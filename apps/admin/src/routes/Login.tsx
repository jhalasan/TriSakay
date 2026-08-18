import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { useSessionStore } from '../store/useSessionStore';
import styles from './Login.module.css';

/**
 * Wireframe screen 1 "Admin log in" — centered card, EMAIL/PASSWORD, Log in.
 * Real Supabase Auth: useSessionStore.signIn() authenticates against
 * auth.users, reads users.role, and rejects (signs back out) any role
 * outside pso_staff/pso_supervisor/admin — this app is PSO-portal only.
 */
export function Login() {
  const navigate = useNavigate();
  const signIn = useSessionStore((state) => state.signIn);
  const error = useSessionStore((state) => state.error);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      <div className={styles.badge}>
        <img src="/brand/trisakay-lockup.png" alt="TriSakay" className={styles.logo} />
      </div>

      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.brandRow}>
          <div className={styles.brandTitle}>Log in</div>
          <div className={styles.brandSub}>PSO Staff / Supervisor / Administrator</div>
        </div>

        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <div className={styles.error}>{error}</div>}

        <Button type="submit" fullWidth loading={submitting}>
          Log in
        </Button>
      </form>
    </div>
  );
}
