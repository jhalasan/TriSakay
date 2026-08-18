import { create } from 'zustand';
import { listMyComplaints, submitComplaint, type ComplaintDbStatus } from '@trisakay/services';

export type ComplaintStatus = 'open' | 'review' | 'closed';

export interface ComplaintRow {
  id: string;
  subject: string;
  status: ComplaintStatus;
}

/** Collapses the six DB statuses into the three the UI distinguishes. */
function toUiStatus(status: ComplaintDbStatus): ComplaintStatus {
  if (status === 'open') return 'open';
  if (status === 'resolved' || status === 'dismissed') return 'closed';
  return 'review'; // 'under_review' | 'escalated' | 'mediation_scheduled'
}

interface ComplaintsState {
  complaints: ComplaintRow[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  submit: (subject: string, message: string) => Promise<boolean>;
}

export const useComplaintsStore = create<ComplaintsState>()((set, get) => ({
  complaints: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });

    const { data, error } = await listMyComplaints();
    if (error) {
      set({ loading: false, error });
      return;
    }

    set({
      loading: false,
      complaints: data.map((row) => ({ id: row.id, subject: row.subject, status: toUiStatus(row.status) })),
    });
  },

  submit: async (subject, message) => {
    set({ error: null });

    const { error } = await submitComplaint({ subject, message });
    if (error) {
      set({ error });
      return false;
    }

    // Re-fetch rather than optimistically prepending a local guess at the
    // new row — same reasoning as history/earnings dropping their local
    // mirrors: a fabricated local entry can drift from or duplicate what a
    // subsequent real load() returns.
    await get().load();
    return true;
  },
}));
