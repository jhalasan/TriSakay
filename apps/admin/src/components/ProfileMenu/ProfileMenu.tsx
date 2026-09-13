import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { TextField } from '../TextField';
import { useToast } from '../Toast';
import { useSessionStore } from '../../store/useSessionStore';
import { ROLE_LABELS } from '../../lib/rbac';
import { passwordPolicyError } from '../../lib/passwordPolicy';
import styles from './ProfileMenu.module.css';

export interface ProfileMenuProps {
  onLogoutClick: () => void;
}

/** Avatar-triggered popover — every signed-in PSO user's own account: name, email, role, edit name, change password, log out. */
export function ProfileMenu({ onLogoutClick }: ProfileMenuProps) {
  const user = useSessionStore((state) => state.user);
  const updateName = useSessionStore((state) => state.updateName);
  const completePasswordChange = useSessionStore((state) => state.completePasswordChange);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [editingName, setEditingName] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  const [changingPassword, setChangingPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!user) return null;

  function close() {
    setOpen(false);
    setEditingName(false);
    setChangingPassword(false);
    setNameError(null);
    setPasswordError(null);
    setPassword('');
    setConfirmPassword('');
  }

  function startEditingName() {
    setFirstName(user!.firstName);
    setLastName(user!.lastName);
    setNameError(null);
    setEditingName(true);
  }

  async function handleSaveName() {
    setSavingName(true);
    const failure = await updateName(firstName, lastName);
    setSavingName(false);

    if (failure) {
      setNameError(failure);
      return;
    }
    setNameError(null);
    setEditingName(false);
    showToast({ message: 'Name updated.' });
  }

  function startChangingPassword() {
    setPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setChangingPassword(true);
  }

  async function handleSavePassword() {
    const policyError = passwordPolicyError(password);
    if (policyError) {
      setPasswordError(policyError);
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setSavingPassword(true);
    const failure = await completePasswordChange(password);
    setSavingPassword(false);

    if (failure) {
      setPasswordError(failure);
      return;
    }
    setPasswordError(null);
    setChangingPassword(false);
    setPassword('');
    setConfirmPassword('');
    showToast({ message: 'Password updated.' });
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Avatar fullName={user.fullName} size={30} />
        <span className={styles.triggerText}>
          <span className={styles.triggerName}>{user.fullName}</span>
          <span className={styles.triggerRole}>{ROLE_LABELS[user.role]}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={styles.chevron}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className={styles.panel} role="menu">
          <div className={styles.identity}>
            <Avatar fullName={user.fullName} size={38} />
            <div className={styles.identityText}>
              <span className={styles.name}>{user.fullName}</span>
              <span className={styles.email}>{user.email}</span>
            </div>
          </div>
          <span className={styles.roleBand}>{ROLE_LABELS[user.role]}</span>

          <div className={styles.section}>
            <div className={styles.sectionRow}>
              <span className={styles.sectionLabel}>Name</span>
              {!editingName && (
                <button type="button" className={styles.linkButton} onClick={startEditingName}>
                  Edit
                </button>
              )}
            </div>
            {editingName ? (
              <div className={styles.form}>
                <TextField
                  label="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  error={nameError ?? undefined}
                  autoFocus
                />
                <TextField label="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                <div className={styles.formActions}>
                  <Button variant="outline" tone="neutral" size="sm" onClick={() => setEditingName(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" loading={savingName} onClick={handleSaveName}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <span className={styles.sectionValue}>{user.fullName}</span>
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionRow}>
              <span className={styles.sectionLabel}>Password</span>
              {!changingPassword && (
                <button type="button" className={styles.linkButton} onClick={startChangingPassword}>
                  Change
                </button>
              )}
            </div>
            {changingPassword ? (
              <div className={styles.form}>
                <TextField
                  type="password"
                  placeholder="At least 10 characters"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={passwordError && passwordError !== 'Passwords do not match.' ? passwordError : undefined}
                  autoFocus
                />
                <TextField
                  type="password"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={passwordError === 'Passwords do not match.' ? passwordError : undefined}
                />
                <div className={styles.formActions}>
                  <Button variant="outline" tone="neutral" size="sm" onClick={() => setChangingPassword(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" loading={savingPassword} onClick={handleSavePassword}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              // No password-last-changed date is tracked anywhere in this app's
              // schema (see Phase 2 notes) — shown as a quiet placeholder rather
              // than a fabricated date.
              <span className={styles.sectionValue}>Not tracked</span>
            )}
          </div>

          <div className={styles.logoutRow}>
            <Button variant="outline" tone="danger" fullWidth onClick={onLogoutClick}>
              Log out
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
