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
  message: string;
  submittedByName: string;
  againstUserName: string | null;
  rideRequestId: string | null;
  category: ComplaintCategory;
  status: ComplaintStatus;
  dhDirective: string | null; // FR-4.3a Department Head directive
  mediationMeetingAt: string | null; // FR-4.5 MTFRB meeting date/time
  mediationLocation: string | null; // FR-4.5, typically the PSO office
  resolutionNotes: string | null; // FR-4.6 mediation outcome / settlement details
  businessDaysElapsed: number; // feeds the FR-4.8 3-day ARTA flag
  createdAt: string;
  triagedByName: string | null;
  triagedAt: string | null;
  dhReviewedByName: string | null;
  dhReviewedAt: string | null;
  mediationScheduledByName: string | null;
  mediationScheduledAt: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  assignedAt: string | null;
  assignmentAcceptedAt: string | null;
  /** Business days since filed (unassigned) or since last assigned (awaiting acceptance). */
  businessDaysUnowned: number;
}
