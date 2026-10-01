import { updatePassword, verifyPasswordReset } from '../auth/index.ts';
import { getSupabaseClient } from '../supabase/client.ts';

export interface AccountSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  userAgent: string | null;
  isCurrent: boolean;
}

export interface MfaStatus {
  enrolled: boolean;
  factorId: string | null;
  /** True when a verified factor exists but this session has only passed the password step (aal1). */
  needsChallenge: boolean;
}

/**
 * Reads whether the signed-in user has a verified authenticator factor and whether this session still owes a code.
 * Throws when either read fails, so callers can fail closed instead of mistaking an error for "no MFA".
 */
export async function getMfaStatus(): Promise<MfaStatus> {
  const mfa = getSupabaseClient().auth.mfa;
  const [factors, level] = await Promise.all([mfa.listFactors(), mfa.getAuthenticatorAssuranceLevel()]);
  if (factors.error) throw new Error(factors.error.message);
  if (level.error) throw new Error(level.error.message);
  const verified = (factors.data?.totp ?? []).find((factor) => factor.status === 'verified');
  // Anything short of a confirmed aal2 session counts as owing a code.
  const needsChallenge = !!verified && level.data?.currentLevel !== 'aal2';
  return { enrolled: !!verified, factorId: verified?.id ?? null, needsChallenge };
}

/**
 * The sign-in gate for the mobile apps. Reads the assurance level the session already carries (no network call,
 * so it works offline): 'challenge' only when the password step is done and a verified factor still needs its code.
 */
export async function getMfaGate(): Promise<'ok' | 'challenge'> {
  const { data } = await getSupabaseClient().auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === 'aal1' && data?.nextLevel === 'aal2' ? 'challenge' : 'ok';
}

/**
 * Step 1 of setup: creates an unverified factor and returns the secret (to type or open in an
 * authenticator app) and a QR code. An unverified factor left over from an abandoned attempt is
 * removed first, otherwise Supabase rejects the new enrolment.
 */
export async function startMfaEnrollment(): Promise<{
  factorId: string | null;
  secret: string | null;
  uri: string | null;
  qrCode: string | null;
  error: string | null;
}> {
  const mfa = getSupabaseClient().auth.mfa;
  const existing = await mfa.listFactors();
  for (const factor of existing.data?.all ?? []) {
    if (factor.factor_type === 'totp' && factor.status === 'unverified') await mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await mfa.enroll({ factorType: 'totp' });
  if (error || !data) return { factorId: null, secret: null, uri: null, qrCode: null, error: error?.message ?? 'Could not start setup.' };
  return { factorId: data.id, secret: data.totp.secret, uri: data.totp.uri, qrCode: data.totp.qr_code, error: null };
}

/** Challenge + verify in one step: used for finishing setup, and for the code prompt after a password sign-in. */
export async function verifyMfaCode(factorId: string, code: string): Promise<{ error: string | null }> {
  const mfa = getSupabaseClient().auth.mfa;
  const challenge = await mfa.challenge({ factorId });
  if (challenge.error || !challenge.data) return { error: challenge.error?.message ?? 'Could not start verification.' };
  const { error } = await mfa.verify({ factorId, challengeId: challenge.data.id, code });
  return { error: error ? error.message : null };
}

export const confirmMfaEnrollment = verifyMfaCode;

export async function disableMfa(factorId: string): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().auth.mfa.unenroll({ factorId });
  return { error: error ? error.message : null };
}

export async function listMySessions(): Promise<{ sessions: AccountSession[]; error: string | null }> {
  const { data, error } = await getSupabaseClient().rpc('list_my_sessions');
  if (error) return { sessions: [], error: error.message };
  const rows = (data ?? []) as Array<{ id: string; created_at: string; updated_at: string | null; user_agent: string | null; is_current: boolean }>;
  return {
    sessions: rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
      userAgent: row.user_agent,
      isCurrent: row.is_current,
    })),
    error: null,
  };
}

export async function revokeMySession(sessionId: string): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().rpc('revoke_my_session', { p_session_id: sessionId });
  return { error: error ? error.message : null };
}

export async function signOutOtherDevices(): Promise<void> {
  await getSupabaseClient().auth.signOut({ scope: 'others' });
}

/** Undo a self-deactivation. The RPC refuses accounts the PSO deactivated. */
export async function reactivateOwnAccount(): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().rpc('self_reactivate_account');
  return { error: error ? error.message : null };
}

/** Who performed the last deactivation: the person themself ('self') or PSO staff ('staff'). null when not deactivated. */
export async function getDeactivationOrigin(): Promise<'self' | 'staff' | null> {
  const { data, error } = await getSupabaseClient().rpc('my_deactivation_origin');
  if (error) return null;
  return data === 'self' || data === 'staff' ? data : null;
}

/**
 * Forgot-password, step 1: exchange the emailed code for a recovery session, then say whether the account's MFA
 * still has to be satisfied. Supabase refuses a password change from a password-level session when a verified
 * factor exists, so `mfaFactorId` (non-null) means the person must enter their authenticator code before step 2.
 */
export async function verifyRecovery(input: { email: string; token: string }): Promise<{ error: string | null; mfaFactorId: string | null }> {
  const { error } = await verifyPasswordReset(input);
  if (error) return { error, mfaFactorId: null };
  try {
    const status = await getMfaStatus();
    return { error: null, mfaFactorId: status.needsChallenge ? status.factorId : null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not check MFA.', mfaFactorId: null };
  }
}

/** Forgot-password, step 2: confirm the authenticator code when one is required, and only then set the new password. */
export async function finishRecovery(input: {
  newPassword: string;
  mfaFactorId: string | null;
  mfaCode: string;
}): Promise<{ error: string | null }> {
  if (input.mfaFactorId) {
    const { error } = await verifyMfaCode(input.mfaFactorId, input.mfaCode);
    if (error) return { error };
  }
  return updatePassword(input.newPassword);
}
