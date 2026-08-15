import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { listPassengersForAdmin } from '../src/admin/passengers.ts';

test('listPassengersForAdmin merges users + completed ride counts + approved discounts', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  { id: 'p1', full_name: 'Maria Fe Santos', contact_no: '0917-000-0002', email: 'maria@example.com', status: 'active', created_at: '2026-01-01T00:00:00.000Z' },
                  { id: 'p2', full_name: 'Juan Dela Cruz', contact_no: null, email: 'juan@example.com', status: 'active', created_at: '2026-02-01T00:00:00.000Z' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'ride_requests') {
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({
                data: [{ passenger_id: 'p1' }, { passenger_id: 'p1' }, { passenger_id: 'p1' }],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'passenger_discounts') {
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({ data: [{ passenger_id: 'p1' }], error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listPassengersForAdmin();

  assert.equal(error, null);
  assert.deepEqual(data, [
    {
      id: 'p1',
      fullName: 'Maria Fe Santos',
      contactNo: '0917-000-0002',
      email: 'maria@example.com',
      accountStatus: 'active',
      totalRides: 3,
      hasApprovedDiscount: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'p2',
      fullName: 'Juan Dela Cruz',
      contactNo: null,
      email: 'juan@example.com',
      accountStatus: 'active',
      totalRides: 0,
      hasApprovedDiscount: false,
      createdAt: '2026-02-01T00:00:00.000Z',
    },
  ]);
});

test('listPassengersForAdmin returns { data: [], error } when the ride-count query fails', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'users') {
        return { select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: 'p1', full_name: 'X', contact_no: null, email: 'x@example.com', status: 'active', created_at: 'now' }], error: null }) }) }) };
      }
      if (table === 'ride_requests') return { select: () => ({ eq: () => ({ in: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) };
      if (table === 'passenger_discounts') return { select: () => ({ eq: () => ({ in: async () => ({ data: [], error: null }) }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listPassengersForAdmin();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('listPassengersForAdmin returns { data: [], error } when the users query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) }),
  } as any);

  const { data, error } = await listPassengersForAdmin();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});
