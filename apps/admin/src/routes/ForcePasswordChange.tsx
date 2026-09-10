import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { ErrorBanner } from '../components/ErrorBanner';
import { useSessionStore } from '../store/useSessionStore';
import { ROLE_LABELS } from '../lib/rbac';
import { PASSWORD_REQUIREMENTS, passwordPolicyError, passwordStrength } from '../lib/passwordPolicy';
import styles from './ForcePasswordChange.module.css';

const STRENGTH_LABEL: Record<ReturnType<typeof passwordStrength>, string> = {
  weak: 'Weak',
  fair: 'Fair',
  strong: 'Strong',
};

function EyeToggle({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={styles.eyeToggle}
      onClick={onClick}
      aria-label={shown ? 'Hide password' : 'Show password'}
      aria-pressed={shown}
      tabIndex={-1}
    >
      {shown ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 3l18 18M10.6 10.6a2.5 2.5 0 003.53 3.54M9.36 5.6A10.6 10.6 0 0112 5.25c5.5 0 9.5 4.5 10.75 6.75-.52.94-1.68 2.7-3.42 4.24M6.6 6.83C4.6 8.24 3.1 10.1 1.25 12c1.25 2.25 5.25 6.75 10.75 6.75 1.14 0 2.2-.19 3.17-.52"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M1.25 12C2.5 9.75 6.5 5.25 12 5.25S21.5 9.75 22.75 12c-1.25 2.25-5.25 6.75-10.75 6.75S2.5 14.25 1.25 12z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )}
    </button>
  );
}

/** Gated by RequireForcedPasswordChange in App.tsx — reached only by an admin-created account still on its temp password. */
export function ForcePasswordChange() {
  const navigate = useNavigate();
  const user = useSessionStore((state) => state.user);
  const signOut = useSessionStore((state) => state.signOut);
  const completePasswordChange = useSessionStore((state) => state.completePasswordChange);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const strength = passwordStrength(password);

  async function handleCancelSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const policyError = passwordPolicyError(password);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setSubmitting(true);
    const failure = await completePasswordChange(password);
    setSubmitting(false);

    if (failure) {
      setError(failure);
      return;
    }
    navigate('/', { replace: true });
  }

  if (!user) return null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <img src="/brand/trisakay-lockup.png" alt="TriSakay" className={styles.headerLockup} />
        <div className={styles.headerRight}>
          <span className={styles.headerEmail}>{user.email}</span>
          <button type="button" className={styles.cancelButton} onClick={handleCancelSignOut}>
            Cancel and sign out
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.iconTile}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="8" cy="15" r="4.3" />
            <path d="M11 12l9-9M16.5 6.5l2.5 2.5M20 3l2 2" />
          </svg>
        </div>
        <h1 className={styles.title}>Set your own password</h1>
        <p className={styles.subtitle}>
          Your temporary password was issued once and shared outside the portal, so it can&apos;t stay on the
          account. Choose a password only you know — you won&apos;t be asked again.
        </p>

        <form className={styles.card} onSubmit={handleSubmit} noValidate>
          <div className={styles.headBand}>
            <Avatar fullName={user.fullName} size={34} />
            <div className={styles.headBandText}>
              <span className={styles.headBandName}>{user.fullName}</span>
              <span className={styles.headBandMeta}>{ROLE_LABELS[user.role]}</span>
            </div>
            <Badge label="First sign-in" tone="info" />
          </div>

          <div className={styles.body}>
            <TextField
              label="Temporary password"
              value="••••••••••"
              readOnly
              tabIndex={-1}
              hint="The one-time password your Administrator gave you."
              className={styles.field}
            />

            <hr className={styles.rule} />

            <div className={styles.twoCol}>
              <TextField
                label="New password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={styles.field}
                endAdornment={<EyeToggle shown={showPassword} onClick={() => setShowPassword((v) => !v)} />}
              />
              <TextField
                label="Confirm new password"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={styles.field}
                endAdornment={<EyeToggle shown={showConfirm} onClick={() => setShowConfirm((v) => !v)} />}
              />
            </div>

            <div className={styles.strengthRow}>
              <div className={styles.strengthTrack}>
                <div className={`${styles.strengthFill} ${styles[`strength-${strength}`]}`} />
              </div>
              <span className={`${styles.strengthLabel} ${styles[`strength-${strength}`]}`}>{STRENGTH_LABEL[strength]}</span>
            </div>

            <div className={styles.requirements}>
              <span className={styles.requirementsLabel}>Requirements</span>
              <div className={styles.requirementsGrid}>
                {PASSWORD_REQUIREMENTS.map((req) => {
                  const met = req.met(password);
                  return (
                    <span key={req.key} className={`${styles.requirement} ${met ? styles.requirementMet : ''}`}>
                      {met ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" />
                          <path d="M7.5 12.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                        </svg>
                      )}
                      {req.label}
                    </span>
                  );
                })}
              </div>
            </div>

            <ErrorBanner message={error} />

            <Button type="submit" fullWidth loading={submitting} className={styles.submitButton}>
              {submitting ? 'Setting password…' : 'Set password and continue'}
            </Button>
          </div>
        </form>

        <p className={styles.footnote}>
          You&apos;ll go straight to the dashboard. The temporary password stops working immediately, and the
          change is written to the audit log.
        </p>
      </main>
    </div>
  );
}
