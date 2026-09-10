import type { CsvColumn } from './csv.ts';
import type { DriverRow } from '../types/driver.ts';
import type { PassengerRow } from '../types/passenger.ts';
import { formatDate, titleCaseLabel } from './format.ts';

export const driverCsvColumns: CsvColumn<DriverRow>[] = [
  { header: 'Name', value: (d) => d.fullName },
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
  { header: 'Name', value: (p) => p.fullName },
  { header: 'Contact No', value: (p) => p.contactNo },
  { header: 'Email', value: (p) => p.email },
  { header: 'Account Status', value: (p) => titleCaseLabel(p.accountStatus) },
  { header: 'Total Rides', value: (p) => p.totalRides },
  { header: 'Fare Discount', value: (p) => (p.discount ? `${titleCaseLabel(p.discount.category)} - ${titleCaseLabel(p.discount.status)}` : '') },
  { header: 'Registered', value: (p) => formatDate(p.createdAt) },
];

/** Mirrors Reports.tsx's `transactions-${range}-${date}.csv` naming. */
export function exportFilename(prefix: string, filter: string): string {
  return `${prefix}-${filter}-${new Date().toISOString().slice(0, 10)}.csv`;
}
