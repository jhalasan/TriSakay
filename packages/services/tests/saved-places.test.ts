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
                      { id: 'p1', kind: 'home', label: 'Home', address: '123 Main St', latitude: 6.1, longitude: 125.2, user_id: 'u1', created_at: 'now' },
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
  assert.equal(data[0].kind, 'home');
});

test('listSavedPlaces returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) }));

  const { data, error } = await listSavedPlaces();
  assert.equal(error, 'Not signed in');
  assert.deepEqual(data, []);
});

test('saveSavedPlace inserts a new row for kind "custom"', async () => {
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
    kind: 'custom',
    label: 'General Santos City Hall',
    address: 'Jersey St, GenSan',
    latitude: 6.11,
    longitude: 125.17,
  });

  assert.equal(error, null);
  assert.deepEqual(insertedRow, {
    user_id: 'u1',
    kind: 'custom',
    label: 'General Santos City Hall',
    address: 'Jersey St, GenSan',
    latitude: 6.11,
    longitude: 125.17,
  });
  assert.equal(data?.id, 'p2');
});

test('saveSavedPlace updates the existing row when saving "home" a second time', async () => {
  let updatedRow: unknown = null;
  let updatedId: string | null = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'existing-home-id' }, error: null }),
            }),
          }),
        }),
        update: (row: unknown) => {
          updatedRow = row;
          return {
            eq: (column: string, value: unknown) => {
              assert.equal(column, 'id');
              updatedId = value as string;
              return {
                select: () => ({
                  single: async () => ({ data: { id: 'existing-home-id', ...(row as object) }, error: null }),
                }),
              };
            },
          };
        },
      }),
    })
  );

  const { data, error } = await saveSavedPlace({
    kind: 'home',
    label: 'Home',
    address: '456 New St',
    latitude: 6.2,
    longitude: 125.3,
  });

  assert.equal(error, null);
  assert.equal(updatedId, 'existing-home-id');
  assert.deepEqual(updatedRow, {
    kind: 'home',
    label: 'Home',
    address: '456 New St',
    latitude: 6.2,
    longitude: 125.3,
  });
  assert.equal(data?.id, 'existing-home-id');
});

test('saveSavedPlace inserts a new row when saving "home" for the first time', async () => {
  let insertedRow: unknown = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
        insert: (row: unknown) => {
          insertedRow = row;
          return {
            select: () => ({
              single: async () => ({ data: { id: 'new-home-id', ...(row as object) }, error: null }),
            }),
          };
        },
      }),
    })
  );

  const { data, error } = await saveSavedPlace({
    kind: 'home',
    label: 'Home',
    address: '123 First Save St',
    latitude: 6.1,
    longitude: 125.2,
  });

  assert.equal(error, null);
  assert.deepEqual(insertedRow, {
    user_id: 'u1',
    kind: 'home',
    label: 'Home',
    address: '123 First Save St',
    latitude: 6.1,
    longitude: 125.2,
  });
  assert.equal(data?.id, 'new-home-id');
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
