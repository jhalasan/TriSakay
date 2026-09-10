import { useEffect, useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { Select } from '../components/Select';
import { ConfirmModal } from '../components/ConfirmModal';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { usePsoUsersStore } from '../store/usePsoUsersStore';
import type { PsoUserRow } from '../types/psoUser';
import { ROLE_LABELS } from '../lib/rbac';
import type { AdminRole } from '../types/role';
import { formatDateTime } from '../lib/format';
import styles from './PsoUsers.module.css';

const ROLE_TONE: Record<AdminRole, 'info' | 'warn' | 'neutral'> = {
  admin: 'info',
  pso_supervisor: 'warn',
  pso_staff: 'neutral',
};

type PendingActionKind = 'disable' | 'enable';
interface PendingAction {
  user: PsoUserRow;
  kind: PendingActionKind;
}

/** A signed-up account with no recorded sign-in yet — distinct from Active/Inactive, both of which imply the account has been used at least once. */
function isInvited(u: PsoUserRow): boolean {
  return u.isActive && u.lastSignInAt === null;
}

/**
 * Wireframe screen 9 "User management" — PSO staff & roles (FR-6.3).
 * Admin-only screen; route access is gated in App.tsx. Restyled per README
 * §09 — inline invite form above the roster, one-time temp-password
 * callout. "Sessions" (session/device visibility + revocation) predates
 * this redesign and isn't in the mock's Actions column, but it's real,
 * shipped functionality — kept alongside Disable/Enable rather than
 * dropped to match the screenshot.
 */
export function PsoUsers() {
  const {
    users,
    loading,
    error,
    createdTempPassword,
    fetch,
    addUser,
    clearTempPassword,
    disable,
    enable,
    sessions,
    sessionsLoading,
    fetchSessions,
    revokeSession,
  } = usePsoUsersStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('pso_staff');
  const [creating, setCreating] = useState(false);
  const [createdEmail, setCreatedEmail] = useState('');

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [sessionsUser, setSessionsUser] = useState<PsoUserRow | null>(null);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetch();
  }, [fetch]);

  const roleCount = useMemo(() => new Set(users.map((u) => u.role)).size, [users]);

  async function handleAdd() {
    if (!fullName.trim() || !email.trim()) return;
    setCreating(true);
    const ok = await addUser({ fullName, email, role });
    setCreating(false);
    if (ok) {
      setCreatedEmail(email);
      setFullName('');
      setEmail('');
      setRole('pso_staff');
    }
  }

  function closeActionModal() {
    setPendingAction(null);
    setReason('');
  }

  async function handleConfirmAction() {
    if (!pendingAction) return;
    setSubmitting(true);
    const ok = await (pendingAction.kind === 'disable' ? disable : enable)(pendingAction.user.id, reason);
    setSubmitting(false);
    if (!ok) return;
    showToast({ message: `${pendingAction.user.fullName} ${pendingAction.kind === 'disable' ? 'disabled' : 'enabled'}.` });
    closeActionModal();
  }

  function openSessions(u: PsoUserRow) {
    setSessionsUser(u);
    fetchSessions(u.id);
  }

  async function handleConfirmRevoke() {
    if (!pendingRevokeId || !sessionsUser) return;
    setRevoking(true);
    const ok = await revokeSession(pendingRevokeId, sessionsUser.id);
    setRevoking(false);
    if (!ok) return;
    showToast({ message: 'Session revoked.' });
    setPendingRevokeId(null);
  }

  const columns: DataTableColumn<PsoUserRow>[] = [
    { key: 'name', header: 'Name', width: '220px', sortValue: (u) => u.fullName, render: (u) => <span style={{ fontWeight: 600 }}>{u.fullName}</span> },
    { key: 'email', header: 'Email', width: '260px', render: (u) => u.email },
    { key: 'role', header: 'Role', width: '130px', render: (u) => <Badge label={ROLE_LABELS[u.role]} tone={ROLE_TONE[u.role]} /> },
    {
      key: 'lastSignIn',
      header: 'Last sign-in',
      width: '160px',
      sortValue: (u) => u.lastSignInAt ?? '',
      render: (u) => <span className="mono" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{u.lastSignInAt ? formatDateTime(u.lastSignInAt) : 'Never'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (u) =>
        isInvited(u) ? (
          <Badge label="Invited" tone="warn" />
        ) : (
          <Badge label={u.isActive ? 'Active' : 'Inactive'} tone={u.isActive ? 'success' : 'neutral'} />
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '190px',
      render: (u) => (
        <div className="row-actions">
          <Button variant="outline" tone="neutral" size="sm" onClick={() => openSessions(u)}>
            Sessions
          </Button>
          <Button
            variant="outline"
            tone={u.isActive ? 'danger' : 'primary'}
            size="sm"
            onClick={() => setPendingAction({ user: u, kind: u.isActive ? 'disable' : 'enable' })}
          >
            {u.isActive ? 'Disable' : 'Enable'}
          </Button>
        </div>
      ),
    },
  ];

  if (error && users.length === 0 && !loading) {
    return (
      <div className="page">
        <EmptyState
          message="Couldn't load PSO accounts."
          hint={error}
          tone="danger"
          action={
            <Button variant="outline" tone="neutral" size="sm" onClick={fetch}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  const formError = !pendingAction && !pendingRevokeId ? error : null;

  return (
    <div className="page">
      {createdTempPassword && (
        <div className={`panel ${styles.tempPasswordCallout}`}>
          <div>
            <h2 className="panel-title" style={{ marginBottom: 2 }}>
              Account created for {createdEmail}
            </h2>
            <p className={styles.tempPasswordHint}>Share this temporary password directly — it will not be shown again and no email was sent.</p>
          </div>
          <div className={styles.tempPasswordRow}>
            <code className={styles.tempPasswordValue}>{createdTempPassword}</code>
            <Button variant="outline" tone="neutral" size="sm" onClick={() => navigator.clipboard?.writeText(createdTempPassword)}>
              Copy
            </Button>
            <Button variant="solid" tone="primary" size="sm" onClick={clearTempPassword}>
              Done
            </Button>
          </div>
        </div>
      )}

      <div className={`panel ${styles.inviteForm}`}>
        <TextField label="Full Name" placeholder="e.g. Jonalyn Carreon" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <TextField label="Work Email" type="email" placeholder="name@gensantos.gov.ph" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Select
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as AdminRole)}
          options={[
            { label: 'PSO Staff', value: 'pso_staff' },
            { label: 'PSO Supervisor', value: 'pso_supervisor' },
            { label: 'Administrator', value: 'admin' },
          ]}
        />
        <Button onClick={handleAdd} loading={creating} disabled={!fullName.trim() || !email.trim()}>
          {creating ? 'Adding…' : 'Add PSO user'}
        </Button>
        {formError && (
          <div className={styles.formErrorRow}>
            <ErrorBanner message={formError} />
          </div>
        )}
      </div>

      <div className="panel">
        <div className="pane-header">
          <h2 className="panel-title" style={{ marginBottom: 0 }}>
            PSO accounts
          </h2>
          <Badge label={`${users.length} accounts · ${roleCount} roles`} tone="neutral" />
        </div>
        <DataTable
          columns={columns}
          rows={users}
          getRowKey={(u) => u.id}
          loading={loading}
          emptyMessage="No PSO accounts yet."
          emptyHint="Accounts you add above appear here."
          maxWidth={1080}
        />
      </div>
      <p className={styles.policyNote}>
        PSO Staff triage and review. PSO Supervisor adds approve, reject, suspend and block. Administrator adds these two screens.
        Disabling an account requires a reason and is written to the audit log.
      </p>

      {sessionsUser && (
        <div className="panel detail-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="panel-title">Sessions: {sessionsUser.fullName}</h2>
            <Button variant="outline" tone="neutral" size="sm" onClick={() => setSessionsUser(null)}>
              Close
            </Button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0 }}>
            A password change or Disable doesn't sign an active session out — revoke a session here to do that immediately.
          </p>
          {sessionsLoading && <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Loading…</span>}
          {!sessionsLoading && sessions.length === 0 && (
            <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>No active sessions.</span>
          )}
          {!sessionsLoading &&
            sessions.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 0',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <div style={{ fontSize: 12 }}>
                  <div>Started {formatDateTime(s.createdAt)} — last active {formatDateTime(s.updatedAt)}</div>
                  <div style={{ color: 'var(--ink-faint)' }}>
                    {s.ip ?? 'Unknown IP'} · {s.userAgent ?? 'Unknown device'}
                  </div>
                </div>
                <Button variant="outline" tone="danger" size="sm" onClick={() => setPendingRevokeId(s.id)}>
                  Revoke
                </Button>
              </div>
            ))}
        </div>
      )}

      {pendingRevokeId && (
        <ConfirmModal
          title="Revoke session"
          message="Sign this session out immediately? The account will need to sign in again on that device."
          confirmLabel="Revoke"
          tone="danger"
          confirmLoading={revoking}
          error={error}
          onCancel={() => setPendingRevokeId(null)}
          onConfirm={handleConfirmRevoke}
        />
      )}

      {pendingAction && (
        <ConfirmModal
          title={pendingAction.kind === 'disable' ? 'Disable PSO account' : 'Enable PSO account'}
          message={
            pendingAction.kind === 'disable'
              ? `Disable ${pendingAction.user.fullName}'s account? They won't be able to sign in to the admin portal until re-enabled.`
              : `Re-enable ${pendingAction.user.fullName}'s account?`
          }
          confirmLabel={pendingAction.kind === 'disable' ? 'Disable' : 'Enable'}
          tone={pendingAction.kind === 'disable' ? 'danger' : 'primary'}
          reasonRequired
          reason={reason}
          onReasonChange={setReason}
          confirmLoading={submitting}
          error={error}
          onCancel={closeActionModal}
          onConfirm={handleConfirmAction}
        />
      )}
    </div>
  );
}
