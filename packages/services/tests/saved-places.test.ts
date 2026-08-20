import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { listSavedPlaces, saveSavedPlace, deleteSavedPlace } from '../src/saved-places/index.ts';

test('listSavedPlaces returns the signed-in user\'s own rows, newest first', async () => {
  const capturedFilters: { column: string; value: unknown }[] = [];
  let orderedBy: { column: string; ascending: boolean } | null = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      from: (table) => {
        assert.equal(table, 'saved_places');
        return {
          select: () => ({
            eq: (column: string, value: unknown) => {
              capturedFilters.push({ column, value });
              return {
                order: (column2: string, opts: { ascending: boolean }) => {
                  orderedBy = { column: column2, ascending: opts.ascending };
                  return Promise.resolve({
                    data: [
                      { id: 'p1', icon: 'home-outline', label: 'Home', address: '123 Main St', latitude: 6.1, longitude: 125.2, user_id: 'u1', created_at: 'now' },
                    ],
                    error: null,
                  });
                },
              };
            },
          }),
        };
      },
    })
  );

  const { data, error } = await listSavedPlaces();

  assert.equal(error, null);
  assert.deepEqual(capturedFilters, [{ column: 'user_id', value: 'u1' }]);
  assert.deepEqual(orderedBy, { column: 'created_at', ascending: false });
  assert.equal(data.length, 1);
  assert.equal(data[0].icon, 'home-outline');
});

test('listSavedPlaces returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) }));

  const { data, error } = await listSavedPlaces();
  assert.equal(error, 'Not signed in');
  assert.deepEqual(data, []);
});

test('saveSavedPlace inserts a new row', async () => {
  let insertedRow: unknown = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      from: (table) => {
        assert.equal(table, 'saved_places');
        return {
          insert: (row: unknown) => {
            insertedRow = row;
            return {
              select: () => ({
                single: async () => ({ data: { id: 'p2', ...(row as object) }, error: null }),
              }),
            };
          },
        };
      },
    })
  );

  const { data, error } = await saveSavedPlace({
    label: 'General Santos City Hall',
    icon: 'location-outline',
    address: 'Jersey St, GenSan',
    latitude: 6.11,
    longitude: 125.17,
  });

  assert.equal(error, null);
  assert.deepEqual(insertedRow, {
    user_id: 'u1',
    label: 'General Santos City Hall',
    icon: 'location-outline',
    address: 'Jersey St, GenSan',
    latitude: 6.11,
    longitude: 125.17,
  });
  assert.equal(data?.id, 'p2');
});

test('saveSavedPlace does not dedupe by icon — a second save is a second row', async () => {
  const insertedRows: unknown[] = [];

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      from: () => ({
        insert: (row: unknown) => {
          insertedRows.push(row);
          return {
            select: () => ({
              single: async () => ({ data: { id: `p${insertedRows.length}`, ...(row as object) }, error: null }),
            }),
          };
        },
      }),
    })
  );

  await saveSavedPlace({ label: 'Gym', icon: 'briefcase-outline', address: 'A', latitude: 1, longitude: 1 });
  await saveSavedPlace({ label: 'Gym 2', icon: 'briefcase-outline', address: 'B', latitude: 2, longitude: 2 });

  assert.equal(insertedRows.length, 2, 'each save inserts a new row instead of replacing a prior one');
});

test('deleteSavedPlace scopes the delete to the signed-in user', async () => {
  const capturedFilters: { column: string; value: unknown }[] = [];

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      from: () => ({
        delete: () => ({
          eq: (column: string, value: unknown) => {
            capturedFilters.push({ column, value });
            return {
              eq: (column2: string, value2: unknown) => {
                capturedFilters.push({ column: column2, value: value2 });
                return Promise.resolve({ error: null });
              },
            };
          },
        }),
      }),
    })
  );

  const { error } = await deleteSavedPlace('p1');

  assert.equal(error, null);
  assert.deepEqual(capturedFilters, [
    { column: 'id', value: 'p1' },
    { column: 'user_id', value: 'u1' },
  ]);
});
