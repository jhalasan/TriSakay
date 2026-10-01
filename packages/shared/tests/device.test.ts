import test from 'node:test';
import assert from 'node:assert/strict';
import { describeDevice, relativeTime } from '../src/utils/device.ts';

test('describeDevice recognises the Android app by its HTTP client', () => {
  assert.deepEqual(describeDevice('okhttp/4.12.0'), { kind: 'android', text: '' });
  assert.deepEqual(describeDevice('Dalvik/2.1.0 (Linux; U; Android 14)'), { kind: 'android', text: '' });
});

test('describeDevice handles a missing agent and truncates a long unknown one', () => {
  assert.deepEqual(describeDevice(null), { kind: 'unknown', text: '' });
  assert.deepEqual(describeDevice(''), { kind: 'unknown', text: '' });
  const long = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
  const result = describeDevice(long);
  assert.equal(result.kind, 'other');
  assert.equal(result.text.length, 40);
});

test('relativeTime reports minutes, hours and days, and handles bad input', () => {
  const now = new Date('2026-10-01T12:00:00Z');
  assert.equal(relativeTime('2026-10-01T11:59:40Z', now), 'now');
  assert.equal(relativeTime('2026-10-01T11:45:00Z', now), '15m');
  assert.equal(relativeTime('2026-10-01T09:00:00Z', now), '3h');
  assert.equal(relativeTime('2026-09-28T12:00:00Z', now), '3d');
  assert.equal(relativeTime('garbage', now), '');
});
