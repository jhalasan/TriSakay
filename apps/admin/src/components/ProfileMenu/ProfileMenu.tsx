import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../Avatar';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { TextField } from '../TextField';
import { ErrorBanner } from '../ErrorBanner';
import { useSessionStore } from '../../store/useSessionStore';
import { ROLE_LABELS } from '../../lib/rbac';
import styles from './ProfileMenu.module.css';

const MIN_PASSWORD_LENGTH = 8;

export interface ProfileMenuProps {
  onLogoutClick: () => void;
}

/** Avatar-triggered popover — every signed-in PSO user's own account: name, email, role, edit name, change password, log out. */
export function ProfileMenu({ onLogoutClick }: ProfileMenuProps) {
  const user = useSessionStore((state) => state.user);
  const updateFullName = useSessionStore((state) => state.updateFullName);
  const completePasswordChange = useSessionStore((state) => state.completePasswordChange);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [editingName, setEditingName] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  const [changingPassword, setChangingPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    setSuccessMessage(null);
    setPassword('');
    setConfirmPassword('');
  }

  function startEditingName() {
    setFullName(user!.fullName);
    setNameError(null);
    setSuccessMessage(null);
    setEditingName(true);
  }

  async function handleSaveName() {
    setSavingName(true);
    const failure = await updateFullName(fullName);
    setSavingName(false);

    if (failure) {
      setNameError(failure);
      return;
    }
    setNameError(null);
    setEditingName(false);
    setSuccessMessage('Name updated.');
  }

  function startChangingPassword() {
    setPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setSuccessMessage(null);
    setChangingPassword(true);
  }

  async function handleSavePassword() {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
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
    setSuccessMessage('Password updated.');
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
        <span className={styles.triggerName}>{user.fullName}</span>
      </button>

      {open && (
        <div className={styles.panel} role="menu">
          <div className={styles.identity}>
            <Avatar fullName={user.fullName} size={40} />
            <div className={styles.identityText}>
              <span className={styles.name}>{user.fullName}</span>
              <span className={styles.email}>{user.email}</span>
            </div>
          </div>
          <Badge label={ROLE_LABELS[user.role]} tone="info" />

          {successMessage && <div className={styles.success}>{successMessage}</div>}

          <hr className={styles.divider} />

          <div className={styles.section}>
            <div className={styles.sectionRow}>
              <span className={styles.sectionLabel}>Name</span>
              {!editingName && (
                <button type="button" className={styles.linkButton} onClick={startEditingName}>
                  Edit
                </button>
              )}
            </div>
            {editingName && (
              <div className={styles.form}>
                <TextField value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
                <ErrorBanner message={nameError} />
                <div className={styles.formActions}>
                  <Button variant="outline" tone="neutral" size="sm" onClick={() => setEditingName(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" loading={savingName} onClick={handleSaveName}>
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>

          <hr className={styles.divider} />

          <div className={styles.section}>
            <div className={styles.sectionRow}>
              <span className={styles.sectionLabel}>Password</span>
              {!changingPassword && (
                <button type="button" className={styles.linkButton} onClick={startChangingPassword}>
                  Change
                </button>
              )}
            </div>
            {changingPassword && (
              <div className={styles.form}>
                <TextField
                  type="password"
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
                <TextField
                  type="password"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <ErrorBanner message={passwordError} />
                <div className={styles.formActions}>
                  <Button variant="outline" tone="neutral" size="sm" onClick={() => setChangingPassword(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" loading={savingPassword} onClick={handleSavePassword}>
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>

          <hr className={styles.divider} />

          <Button variant="outline" tone="danger" size="sm" onClick={onLogoutClick}>
            Log out
          </Button>
        </div>
      )}
    </div>
  );
}
