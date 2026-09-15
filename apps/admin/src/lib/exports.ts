import type { CsvColumn } from './csv.ts';
import type { DriverRow } from '../types/driver.ts';
import type { PassengerRow } from '../types/passenger.ts';
import type { TricycleRow } from '../types/tricycle.ts';
import { daysUntilExpiry } from '../types/tricycle.ts';
import { formatDate, titleCaseLabel } from './format.ts';

export const driverCsvColumns: CsvColumn<DriverRow>[] = [
  { header: 'Last Name', value: (d) => d.lastName },
  { header: 'First Name', value: (d) => d.firstName },
  { header: 'Contact No', value: (d) => d.contactNo },
  { header: 'Email', value: (d) => d.email },
  { header: 'Plate No', value: (d) => d.plateNo },
  { header: 'Cluster', value: (d) => (d.cluster ? titleCaseLabel(d.cluster) : '') },
  { header: 'Account Status', value: (d) => titleCaseLabel(d.accountStatus) },
  { header: 'Verification Status', value: (d) => titleCaseLabel(d.verificationStatus) },
  { header: 'Rating', value: (d) => (d.ratingCount > 0 ? d.ratingAvg.toFixed(2) : '') },
  { header: 'Ratings Count', value: (d) => d.ratingCount },
  { header: 'Trips', value: (d) => d.tripCount },
  { header: 'Registered', value: (d) => formatDate(d.createdAt) },
];

export const passengerCsvColumns: CsvColumn<PassengerRow>[] = [
  { header: 'Last Name', value: (p) => p.lastName },
  { header: 'First Name', value: (p) => p.firstName },
  { header: 'Contact No', value: (p) => p.contactNo },
  { header: 'Email', value: (p) => p.email },
  { header: 'Account Status', value: (p) => titleCaseLabel(p.accountStatus) },
  { header: 'Total Rides', value: (p) => p.totalRides },
  { header: 'Fare Discount', value: (p) => (p.discount ? `${titleCaseLabel(p.discount.category)} - ${titleCaseLabel(p.discount.status)}` : '') },
  { header: 'Registered', value: (p) => formatDate(p.createdAt) },
];

export const tricycleCsvColumns: CsvColumn<TricycleRow>[] = [
  { header: 'Plate No', value: (t) => t.plateNo },
  { header: 'Body No', value: (t) => t.bodyNo },
  { header: 'Cluster', value: (t) => (t.cluster ? titleCaseLabel(t.cluster) : '') },
  { header: 'Verification Status', value: (t) => titleCaseLabel(t.verificationStatus) },
  { header: 'MTOP No', value: (t) => t.mtopNo },
  { header: 'MTOP Expiry Date', value: (t) => (t.mtopExpiryDate ? formatDate(t.mtopExpiryDate) : '') },
  { header: 'Days Until Expiry', value: (t) => daysUntilExpiry(t.mtopExpiryDate) ?? '' },
  { header: 'Driver', value: (t) => t.driverName },
  { header: 'Driver Contact No', value: (t) => t.driverContactNo },
];

/** Mirrors Reports.tsx's `transactions-${range}-${date}.csv` naming. */
export function exportFilename(prefix: string, filter: string): string {
  return `${prefix}-${filter}-${new Date().toISOString().slice(0, 10)}.csv`;
}
