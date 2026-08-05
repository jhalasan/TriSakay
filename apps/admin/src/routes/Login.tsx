import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { Avatar } from '../components/Avatar';
import { useSessionStore } from '../store/useSessionStore';
import styles from './Login.module.css';

/**
 * Wireframe screen 1 "Admin log in" — centered card, EMAIL/PASSWORD, Log in.
 * Frontend-only this pass: useSessionStore.signIn() accepts any non-empty
 * credentials and signs in as the PSO Supervisor persona. Real Supabase
 * Auth + users.role lookup is docs/ADMIN_TODO.MD F1.
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
    await signIn(email, password);
    setSubmitting(false);
    if (useSessionStore.getState().isAuthenticated) {
      navigate('/', { replace: true });
    }
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.brandRow}>
          <Avatar fullName="TriSakay Admin" size={44} />
          <div>
            <div className={styles.brandTitle}>TriSakay Admin</div>
            <div className={styles.brandSub}>PSO Staff / Supervisor / Administrator</div>
          </div>
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
