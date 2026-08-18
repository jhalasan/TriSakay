import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { useSessionStore } from '../store/useSessionStore';
import styles from './Login.module.css';

/**
 * Wireframe screen 1 "Admin log in" — visual redesign only (split-screen,
 * premium presentation). Auth wiring is unchanged: useSessionStore.signIn()
 * still authenticates against auth.users, reads users.role, and rejects
 * (signs back out) any role outside pso_staff/pso_supervisor/admin.
 */
export function Login() {
  const navigate = useNavigate();
  const signIn = useSessionStore((state) => state.signIn);
  const error = useSessionStore((state) => state.error);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const ok = await signIn(email, password);
    setSubmitting(false);
    if (ok) navigate('/', { replace: true });
  }

  return (
    <div className={styles.page}>
      <aside className={styles.brandPanel}>
        <svg className={styles.routeArt} viewBox="0 0 480 640" fill="none" aria-hidden="true">
          <path
            d="M-20 120 C 90 90, 120 210, 230 190 S 360 90, 470 140"
            stroke="white"
            strokeOpacity="0.14"
            strokeWidth="2.5"
            strokeDasharray="1 14"
            strokeLinecap="round"
          />
          <path
            d="M-30 340 C 70 300, 150 420, 250 380 S 420 300, 500 360"
            stroke="white"
            strokeOpacity="0.1"
            strokeWidth="2.5"
            strokeDasharray="1 14"
            strokeLinecap="round"
          />
          <path
            d="M-10 540 C 100 500, 160 600, 260 560 S 400 480, 490 540"
            stroke="white"
            strokeOpacity="0.08"
            strokeWidth="2.5"
            strokeDasharray="1 14"
            strokeLinecap="round"
          />
          <circle cx="230" cy="190" r="4" fill="white" fillOpacity="0.3" />
          <circle cx="250" cy="380" r="4" fill="white" fillOpacity="0.22" />
        </svg>

        <div className={styles.brandContent}>
          <img src="/brand/trisakay-lockup.png" alt="TriSakay" className={styles.brandLogo} />
          <h1 className={styles.brandHeadline}>PSO Operations Portal</h1>
          <p className={styles.brandTagline}>
            Real-time oversight for tricycle operations, driver verification, and passenger
            safety across General Santos City.
          </p>
        </div>

        <div className={styles.brandFooter}>TriSakay &middot; PSO Portal</div>
      </aside>

      <main className={styles.formPanel}>
        <div className={styles.formPanelInner}>
          <img src="/brand/trisakay-mark.png" alt="TriSakay" className={styles.mobileMark} />

          <form className={styles.card} onSubmit={handleSubmit} noValidate>
            <div className={styles.brandRow}>
              <h2 className={styles.brandTitle}>Welcome back</h2>
              <p className={styles.brandSub}>Sign in to manage TriSakay operations.</p>
            </div>

            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              placeholder="you@gensantos.gov.ph"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              endAdornment={
                <button
                  type="button"
                  className={styles.eyeToggle}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                >
                  {showPassword ? (
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
              }
            />

            {error && (
              <div className={styles.error} role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={styles.errorIcon}>
                  <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M12 7.5v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="12" cy="16.5" r="1" fill="currentColor" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" fullWidth loading={submitting}>
              {submitting ? 'Signing in…' : 'Log in'}
            </Button>

            <p className={styles.accessNote}>Access is restricted to authorized PSO personnel.</p>
          </form>
        </div>
      </main>
    </div>
  );
}
