import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/supabase/database.types.ts';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { submitDriverDocuments } from '../src/driver-documents/index.ts';

test('submitDriverDocuments uploads every document and inserts one driver_documents row per file', async () => {
  const uploadedPaths: string[] = [];
  let capturedInsert: any = null;

  __setSupabaseClientForTests({
    storage: {
      from: () => ({
        upload: async (path: string) => {
          uploadedPaths.push(path);
          return { error: null };
        },
        remove: async () => ({ error: null }),
      }),
    },
    from: () => ({
      insert: async (rows: unknown) => {
        capturedInsert = rows;
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient<Database>);

  const { error } = await submitDriverDocuments('driver1', [
    { type: 'drivers_license', data: new ArrayBuffer(0) },
    { type: 'or_cr', data: new ArrayBuffer(0) },
  ]);

  assert.equal(error, null);
  assert.equal(uploadedPaths.length, 2);
  assert.ok(uploadedPaths[0].startsWith('driver1/drivers_license-'));
  assert.ok(uploadedPaths[1].startsWith('driver1/or_cr-'));
  assert.equal(capturedInsert.length, 2);
  assert.equal(capturedInsert[0].driver_id, 'driver1');
  assert.equal(capturedInsert[0].doc_type, 'drivers_license');
  assert.equal(capturedInsert[1].doc_type, 'or_cr');
});

test('submitDriverDocuments removes already-uploaded files when a later upload fails', async () => {
  const uploadedPaths: string[] = [];
  const removedCalls: string[][] = [];

  __setSupabaseClientForTests({
    storage: {
      from: () => ({
        upload: async (path: string) => {
          if (path.includes('or_cr')) return { error: { message: 'upload failed' } };
          uploadedPaths.push(path);
          return { error: null };
        },
        remove: async (paths: string[]) => {
          removedCalls.push(paths);
          return { error: null };
        },
      }),
    },
    from: () => {
      throw new Error('the DB insert must not run when an upload already failed');
    },
  } as unknown as SupabaseClient<Database>);

  const { error } = await submitDriverDocuments('driver1', [
    { type: 'drivers_license', data: new ArrayBuffer(0) },
    { type: 'or_cr', data: new ArrayBuffer(0) },
  ]);

  assert.equal(error, 'upload failed');
  assert.equal(removedCalls.length, 1);
  assert.deepEqual(removedCalls[0], uploadedPaths);
});

test('submitDriverDocuments removes every uploaded file when the driver_documents insert fails', async () => {
  const uploadedPaths: string[] = [];
  const removedCalls: string[][] = [];

  __setSupabaseClientForTests({
    storage: {
      from: () => ({
        upload: async (path: string) => {
          uploadedPaths.push(path);
          return { error: null };
        },
        remove: async (paths: string[]) => {
          removedCalls.push(paths);
          return { error: null };
        },
      }),
    },
    from: () => ({
      insert: async () => ({ error: { message: 'network error' } }),
    }),
  } as unknown as SupabaseClient<Database>);

  const { error } = await submitDriverDocuments('driver1', [
    { type: 'drivers_license', data: new ArrayBuffer(0) },
    { type: 'franchise_permit', data: new ArrayBuffer(0) },
  ]);

  assert.equal(error, 'network error');
  assert.equal(removedCalls.length, 1);
  assert.deepEqual(removedCalls[0], uploadedPaths);
});
