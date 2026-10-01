import type { AdminRole } from '../types/role';
import type { ComplaintStatus } from '../types/complaint';
import { isSupervisor } from './rbac.ts';

export interface OwnershipInput {
  status: ComplaintStatus;
  assignedToId: string | null;
  assignedToName: string | null;
  assignmentAcceptedAt: string | null;
  /** Business days since the complaint was filed (unassigned) or last assigned (awaiting acceptance). */
  businessDaysUnowned: number;
}

export interface OwnershipView {
  state: 'unassigned' | 'awaiting' | 'owned';
  canClaim: boolean;
  canAssign: boolean;
  canAccept: boolean;
  canDecline: boolean;
  canRelease: boolean;
  /** May change status / triage. Mirrors the database rule: a supervisor always, staff only as the accepted owner. */
  canAct: boolean;
  /** Unowned or unaccepted for more than one business day. */
  stale: boolean;
}

/** UI mirror of the complaint ownership rules enforced by the database (supabase/migrations/20261001000004). */
export function complaintOwnership(c: OwnershipInput, viewer: { id: string; role: AdminRole }): OwnershipView {
  const closed = c.status === 'resolved' || c.status === 'dismissed';
  const state = c.assignedToId === null ? 'unassigned' : c.assignmentAcceptedAt === null ? 'awaiting' : 'owned';
  const supervisor = isSupervisor(viewer.role);
  const isOwner = c.assignedToId === viewer.id;

  return {
    state,
    canClaim: !closed && state === 'unassigned',
    canAssign: !closed && supervisor,
    canAccept: !closed && state === 'awaiting' && isOwner,
    canDecline: !closed && state === 'awaiting' && isOwner,
    canRelease: !closed && state !== 'unassigned' && (isOwner || supervisor),
    canAct: supervisor || (state === 'owned' && isOwner),
    stale: !closed && state !== 'owned' && c.businessDaysUnowned > 1,
  };
}

/** Short owner text for the list column. */
export function ownershipLabel(c: Pick<OwnershipInput, 'assignedToId' | 'assignedToName' | 'assignmentAcceptedAt'>): string {
  if (c.assignedToId === null) return 'Unassigned';
  const name = c.assignedToName ?? 'Unknown';
  return c.assignmentAcceptedAt === null ? `Awaiting acceptance: ${name}` : name;
}
