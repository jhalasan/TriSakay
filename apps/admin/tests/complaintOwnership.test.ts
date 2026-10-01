import test from 'node:test';
import assert from 'node:assert/strict';
import { complaintOwnership, ownershipLabel } from '../src/lib/complaintOwnership.ts';

const base = {
  status: 'open' as const,
  assignedToId: null as string | null,
  assignedToName: null as string | null,
  assignmentAcceptedAt: null as string | null,
  businessDaysUnowned: 0,
};
const staff = { id: 'u1', role: 'pso_staff' as const };
const sup = { id: 'u9', role: 'pso_supervisor' as const };

test('an unassigned complaint can be claimed by staff, assigned by a supervisor, and not acted on by staff', () => {
  const s = complaintOwnership(base, staff);
  assert.equal(s.state, 'unassigned');
  assert.equal(s.canClaim, true);
  assert.equal(s.canAssign, false);
  assert.equal(s.canAct, false);
  assert.equal(complaintOwnership(base, sup).canAssign, true);
  assert.equal(complaintOwnership(base, sup).canAct, true);
});

test('an assignment waiting for acceptance can be accepted or declined only by the new owner; staff cannot act yet', () => {
  const c = { ...base, assignedToId: 'u1', assignedToName: 'Ana', assignmentAcceptedAt: null };
  const owner = complaintOwnership(c, staff);
  assert.equal(owner.state, 'awaiting');
  assert.equal(owner.canAccept, true);
  assert.equal(owner.canDecline, true);
  assert.equal(owner.canAct, false);
  const other = complaintOwnership(c, { id: 'u2', role: 'pso_staff' });
  assert.equal(other.canAccept, false);
  assert.equal(other.canRelease, false);
  assert.equal(complaintOwnership(c, sup).canRelease, true);
});

test('an accepted complaint lets only its owner (or a supervisor) act, and the owner can release it', () => {
  const c = { ...base, assignedToId: 'u1', assignedToName: 'Ana', assignmentAcceptedAt: '2026-08-02T00:00:00Z' };
  const owner = complaintOwnership(c, staff);
  assert.equal(owner.state, 'owned');
  assert.equal(owner.canAct, true);
  assert.equal(owner.canRelease, true);
  assert.equal(owner.canClaim, false);
  assert.equal(complaintOwnership(c, { id: 'u2', role: 'pso_staff' }).canAct, false);
});

test('a closed complaint offers no ownership actions', () => {
  const c = { ...base, status: 'resolved' as const, assignedToId: 'u1', assignedToName: 'Ana', assignmentAcceptedAt: '2026-08-02T00:00:00Z' };
  const v = complaintOwnership(c, sup);
  assert.equal(v.canClaim || v.canAssign || v.canAccept || v.canDecline || v.canRelease, false);
});

test('unowned or unaccepted for more than one business day is flagged stale; closed ones never are', () => {
  assert.equal(complaintOwnership({ ...base, businessDaysUnowned: 2 }, staff).stale, true);
  assert.equal(complaintOwnership({ ...base, businessDaysUnowned: 1 }, staff).stale, false);
  const awaiting = { ...base, assignedToId: 'u1', assignedToName: 'Ana', businessDaysUnowned: 3 };
  assert.equal(complaintOwnership(awaiting, staff).stale, true);
  const owned = { ...awaiting, assignmentAcceptedAt: '2026-08-02T00:00:00Z' };
  assert.equal(complaintOwnership(owned, staff).stale, false);
  assert.equal(complaintOwnership({ ...base, status: 'dismissed' as const, businessDaysUnowned: 9 }, staff).stale, false);
});

test('ownershipLabel names the owner, or says Unassigned / Awaiting acceptance', () => {
  assert.equal(ownershipLabel(base), 'Unassigned');
  assert.equal(ownershipLabel({ ...base, assignedToId: 'u1', assignedToName: 'Ana' }), 'Awaiting acceptance: Ana');
  assert.equal(ownershipLabel({ ...base, assignedToId: 'u1', assignedToName: 'Ana', assignmentAcceptedAt: '2026-08-02T00:00:00Z' }), 'Ana');
  assert.equal(ownershipLabel({ ...base, assignedToId: 'u1', assignedToName: null, assignmentAcceptedAt: '2026-08-02T00:00:00Z' }), 'Unknown');
});
