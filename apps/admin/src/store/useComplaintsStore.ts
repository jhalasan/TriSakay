import { create } from 'zustand';
import {
  acceptComplaint,
  assignComplaint,
  claimComplaint,
  declineComplaint,
  listComplaintAssignments,
  listPsoStaff,
  releaseComplaint,
  listComplaintAttachments,
  listComplaints,
  listComplaintStatusHistory,
  recordComplaintResolution,
  recordDhDirective,
  scheduleComplaintMediation,
  setComplaintStatus,
} from '../services/complaints';
import type { ComplaintAssignmentRow, ComplaintAttachmentRow, ComplaintStatusHistoryRow, PsoStaffRow } from '../services/complaints';
import type { ComplaintRow, ComplaintStatus } from '../types/complaint';
import { runBulkAction, type BulkActionSummary } from '../lib/bulkActions';

interface ComplaintsState {
  complaints: ComplaintRow[];
  loading: boolean;
  error: string | null;
  search: string;
  statusFilter: ComplaintStatus | 'all';
  page: number;
  attachments: ComplaintAttachmentRow[];
  attachmentsLoading: boolean;
  statusHistory: ComplaintStatusHistoryRow[];
  statusHistoryLoading: boolean;
  assignments: ComplaintAssignmentRow[];
  assignmentsLoading: boolean;
  psoStaff: PsoStaffRow[];
  /** 'all' (default), 'mine' (owned by me) or 'unassigned' — filters the list in Complaints.tsx. */
  ownerFilter: 'all' | 'mine' | 'unassigned';
  setOwnerFilter: (value: ComplaintsState['ownerFilter']) => void;
  /** Ownership actions: each refetches the list and the open complaint's handoff history on success. */
  claim: (id: string) => Promise<boolean>;
  assign: (id: string, toUserId: string, note: string) => Promise<boolean>;
  accept: (id: string) => Promise<boolean>;
  decline: (id: string, note: string) => Promise<boolean>;
  release: (id: string, note: string) => Promise<boolean>;
  fetchAssignments: (complaintId: string) => Promise<void>;
  fetchPsoStaff: () => Promise<void>;
  fetch: () => Promise<void>;
  setSearch: (value: string) => void;
  setStatusFilter: (value: ComplaintsState['statusFilter']) => void;
  setPage: (page: number) => void;
  updateStatus: (id: string, status: ComplaintStatus) => Promise<boolean>;
  /** Bulk triage only — mirrors the same "open/under_review/escalated" restriction as the single-row
   * Status <select> in Complaints.tsx (see that file's TRIAGE_STATUSES comment): resolving/dismissing
   * always needs case-specific outcome notes, so there's no bulk path for those, by design. */
  bulkUpdateStatus: (ids: string[], status: ComplaintStatus) => Promise<BulkActionSummary>;
  setDhDirective: (id: string, directive: string) => Promise<boolean>;
  scheduleMediation: (id: string, meetingAt: string, location: string) => Promise<boolean>;
  recordResolution: (id: string, status: 'resolved' | 'dismissed', notes: string) => Promise<boolean>;
  /** Lazy — only fetched once a complaint is opened for review, not for every row in the list. */
  fetchAttachments: (complaintId: string) => Promise<void>;
  /** Lazy, same as fetchAttachments. */
  fetchStatusHistory: (complaintId: string) => Promise<void>;
}

export const useComplaintsStore = create<ComplaintsState>()((set, get) => {
  async function runOwnershipAction(id: string, action: () => Promise<{ error: string | null }>): Promise<boolean> {
    const { error } = await action();
    if (error) {
      set({ error });
      return false;
    }
    set({ error: null });
    await Promise.all([get().fetch(), get().fetchAssignments(id)]);
    return true;
  }

  return {
  complaints: [],
  loading: false,
  error: null,
  search: '',
  statusFilter: 'all',
  page: 1,
  attachments: [],
  attachmentsLoading: false,
  statusHistory: [],
  statusHistoryLoading: false,
  assignments: [],
  assignmentsLoading: false,
  psoStaff: [],
  ownerFilter: 'all',

  setOwnerFilter: (value) => set({ ownerFilter: value, page: 1 }),

  claim: async (id) => runOwnershipAction(id, () => claimComplaint(id)),
  assign: async (id, toUserId, note) => runOwnershipAction(id, () => assignComplaint(id, toUserId, note)),
  accept: async (id) => runOwnershipAction(id, () => acceptComplaint(id)),
  decline: async (id, note) => runOwnershipAction(id, () => declineComplaint(id, note)),
  release: async (id, note) => runOwnershipAction(id, () => releaseComplaint(id, note)),

  fetchAssignments: async (complaintId) => {
    set({ assignments: [], assignmentsLoading: true });
    const { data, error } = await listComplaintAssignments(complaintId);
    if (error) return set({ assignmentsLoading: false, error });
    set({ assignments: data, assignmentsLoading: false });
  },

  fetchPsoStaff: async () => {
    const { data, error } = await listPsoStaff();
    if (error) return set({ error });
    set({ psoStaff: data });
  },

  fetch: async () => {
    set({ loading: true, error: null });
    const { data, error } = await listComplaints();
    set({ complaints: data, loading: false, error });
  },

  setSearch: (value) => set({ search: value, page: 1 }),
  setStatusFilter: (value) => set({ statusFilter: value, page: 1 }),
  setPage: (page) => set({ page }),

  updateStatus: async (id, status) => {
    const { error } = await setComplaintStatus(id, status);
    if (error) {
      set({ error });
      return false;
    }
    await get().fetch();
    return true;
  },

  bulkUpdateStatus: async (ids, status) => {
    const summary = await runBulkAction(ids, (id) => setComplaintStatus(id, status), '');
    if (summary.failed > 0) set({ error: `${summary.failed} of ${ids.length} complaint(s) could not be updated.` });
    await get().fetch();
    return summary;
  },

  setDhDirective: async (id, directive) => {
    const { error } = await recordDhDirective(id, directive);
    if (error) {
      set({ error });
      return false;
    }
    await get().fetch();
    return true;
  },

  scheduleMediation: async (id, meetingAt, location) => {
    const { error } = await scheduleComplaintMediation(id, meetingAt, location);
    if (error) {
      set({ error });
      return false;
    }
    await get().fetch();
    return true;
  },

  recordResolution: async (id, status, notes) => {
    const { error } = await recordComplaintResolution(id, status, notes);
    if (error) {
      set({ error });
      return false;
    }
    await get().fetch();
    return true;
  },

  fetchAttachments: async (complaintId) => {
    set({ attachments: [], attachmentsLoading: true });
    const { data, error } = await listComplaintAttachments(complaintId);
    if (error) return set({ attachmentsLoading: false, error });
    set({ attachments: data, attachmentsLoading: false });
  },

  fetchStatusHistory: async (complaintId) => {
    set({ statusHistory: [], statusHistoryLoading: true });
    const { data, error } = await listComplaintStatusHistory(complaintId);
    if (error) return set({ statusHistoryLoading: false, error });
    set({ statusHistory: data, statusHistoryLoading: false });
  },
};
});
