import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, estimateEtaMinutes } from '../src/utils/geo.ts';

test('haversineKm returns ~0 for identical points', () => {
  assert.ok(haversineKm(6.1164, 125.1717, 6.1164, 125.1717) < 0.001);
});

test('haversineKm returns a sane distance for two known General Santos points', () => {
  // Roughly 1.1km apart (City Hall area to a nearby point), tolerant band.
  const km = haversineKm(6.1164, 125.1717, 6.1258, 125.1706);
  assert.ok(km > 0.9 && km < 1.3, `expected ~1.0-1.1km, got ${km}`);
});

test('estimateEtaMinutes divides distance by the assumed speed and converts to minutes', () => {
  // 5km at 20km/h = 0.25h = 15 minutes.
  assert.equal(estimateEtaMinutes(5, 20), 15);
});

test('estimateEtaMinutes rounds to the nearest whole minute', () => {
  // 1km at 20km/h = 0.05h = 3 minutes exactly; 1.2km = 3.6 min -> rounds to 4.
  assert.equal(estimateEtaMinutes(1.2, 20), 4);
});

test('estimateEtaMinutes returns 0 for zero distance', () => {
  assert.equal(estimateEtaMinutes(0, 20), 0);
});
