import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineDistanceKm } from '@trisakay/utils';
import { fetchRouteEstimate } from '../src/utils/route.ts';

const PICKUP = { latitude: 6.1164, longitude: 125.1717 };
const DROPOFF = { latitude: 6.12, longitude: 125.18 };

function mockFetch(impl: typeof globalThis.fetch) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return () => { globalThis.fetch = original; };
}

test('parses an OSRM geojson route into km + {latitude,longitude} points', async () => {
  const restore = mockFetch((async () => ({
    ok: true,
    json: async () => ({
      code: 'Ok',
      routes: [{
        distance: 2500,
        geometry: { coordinates: [[125.1717, 6.1164], [125.176, 6.1182], [125.18, 6.12]] },
      }],
    }),
  })) as unknown as typeof globalThis.fetch);
  try {
    const result = await fetchRouteEstimate(PICKUP, DROPOFF);
    assert.equal(result.source, 'osrm');
    assert.equal(result.distanceKm, 2.5);
    assert.equal(result.geometry.length, 3);
    assert.deepEqual(result.geometry[0], { latitude: 6.1164, longitude: 125.1717 });
    assert.deepEqual(result.geometry[2], { latitude: 6.12, longitude: 125.18 });
  } finally { restore(); }
});

test('falls back to a straight line + haversine when OSRM returns not-ok', async () => {
  const restore = mockFetch((async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof globalThis.fetch);
  try {
    const result = await fetchRouteEstimate(PICKUP, DROPOFF);
    assert.equal(result.source, 'straight');
    assert.equal(result.geometry.length, 2);
    assert.equal(result.distanceKm, haversineDistanceKm(PICKUP, DROPOFF));
  } finally { restore(); }
});

test('falls back to a straight line when fetch throws (offline)', async () => {
  const restore = mockFetch((async () => { throw new Error('network'); }) as unknown as typeof globalThis.fetch);
  try {
    const result = await fetchRouteEstimate(PICKUP, DROPOFF);
    assert.equal(result.source, 'straight');
    assert.equal(result.distanceKm, haversineDistanceKm(PICKUP, DROPOFF));
  } finally { restore(); }
});

test('falls back when OSRM code is not Ok (no route found)', async () => {
  const restore = mockFetch((async () => ({ ok: true, json: async () => ({ code: 'NoRoute', routes: [] }) })) as unknown as typeof globalThis.fetch);
  try {
    const result = await fetchRouteEstimate(PICKUP, DROPOFF);
    assert.equal(result.source, 'straight');
  } finally { restore(); }
});

test('falls back to a straight line when the request aborts (hung OSRM server)', async () => {
  const restore = mockFetch((async () => {
    throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
  }) as unknown as typeof globalThis.fetch);
  try {
    const result = await fetchRouteEstimate(PICKUP, DROPOFF);
    assert.equal(result.source, 'straight');
    assert.equal(result.distanceKm, haversineDistanceKm(PICKUP, DROPOFF));
  } finally { restore(); }
});
