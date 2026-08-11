export type DocumentType = 'drivers_license' | 'or_cr' | 'franchise_permit' | 'tricycle_photo';
export type DocumentStatus = 'unsubmitted' | 'selected' | 'pending' | 'verified' | 'rejected';

export const DOCUMENT_TYPES: DocumentType[] = ['drivers_license', 'or_cr', 'franchise_permit', 'tricycle_photo'];

export const DOCUMENT_LABEL: Record<DocumentType, string> = {
  drivers_license: "Driver's license",
  or_cr: 'OR / CR',
  franchise_permit: 'Franchise / permit',
  tricycle_photo: 'Tricycle photo',
};
