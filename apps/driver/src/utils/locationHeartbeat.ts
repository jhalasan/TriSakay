/**
 * A driver who is online but parked produces no movement updates (the phone is
 * asked for a fix every 30 m of movement), so the server's copy of their
 * position ages. The server only shows requests to, and only counts as nearby,
 * a driver whose last fix is under 2 minutes old, and a cron job switches a
 * driver offline after 5 minutes without one. The heartbeat re-sends the
 * position on a timer to stay inside that window.
 */

/** Right after moving the driver may be about to roll again, so stay close to the server's window. */
const ACTIVE_HEARTBEAT_MS = 40_000;
/** After a long stop, back off a little to save battery and writes. Still half the 2 minute server limit. */
const PARKED_HEARTBEAT_MS = 60_000;
/** How long without moving before the driver counts as parked for this purpose. */
const PARKED_AFTER_MS = 10 * 60_000;
/** Timers fire a little late; send slightly early rather than risk a gap. */
const SLACK_MS = 5_000;

/** How long to wait between heartbeats, given how long ago the driver last moved. */
export function heartbeatDelayMs(msSinceMovement: number): number {
  return msSinceMovement >= PARKED_AFTER_MS ? PARKED_HEARTBEAT_MS : ACTIVE_HEARTBEAT_MS;
}

/** True when the last push is old enough that a normal movement update is not keeping the position fresh. */
export function shouldSendHeartbeat(msSinceLastPush: number, msSinceMovement: number): boolean {
  return msSinceLastPush >= heartbeatDelayMs(msSinceMovement) - SLACK_MS;
}
