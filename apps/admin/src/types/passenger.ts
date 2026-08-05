import type { AccountStatus } from './driver';

/** Mirrors docs/SCHEMA.MD `users` where role = 'passenger'. */
export interface PassengerRow {
  id: string;
  fullName: string;
  contactNo: string;
  email: string;
  accountStatus: AccountStatus;
  totalRides: number;
  hasApprovedDiscount: boolean; // passenger_discounts.status = 'approved'
  createdAt: string;
}
