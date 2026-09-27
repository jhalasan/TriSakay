import test from 'node:test';
import assert from 'node:assert/strict';
import { isStopOverdue, sortByNextStop, type NextStopPassenger } from '../src/utils/nextStop.ts';

// Driver parked at a fixed point in General Santos; stops are placed a given
// number of km due north of it (1 degree of latitude is ~111.195 km).
const DRIVER = { lat: 6.1, lng: 125.17 };
const KM_PER_DEG_LAT = 111.195;
const NOW = Date.parse('2026-09-27T10:00:00Z');

function northKm(km: number): { lat: number; lng: number } {
  return { lat: DRIVER.lat + km / KM_PER_DEG_LAT, lng: DRIVER.lng };
}

function minutesAgo(min: number): string {
  return new Date(NOW - min * 60_000).toISOString();
}

/** A passenger still waiting at a pickup `km` away. */
function waiting(id: string, km: number, extra: Partial<NextStopPassenger> = {}): NextStopPassenger {
  const p = northKm(km);
  return { id, status: 'assigned', pickupLat: p.lat, pickupLng: p.lng, destLat: null, destLng: null, assignedAt: minutesAgo(1), ...extra };
}

/** A passenger on board whose drop-off is `km` away. */
function onBoard(id: string, km: number, extra: Partial<NextStopPassenger> = {}): NextStopPassenger {
  const d = northKm(km);
  return { id, status: 'ongoing', pickupLat: DRIVER.lat, pickupLng: DRIVER.lng, destLat: d.lat, destLng: d.lng, pickedUpAt: minutesAgo(1), distanceKm: 3, ...extra };
}

function ids(result: { passenger: NextStopPassenger }[]): string[] {
  return result.map((r) => r.passenger.id);
}

test('next stop is the drop-off when on board and the pickup when waiting, nearest first', () => {
  const result = sortByNextStop([onBoard('a', 2), waiting('b', 0.5), onBoard('c', 1)], DRIVER, [], NOW);
  assert.deepEqual(ids(result), ['b', 'c', 'a']);
  assert.ok(Math.abs(result[0].distanceKm! - 0.5) < 0.01);
  assert.equal(result[0].stopLat, northKm(0.5).lat);
  assert.equal(result[1].stopLat, northKm(1).lat, 'on-board stop points at the drop-off');
});

test('without a GPS fix, keeps accept order and reports no distance', () => {
  const result = sortByNextStop([onBoard('a', 2), waiting('b', 0.5)], null, [], NOW);
  assert.deepEqual(ids(result), ['a', 'b']);
  assert.equal(result[0].distanceKm, null);
});

test('without a GPS fix, keeps the last shown order when there is one', () => {
  const result = sortByNextStop([onBoard('a', 2), waiting('b', 0.5), onBoard('c', 1)], null, ['c', 'b'], NOW);
  assert.deepEqual(ids(result), ['c', 'b', 'a']);
});

test('no jumping: a stop less than 150 m closer does not overtake the current order', () => {
  // 'a' was on top; 'b' is now 100 m closer — GPS jitter territory.
  const result = sortByNextStop([onBoard('a', 1.0), onBoard('b', 0.9)], DRIVER, ['a', 'b'], NOW);
  assert.deepEqual(ids(result), ['a', 'b']);
});

test('no jumping: a stop 150 m or more closer does overtake', () => {
  const result = sortByNextStop([onBoard('a', 1.0), onBoard('b', 0.8)], DRIVER, ['a', 'b'], NOW);
  assert.deepEqual(ids(result), ['b', 'a']);
});

test('a newly accepted passenger is placed by distance, not appended', () => {
  const result = sortByNextStop([onBoard('a', 1.0), waiting('new', 0.2)], DRIVER, ['a'], NOW);
  assert.deepEqual(ids(result), ['new', 'a']);
});

test('a passenger with no stop coordinates goes last', () => {
  const noCoords: NextStopPassenger = { id: 'x', status: 'assigned', pickupLat: null, pickupLng: null, destLat: null, destLng: null };
  const result = sortByNextStop([noCoords, onBoard('a', 2)], DRIVER, [], NOW);
  assert.deepEqual(ids(result), ['a', 'x']);
  assert.equal(result[1].distanceKm, null);
});

test('priority 1: a waiting transfer pickup goes to the top even when farther', () => {
  const result = sortByNextStop([onBoard('a', 0.5), waiting('t', 2, { isTransferPickup: true })], DRIVER, [], NOW);
  assert.deepEqual(ids(result), ['t', 'a']);
});

test('priority 1 exception: an on-board drop-off 300 m or less away comes before the transfer pickup', () => {
  const result = sortByNextStop([waiting('t', 2, { isTransferPickup: true }), onBoard('near', 0.3)], DRIVER, [], NOW);
  assert.deepEqual(ids(result), ['near', 't']);
});

test('priority 1 exception does not apply to a drop-off more than 300 m away', () => {
  const result = sortByNextStop([waiting('t', 2, { isTransferPickup: true }), onBoard('far', 0.4)], DRIVER, [], NOW);
  assert.deepEqual(ids(result), ['t', 'far']);
});

test('priority 1 exception does not pull a nearby waiting pickup ahead of the transfer', () => {
  const result = sortByNextStop([waiting('t', 2, { isTransferPickup: true }), waiting('w', 0.2)], DRIVER, [], NOW);
  assert.deepEqual(ids(result), ['t', 'w']);
});

test('priority 2: an overdue on-board passenger comes before a closer one', () => {
  // 3 km at 20 km/h is 9 min normal; 1.5x is 13.5 min; 20 min on board is overdue.
  const late = onBoard('late', 2, { distanceKm: 3, pickedUpAt: minutesAgo(20) });
  const result = sortByNextStop([onBoard('close', 0.3), late], DRIVER, [], NOW);
  assert.deepEqual(ids(result), ['late', 'close']);
});

test('priority 2: an on-board passenger within 1.5x the normal time is not bumped up', () => {
  const onTime = onBoard('onTime', 2, { distanceKm: 3, pickedUpAt: minutesAgo(12) });
  const result = sortByNextStop([onBoard('close', 0.3), onTime], DRIVER, [], NOW);
  assert.deepEqual(ids(result), ['close', 'onTime']);
});

test('priority 2: an overdue waiting passenger comes before a closer one', () => {
  // Pickup 2 km away: 6 min normal, 9 min at 1.5x; assigned 10 min ago.
  const result = sortByNextStop([onBoard('close', 0.3), waiting('late', 2, { assignedAt: minutesAgo(10) })], DRIVER, [], NOW);
  assert.deepEqual(ids(result), ['late', 'close']);
});

test('priority 2 comes after a transfer pickup', () => {
  const late = onBoard('late', 2, { distanceKm: 3, pickedUpAt: minutesAgo(20) });
  const result = sortByNextStop([late, waiting('t', 1, { isTransferPickup: true })], DRIVER, [], NOW);
  assert.deepEqual(ids(result), ['t', 'late']);
});

test('isStopOverdue: on-board ride distance falls back to pickup-to-drop-off when distanceKm is missing', () => {
  // Pickup is the driver point; drop-off 3 km north -> 9 min normal, 13.5 min threshold.
  const p = onBoard('a', 3, { distanceKm: null, pickedUpAt: minutesAgo(14) });
  assert.equal(isStopOverdue(p, 3, NOW), true);
});

test('isStopOverdue: normal time is never below 5 minutes', () => {
  // Pickup 100 m away would be 0.3 min normal; the 5 min floor makes the threshold 7.5 min.
  assert.equal(isStopOverdue(waiting('w', 0.1, { assignedAt: minutesAgo(6) }), 0.1, NOW), false);
  assert.equal(isStopOverdue(waiting('w', 0.1, { assignedAt: minutesAgo(8) }), 0.1, NOW), true);
});

test('isStopOverdue: false without a start time', () => {
  assert.equal(isStopOverdue(onBoard('a', 1, { pickedUpAt: null }), 1, NOW), false);
  assert.equal(isStopOverdue(waiting('w', 1, { assignedAt: null }), 1, NOW), false);
});
