import { useEffect, useState } from 'react';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { Select } from '../components/Select';
import { ConfirmModal } from '../components/ConfirmModal';
import { usePsoUsersStore } from '../store/usePsoUsersStore';
import type { PsoUserRow } from '../types/psoUser';
import { ROLE_LABELS } from '../lib/rbac';
import type { AdminRole } from '../types/role';

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

/** Wireframe screen 9 "User management" — PSO staff & roles (FR-6.3). Admin-only screen; route access is gated in App.tsx. */
export function PsoUsers() {
  const { users, loading, error, createdTempPassword, fetch, addUser, clearTempPassword, disable, enable } = usePsoUsersStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('pso_staff');
  const [creating, setCreating] = useState(false);
  const [createdEmail, setCreatedEmail] = useState('');

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch();
  }, [fetch]);

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
      setShowAddForm(false);
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
    if (ok) closeActionModal();
  }

  const columns: DataTableColumn<PsoUserRow>[] = [
    { key: 'name', header: 'Name', sortValue: (u) => u.fullName, render: (u) => u.fullName },
    { key: 'email', header: 'Email', render: (u) => u.email },
    { key: 'role', header: 'Role', render: (u) => <Badge label={ROLE_LABELS[u.role]} tone={ROLE_TONE[u.role]} /> },
    { key: 'status', header: 'Status', render: (u) => <Badge label={u.isActive ? 'Active' : 'Inactive'} tone={u.isActive ? 'success' : 'neutral'} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (u) => (
        <Button
          variant="outline"
          tone={u.isActive ? 'danger' : 'primary'}
          size="sm"
          onClick={() => setPendingAction({ user: u, kind: u.isActive ? 'disable' : 'enable' })}
        >
          {u.isActive ? 'Disable' : 'Enable'}
        </Button>
      ),
    },
  ];

  return (
    <div className="page">
      {error && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--danger)',
            background: 'var(--danger-soft)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--r-sm)',
            padding: 'var(--sp-sm)',
          }}
        >
          {error}
        </div>
      )}

      {createdTempPassword && (
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="panel-title">Account created for {createdEmail}</div>
          <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0 }}>
            Share this temporary password with them directly — it won't be shown again, and no email was sent.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code
              style={{
                fontFamily: 'monospace',
                fontSize: 14,
                background: 'var(--surface-alt, #f4f4f4)',
                padding: '6px 10px',
                borderRadius: 'var(--r-sm)',
                userSelect: 'all',
              }}
            >
              {createdTempPassword}
            </code>
            <Button
              variant="outline"
              tone="neutral"
              size="sm"
              onClick={() => navigator.clipboard?.writeText(createdTempPassword)}
            >
              Copy
            </Button>
            <Button variant="solid" tone="primary" size="sm" onClick={clearTempPassword}>
              Done
            </Button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={() => setShowAddForm((v) => !v)}>Add PSO user</Button>
      </div>

      {showAddForm && (
        <div className="panel" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <TextField label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
            Save
          </Button>
        </div>
      )}

      <DataTable columns={columns} rows={users} getRowKey={(u) => u.id} loading={loading} />
      <p style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Roles: PSO Staff · PSO Supervisor (fixed role enum) · Administrator.</p>

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
          onCancel={closeActionModal}
          onConfirm={handleConfirmAction}
        />
      )}
    </div>
  );
}
