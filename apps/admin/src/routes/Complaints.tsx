import { useEffect, useMemo, useState } from 'react';
import { TableToolbar } from '../components/TableToolbar';
import { Select } from '../components/Select';
import { Textarea } from '../components/Textarea';
import { TextField } from '../components/TextField';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { RoleGate } from '../components/RoleGate';
import { ErrorBanner } from '../components/ErrorBanner';
import { Pagination } from '../components/Pagination';
import { EmptyState } from '../components/EmptyState';
import { DocumentImage } from '../components/DocumentImage';
import { useComplaintsStore } from '../store/useComplaintsStore';
import type { ComplaintRow, ComplaintStatus } from '../types/complaint';
import { formatDate, titleCaseLabel } from '../lib/format';
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

const PAGE_SIZE = 5;

const ALL_STATUSES: { label: string; value: ComplaintStatus }[] = [
  { label: 'Open', value: 'open' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Escalated', value: 'escalated' },
  { label: 'Mediation Scheduled', value: 'mediation_scheduled' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Dismissed', value: 'dismissed' },
];

/**
 * Wireframe screen 7 "Complaints management" — two-step flow per FR-4.3-4.8:
 * PSO Staff triage, then a Department Head directive (FR-4.3a). Restyled
 * per README §08 — an SLA strip above a 55/45 queue/case split, the case
 * column never below the table.
 *
 * The SLA strip's "Overdue" count reuses the exact rule the SLA table
 * column already applies (open/under_review past the 3-day ARTA clock,
 * FR-4.8) rather than widening it to match the mock's escalated row, which
 * would be a behaviour change beyond a restyle — README §4 flags this rule
 * as still unconfirmed with the team.
 */
export function Complaints() {
  const {
    complaints,
    loading,
    error,
    search,
    statusFilter,
    page,
    fetch,
    setSearch,
    setStatusFilter,
    setPage,
    updateStatus,
    setDhDirective,
    scheduleMediation,
    recordResolution,
    attachments,
    attachmentsLoading,
    fetchAttachments,
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

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const slaCounts = useMemo(
    () => ({
      overdue: complaints.filter((c) => ['open', 'under_review'].includes(c.status) && c.businessDaysElapsed > 3).length,
      open: complaints.filter((c) => c.status === 'open').length,
      underReview: complaints.filter((c) => c.status === 'under_review').length,
      resolved: complaints.filter((c) => c.status === 'resolved').length,
    }),
    [complaints]
  );

  const selected = complaints.find((c) => c.id === selectedId) ?? null;
  const canScheduleMediation = selected?.status === 'escalated';

  function openReview(c: ComplaintRow) {
    setSelectedId(c.id);
    setDirectiveDraft(c.dhDirective ?? '');
    setMeetingAtDraft(c.mediationMeetingAt ? c.mediationMeetingAt.slice(0, 16) : '');
    setMeetingLocationDraft(c.mediationLocation ?? '');
    setResolutionStatusDraft('resolved');
    setResolutionNotesDraft(c.resolutionNotes ?? '');
    fetchAttachments(c.id);
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
          <Badge label={`${c.businessDaysElapsed}d overdue`} tone="danger" />
        ) : (
          <span className="mono" style={{ color: 'var(--ink-faint)', fontSize: 11 }}>
            {c.businessDaysElapsed}d
          </span>
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
      <ErrorBanner message={error} />

      <div className={styles.split}>
        <div className={styles.queueCol}>
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
          <div className={styles.slaStrip}>
            <Badge label={`Overdue ${slaCounts.overdue}`} tone="danger" />
            <Badge label={`Open ${slaCounts.open}`} tone="warn" />
            <Badge label={`Under review ${slaCounts.underReview}`} tone="info" />
            <Badge label={`Resolved ${slaCounts.resolved}`} tone="neutral" />
          </div>
          <DataTable
            columns={columns}
            rows={pageRows}
            getRowKey={(c) => c.id}
            loading={loading}
            emptyMessage="No complaints match your filters."
            onRowClick={openReview}
            isRowHighlighted={(c) => c.id === selectedId}
          />
          <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
        </div>

        <div className={`panel ${styles.caseCol}`}>
          {selected ? (
            <>
              <div className={styles.caseHeader}>
                <div>
                  <h2 className="panel-title" style={{ marginBottom: 2 }}>
                    {selected.subject}
                  </h2>
                  <span className="case-sub">
                    filed {formatDate(selected.createdAt)}
                    {selected.rideRequestId ? ` · ride ${selected.rideRequestId}` : ''}
                  </span>
                </div>
                <button type="button" className={styles.closeButton} aria-label="Close" onClick={() => setSelectedId(null)}>
                  ×
                </button>
              </div>

              {selected.message && <div className={styles.quote}>&ldquo;{selected.message}&rdquo;</div>}

              <div className="two-col">
                <div className="field">
                  <span className="field-label">Complainant</span>
                  <span>{selected.submittedByName}</span>
                </div>
                <div className="field">
                  <span className="field-label">Against</span>
                  <span>{selected.againstUserName ?? '—'}</span>
                </div>
              </div>

              <div className="field">
                <span className="field-label">Status</span>
                <Select
                  value={selected.status}
                  onChange={(e) => updateStatus(selected.id, e.target.value as ComplaintStatus)}
                  options={ALL_STATUSES}
                />
              </div>

              <div className={styles.subsection}>
                <div className={styles.subsectionTitle}>Evidence (FR-4.7)</div>
                {attachmentsLoading && <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Loading…</span>}
                {!attachmentsLoading && attachments.length === 0 && (
                  <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>No evidence attached to this complaint.</span>
                )}
                {!attachmentsLoading && attachments.length > 0 && (
                  <div className={styles.evidenceGrid}>
                    {attachments.map((a) => (
                      <DocumentImage key={a.id} bucket="complaint-evidence" path={a.storagePath} alt="Complaint evidence" height={120} />
                    ))}
                  </div>
                )}
              </div>

              <Textarea
                label="Department Head directive"
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
                Save directive
              </Button>

              <RoleGate
                min="supervisor"
                fallback={<div className="read-only-note">Schedule Mediation — PSO Supervisor &amp; Administrator only.</div>}
              >
                <div className={styles.subsection}>
                  <div className={styles.subsectionTitle}>
                    Schedule mediation
                    {!canScheduleMediation && <Badge label="Unlocks on Escalated" tone="warn" />}
                  </div>
                  <div className="two-col" style={{ opacity: canScheduleMediation ? 1 : 0.45 }}>
                    <TextField
                      label="Meeting date/time"
                      type="datetime-local"
                      value={meetingAtDraft}
                      onChange={(e) => setMeetingAtDraft(e.target.value)}
                      disabled={!canScheduleMediation}
                    />
                    <TextField
                      label="Location"
                      value={meetingLocationDraft}
                      onChange={(e) => setMeetingLocationDraft(e.target.value)}
                      placeholder="e.g. PSO Office, City Hall"
                      disabled={!canScheduleMediation}
                    />
                  </div>
                  <Button
                    variant="solid"
                    tone="primary"
                    size="sm"
                    superscript="S+"
                    disabled={!canScheduleMediation || !meetingAtDraft}
                    onClick={() => scheduleMediation(selected.id, new Date(meetingAtDraft).toISOString(), meetingLocationDraft)}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    Schedule mediation
                  </Button>
                </div>
              </RoleGate>

              {selected.mediationMeetingAt && (
                <div className="field">
                  <span className="field-label">Mediation Meeting</span>
                  <span style={{ fontSize: 13 }}>
                    {new Date(selected.mediationMeetingAt).toLocaleString('en-PH')}
                    {selected.mediationLocation ? ` — ${selected.mediationLocation}` : ''}
                  </span>
                </div>
              )}

              {selected.status === 'mediation_scheduled' && (
                <RoleGate
                  min="supervisor"
                  fallback={<div className="read-only-note">Recording the outcome is limited to PSO Supervisor and Administrator.</div>}
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
                <div className="field">
                  <span className="field-label">Resolution Notes</span>
                  <span style={{ fontSize: 13 }}>{selected.resolutionNotes}</span>
                </div>
              )}
            </>
          ) : (
            <EmptyState message="Select a complaint to review it." />
          )}
        </div>
      </div>
    </div>
  );
}
