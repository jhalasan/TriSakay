/** Mirrors docs/SCHEMA.MD `complaint_category` / `complaint_status` enums. */
export type ComplaintCategory =
  | 'fare'
  | 'conduct'
  | 'safety'
  | 'low_rating'
  | 'vehicle_condition'
  | 'other';

export type ComplaintStatus =
  | 'open'
  | 'under_review'
  | 'escalated'
  | 'mediation_scheduled'
  | 'resolved'
  | 'dismissed';

export interface ComplaintRow {
  id: string;
  subject: string;
  submittedByName: string;
  againstUserName: string | null;
  category: ComplaintCategory;
  status: ComplaintStatus;
  dhDirective: string | null; // FR-4.3a Department Head directive
  businessDaysElapsed: number; // feeds the FR-4.8 3-day ARTA flag
  createdAt: string;
}
