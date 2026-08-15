/** Mirrors docs/SCHEMA.MD `discount_category` / `verification_status` (reused for review status) on `passenger_discounts`. */
export type DiscountCategory = 'senior_citizen' | 'pwd' | 'student';
export type DiscountReviewStatus = 'unsubmitted' | 'pending' | 'approved' | 'rejected';

export interface DiscountRow {
  id: string;
  passengerId: string;
  passengerName: string;
  category: DiscountCategory;
  status: DiscountReviewStatus;
  submittedAt: string; // ISO
  remarks: string | null;
  idPhotoFrontPath: string;
  idPhotoBackPath: string;
}
