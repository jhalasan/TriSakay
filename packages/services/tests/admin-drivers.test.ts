import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { listDriversForAdmin } from '../src/admin/drivers.ts';

test('listDriversForAdmin merges users + driver_profiles + tricycles by id', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  { id: 'd1', full_name: 'Ronnie Bautista', contact_no: '0917-000-0001', email: 'ronnie@example.com', status: 'active', created_at: '2026-01-01T00:00:00.000Z' },
                  { id: 'd2', full_name: 'Ariel Cabahug', contact_no: null, email: 'ariel@example.com', status: 'active', created_at: '2026-02-01T00:00:00.000Z' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'driver_profiles') {
        return {
          select: () => ({
            in: async () => ({
              data: [{ user_id: 'd1', verification_status: 'approved', rating_avg: '4.80', rating_count: 132 }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'tricycles') {
        return {
          select: () => ({
            in: async () => ({
              data: [{ driver_id: 'd1', plate_no: 'GSC-4521', cluster: 'melting_pot' }],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listDriversForAdmin();

  assert.equal(error, null);
  assert.deepEqual(data, [
    {
      id: 'd1',
      fullName: 'Ronnie Bautista',
      contactNo: '0917-000-0001',
      email: 'ronnie@example.com',
      accountStatus: 'active',
      verificationStatus: 'approved',
      ratingAvg: 4.8,
      ratingCount: 132,
      plateNo: 'GSC-4521',
      cluster: 'melting_pot',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'd2',
      fullName: 'Ariel Cabahug',
      contactNo: null,
      email: 'ariel@example.com',
      accountStatus: 'active',
      verificationStatus: 'unsubmitted',
      ratingAvg: 0,
      ratingCount: 0,
      plateNo: null,
      cluster: null,
      createdAt: '2026-02-01T00:00:00.000Z',
    },
  ]);
});

test('listDriversForAdmin returns an empty array without querying profiles/tricycles when there are no drivers', async () => {
  let profilesQueried = false;
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'users') return { select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) };
      profilesQueried = true;
      throw new Error(`should not query ${table}`);
    },
  } as any);

  const { data, error } = await listDriversForAdmin();
  assert.deepEqual(data, []);
  assert.equal(error, null);
  assert.equal(profilesQueried, false);
});

test('listDriversForAdmin returns { data: [], error } when the users query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) }),
  } as any);

  const { data, error } = await listDriversForAdmin();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('listDriversForAdmin returns { data: [], error } when the tricycles query fails', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'users') {
        return { select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: 'd1', full_name: 'X', contact_no: null, email: 'x@example.com', status: 'active', created_at: 'now' }], error: null }) }) }) };
      }
      if (table === 'driver_profiles') return { select: () => ({ in: async () => ({ data: [], error: null }) }) };
      if (table === 'tricycles') return { select: () => ({ in: async () => ({ data: null, error: { message: 'connection refused' } }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listDriversForAdmin();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});
