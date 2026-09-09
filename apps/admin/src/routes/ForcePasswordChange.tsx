import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/ErrorBanner';
import { useSessionStore } from '../store/useSessionStore';
import styles from './ForcePasswordChange.module.css';

const MIN_LENGTH = 8;

/** Gated by RequireForcedPasswordChange in App.tsx — reached only by an admin-created account still on its temp password. */
export function ForcePasswordChange() {
  const navigate = useNavigate();
  const completePasswordChange = useSessionStore((state) => state.completePasswordChange);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
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

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Set your password</h1>
          <p className={styles.subtitle}>
            You're signed in with a temporary password. Choose a new one to continue to the portal.
          </p>
        </div>

        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder={`At least ${MIN_LENGTH} characters`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <ErrorBanner message={error} />

        <Button type="submit" fullWidth loading={submitting}>
          {submitting ? 'Setting password…' : 'Set password and continue'}
        </Button>
      </form>
    </div>
  );
}
