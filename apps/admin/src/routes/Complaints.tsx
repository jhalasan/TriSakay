import { useEffect, useMemo, useState } from 'react';
import { TableToolbar } from '../components/TableToolbar';
import { Select } from '../components/Select';
import { Textarea } from '../components/Textarea';
import { TextField } from '../components/TextField';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { RoleGate } from '../components/RoleGate';
import { useComplaintsStore } from '../store/useComplaintsStore';
import type { ComplaintRow, ComplaintStatus } from '../types/complaint';
import { titleCaseLabel } from '../lib/format';
import styles from './Complaints.module.css';

const STATUS_TONE: Record<ComplaintStatus, 'neutral' | 'success' | 'warn' | 'danger' | 'info'> = {
  open: 'warn',
  under_review: 'info',
  escalated: 'danger',
  mediation_scheduled: 'info',
  resolved: 'success',
  dismissed: 'neutral',
};

const CATEGORY_LABEL: Record<ComplaintRow['category'], string> = {
  fare: 'Fare',
  conduct: 'Conduct',
  safety: 'Safety',
  low_rating: 'Low Rating',
  vehicle_condition: 'Vehicle Condition',
  other: 'Other',
};

const ALL_STATUSES: { label: string; value: ComplaintStatus }[] = [
  { label: 'Open', value: 'open' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Escalated', value: 'escalated' },
  { label: 'Mediation Scheduled', value: 'mediation_scheduled' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Dismissed', value: 'dismissed' },
];

/** Wireframe screen 7 "Complaints management" — two-step flow per FR-4.3-4.8: PSO Staff triage, then a Department Head directive (FR-4.3a). */
export function Complaints() {
  const {
    complaints,
    loading,
    search,
    statusFilter,
    page,
    fetch,
    setSearch,
    setStatusFilter,
    updateStatus,
    setDhDirective,
    scheduleMediation,
    recordResolution,
  } = useComplaintsStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [directiveDraft, setDirectiveDraft] = useState('');
  const [meetingAtDraft, setMeetingAtDraft] = useState('');
  const [meetingLocationDraft, setMeetingLocationDraft] = useState('');
  const [resolutionStatusDraft, setResolutionStatusDraft] = useState<'resolved' | 'dismissed'>('resolved');
  const [resolutionNotesDraft, setResolutionNotesDraft] = useState('');

  useEffect(() => {
    fetch();
  }, [fetch]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return complaints.filter((c) => {
      const matchesSearch = !q || c.subject.toLowerCase().includes(q) || c.submittedByName.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [complaints, search, statusFilter]);

  const selected = complaints.find((c) => c.id === selectedId) ?? null;

  function openReview(c: ComplaintRow) {
    setSelectedId(c.id);
    setDirectiveDraft(c.dhDirective ?? '');
    setMeetingAtDraft(c.mediationMeetingAt ? c.mediationMeetingAt.slice(0, 16) : '');
    setMeetingLocationDraft(c.mediationLocation ?? '');
    setResolutionStatusDraft('resolved');
    setResolutionNotesDraft(c.resolutionNotes ?? '');
  }

  const columns: DataTableColumn<ComplaintRow>[] = [
    {
      key: 'subject',
      header: 'Complaint',
      sortValue: (c) => c.subject,
      render: (c) => (
        <div>
          <div style={{ fontWeight: 600 }}>{c.subject}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
            {c.submittedByName}
            {c.againstUserName ? ` → ${c.againstUserName}` : ''}
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (c) => <Badge label={CATEGORY_LABEL[c.category]} tone="neutral" /> },
    { key: 'status', header: 'Status', sortValue: (c) => c.status, render: (c) => <Badge label={titleCaseLabel(c.status)} tone={STATUS_TONE[c.status]} /> },
    {
      key: 'sla',
      header: 'SLA',
      render: (c) =>
        ['open', 'under_review'].includes(c.status) && c.businessDaysElapsed > 3 ? (
          <Badge label={`${c.businessDaysElapsed}d — overdue`} tone="danger" />
        ) : (
          <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>{c.businessDaysElapsed}d</span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (c) => (
        <Button variant="outline" tone="neutral" size="sm" onClick={() => openReview(c)}>
          {['resolved', 'dismissed'].includes(c.status) ? 'View' : 'Review'}
        </Button>
      ),
    },
  ];

  return (
    <div className="page">
      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by subject or complainant…"
        filters={
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            options={[{ label: 'All statuses', value: 'all' }, ...ALL_STATUSES]}
          />
        }
      />
      <DataTable columns={columns} rows={filtered} getRowKey={(c) => c.id} loading={loading} emptyMessage="No complaints match your filters." />

      {selected && (
        <div className={`panel ${styles.review}`}>
          <div className="panel-title">Reviewing: {selected.subject}</div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Status</span>
            <Select
              value={selected.status}
              onChange={(e) => updateStatus(selected.id, e.target.value as ComplaintStatus)}
              options={ALL_STATUSES}
            />
          </div>

          <Textarea
            label="Department Head Directive"
            value={directiveDraft}
            onChange={(e) => setDirectiveDraft(e.target.value)}
            placeholder="e.g. Contact both parties and schedule MTFRB mediation."
          />
          <Button
            variant="solid"
            tone="primary"
            size="sm"
            onClick={() => setDhDirective(selected.id, directiveDraft)}
            style={{ alignSelf: 'flex-start' }}
          >
            Save Directive
          </Button>

          {selected.status === 'escalated' && (
            <RoleGate
              min="supervisor"
              fallback={<div className={styles.readOnlyNote}>Schedule Mediation — PSO Supervisor &amp; Administrator only.</div>}
            >
              <div className={styles.subsection}>
                <div className={styles.subsectionTitle}>Schedule Mediation (FR-4.5)</div>
                <TextField
                  label="Meeting date/time"
                  type="datetime-local"
                  value={meetingAtDraft}
                  onChange={(e) => setMeetingAtDraft(e.target.value)}
                />
                <TextField
                  label="Location"
                  value={meetingLocationDraft}
                  onChange={(e) => setMeetingLocationDraft(e.target.value)}
                  placeholder="e.g. PSO Office, City Hall"
                />
                <Button
                  variant="solid"
                  tone="primary"
                  size="sm"
                  disabled={!meetingAtDraft}
                  onClick={() => scheduleMediation(selected.id, new Date(meetingAtDraft).toISOString(), meetingLocationDraft)}
                  style={{ alignSelf: 'flex-start' }}
                >
                  Schedule Mediation
                </Button>
              </div>
            </RoleGate>
          )}

          {selected.mediationMeetingAt && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Mediation Meeting</span>
              <span style={{ fontSize: 13 }}>
                {new Date(selected.mediationMeetingAt).toLocaleString('en-PH')}
                {selected.mediationLocation ? ` — ${selected.mediationLocation}` : ''}
              </span>
            </div>
          )}

          {selected.status === 'mediation_scheduled' && (
            <RoleGate
              min="supervisor"
              fallback={<div className={styles.readOnlyNote}>Record Outcome — PSO Supervisor &amp; Administrator only.</div>}
            >
              <div className={styles.subsection}>
                <div className={styles.subsectionTitle}>Record Outcome (FR-4.6)</div>
                <Select
                  value={resolutionStatusDraft}
                  onChange={(e) => setResolutionStatusDraft(e.target.value as 'resolved' | 'dismissed')}
                  options={[
                    { label: 'Resolved', value: 'resolved' },
                    { label: 'Dismissed', value: 'dismissed' },
                  ]}
                />
                <Textarea
                  label="Outcome / settlement details"
                  value={resolutionNotesDraft}
                  onChange={(e) => setResolutionNotesDraft(e.target.value)}
                  placeholder="e.g. Parties agreed to a fare refund at the MTFRB mediation meeting."
                />
                <Button
                  variant="solid"
                  tone="primary"
                  size="sm"
                  onClick={() => recordResolution(selected.id, resolutionStatusDraft, resolutionNotesDraft)}
                  style={{ alignSelf: 'flex-start' }}
                >
                  Save Outcome
                </Button>
              </div>
            </RoleGate>
          )}

          {selected.resolutionNotes && ['resolved', 'dismissed'].includes(selected.status) && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Resolution Notes</span>
              <span style={{ fontSize: 13 }}>{selected.resolutionNotes}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
