import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/supabase/database.types.ts';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import {
  DRIVER_DOCUMENT_MAX_BYTES,
  listOwnDriverDocuments,
  resubmitDriverDocuments,
  submitDriverDocuments,
  updateDriverDocumentExpiry,
  validateDriverDocumentFile,
} from '../src/driver-documents/index.ts';

test('submitDriverDocuments uploads every document then submits them via one RPC call', async () => {
  const uploadedPaths: string[] = [];
  let capturedRpc: { fn: string; args: any } | null = null;

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
    rpc: async (fn: string, args: unknown) => {
      capturedRpc = { fn, args };
      return { data: 'tricycle1', error: null };
    },
  } as unknown as SupabaseClient<Database>);

  const { error } = await submitDriverDocuments('driver1', 'GSC-1187', [
    { type: 'drivers_license', data: new ArrayBuffer(0) },
    { type: 'or_cr', data: new ArrayBuffer(0) },
  ]);

  assert.equal(error, null);
  assert.equal(uploadedPaths.length, 2);
  assert.ok(uploadedPaths[0].startsWith('driver1/drivers_license-'));
  assert.ok(uploadedPaths[1].startsWith('driver1/or_cr-'));
  assert.equal(capturedRpc!.fn, 'submit_driver_documents');
  assert.equal(capturedRpc!.args.p_plate_no, 'GSC-1187');
  assert.equal(capturedRpc!.args.p_documents.length, 2);
  assert.equal(capturedRpc!.args.p_documents[0].doc_type, 'drivers_license');
  assert.equal(capturedRpc!.args.p_documents[0].storage_path, uploadedPaths[0]);
  assert.equal(capturedRpc!.args.p_documents[1].doc_type, 'or_cr');
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
    rpc: async () => {
      throw new Error('the RPC call must not run when an upload already failed');
    },
  } as unknown as SupabaseClient<Database>);

  const { error } = await submitDriverDocuments('driver1', 'GSC-1187', [
    { type: 'drivers_license', data: new ArrayBuffer(0) },
    { type: 'or_cr', data: new ArrayBuffer(0) },
  ]);

  assert.equal(error, 'upload failed');
  assert.equal(removedCalls.length, 1);
  assert.deepEqual(removedCalls[0], uploadedPaths);
});

test('submitDriverDocuments removes every uploaded file when the RPC call fails', async () => {
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
    rpc: async () => ({ data: null, error: { message: 'network error' } }),
  } as unknown as SupabaseClient<Database>);

  const { error } = await submitDriverDocuments('driver1', 'GSC-1187', [
    { type: 'drivers_license', data: new ArrayBuffer(0) },
    { type: 'franchise_permit', data: new ArrayBuffer(0) },
  ]);

  assert.equal(error, 'network error');
  assert.equal(removedCalls.length, 1);
  assert.deepEqual(removedCalls[0], uploadedPaths);
});

test('submitDriverDocuments translates a duplicate plate number into a friendly error instead of the raw constraint message', async () => {
  const removedCalls: string[][] = [];

  __setSupabaseClientForTests({
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        remove: async (paths: string[]) => {
          removedCalls.push(paths);
          return { error: null };
        },
      }),
    },
    rpc: async () => ({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint "tricycles_plate_no_key"' },
    }),
  } as unknown as SupabaseClient<Database>);

  const { error } = await submitDriverDocuments('driver1', 'GSC-1187', [
    { type: 'drivers_license', data: new ArrayBuffer(0) },
  ]);

  assert.equal(error, 'That plate number is already registered to another driver. Please double-check it and try again.');
  assert.equal(removedCalls.length, 1);
});

test('listOwnDriverDocuments scopes the read to the signed-in driver (D13)', async () => {
  let capturedFilter: { column: string; value: unknown } | null = null;

  __setSupabaseClientForTests({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'driver1' } } } }) },
    from: (table: string) => {
      assert.equal(table, 'driver_documents');
      return {
        select: () => ({
          eq: (column: string, value: unknown) => {
            capturedFilter = { column, value };
            return Promise.resolve({
              data: [
                { id: 'd1', doc_type: 'drivers_license', status: 'approved', expiry_date: '2027-01-01', remarks: null },
                { id: 'd2', doc_type: 'or_cr', status: 'pending', expiry_date: null, remarks: null },
              ],
              error: null,
            });
          },
        }),
      };
    },
  } as unknown as SupabaseClient<Database>);

  const { data, error } = await listOwnDriverDocuments();

  assert.equal(error, null);
  assert.deepEqual(capturedFilter, { column: 'driver_id', value: 'driver1' });
  assert.deepEqual(data, [
    { id: 'd1', docType: 'drivers_license', status: 'approved', expiryDate: '2027-01-01', remarks: null },
    { id: 'd2', docType: 'or_cr', status: 'pending', expiryDate: null, remarks: null },
  ]);
});

test('listOwnDriverDocuments returns an error when there is no active session', async () => {
  __setSupabaseClientForTests({
    auth: { getSession: async () => ({ data: { session: null } }) },
  } as unknown as SupabaseClient<Database>);

  const { data, error } = await listOwnDriverDocuments();
  assert.deepEqual(data, []);
  assert.equal(error, 'Not signed in');
});

test('updateDriverDocumentExpiry scopes the update to the signed-in driver (D13)', async () => {
  let capturedUpdate: unknown = null;
  const capturedFilters: { column: string; value: unknown }[] = [];

  __setSupabaseClientForTests({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'driver1' } } } }) },
    from: (table: string) => {
      assert.equal(table, 'driver_documents');
      return {
        update: (row: unknown) => {
          capturedUpdate = row;
          return {
            eq: (column: string, value: unknown) => {
              capturedFilters.push({ column, value });
              return {
                eq: (column2: string, value2: unknown) => {
                  capturedFilters.push({ column: column2, value: value2 });
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient<Database>);

  const { error } = await updateDriverDocumentExpiry('d1', '2027-06-15');

  assert.equal(error, null);
  assert.deepEqual(capturedUpdate, { expiry_date: '2027-06-15', expiry_notified_at: null });
  assert.deepEqual(capturedFilters, [
    { column: 'id', value: 'd1' },
    { column: 'driver_id', value: 'driver1' },
  ]);
});

test('validateDriverDocumentFile accepts a JPG, PNG or WebP of 5 MB or less', () => {
  assert.equal(validateDriverDocumentFile({ sizeBytes: 1_000_000, mimeType: 'image/jpeg' }), null);
  assert.equal(validateDriverDocumentFile({ sizeBytes: DRIVER_DOCUMENT_MAX_BYTES, mimeType: 'image/png' }), null);
  assert.equal(validateDriverDocumentFile({ sizeBytes: 10, mimeType: 'image/webp' }), null);
  assert.equal(validateDriverDocumentFile({ sizeBytes: undefined, mimeType: undefined }), null, 'unknown size or type is left to the server rules');
});

test('validateDriverDocumentFile refuses a file over 5 MB or a type that is not an allowed image', () => {
  assert.equal(validateDriverDocumentFile({ sizeBytes: DRIVER_DOCUMENT_MAX_BYTES + 1, mimeType: 'image/jpeg' }), 'too_large');
  assert.equal(validateDriverDocumentFile({ sizeBytes: 1000, mimeType: 'application/pdf' }), 'wrong_type');
  assert.equal(validateDriverDocumentFile({ sizeBytes: 1000, mimeType: 'image/heic' }), 'wrong_type');
});

test('resubmitDriverDocuments uploads only the given documents and calls resubmit_driver_documents', async () => {
  const uploadedPaths: string[] = [];
  let capturedRpc: { fn: string; args: any } | null = null;

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
    rpc: async (fn: string, args: unknown) => {
      capturedRpc = { fn, args };
      return { data: 1, error: null };
    },
  } as unknown as SupabaseClient<Database>);

  const { error, remaining } = await resubmitDriverDocuments('driver1', [{ type: 'or_cr', data: new ArrayBuffer(0) }]);

  assert.equal(error, null);
  assert.equal(remaining, 1);
  assert.equal(uploadedPaths.length, 1);
  assert.ok(uploadedPaths[0].startsWith('driver1/or_cr-'));
  assert.equal(capturedRpc!.fn, 'resubmit_driver_documents');
  assert.deepEqual(capturedRpc!.args.p_documents, [{ doc_type: 'or_cr', storage_path: uploadedPaths[0] }]);
});

test('resubmitDriverDocuments removes the uploaded files when the RPC refuses them', async () => {
  const removedCalls: string[][] = [];

  __setSupabaseClientForTests({
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        remove: async (paths: string[]) => {
          removedCalls.push(paths);
          return { error: null };
        },
      }),
    },
    rpc: async () => ({ data: null, error: { message: 'That document is not waiting for a correction' } }),
  } as unknown as SupabaseClient<Database>);

  const { error, remaining } = await resubmitDriverDocuments('driver1', [{ type: 'or_cr', data: new ArrayBuffer(0) }]);

  assert.equal(error, 'That document is not waiting for a correction');
  assert.equal(remaining, null);
  assert.equal(removedCalls.length, 1);
  assert.equal(removedCalls[0].length, 1);
});

test('listOwnDriverDocuments returns the reviewer reason for each document', async () => {
  __setSupabaseClientForTests({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'driver1' } } } }) },
    from: () => ({
      select: () => ({
        eq: async () => ({
          data: [{ id: 'd1', doc_type: 'or_cr', status: 'rejected', expiry_date: null, remarks: 'Plate number is cut off' }],
          error: null,
        }),
      }),
    }),
  } as unknown as SupabaseClient<Database>);

  const { data, error } = await listOwnDriverDocuments();

  assert.equal(error, null);
  assert.equal(data[0].remarks, 'Plate number is cut off');
});
