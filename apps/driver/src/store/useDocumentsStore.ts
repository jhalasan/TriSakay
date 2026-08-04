import { create } from 'zustand';
import { DOCUMENT_TYPES, type DocumentStatus, type DocumentType } from '../types/document';

export interface DocumentEntry {
  status: DocumentStatus;
  uri: string | null;
}

interface DocumentsState {
  documents: Record<DocumentType, DocumentEntry>;
  submit: (type: DocumentType, uri: string) => void;
  remove: (type: DocumentType) => void;
}

const initialDocuments = Object.fromEntries(
  DOCUMENT_TYPES.map((type) => [type, { status: 'unsubmitted' as DocumentStatus, uri: null }])
) as Record<DocumentType, DocumentEntry>;

export const useDocumentsStore = create<DocumentsState>()((set) => ({
  documents: initialDocuments,
  submit: (type, uri) =>
    set((state) => ({ documents: { ...state.documents, [type]: { status: 'pending', uri } } })),
  remove: (type) =>
    set((state) => ({ documents: { ...state.documents, [type]: { status: 'unsubmitted', uri: null } } })),
}));
