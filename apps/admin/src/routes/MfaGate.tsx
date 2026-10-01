import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { confirmMfaEnrollment, getMfaStatus, startMfaEnrollment, verifyMfaCode } from '@trisakay/services';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/ErrorBanner';
import { useSessionStore } from '../store/useSessionStore';
import styles from './MfaGate.module.css';

interface Enrollment {
  factorId: string;
  secret: string;
  qrCode: string;
}

/**
 * Staff MFA is required. Until a code has been entered this session the portal stays closed (RequireMfa in
 * App.tsx). Two modes, driven by the session store: 'enroll' (first time: scan the QR, confirm a code) and
 * 'challenge' (every later sign-in: enter the current code).
 */
export function MfaGate() {
  const navigate = useNavigate();
  const user = useSessionStore((state) => state.user);
  const mfaStep = useSessionStore((state) => state.mfaStep);
  const refreshMfa = useSessionStore((state) => state.refreshMfa);
  const signOut = useSessionStore((state) => state.signOut);

  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Enrol mode: ask for a new factor and its QR code. Challenge mode: find the existing factor.
  useEffect(() => {
    let cancelled = false;
    setError(null);

    if (mfaStep === 'enroll') {
      startMfaEnrollment().then((result) => {
        if (cancelled) return;
        if (result.error || !result.factorId || !result.secret || !result.qrCode) {
          setError("MFA setup isn't available right now. Try again later.");
          return;
        }
        setEnrollment({ factorId: result.factorId, secret: result.secret, qrCode: result.qrCode });
      });
    } else if (mfaStep === 'challenge') {
      getMfaStatus()
        .then((status) => {
          if (cancelled) return;
          if (status.factorId) setFactorId(status.factorId);
          else void refreshMfa(); // the factor is gone (reset by another admin): re-evaluate, which sends this user to enrol
        })
        .catch(() => {
          if (!cancelled) setError("Couldn't reach the server. Check your connection and try again.");
        });
    }

    return () => {
      cancelled = true;
    };
  }, [mfaStep, refreshMfa]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const id = mfaStep === 'enroll' ? enrollment?.factorId : factorId;
    if (!id || code.length !== 6) return;

    setError(null);
    setSubmitting(true);
    const { error: failure } = mfaStep === 'enroll' ? await confirmMfaEnrollment(id, code) : await verifyMfaCode(id, code);
    if (failure) {
      setSubmitting(false);
      setError("That code didn't work. Check it and try again.");
      return;
    }
    await refreshMfa();
    setSubmitting(false);
    navigate('/', { replace: true });
  }

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  if (!user) return null;

  const enrolling = mfaStep === 'enroll';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <img src="/brand/trisakay-lockup.png" alt="TriSakay" className={styles.headerLockup} />
        <div className={styles.headerRight}>
          <span className={styles.headerEmail}>{user.email}</span>
          <button type="button" className={styles.cancelButton} onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <h1 className={styles.title}>{enrolling ? 'Set up MFA' : 'Enter your code'}</h1>
        <p className={styles.subtitle}>
          {enrolling
            ? 'Staff accounts need multi-factor authentication. Scan the code with an authenticator app (such as Google Authenticator), then enter the 6-digit code it shows.'
            : 'Open your authenticator app and enter the 6-digit code for TriSakay.'}
        </p>

        <form className={styles.card} onSubmit={handleSubmit} noValidate>
          <div className={styles.body}>
            {enrolling && enrollment && (
              <div className={styles.qrBlock}>
                <img src={enrollment.qrCode} alt="MFA QR code" className={styles.qr} />
                <span className={styles.secretLabel}>Can&apos;t scan? Type this key into the app</span>
                <code className={styles.secret}>{enrollment.secret}</code>
              </div>
            )}

            <TextField
              label="6-digit code"
              hint="The code changes every 30 seconds."
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ''));
                setError(null);
              }}
              className={styles.field}
            />

            <ErrorBanner message={error} />

            <Button type="submit" fullWidth loading={submitting} disabled={code.length !== 6} className={styles.submitButton}>
              {enrolling ? 'Turn on MFA' : 'Verify'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
