import type { ComplaintDbStatus } from '@trisakay/services';
import { getComplaintStageStates, type ComplaintStageState } from './complaintStages.ts';

// Hex literals rather than importing `colors` from '@trisakay/ui': that
// package's barrel uses extensionless directory imports that plain
// `node --test` (this app's test runner, unlike packages/ui's own tsx-based
// one) can't resolve as ESM. Values copied verbatim from
// packages/ui/src/theme/colors.ts — keep these two in sync by hand.
const accentBlueSoft = '#E3EDF7';
const accentBluePressed = '#002043';
const dangerSoft = '#FBEAE8';
const dangerPressed = '#931E17';
const accentGreenSoft = '#E9F7E3';
const accentGreenPressed = '#3B602B';
const fill = '#EDF1F4';
const inkSoft = '#5A646B';
const accentGreen = '#477434';
const accentBlue = '#002E60';
const line = '#DCE2E6';
const lineStrong = '#838B91';

export interface StatusChipTone {
  bg: string;
  fg: string;
}

/** StatusChip colours (README §1.2). "Under review" is blue, never green — resolved is the only green status. */
export const STATUS_CHIP_TONE: Record<ComplaintDbStatus, StatusChipTone> = {
  open: { bg: accentBlueSoft, fg: accentBluePressed },
  under_review: { bg: accentBlueSoft, fg: accentBluePressed },
  mediation_scheduled: { bg: accentBlueSoft, fg: accentBluePressed },
  escalated: { bg: dangerSoft, fg: dangerPressed },
  resolved: { bg: accentGreenSoft, fg: accentGreenPressed },
  dismissed: { bg: fill, fg: inkSoft },
};

export interface StageBarSegmentColors {
  segment1: string;
  segment2: string;
  segment3: string;
}

const DONE = accentGreen;
const CURRENT = accentBlue;
const PENDING = line;
const DISMISSED_DECISION = lineStrong;

function segmentColor(state: ComplaintStageState, doneColor: string): string {
  if (state === 'done') return doneColor;
  if (state === 'current') return CURRENT;
  return PENDING;
}

/** StageBar segment colours (README §1.3), derived from getComplaintStageStates — never duplicates that logic. */
export function getStageBarColors(status: ComplaintDbStatus): StageBarSegmentColors {
  const { underReview, resolution } = getComplaintStageStates(status);
  return {
    segment1: DONE,
    segment2: segmentColor(underReview, DONE),
    segment3: resolution === 'done' ? (status === 'dismissed' ? DISMISSED_DECISION : DONE) : PENDING,
  };
}

export function isTerminalStatus(status: ComplaintDbStatus): boolean {
  return status === 'resolved' || status === 'dismissed';
}
