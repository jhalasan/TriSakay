import type { AccountStatus } from './driver';
import type { DiscountCategory, DiscountReviewStatus } from './discount';

export interface PassengerDiscount {
  category: DiscountCategory;
  status: DiscountReviewStatus;
}

/** Mirrors docs/SCHEMA.MD `users` where role = 'passenger'. */
export interface PassengerRow {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  contactNo: string;
  email: string;
  accountStatus: AccountStatus;
  totalRides: number;
  discount: PassengerDiscount | null; // the passenger's latest passenger_discounts application, if any
  createdAt: string;
}
