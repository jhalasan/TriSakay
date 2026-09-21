import { useEffect, useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge, type BadgeTone } from '../components/Badge';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { Select } from '../components/Select';
import { Textarea } from '../components/Textarea';
import { Toggle } from '../components/Toggle';
import { TableToolbar } from '../components/TableToolbar';
import { ConfirmModal } from '../components/ConfirmModal';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { useBarangaysStore } from '../store/useBarangaysStore';
import { countBarangayRideRequests } from '../services/barangays';
import type { BarangayInput, BarangayRow, TricycleCluster } from '../services/barangays';
import { formatDate, titleCaseLabel } from '../lib/format';
import styles from './Barangays.module.css';

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

const CLUSTER_FILTER_OPTIONS: { label: string; value: TricycleCluster | 'all' }[] = [
  { label: 'All clusters', value: 'all' },
  { label: 'Red', value: 'red' },
  { label: 'White', value: 'white' },
  { label: 'Apple Green', value: 'apple_green' },
  { label: 'Melting Pot', value: 'melting_pot' },
];

const EMPTY_DRAFT: BarangayInput = { name: '', cluster: null, isSplit: false, notes: null };

function draftsEqual(a: BarangayInput, b: BarangayInput): boolean {
  return a.name === b.name && a.cluster === b.cluster && a.isSplit === b.isSplit && (a.notes ?? '') === (b.notes ?? '');
}

/**
 * Ordinance No. 37, s.2018, Sec. 119 cluster reference data (docs/SCHEMA.MD
 * §2.5b) — Administrator-only screen (RequireAdmin in App.tsx), matching PSO
 * Users/System Settings. Any authenticated user can already read this table
 * (barangays_read_all); this is the write side for when the MTFRB amends
 * cluster boundaries, previously only reachable via direct SQL. Restyled
 * per README §11 — inline add/edit panel above the list. No pager: this is
 * reference data amended rarely, not a work queue, so the whole filtered
 * list (currently 26 barangays) just renders in one scrollable table rather
 * than adding click-through friction to a "see everyone in this cluster"
 * glance. (A fixed six-row cap lived here before this pass — written before
 * the real barangay count was known, it silently hid most of the table with
 * no way to reach the rest.)
 */
export function Barangays() {
  const { barangays, loading, error, fetch, create, update, remove } = useBarangaysStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingOriginal, setEditingOriginal] = useState<BarangayInput>(EMPTY_DRAFT);
  const [draft, setDraft] = useState<BarangayInput>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BarangayRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingDeleteUsage, setPendingDeleteUsage] = useState<{ count: number | null; loading: boolean; error: string | null }>({
    count: null,
    loading: false,
    error: null,
  });
  const [confirmingClusterChange, setConfirmingClusterChange] = useState(false);
  const [search, setSearch] = useState('');
  const [clusterFilter, setClusterFilter] = useState<TricycleCluster | 'all'>('all');
  const { showToast } = useToast();

  useEffect(() => {
    fetch();
  }, [fetch]);

  function openAddForm() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setEditingOriginal(EMPTY_DRAFT);
    setShowForm(true);
  }

  function openEditForm(row: BarangayRow) {
    const input: BarangayInput = { name: row.name, cluster: row.cluster, isSplit: row.isSplit, notes: row.notes };
    setEditingId(row.id);
    setDraft(input);
    setEditingOriginal(input);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }

  async function handleSave() {
    if (!draft.name.trim()) return;
    const wasEditing = !!editingId;
    setSaving(true);
    const ok = editingId ? await update(editingId, draft) : await create(draft);
    setSaving(false);
    if (!ok) return;
    showToast({ message: wasEditing ? `${draft.name} updated.` : `${draft.name} added.` });
    closeForm();
  }

  /** UAT A19: editing a barangay's cluster changes which tricycles can serve it, so that specific field gets a confirmation step; a name/notes-only edit does not. */
  function handleSaveClick() {
    if (editingId && draft.cluster !== editingOriginal.cluster) {
      setConfirmingClusterChange(true);
      return;
    }
    handleSave();
  }

  async function handleConfirmClusterChange() {
    setConfirmingClusterChange(false);
    await handleSave();
  }

  async function openDeleteConfirm(row: BarangayRow) {
    setPendingDelete(row);
    setPendingDeleteUsage({ count: null, loading: true, error: null });
    const { data, error } = await countBarangayRideRequests(row.id);
    setPendingDeleteUsage({ count: data, loading: false, error });
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const ok = await remove(pendingDelete.id);
    setDeleting(false);
    if (!ok) return;
    showToast({ message: `${pendingDelete.name} deleted.` });
    setPendingDelete(null);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return barangays.filter((b) => {
      const matchesSearch = !q || b.name.toLowerCase().includes(q);
      const matchesCluster = clusterFilter === 'all' || b.cluster === clusterFilter;
      return matchesSearch && matchesCluster;
    });
  }, [barangays, search, clusterFilter]);

  const lastAmended = useMemo(
    () =>
      barangays.reduce<BarangayRow | null>((latest, b) => {
        if (!b.updatedAt) return latest;
        if (!latest || !latest.updatedAt || b.updatedAt > latest.updatedAt) return b;
        return latest;
      }, null),
    [barangays]
  );

  const columns: DataTableColumn<BarangayRow>[] = [
    { key: 'name', header: 'Barangay', sortValue: (b) => b.name, render: (b) => <span style={{ fontWeight: 600 }}>{b.name}</span> },
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
          <Button variant="outline" tone="danger" size="sm" onClick={() => openDeleteConfirm(b)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (error && barangays.length === 0 && !loading) {
    return (
      <div className="page">
        <EmptyState
          message="Couldn't load barangays."
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

  const formError = showForm ? error : null;

  return (
    <div className="page">
      <div className={`panel ${styles.header}`}>
        <div>
          <h2 className="panel-title" style={{ marginBottom: 2 }}>
            Tricycle Cluster Assignments
          </h2>
          <p className={styles.ordinance}>Ordinance No. 37, s.2018, Sec. 119 — amend only when the MTFRB revises cluster boundaries.</p>
          <p className={styles.ordinance}>
            TriSakay currently operates within <strong>General Santos City only</strong> — the list below covers all of the city&apos;s barangays; there is no coverage outside city limits.
          </p>
        </div>
        <div className={styles.headerRight}>
          <Badge label="Administrator only" tone="info" />
          <Button onClick={showForm && !editingId ? closeForm : openAddForm}>{showForm && !editingId ? 'Cancel' : 'Add barangay'}</Button>
        </div>
      </div>

      {showForm && (
        <div className={`panel ${styles.form}`}>
          <div className={styles.formHeader}>
            <h2 className="panel-title" style={{ marginBottom: 0 }}>
              {editingId ? `Edit barangay — ${editingOriginal.name}` : 'Add barangay'}
            </h2>
            {editingId && !draftsEqual(draft, editingOriginal) && <Badge label="Unsaved changes" tone="warn" />}
          </div>
          <div className={styles.formFields}>
            <TextField label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <Select
              label="Cluster"
              value={draft.cluster ?? ''}
              onChange={(e) => setDraft({ ...draft, cluster: (e.target.value || null) as TricycleCluster | null })}
              options={CLUSTER_OPTIONS}
            />
            <Textarea
              label="Notes"
              value={draft.notes ?? ''}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value || null })}
              placeholder="e.g. Northwest of national highway = White; Southeast = Apple Green"
              rows={2}
            />
          </div>
          <ErrorBanner message={formError} />
          <div className={styles.formFooter}>
            <Toggle label="Split barangay" hint="Two clusters share the barangay; state the boundary in the notes" checked={draft.isSplit} onChange={(isSplit) => setDraft({ ...draft, isSplit })} />
            <div className="row-actions">
              <Button variant="outline" tone="neutral" onClick={closeForm}>
                Cancel
              </Button>
              <Button onClick={handleSaveClick} loading={saving} disabled={!draft.name.trim()}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add barangay'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search barangays…"
        filters={
          <Select
            aria-label="Filter by cluster"
            value={clusterFilter}
            onChange={(e) => setClusterFilter(e.target.value as TricycleCluster | 'all')}
            options={CLUSTER_FILTER_OPTIONS}
          />
        }
      />

      <div className="panel">
        <DataTable columns={columns} rows={filtered} getRowKey={(b) => b.id} loading={loading} emptyMessage="No barangays match these filters." />
        <div className="list-footer">
          <span className="list-footer-count">
            Showing {filtered.length} of {barangays.length} barangays
          </span>
          {lastAmended?.updatedAt && (
            <span className="list-footer-count">
              Last amended {formatDate(lastAmended.updatedAt)}
              {lastAmended.updatedByName ? ` by ${lastAmended.updatedByName}` : ''}
            </span>
          )}
        </div>
      </div>

      {pendingDelete && (
        <ConfirmModal
          title="Delete barangay"
          message={
            pendingDeleteUsage.loading
              ? `Delete "${pendingDelete.name}"? Checking how many ride requests reference it…`
              : pendingDeleteUsage.error
                ? `Delete "${pendingDelete.name}"? Couldn't verify how many ride requests reference it (${pendingDeleteUsage.error}) — its history is kept either way; only the reference row is removed.`
                : pendingDeleteUsage.count
                  ? `Delete "${pendingDelete.name}"? ${pendingDeleteUsage.count} ride request${pendingDeleteUsage.count === 1 ? '' : 's'} recorded it as a pickup point and will keep their history with this reference cleared. Drivers assigned to it keep their current cluster until reassigned.`
                  : `Delete "${pendingDelete.name}"? No ride requests reference it. Drivers assigned to it keep their current cluster until reassigned.`
          }
          confirmLabel="Delete"
          tone="danger"
          confirmLoading={deleting}
          error={error}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {confirmingClusterChange && (
        <ConfirmModal
          title="Change tricycle cluster?"
          message={`Changing "${editingOriginal.name}"'s cluster from ${editingOriginal.cluster ? titleCaseLabel(editingOriginal.cluster) : 'none (split)'} to ${draft.cluster ? titleCaseLabel(draft.cluster) : 'none (split)'} changes which tricycles can be matched to pickups here, effective immediately for new bookings.`}
          confirmLabel="Save changes"
          tone="danger"
          confirmLoading={saving}
          onCancel={() => setConfirmingClusterChange(false)}
          onConfirm={handleConfirmClusterChange}
        />
      )}
    </div>
  );
}
