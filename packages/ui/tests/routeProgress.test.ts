import test from 'node:test';
import assert from 'node:assert/strict';
import { OFF_ROUTE_METERS, remainingRoute, snapToRoute } from '../src/hooks/routeProgress.ts';

// A north-south road: 0.001 deg of latitude is about 111 m.
const ROUTE = [
  { latitude: 6.1, longitude: 125.1 },
  { latitude: 6.101, longitude: 125.1 },
  { latitude: 6.102, longitude: 125.1 },
];

test('snapToRoute puts a position on the road onto the line with ~0 offset', () => {
  const snap = snapToRoute(ROUTE, { latitude: 6.1005, longitude: 125.1 });
  assert.ok(snap);
  assert.equal(snap.segmentIndex, 0);
  assert.ok(snap.distanceM < 0.5);
  assert.ok(Math.abs(snap.point.latitude - 6.1005) < 1e-6);
});

test('snapToRoute reports how far a position is from the line', () => {
  // 0.0005 deg of longitude at this latitude is about 55 m.
  const snap = snapToRoute(ROUTE, { latitude: 6.1015, longitude: 125.1005 });
  assert.ok(snap);
  assert.equal(snap.segmentIndex, 1);
  assert.ok(snap.distanceM > 50 && snap.distanceM < 60);
  assert.ok(snap.distanceM < OFF_ROUTE_METERS + 5);
});

test('snapToRoute clamps to the ends of the route', () => {
  const beyond = snapToRoute(ROUTE, { latitude: 6.11, longitude: 125.1 });
  assert.ok(beyond);
  assert.equal(beyond.segmentIndex, 1);
  assert.deepEqual(beyond.point, ROUTE[2]);
});

test('snapToRoute needs at least one segment', () => {
  assert.equal(snapToRoute([], { latitude: 6.1, longitude: 125.1 }), null);
  assert.equal(snapToRoute([ROUTE[0]], { latitude: 6.1, longitude: 125.1 }), null);
});

test('remainingRoute drops the part already driven', () => {
  const snap = snapToRoute(ROUTE, { latitude: 6.1015, longitude: 125.1 });
  assert.ok(snap);
  const left = remainingRoute(ROUTE, snap);
  assert.equal(left.length, 2);
  assert.ok(Math.abs(left[0].latitude - 6.1015) < 1e-6);
  assert.deepEqual(left[1], ROUTE[2]);
});
