import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { getSignedDocumentUrl } from '../src/storage/index.ts';

test('getSignedDocumentUrl requests a signed URL from the given bucket/path with the given expiry', async () => {
  let captured: { bucket: string; path: string; expiry: number } | null = null;

  __setSupabaseClientForTests({
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: async (path: string, expiry: number) => {
          captured = { bucket, path, expiry };
          return { data: { signedUrl: 'https://example.test/signed/abc' }, error: null };
        },
      }),
    },
  } as any);

  const { url, error } = await getSignedDocumentUrl('driver-docs', 'drv1/drivers_license-123.jpg', 120);
  assert.equal(error, null);
  assert.equal(url, 'https://example.test/signed/abc');
  assert.deepEqual(captured, { bucket: 'driver-docs', path: 'drv1/drivers_license-123.jpg', expiry: 120 });
});

test('getSignedDocumentUrl defaults the expiry to 300 seconds', async () => {
  let capturedExpiry: number | null = null;

  __setSupabaseClientForTests({
    storage: {
      from: () => ({
        createSignedUrl: async (_path: string, expiry: number) => {
          capturedExpiry = expiry;
          return { data: { signedUrl: 'https://example.test/signed/abc' }, error: null };
        },
      }),
    },
  } as any);

  await getSignedDocumentUrl('discount-ids', 'p1/senior_citizen-front-123.jpg');
  assert.equal(capturedExpiry, 300);
});

test('getSignedDocumentUrl returns { url: null, error } when Storage rejects the request', async () => {
  __setSupabaseClientForTests({
    storage: {
      from: () => ({ createSignedUrl: async () => ({ data: null, error: { message: 'Object not found' } }) }),
    },
  } as any);

  const { url, error } = await getSignedDocumentUrl('driver-docs', 'missing/path.jpg');
  assert.equal(url, null);
  assert.equal(error, 'Object not found');
});
