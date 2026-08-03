import { create } from 'zustand';

export type ComplaintStatus = 'open' | 'review' | 'closed';

export interface ComplaintRow {
  id: string;
  subject: string;
  status: ComplaintStatus;
}

interface ComplaintsState {
  complaints: ComplaintRow[];
  addComplaint: (complaint: ComplaintRow) => void;
}

export const useComplaintsStore = create<ComplaintsState>()((set) => ({
  complaints: [],
  addComplaint: (complaint) => set((state) => ({ complaints: [complaint, ...state.complaints] })),
}));
