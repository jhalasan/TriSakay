import type { VerificationCase } from '../types/verification';

/**
 * Pending verification cases. Per FR-1.4a, mtopNo/mtopExpiryDate/cluster
 * start blank ('') for a case still awaiting PSO review — the reviewer
 * transcribes them from the uploaded Franchise/Permit document; the app
 * never OCRs it.
 */
export const MOCK_VERIFICATION_CASES: VerificationCase[] = [
  {
    driverId: 'drv-002',
    driverFullName: 'Ariel Cabahug',
    plateNo: 'GSC-1187',
    documents: [
      { docType: 'drivers_license', label: "Driver's License", status: 'approved', storagePathPlaceholder: 'driver-docs/drv-002/license.jpg' },
      { docType: 'or_cr', label: 'OR / CR', status: 'pending', storagePathPlaceholder: 'driver-docs/drv-002/or-cr.jpg' },
      { docType: 'tricycle_photo', label: 'Tricycle Photo', status: 'pending', storagePathPlaceholder: 'driver-docs/drv-002/tricycle.jpg' },
      { docType: 'franchise_permit', label: 'Franchise / Permit', status: 'pending', storagePathPlaceholder: 'driver-docs/drv-002/mtop.jpg' },
    ],
    mtopNo: '',
    mtopExpiryDate: '',
    cluster: '',
    overallStatus: 'pending',
    notes: '',
  },
  {
    driverId: 'drv-006',
    driverFullName: 'Carlito Villanueva',
    plateNo: 'GSC-5567',
    documents: [
      { docType: 'drivers_license', label: "Driver's License", status: 'approved', storagePathPlaceholder: 'driver-docs/drv-006/license.jpg' },
      { docType: 'or_cr', label: 'OR / CR', status: 'approved', storagePathPlaceholder: 'driver-docs/drv-006/or-cr.jpg' },
      { docType: 'tricycle_photo', label: 'Tricycle Photo', status: 'approved', storagePathPlaceholder: 'driver-docs/drv-006/tricycle.jpg' },
      { docType: 'franchise_permit', label: 'Franchise / Permit', status: 'pending', storagePathPlaceholder: 'driver-docs/drv-006/mtop.jpg' },
    ],
    mtopNo: 'MTOP-2026-00447',
    mtopExpiryDate: '2026-09-15',
    cluster: 'melting_pot',
    overallStatus: 'pending',
    notes: 'Cross-checked plate and body number against uploaded OR/CR. Awaiting franchise permit confirmation before approval.',
  },
];
