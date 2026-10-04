const test = require('node:test');
const assert = require('node:assert/strict');

// Server rule (match-ride-request, nearby-driver-count, notify-drivers-new-request):
// a driver whose last fix is older than this sees no requests and is not counted.
const SERVER_FRESHNESS_MS = 2 * 60 * 1000;

test('heartbeat always fires well inside the server freshness window, however long the driver has been parked', async () => {
  const { heartbeatDelayMs } = await import('../src/utils/locationHeartbeat.ts');

  for (const parkedMs of [0, 30_000, 5 * 60_000, 9 * 60_000, 11 * 60_000, 3 * 60 * 60_000]) {
    assert.ok(
      heartbeatDelayMs(parkedMs) + 30_000 <= SERVER_FRESHNESS_MS,
      `delay ${heartbeatDelayMs(parkedMs)}ms leaves less than 30s margin after ${parkedMs}ms parked`
    );
  }
});

test('heartbeat is quick while the driver was just moving and relaxes after a long stop', async () => {
  const { heartbeatDelayMs } = await import('../src/utils/locationHeartbeat.ts');

  assert.equal(heartbeatDelayMs(0), 40_000);
  assert.equal(heartbeatDelayMs(9 * 60_000), 40_000);
  assert.equal(heartbeatDelayMs(11 * 60_000), 60_000);
  assert.ok(heartbeatDelayMs(11 * 60_000) > heartbeatDelayMs(0));
});

test('no heartbeat is sent when a normal movement update just refreshed the position', async () => {
  const { shouldSendHeartbeat } = await import('../src/utils/locationHeartbeat.ts');

  assert.equal(shouldSendHeartbeat(5_000, 5_000), false);
  assert.equal(shouldSendHeartbeat(20_000, 20_000), false);
});

test('a heartbeat is sent once the last push is as old as the heartbeat delay', async () => {
  const { shouldSendHeartbeat } = await import('../src/utils/locationHeartbeat.ts');

  assert.equal(shouldSendHeartbeat(40_000, 40_000), true);
  assert.equal(shouldSendHeartbeat(45_000, 3 * 60_000), true);
  assert.equal(shouldSendHeartbeat(58_000, 20 * 60_000), true);
  assert.equal(shouldSendHeartbeat(50_000, 20 * 60_000), false);
});
