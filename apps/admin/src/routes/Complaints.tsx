import { useEffect, useMemo, useState } from 'react';
import { TableToolbar } from '../components/TableToolbar';
import { Select } from '../components/Select';
import { Textarea } from '../components/Textarea';
import { TextField } from '../components/TextField';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { RoleGate } from '../components/RoleGate';
import { ConfirmModal } from '../components/ConfirmModal';
import { Modal } from '../components/Modal';
import { ErrorBanner } from '../components/ErrorBanner';
import { Pagination } from '../components/Pagination';
import { EmptyState } from '../components/EmptyState';
import { DocumentImage } from '../components/DocumentImage';
import { RideChatThread } from '../components/RideChatThread';
import { SkeletonBar } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { useComplaintsStore } from '../store/useComplaintsStore';
import { useSessionStore } from '../store/useSessionStore';
import { complaintOwnership, ownershipLabel } from '../lib/complaintOwnership';
import type { ComplaintRow, ComplaintStatus } from '../types/complaint';
import { formatDate, getReferenceCode, titleCaseLabel, toDatetimeLocalValue } from '../lib/format';
import { formatBulkTargets } from '../lib/bulkActions';
import type { ComplaintAssignmentRow } from '../services/complaints';
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

const PAGE_SIZE_OPTIONS = [
  { label: '5 / page', value: '5' },
  { label: '10 / page', value: '10' },
  { label: '25 / page', value: '25' },
];

/** Bulk triage — same two forward transitions the single-row Status select allows, offered for
 * multiple selected rows at once (Alex/power-user finding: clearing a backlog of open complaints
 * one row at a time doesn't scale). No reason field — this mirrors the single-row select's own
 * lack of one, since it's the same RLS-ungated, no-notes-required staff triage step. */
type BulkTriageKind = 'under_review' | 'escalated';
const BULK_TRIAGE_COPY: Record<BulkTriageKind, { label: string; title: string; message: (rows: ComplaintRow[]) => string }> = {
  under_review: {
    label: 'Mark Under Review',
    title: 'Mark complaints Under Review',
    message: (rows) => `Mark ${rows.length} selected complaint(s) as Under Review? ${formatBulkTargets(rows.map((r) => r.subject))}`,
  },
  escalated: {
    label: 'Escalate',
    title: 'Escalate complaints',
    message: (rows) => `Escalate ${rows.length} selected complaint(s)? ${formatBulkTargets(rows.map((r) => r.subject))}`,
  },
};

const ALL_STATUSES: { label: string; value: ComplaintStatus }[] = [
  { label: 'Open', value: 'open' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Escalated', value: 'escalated' },
  { label: 'Mediation Scheduled', value: 'mediation_scheduled' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Dismissed', value: 'dismissed' },
];

/**
 * The status <select> below is the plain FR-4.3 staff-triage step — no
 * reason capture, no role gate, since `complaints_triage_staff` RLS lets
 * any is_pso() account write it directly. It must therefore never offer a
 * status that has its own dedicated, correctly-gated flow with real data
 * requirements: "Mediation Scheduled" needs a meeting date/location
 * (Schedule Mediation, below), and "Resolved"/"Dismissed" need Supervisor+
 * and outcome notes (Record Outcome, below). Offering those here would let
 * any PSO Staff close a complaint with zero notes and zero role check,
 * silently bypassing FR-4.5/4.6 through a plain dropdown.
 */
const TRIAGE_STATUSES: { label: string; value: ComplaintStatus }[] = ALL_STATUSES.filter((s) =>
  ['open', 'under_review', 'escalated'].includes(s.value)
);

/**
 * Wireframe screen 7 "Complaints management" — two-step flow per FR-4.3-4.8:
 * PSO Staff triage, then a Department Head directive (FR-4.3a). An SLA strip
 * sits above the queue table; reviewing a complaint opens its case detail in
 * a modal rather than expanding the page.
 *
 * The SLA strip's "Overdue" count reuses the exact rule the SLA table
 * column already applies (open/under_review past the 3-day ARTA clock,
 * FR-4.8) rather than widening it to match the mock's escalated row, which
 * would be a behaviour change beyond a restyle — README §4 flags this rule
 * as still unconfirmed with the team.
 */
/** Which staff step happened, by whom and when — only steps that have happened. */
function handlerSteps(c: ComplaintRow): { label: string; name: string | null; at: string }[] {
  const steps = [
    { label: 'Triaged', name: c.triagedByName, at: c.triagedAt },
    { label: 'Directive', name: c.dhReviewedByName, at: c.dhReviewedAt },
    { label: 'Mediation scheduled', name: c.mediationScheduledByName, at: c.mediationScheduledAt },
    { label: c.status === 'dismissed' ? 'Dismissed' : 'Resolved', name: c.resolvedByName, at: c.resolvedAt },
  ];
  return steps.filter((step): step is { label: string; name: string | null; at: string } => !!step.at);
}

const ROLE_LABEL: Record<string, string> = { pso_staff: 'Staff', pso_supervisor: 'Supervisor', admin: 'Admin' };

/** One line of the handoff history: who did what, with the note when there is one. */
function handoffText(h: ComplaintAssignmentRow): string {
  const by = h.byName ?? 'Unknown';
  const verb =
    h.kind === 'claimed' ? `${by} claimed it`
    : h.kind === 'assigned' ? `${by} assigned it to ${h.toName ?? 'Unknown'}`
    : h.kind === 'accepted' ? `${by} accepted it`
    : h.kind === 'declined' ? `${by} declined it`
    : `${by} released it`;
  return h.note ? `${verb} — “${h.note}”` : verb;
}

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
    bulkUpdateStatus,
    setDhDirective,
    scheduleMediation,
    recordResolution,
    attachments,
    attachmentsLoading,
    fetchAttachments,
    statusHistory,
    statusHistoryLoading,
    fetchStatusHistory,
    assignments,
    assignmentsLoading,
    fetchAssignments,
    psoStaff,
    fetchPsoStaff,
    ownerFilter,
    setOwnerFilter,
    claim,
    assign,
    accept,
    decline,
    release,
  } = useComplaintsStore();
  const viewer = useSessionStore((state) => state.user);
  const [assigneeDraft, setAssigneeDraft] = useState('');
  const [ownerNoteDraft, setOwnerNoteDraft] = useState('');
  const [ownerBusy, setOwnerBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [directiveDraft, setDirectiveDraft] = useState('');
  const [meetingAtDraft, setMeetingAtDraft] = useState('');
  const [meetingLocationDraft, setMeetingLocationDraft] = useState('');
  const [resolutionStatusDraft, setResolutionStatusDraft] = useState<'resolved' | 'dismissed'>('resolved');
  const [resolutionNotesDraft, setResolutionNotesDraft] = useState('');
  const [savingDirective, setSavingDirective] = useState(false);
  const [schedulingMediation, setSchedulingMediation] = useState(false);
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [pageSize, setPageSize] = useState(5);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [pendingBulkKind, setPendingBulkKind] = useState<BulkTriageKind | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetch();
  }, [fetch]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return complaints.filter((c) => {
      const matchesSearch = !q || c.subject.toLowerCase().includes(q) || c.submittedByName.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesOwner =
        ownerFilter === 'all' ||
        (ownerFilter === 'mine' ? c.assignedToId === viewer?.id : c.assignedToId === null);
      return matchesSearch && matchesStatus && matchesOwner;
    });
  }, [complaints, search, statusFilter, ownerFilter, viewer?.id]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const slaCounts = useMemo(
    () => ({
      overdue: complaints.filter((c) => ['open', 'under_review'].includes(c.status) && c.businessDaysElapsed > 3).length,
      open: complaints.filter((c) => c.status === 'open').length,
      underReview: complaints.filter((c) => c.status === 'under_review').length,
      resolved: complaints.filter((c) => c.status === 'resolved').length,
      unassigned: complaints.filter((c) => c.assignedToId === null && !['resolved', 'dismissed'].includes(c.status)).length,
      needsAttention: viewer ? complaints.filter((c) => complaintOwnership(c, viewer).stale).length : 0,
    }),
    [complaints, viewer]
  );

  const selected = complaints.find((c) => c.id === selectedId) ?? null;
  const ownership = selected && viewer ? complaintOwnership(selected, viewer) : null;
  const canScheduleMediation = selected?.status === 'escalated';

  async function handleOwnerAction(action: () => Promise<boolean>, doneMessage: string) {
    setOwnerBusy(true);
    const ok = await action();
    setOwnerBusy(false);
    if (ok) {
      setOwnerNoteDraft('');
      setAssigneeDraft('');
      showToast({ message: doneMessage });
    }
  }

  async function handleSaveDirective() {
    if (!selected) return;
    setSavingDirective(true);
    const ok = await setDhDirective(selected.id, directiveDraft);
    setSavingDirective(false);
    if (ok) showToast({ message: 'Directive saved.' });
  }

  async function handleScheduleMediation() {
    if (!selected) return;
    setSchedulingMediation(true);
    const ok = await scheduleMediation(selected.id, new Date(meetingAtDraft).toISOString(), meetingLocationDraft);
    setSchedulingMediation(false);
    if (ok) showToast({ message: 'Mediation scheduled.' });
  }

  async function handleSaveOutcome() {
    if (!selected) return;
    setSavingOutcome(true);
    const ok = await recordResolution(selected.id, resolutionStatusDraft, resolutionNotesDraft);
    setSavingOutcome(false);
    if (ok) showToast({ message: 'Outcome saved.' });
  }

  function toggleRow(id: string) {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage(checked: boolean) {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      for (const row of pageRows) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  async function handleConfirmBulk() {
    if (!pendingBulkKind) return;
    setBulkSubmitting(true);
    const summary = await bulkUpdateStatus([...selectedRowIds], pendingBulkKind);
    setBulkSubmitting(false);
    if (summary.failed > 0) return; // keep the modal open — store.error (shown in the modal) already names the count that failed
    showToast({ message: `${summary.succeeded} complaint(s) marked ${titleCaseLabel(pendingBulkKind)}.` });
    setSelectedRowIds(new Set());
    setPendingBulkKind(null);
  }

  function openReview(c: ComplaintRow) {
    setSelectedId(c.id);
    setDirectiveDraft(c.dhDirective ?? '');
    setMeetingAtDraft(c.mediationMeetingAt ? toDatetimeLocalValue(c.mediationMeetingAt) : '');
    setMeetingLocationDraft(c.mediationLocation ?? '');
    setResolutionStatusDraft('resolved');
    setResolutionNotesDraft(c.resolutionNotes ?? '');
    fetchAttachments(c.id);
    fetchStatusHistory(c.id);
    fetchAssignments(c.id);
    setAssigneeDraft('');
    setOwnerNoteDraft('');
    if (viewer && complaintOwnership(c, viewer).canAssign) fetchPsoStaff();
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
      key: 'owner',
      header: 'Owner',
      sortValue: (c) => c.assignedToName ?? '',
      render: (c) => {
        const stale = viewer ? complaintOwnership(c, viewer).stale : false;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12, color: c.assignedToId ? undefined : 'var(--ink-faint)' }}>{ownershipLabel(c)}</span>
            {stale && <Badge label="Needs attention" tone="warn" />}
          </div>
        );
      },
    },
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

  if (error && complaints.length === 0 && !loading) {
    return (
      <div className="page">
        <EmptyState
          message="Couldn't load complaints."
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

  return (
    <div className="page">
      <div className={styles.queueCol}>
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by subject or complainant…"
            filters={
              <>
                <Select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  options={[{ label: 'All statuses', value: 'all' }, ...ALL_STATUSES]}
                />
                <Select
                  aria-label="Filter by owner"
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value as typeof ownerFilter)}
                  options={[
                    { label: 'All owners', value: 'all' },
                    { label: 'My complaints', value: 'mine' },
                    { label: 'Unassigned', value: 'unassigned' },
                  ]}
                />
                <Select
                  aria-label="Rows per page"
                  value={String(pageSize)}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  options={PAGE_SIZE_OPTIONS}
                />
              </>
            }
          />
          <div className={styles.slaStrip}>
            <Badge label={`Overdue ${slaCounts.overdue}`} tone="danger" />
            <Badge label={`Unassigned ${slaCounts.unassigned}`} tone="warn" />
            {slaCounts.needsAttention > 0 && <Badge label={`Needs attention ${slaCounts.needsAttention}`} tone="warn" />}
            <Badge label={`Open ${slaCounts.open}`} tone="warn" />
            <Badge label={`Under review ${slaCounts.underReview}`} tone="info" />
            <Badge label={`Resolved ${slaCounts.resolved}`} tone="neutral" />
          </div>
          {selectedRowIds.size > 0 && (
            <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{selectedRowIds.size} selected</span>
              <Button variant="outline" tone="neutral" size="sm" onClick={() => setPendingBulkKind('under_review')}>
                {BULK_TRIAGE_COPY.under_review.label}
              </Button>
              <Button variant="outline" tone="neutral" size="sm" onClick={() => setPendingBulkKind('escalated')}>
                {BULK_TRIAGE_COPY.escalated.label}
              </Button>
              <Button variant="ghost" tone="neutral" size="sm" onClick={() => setSelectedRowIds(new Set())} style={{ marginLeft: 'auto' }}>
                Clear selection
              </Button>
            </div>
          )}
          <DataTable
            columns={columns}
            rows={pageRows}
            getRowKey={(c) => c.id}
            loading={loading}
            emptyMessage="No complaints match your filters."
            onRowClick={openReview}
            isRowHighlighted={(c) => c.id === selectedId}
            selectedIds={selectedRowIds}
            onToggleRow={toggleRow}
            onToggleAll={toggleAllOnPage}
          />
          <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
      </div>

      {selected && (
        <Modal
          title={selected.subject}
          subtitle={
            <>
              {/* A12 (UAT audit): same 4-char derivation as the passenger app's own complaint detail screen, so a rider quoting "#A1B2" over the phone maps to the same complaint here. */}
              Ref. #{getReferenceCode(selected.id, 4)} · filed {formatDate(selected.createdAt)}
              {selected.rideRequestId ? ` · ride ${selected.rideRequestId}` : ''}
            </>
          }
          onClose={() => setSelectedId(null)}
          size="lg"
        >
              {selected.message && <div className={styles.quote}>&ldquo;{selected.message}&rdquo;</div>}

              <ErrorBanner message={error} />

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
                {['mediation_scheduled', 'resolved', 'dismissed'].includes(selected.status) ? (
                  <>
                    <Badge label={titleCaseLabel(selected.status)} tone={STATUS_TONE[selected.status]} />
                    <span className="footnote">
                      {selected.status === 'mediation_scheduled'
                        ? 'A mediation meeting is scheduled — see Record Outcome below to close this complaint.'
                        : "This complaint is closed. Status can't be changed here."}
                    </span>
                  </>
                ) : ownership && !ownership.canAct ? (
                  <>
                    <Badge label={titleCaseLabel(selected.status)} tone={STATUS_TONE[selected.status]} />
                    <span className="footnote">Claim this complaint (or accept it once assigned) to change its status.</span>
                  </>
                ) : (
                  <Select
                    value={selected.status}
                    onChange={async (e) => {
                      const ok = await updateStatus(selected.id, e.target.value as ComplaintStatus);
                      if (ok) showToast({ message: 'Status updated.' });
                    }}
                    options={TRIAGE_STATUSES}
                  />
                )}
              </div>

              {ownership && (
                <div className={styles.subsection}>
                  <div className={styles.subsectionTitle}>Owner</div>
                  <div style={{ fontSize: 13 }}>
                    {ownershipLabel(selected)}
                    {ownership.stale && <> <Badge label="Needs attention" tone="warn" /></>}
                  </div>
                  {(ownership.canAssign || ownership.canDecline || ownership.canRelease) && (
                    <Textarea
                      label="Note"
                      hint="Required to assign, decline or release. Saved in the handoff history."
                      value={ownerNoteDraft}
                      onChange={(e) => setOwnerNoteDraft(e.target.value)}
                      placeholder="e.g. Please contact both parties by Friday."
                    />
                  )}
                  {ownership.canAssign && (
                    <Select
                      aria-label="Assign to"
                      value={assigneeDraft}
                      onChange={(e) => setAssigneeDraft(e.target.value)}
                      options={[
                        { label: 'Assign to…', value: '' },
                        ...psoStaff
                          .filter((u) => u.id !== selected.assignedToId)
                          .map((u) => ({ label: `${u.fullName} (${ROLE_LABEL[u.role] ?? u.role})`, value: u.id })),
                      ]}
                    />
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {ownership.canClaim && (
                      <Button variant="solid" tone="primary" size="sm" loading={ownerBusy} onClick={() => handleOwnerAction(() => claim(selected.id), 'Complaint claimed.')}>
                        Claim this complaint
                      </Button>
                    )}
                    {ownership.canAccept && (
                      <Button variant="solid" tone="primary" size="sm" loading={ownerBusy} onClick={() => handleOwnerAction(() => accept(selected.id), 'Complaint accepted.')}>
                        Accept
                      </Button>
                    )}
                    {ownership.canDecline && (
                      <Button variant="outline" tone="neutral" size="sm" loading={ownerBusy} disabled={!ownerNoteDraft.trim()} onClick={() => handleOwnerAction(() => decline(selected.id, ownerNoteDraft), 'Complaint declined.')}>
                        Decline
                      </Button>
                    )}
                    {ownership.canAssign && (
                      <Button variant="solid" tone="primary" size="sm" superscript="S+" loading={ownerBusy} disabled={!assigneeDraft || !ownerNoteDraft.trim()} onClick={() => handleOwnerAction(() => assign(selected.id, assigneeDraft, ownerNoteDraft), 'Complaint assigned.')}>
                        Assign
                      </Button>
                    )}
                    {ownership.canRelease && (
                      <Button variant="outline" tone="neutral" size="sm" loading={ownerBusy} disabled={!ownerNoteDraft.trim()} onClick={() => handleOwnerAction(() => release(selected.id, ownerNoteDraft), 'Complaint released.')}>
                        Release
                      </Button>
                    )}
                  </div>

                  <div className={styles.subsectionTitle} style={{ marginTop: 8 }}>Handoff history</div>
                  {assignmentsLoading && <SkeletonBar width={140} height={12} />}
                  {!assignmentsLoading && assignments.length === 0 && (
                    <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>No handoffs yet.</span>
                  )}
                  {!assignmentsLoading && assignments.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                      {assignments.map((h) => (
                        <div key={h.id}>
                          <span style={{ color: 'var(--ink-faint)' }}>{formatDate(h.createdAt)}</span> · {handoffText(h)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className={styles.subsection}>
                <div className={styles.subsectionTitle}>Handled by</div>
                {handlerSteps(selected).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    {handlerSteps(selected).map((step) => (
                      <div key={step.label}>
                        <span style={{ color: 'var(--ink-faint)' }}>{step.label}:</span> {step.name ?? 'Unknown'} · {formatDate(step.at)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>No staff has acted on this complaint yet.</span>
                )}
              </div>

              <div className={styles.subsection}>
                <div className={styles.subsectionTitle}>Evidence</div>
                {attachmentsLoading && <SkeletonBar width={140} height={12} />}
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

              <div className={styles.subsection}>
                <div className={styles.subsectionTitle}>Status History</div>
                {statusHistoryLoading && <SkeletonBar width={140} height={12} />}
                {!statusHistoryLoading && statusHistory.length === 0 && (
                  <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>No status changes recorded yet.</span>
                )}
                {!statusHistoryLoading && statusHistory.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {statusHistory.map((h) => (
                      <div key={h.id} style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                        <Badge label={titleCaseLabel(h.oldStatus)} tone="neutral" /> {'→'} <Badge label={titleCaseLabel(h.newStatus)} tone={STATUS_TONE[h.newStatus]} />
                        {' · '}
                        {h.changedByName ?? 'Unknown'} · {formatDate(h.changedAt)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Textarea
                label="Department Head directive"
                hint="The next step PSO staff should take on this complaint."
                value={directiveDraft}
                onChange={(e) => setDirectiveDraft(e.target.value)}
                placeholder="e.g. Contact both parties and schedule MTFRB mediation."
              />
              <Button
                variant="solid"
                tone="primary"
                size="sm"
                loading={savingDirective}
                onClick={handleSaveDirective}
                style={{ alignSelf: 'flex-start' }}
              >
                {savingDirective ? 'Saving…' : 'Save directive'}
              </Button>

              {canScheduleMediation && (
                <RoleGate
                  min="supervisor"
                  fallback={<div className="read-only-note">Schedule Mediation — PSO Supervisor &amp; Administrator only.</div>}
                >
                  <div className={styles.subsection}>
                    <div className={styles.subsectionTitle}>Schedule mediation</div>
                    <div className="two-col">
                      <TextField
                        label="Meeting date/time"
                        hint="When both parties should attend the mediation."
                        type="datetime-local"
                        value={meetingAtDraft}
                        onChange={(e) => setMeetingAtDraft(e.target.value)}
                      />
                      <TextField
                        label="Location"
                        hint="Where the mediation meeting will be held."
                        value={meetingLocationDraft}
                        onChange={(e) => setMeetingLocationDraft(e.target.value)}
                        placeholder="e.g. PSO Office, City Hall"
                      />
                    </div>
                    <Button
                      variant="solid"
                      tone="primary"
                      size="sm"
                      superscript="S+"
                      loading={schedulingMediation}
                      disabled={!meetingAtDraft}
                      onClick={handleScheduleMediation}
                      style={{ alignSelf: 'flex-start' }}
                    >
                      {schedulingMediation ? 'Scheduling…' : 'Schedule mediation'}
                    </Button>
                  </div>
                </RoleGate>
              )}

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
                    <div className={styles.subsectionTitle}>Record Outcome</div>
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
                      hint="What was agreed, for the record before the complaint is closed."
                      value={resolutionNotesDraft}
                      onChange={(e) => setResolutionNotesDraft(e.target.value)}
                      placeholder="e.g. Parties agreed to a fare refund at the MTFRB mediation meeting."
                    />
                    <Button
                      variant="solid"
                      tone="primary"
                      size="sm"
                      loading={savingOutcome}
                      disabled={!resolutionNotesDraft.trim()}
                      onClick={handleSaveOutcome}
                      style={{ alignSelf: 'flex-start' }}
                    >
                      {savingOutcome ? 'Saving…' : 'Save Outcome'}
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

              {selected.rideRequestId && <RideChatThread rideRequestId={selected.rideRequestId} />}
        </Modal>
      )}

      {pendingBulkKind && (
        <ConfirmModal
          title={BULK_TRIAGE_COPY[pendingBulkKind].title}
          message={BULK_TRIAGE_COPY[pendingBulkKind].message(complaints.filter((c) => selectedRowIds.has(c.id)))}
          confirmLabel={BULK_TRIAGE_COPY[pendingBulkKind].label}
          tone="primary"
          confirmLoading={bulkSubmitting}
          error={error}
          onCancel={() => setPendingBulkKind(null)}
          onConfirm={handleConfirmBulk}
        />
      )}
    </div>
  );
}
