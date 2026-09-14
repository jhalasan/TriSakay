import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requestPasswordReset } from '@trisakay/services';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/ErrorBanner';
import { useSessionStore } from '../store/useSessionStore';
import { PASSWORD_REQUIREMENTS, passwordPolicyError, passwordStrength } from '../lib/passwordPolicy';
import styles from './ForgotPassword.module.css';

const STRENGTH_LABEL: Record<ReturnType<typeof passwordStrength>, string> = {
  weak: 'Weak',
  fair: 'Fair',
  strong: 'Strong',
};

type Step = 'email' | 'code';

/**
 * Forgot-password flow, reached from Login's "Forgot password?" link. Uses
 * the emailed 6-digit code, not a link: this app has no deep-link handling,
 * so the Supabase project's "Reset Password" email template must include
 * `{{ .Token }}` for the code to actually arrive (see requestPasswordReset
 * in packages/services/src/auth/index.ts) — the dashboard's default template
 * sends a magic link that has nowhere to land here.
 */
export function ForgotPassword() {
  const navigate = useNavigate();
  const confirmPasswordReset = useSessionStore((state) => state.confirmPasswordReset);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const strength = passwordStrength(password);

  async function handleRequestCode(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }

    setError(null);
    setSubmitting(true);
    const { error: requestError } = await requestPasswordReset(email.trim());
    setSubmitting(false);

    // Supabase doesn't reveal whether the email matches an account either way, so this step always advances on success.
    if (requestError) {
      setError(requestError);
      return;
    }
    setStep('code');
  }

  async function handleConfirmReset(e: FormEvent) {
    e.preventDefault();

    if (!code.trim()) {
      setError('Enter the code from your email.');
      return;
    }
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
    const failure = await confirmPasswordReset(email.trim(), code.trim(), password);
    setSubmitting(false);

    if (failure) {
      setError(failure);
      return;
    }
    navigate('/', { replace: true });
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <img src="/brand/trisakay-lockup.png" alt="TriSakay" className={styles.lockup} />

        {step === 'email' ? (
          <>
            <h1 className={styles.title}>Reset your password</h1>
            <p className={styles.subtitle}>Enter your account email and we&apos;ll send a 6-digit code to reset your password.</p>

            <form className={styles.card} onSubmit={handleRequestCode} noValidate>
              <TextField
                label="Email"
                type="email"
                autoComplete="username"
                placeholder="you@gensantos.gov.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={styles.field}
              />

              <ErrorBanner message={error} />

              <Button type="submit" fullWidth loading={submitting} className={styles.submitButton}>
                {submitting ? 'Sending code…' : 'Send reset code'}
              </Button>
            </form>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Enter your code</h1>
            <p className={styles.subtitle}>
              We sent a 6-digit code to <strong>{email}</strong>. Enter it below along with your new password.
            </p>

            <form className={styles.card} onSubmit={handleConfirmReset} noValidate>
              <TextField
                label="Reset code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className={styles.field}
              />

              <hr className={styles.rule} />

              <TextField
                label="New password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={styles.field}
              />
              <TextField
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={styles.field}
              />

              <div className={styles.strengthRow}>
                <div className={styles.strengthTrack}>
                  <div className={`${styles.strengthFill} ${styles[`strength-${strength}`]}`} />
                </div>
                <span className={`${styles.strengthLabel} ${styles[`strength-${strength}`]}`}>{STRENGTH_LABEL[strength]}</span>
              </div>

              <div className={styles.requirements}>
                {PASSWORD_REQUIREMENTS.map((req) => (
                  <span key={req.key} className={`${styles.requirement} ${req.met(password) ? styles.requirementMet : ''}`}>
                    {req.label}
                  </span>
                ))}
              </div>

              <ErrorBanner message={error} />

              <Button type="submit" fullWidth loading={submitting} className={styles.submitButton}>
                {submitting ? 'Resetting…' : 'Reset password and sign in'}
              </Button>

              <button type="button" className={styles.resendButton} onClick={() => setStep('email')}>
                Use a different email or resend the code
              </button>
            </form>
          </>
        )}

        <Link to="/login" className={styles.backLink}>
          &larr; Back to log in
        </Link>
      </main>
    </div>
  );
}
