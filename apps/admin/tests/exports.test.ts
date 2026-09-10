import test from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from '../src/lib/csv.ts';
import { driverCsvColumns, passengerCsvColumns, exportFilename } from '../src/lib/exports.ts';
import type { DriverRow } from '../src/types/driver.ts';
import type { PassengerRow } from '../src/types/passenger.ts';

const driver: DriverRow = {
  id: 'd1',
  fullName: 'Doe, Juan',
  contactNo: '09171234567',
  email: 'juan@example.com',
  accountStatus: 'active',
  verificationStatus: 'approved',
  ratingAvg: 4.5,
  ratingCount: 10,
  plateNo: 'ABC-123',
  cluster: null,
  tripCount: 34,
  createdAt: '2026-01-15T00:00:00.000Z',
};

const passenger: PassengerRow = {
  id: 'p1',
  fullName: 'Santos, Maria',
  contactNo: '09181234567',
  email: 'maria@example.com',
  accountStatus: 'active',
  totalRides: 12,
  discount: { category: 'senior_citizen', status: 'approved' },
  createdAt: '2026-01-15T00:00:00.000Z',
};

test('driverCsvColumns includes every header once', () => {
  const headers = driverCsvColumns.map((c) => c.header);
  assert.deepEqual(headers, [
    'Name',
    'Contact No',
    'Email',
    'Plate No',
    'Cluster',
    'Account Status',
    'Verification Status',
    'Rating',
    'Ratings Count',
    'Trips',
    'Registered',
  ]);
});

test('driverCsvColumns renders a null cluster as an empty string', () => {
  const cluster = driverCsvColumns.find((c) => c.header === 'Cluster')!;
  assert.equal(cluster.value(driver), '');
});

test('passengerCsvColumns includes every header once', () => {
  const headers = passengerCsvColumns.map((c) => c.header);
  assert.deepEqual(headers, ['Name', 'Contact No', 'Email', 'Account Status', 'Total Rides', 'Fare Discount', 'Registered']);
});

test('a comma-containing name round-trips quoted through toCsv', () => {
  const csv = toCsv([driver], driverCsvColumns);
  const lines = csv.split('\r\n');
  assert.ok(lines[1].startsWith('"Doe, Juan"'), `expected quoted name, got: ${lines[1]}`);
});

test('exportFilename builds "<prefix>-<filter>-<date>.csv"', () => {
  const filename = exportFilename('drivers', 'suspended');
  assert.match(filename, /^drivers-suspended-\d{4}-\d{2}-\d{2}\.csv$/);
});
