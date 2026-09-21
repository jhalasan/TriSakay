import { create } from 'zustand';
import { listOwnDriverDocuments, updateDriverDocumentExpiry, type OwnDriverDocumentRow } from '@trisakay/services';

/** UAT D13 — the driver's own documents with their self-reported expiry dates. */
interface DriverDocumentsState {
  documents: OwnDriverDocumentRow[];
  loading: boolean;
  error: string | null;
  saving: string | null;
  load: () => Promise<void>;
  setExpiry: (documentId: string, expiryDate: string | null) => Promise<{ error: string | null }>;
}

export const useDriverDocumentsStore = create<DriverDocumentsState>()((set, get) => ({
  documents: [],
  loading: false,
  error: null,
  saving: null,

  load: async () => {
    set({ loading: true, error: null });
    const { data, error } = await listOwnDriverDocuments();
    set({ loading: false, documents: data, error });
  },

  setExpiry: async (documentId, expiryDate) => {
    set({ saving: documentId });
    const { error } = await updateDriverDocumentExpiry(documentId, expiryDate);
    set({ saving: null });
    if (!error) {
      set({
        documents: get().documents.map((d) => (d.id === documentId ? { ...d, expiryDate } : d)),
      });
    }
    return { error };
  },
}));
