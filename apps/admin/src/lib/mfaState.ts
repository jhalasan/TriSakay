export type MfaStep = 'enroll' | 'challenge' | 'ok';

/** Staff MFA is mandatory: no factor means enrol; a factor but no code entered this session means challenge. */
export function nextMfaStep(status: { enrolled: boolean; needsChallenge: boolean }): MfaStep {
  if (!status.enrolled) return 'enroll';
  return status.needsChallenge ? 'challenge' : 'ok';
}
