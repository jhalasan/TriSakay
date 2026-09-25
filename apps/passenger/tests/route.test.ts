import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineDistanceKm } from '@trisakay/utils';
import { __setSupabaseClientForTests } from '@trisakay/services';
import { fetchRouteEstimate } from '../src/utils/route.ts';

const PICKUP = { latitude: 6.1164, longitude: 125.1717 };
const DROPOFF = { latitude: 6.12, longitude: 125.18 };

function mockInvoke(impl: (body: unknown) => Promise<{ data: unknown; error: unknown }>) {
  __setSupabaseClientForTests({
    functions: { invoke: (_name: string, options: { body: unknown }) => impl(options.body) },
  } as any);
}

test('parses a maps-proxy route response into km + {latitude,longitude} points', async () => {
  mockInvoke(async () => ({
    data: {
      distanceKm: 2.5,
      geometry: [
        { latitude: 6.1164, longitude: 125.1717 },
        { latitude: 6.1182, longitude: 125.176 },
        { latitude: 6.12, longitude: 125.18 },
      ],
    },
    error: null,
  }));
  const result = await fetchRouteEstimate(PICKUP, DROPOFF);
  assert.equal(result.source, 'google');
  assert.equal(result.distanceKm, 2.5);
  assert.equal(result.geometry.length, 3);
  assert.deepEqual(result.geometry[0], { latitude: 6.1164, longitude: 125.1717 });
  assert.deepEqual(result.geometry[2], { latitude: 6.12, longitude: 125.18 });
});

test('falls back to a straight line + haversine when maps-proxy returns fallback:true', async () => {
  mockInvoke(async () => ({ data: { fallback: true }, error: null }));
  const result = await fetchRouteEstimate(PICKUP, DROPOFF);
  assert.equal(result.source, 'straight');
  assert.equal(result.geometry.length, 2);
  assert.equal(result.distanceKm, haversineDistanceKm(PICKUP, DROPOFF));
});

test('falls back to a straight line when the function call itself errors', async () => {
  mockInvoke(async () => ({ data: null, error: new Error('function error') }));
  const result = await fetchRouteEstimate(PICKUP, DROPOFF);
  assert.equal(result.source, 'straight');
  assert.equal(result.distanceKm, haversineDistanceKm(PICKUP, DROPOFF));
});

test('falls back to a straight line when invoke throws (offline)', async () => {
  mockInvoke(async () => {
    throw new Error('network');
  });
  const result = await fetchRouteEstimate(PICKUP, DROPOFF);
  assert.equal(result.source, 'straight');
  assert.equal(result.distanceKm, haversineDistanceKm(PICKUP, DROPOFF));
});

test('falls back to a straight line when the response has no usable geometry', async () => {
  mockInvoke(async () => ({ data: { distanceKm: 2.5, geometry: [{ latitude: 6.1164, longitude: 125.1717 }] }, error: null }));
  const result = await fetchRouteEstimate(PICKUP, DROPOFF);
  assert.equal(result.source, 'straight');
});
