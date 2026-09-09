import { useEffect, useState } from 'react';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge, type BadgeTone } from '../components/Badge';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { Select } from '../components/Select';
import { Textarea } from '../components/Textarea';
import { Toggle } from '../components/Toggle';
import { ConfirmModal } from '../components/ConfirmModal';
import { ErrorBanner } from '../components/ErrorBanner';
import { useBarangaysStore } from '../store/useBarangaysStore';
import type { BarangayInput, BarangayRow, TricycleCluster } from '../services/barangays';
import { titleCaseLabel } from '../lib/format';

const CLUSTER_TONE: Record<TricycleCluster, BadgeTone> = {
  red: 'danger',
  white: 'neutral',
  apple_green: 'success',
  melting_pot: 'info',
};

const CLUSTER_OPTIONS: { label: string; value: TricycleCluster | '' }[] = [
  { label: 'None — split barangay', value: '' },
  { label: 'Red', value: 'red' },
  { label: 'White', value: 'white' },
  { label: 'Apple Green', value: 'apple_green' },
  { label: 'Melting Pot', value: 'melting_pot' },
];

const EMPTY_DRAFT: BarangayInput = { name: '', cluster: null, isSplit: false, notes: null };

/**
 * Ordinance No. 37, s.2018, Sec. 119 cluster reference data (docs/SCHEMA.MD
 * §2.5b) — Administrator-only screen (RequireAdmin in App.tsx), matching PSO
 * Users/System Settings. Any authenticated user can already read this table
 * (barangays_read_all); this is the write side for when the MTFRB amends
 * cluster boundaries, previously only reachable via direct SQL.
 */
export function Barangays() {
  const { barangays, loading, error, fetch, create, update, remove } = useBarangaysStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BarangayInput>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BarangayRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch();
  }, [fetch]);

  function openAddForm() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setShowForm(true);
  }

  function openEditForm(row: BarangayRow) {
    setEditingId(row.id);
    setDraft({ name: row.name, cluster: row.cluster, isSplit: row.isSplit, notes: row.notes });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }

  async function handleSave() {
    if (!draft.name.trim()) return;
    setSaving(true);
    const ok = editingId ? await update(editingId, draft) : await create(draft);
    setSaving(false);
    if (ok) closeForm();
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const ok = await remove(pendingDelete.id);
    setDeleting(false);
    if (ok) setPendingDelete(null);
  }

  const columns: DataTableColumn<BarangayRow>[] = [
    { key: 'name', header: 'Name', sortValue: (b) => b.name, render: (b) => b.name },
    {
      key: 'cluster',
      header: 'Cluster',
      render: (b) => (b.cluster ? <Badge label={titleCaseLabel(b.cluster)} tone={CLUSTER_TONE[b.cluster]} /> : <Badge label="Split" tone="warn" />),
    },
    { key: 'split', header: 'Split', render: (b) => (b.isSplit ? 'Yes' : 'No') },
    { key: 'notes', header: 'Notes', render: (b) => b.notes ?? '—' },
    {
      key: 'actions',
      header: 'Actions',
      render: (b) => (
        <div className="row-actions">
          <Button variant="outline" tone="neutral" size="sm" onClick={() => openEditForm(b)}>
            Edit
          </Button>
          <Button variant="outline" tone="danger" size="sm" onClick={() => setPendingDelete(b)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <ErrorBanner message={error} />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={showForm && !editingId ? closeForm : openAddForm}>{showForm && !editingId ? 'Cancel' : 'Add Barangay'}</Button>
      </div>

      {showForm && (
        <div className="panel" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <TextField label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Select
            label="Cluster"
            value={draft.cluster ?? ''}
            onChange={(e) => setDraft({ ...draft, cluster: (e.target.value || null) as TricycleCluster | null })}
            options={CLUSTER_OPTIONS}
          />
          <Toggle label="Split barangay" checked={draft.isSplit} onChange={(isSplit) => setDraft({ ...draft, isSplit })} />
          <Textarea
            label="Notes"
            value={draft.notes ?? ''}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value || null })}
            placeholder="e.g. Northwest of national highway = White; Southeast = Apple Green"
            rows={2}
          />
          <Button onClick={handleSave} loading={saving} disabled={!draft.name.trim()}>
            {editingId ? 'Save Changes' : 'Save'}
          </Button>
          {editingId && (
            <Button variant="outline" tone="neutral" onClick={closeForm}>
              Cancel
            </Button>
          )}
        </div>
      )}

      <DataTable columns={columns} rows={barangays} getRowKey={(b) => b.id} loading={loading} emptyMessage="No barangays on record." />

      {pendingDelete && (
        <ConfirmModal
          title="Delete barangay"
          message={`Delete "${pendingDelete.name}"? Any ride requests that recorded this barangay as a pickup point keep their history — only the reference row is removed.`}
          confirmLabel="Delete"
          tone="danger"
          confirmLoading={deleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
