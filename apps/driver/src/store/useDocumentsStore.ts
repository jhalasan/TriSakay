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
  // 'selected', not 'pending' — picking a file just stages it locally. It
  // isn't actually uploaded until handleSubmit calls submitDriverDocuments
  // during registration, so 'pending' (awaiting PSO review) would be a lie
  // told before the file has even left the device.
  submit: (type, uri) =>
    set((state) => ({ documents: { ...state.documents, [type]: { status: 'selected', uri } } })),
  remove: (type) =>
    set((state) => ({ documents: { ...state.documents, [type]: { status: 'unsubmitted', uri: null } } })),
}));
