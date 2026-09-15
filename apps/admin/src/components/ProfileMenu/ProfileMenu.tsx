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
  const changeOwnPassword = useSessionStore((state) => state.changeOwnPassword);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [editingName, setEditingName] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // P1-10 (2026-09-15 launch audit): tagged by which field the error belongs
  // to, rather than string-matching the message against a recomputed
  // policy check — the field's current value can drift from what produced
  // the error, which made the old string-comparison approach fragile.
  const [passwordError, setPasswordError] = useState<{ field: 'current' | 'new' | 'confirm'; message: string } | null>(
    null,
  );
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
    setCurrentPassword('');
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
    setCurrentPassword('');
    setPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setChangingPassword(true);
  }

  async function handleSavePassword() {
    if (!currentPassword) {
      setPasswordError({ field: 'current', message: 'Enter your current password.' });
      return;
    }
    const policyError = passwordPolicyError(password);
    if (policyError) {
      setPasswordError({ field: 'new', message: policyError });
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError({ field: 'confirm', message: 'Passwords do not match.' });
      return;
    }

    setSavingPassword(true);
    const failure = await changeOwnPassword(currentPassword, password);
    setSavingPassword(false);

    if (failure) {
      // changeOwnPassword only fails this early on the current-password
      // check (verifyCurrentPassword's message) or a server-side rejection
      // of the new password — attribute anything else to the new-password
      // field rather than silently dropping it.
      setPasswordError({ field: failure === 'Current password is incorrect.' ? 'current' : 'new', message: failure });
      return;
    }
    setPasswordError(null);
    setChangingPassword(false);
    setCurrentPassword('');
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
                {/* P1-10 (2026-09-15 launch audit): current-password
                    re-verification, so an already-open, unattended session
                    can't change the account password with no proof of
                    knowing the existing one. */}
                <TextField
                  type="password"
                  placeholder="Current password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  error={passwordError?.field === 'current' ? passwordError.message : undefined}
                  autoFocus
                />
                <TextField
                  type="password"
                  placeholder="At least 10 characters"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={passwordError?.field === 'new' ? passwordError.message : undefined}
                />
                <TextField
                  type="password"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={passwordError?.field === 'confirm' ? passwordError.message : undefined}
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
