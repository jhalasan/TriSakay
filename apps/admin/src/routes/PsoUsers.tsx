import { useEffect, useState } from 'react';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { Select } from '../components/Select';
import { addPsoUser, listPsoUsers, togglePsoUserActive } from '../services/psoUsers';
import type { PsoUserRow } from '../types/psoUser';
import { ROLE_LABELS } from '../lib/rbac';
import type { AdminRole } from '../types/role';

const ROLE_TONE: Record<AdminRole, 'info' | 'warn' | 'neutral'> = {
  admin: 'info',
  pso_supervisor: 'warn',
  pso_staff: 'neutral',
};

/** Wireframe screen 9 "User management" — PSO staff & roles (FR-6.3). Admin-only screen; route access is gated in App.tsx. */
export function PsoUsers() {
  const [users, setUsers] = useState<PsoUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('pso_staff');

  async function refresh() {
    setLoading(true);
    const { data } = await listPsoUsers();
    setUsers(data);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAdd() {
    if (!fullName.trim() || !email.trim()) return;
    await addPsoUser({ fullName, email, role });
    setFullName('');
    setEmail('');
    setRole('pso_staff');
    setShowAddForm(false);
    await refresh();
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
        <div style={{ display: 'flex', gap: 6 }}>
          <Button variant="outline" tone="neutral" size="sm">
            Edit
          </Button>
          <Button
            variant="outline"
            tone={u.isActive ? 'danger' : 'primary'}
            size="sm"
            onClick={async () => {
              await togglePsoUserActive(u.id);
              await refresh();
            }}
          >
            {u.isActive ? 'Disable' : 'Enable'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="page">
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
          <Button onClick={handleAdd}>Save</Button>
        </div>
      )}

      <DataTable columns={columns} rows={users} getRowKey={(u) => u.id} loading={loading} />
      <p style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Roles: PSO Staff · PSO Supervisor (fixed role enum) · Administrator.</p>
    </div>
  );
}
