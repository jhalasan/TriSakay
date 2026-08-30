const test = require('node:test');
const assert = require('node:assert/strict');

test('returns the whole seconds remaining before expiry', async () => {
  const { secondsUntil } = await import('../src/hooks/useRequestCountdown.ts');

  const now = Date.parse('2026-01-01T00:00:00.000Z');
  const expiresAt = '2026-01-01T00:00:15.400Z';
  assert.equal(secondsUntil(expiresAt, now), 15);
});

test('clamps to 0 once expired, never negative', async () => {
  const { secondsUntil } = await import('../src/hooks/useRequestCountdown.ts');

  const now = Date.parse('2026-01-01T00:00:20.000Z');
  const expiresAt = '2026-01-01T00:00:15.000Z';
  assert.equal(secondsUntil(expiresAt, now), 0);
});

test('returns 0 exactly at the expiry instant', async () => {
  const { secondsUntil } = await import('../src/hooks/useRequestCountdown.ts');

  const now = Date.parse('2026-01-01T00:00:15.000Z');
  const expiresAt = '2026-01-01T00:00:15.000Z';
  assert.equal(secondsUntil(expiresAt, now), 0);
});
