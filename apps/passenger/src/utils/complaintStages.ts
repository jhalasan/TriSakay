import type { ComplaintDbStatus } from '@trisakay/services';

export type ComplaintStageState = 'done' | 'current' | 'pending';

export interface ComplaintStageStates {
  underReview: ComplaintStageState;
  resolution: ComplaintStageState;
}

/**
 * The "Received" stage is always done (a complaint can't exist without being received).
 * "Resolution" is done once the complaint reaches a terminal status; otherwise pending.
 * "Under review" is done once resolution is done, current once the complaint has left
 * 'open', otherwise pending.
 */
export function getComplaintStageStates(status: ComplaintDbStatus): ComplaintStageStates {
  const resolutionDone = status === 'resolved' || status === 'dismissed';
  const underReviewDone = status !== 'open';

  return {
    underReview: resolutionDone ? 'done' : underReviewDone ? 'current' : 'pending',
    resolution: resolutionDone ? 'done' : 'pending',
  };
}
