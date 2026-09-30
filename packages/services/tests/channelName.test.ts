import test from 'node:test';
import assert from 'node:assert/strict';
import { uniqueChannelName } from '../src/supabase/channelName.ts';

test('uniqueChannelName never returns the same name twice for the same base', () => {
  const names = new Set(Array.from({ length: 50 }, () => uniqueChannelName('ride_request_status_r1')));
  assert.equal(names.size, 50);
});

test('uniqueChannelName keeps the base so channels stay identifiable in logs', () => {
  assert.ok(uniqueChannelName('driver_location_d1').startsWith('driver_location_d1:'));
});
