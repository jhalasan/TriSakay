import test from 'node:test';
import assert from 'node:assert/strict';
import { searchDrivers, searchPassengers } from '../src/lib/globalSearch.ts';
import type { DriverRow } from '../src/types/driver.ts';
import type { PassengerRow } from '../src/types/passenger.ts';

const DRIVERS: DriverRow[] = [
  {
    id: 'd1',
    fullName: 'Ferdinand Amaro',
    contactNo: '0917-000-0001',
    email: 'ferdinand.amaro@example.com',
    accountStatus: 'active',
    verificationStatus: 'approved',
    ratingAvg: 4.8,
    ratingCount: 40,
    plateNo: 'ABC-1234',
    cluster: 'red',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'd2',
    fullName: 'Reynaldo Suson',
    contactNo: '0917-000-0002',
    email: 'reynaldo.suson@example.com',
    accountStatus: 'active',
    verificationStatus: 'approved',
    ratingAvg: 3.1,
    ratingCount: 12,
    plateNo: 'XYZ-9876',
    cluster: 'white',
    createdAt: '2026-01-02T00:00:00.000Z',
  },
];

const PASSENGERS: PassengerRow[] = [
  {
    id: 'p1',
    fullName: 'Maria Fe Santos',
    contactNo: '0917-000-0003',
    email: 'maria.santos@example.com',
    accountStatus: 'active',
    totalRides: 20,
    hasApprovedDiscount: false,
    createdAt: '2026-01-03T00:00:00.000Z',
  },
];

test('searchDrivers matches by name (case-insensitive)', () => {
  const results = searchDrivers('ferdinand', DRIVERS);
  assert.deepEqual(results, [
    { key: 'driver:d1', to: '/drivers?highlight=d1', label: 'Ferdinand Amaro', sublabel: 'ABC-1234', group: 'Drivers' },
  ]);
});

test('searchDrivers matches by plate no', () => {
  const results = searchDrivers('xyz-98', DRIVERS);
  assert.equal(results.length, 1);
  assert.equal(results[0].label, 'Reynaldo Suson');
});

test('searchDrivers matches by email', () => {
  const results = searchDrivers('reynaldo.suson@', DRIVERS);
  assert.equal(results.length, 1);
  assert.equal(results[0].key, 'driver:d2');
});

test('searchDrivers returns [] for a blank query without matching every row', () => {
  assert.deepEqual(searchDrivers('', DRIVERS), []);
  assert.deepEqual(searchDrivers('   ', DRIVERS), []);
});

test('searchDrivers caps results at the given limit', () => {
  const manyDrivers = Array.from({ length: 10 }, (_, i) => ({ ...DRIVERS[0], id: `d${i}`, fullName: `Ferdinand ${i}` }));
  const results = searchDrivers('ferdinand', manyDrivers, 3);
  assert.equal(results.length, 3);
});

test('searchPassengers matches by name or email, not plate (passengers have none)', () => {
  assert.equal(searchPassengers('maria', PASSENGERS).length, 1);
  assert.equal(searchPassengers('maria.santos@', PASSENGERS).length, 1);
  assert.deepEqual(searchPassengers('ABC-1234', PASSENGERS), []);
});

test('searchPassengers returns [] for a blank query', () => {
  assert.deepEqual(searchPassengers('', PASSENGERS), []);
});
