import { create } from 'zustand';
import { DOCUMENT_TYPES, type DocumentStatus, type DocumentType } from '../types/document';

interface DocumentsState {
  statuses: Record<DocumentType, DocumentStatus>;
  submit: (type: DocumentType) => void;
}

const initialStatuses = Object.fromEntries(
  DOCUMENT_TYPES.map((type) => [type, 'unsubmitted' as DocumentStatus])
) as Record<DocumentType, DocumentStatus>;

export const useDocumentsStore = create<DocumentsState>()((set) => ({
  statuses: initialStatuses,
  submit: (type) => set((state) => ({ statuses: { ...state.statuses, [type]: 'pending' } })),
}));
