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

/** Reads whether the signed-in user has a verified authenticator factor and whether this session still owes a code. */
export async function getMfaStatus(): Promise<MfaStatus> {
  const mfa = getSupabaseClient().auth.mfa;
  const [factors, level] = await Promise.all([mfa.listFactors(), mfa.getAuthenticatorAssuranceLevel()]);
  const verified = (factors.data?.totp ?? []).find((factor) => factor.status === 'verified');
  const needsChallenge = !!verified && level.data?.currentLevel === 'aal1' && level.data?.nextLevel === 'aal2';
  return { enrolled: !!verified, factorId: verified?.id ?? null, needsChallenge };
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
  const rows = (data ?? []) as Array<{ id: string; created_at: string; updated_at: string; user_agent: string | null; is_current: boolean }>;
  return {
    sessions: rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
