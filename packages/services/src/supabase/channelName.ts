let counter = 0;

/**
 * A realtime channel name that is unique to one subscription.
 *
 * supabase-js keys channels by topic: asking for a name that already exists
 * returns the *existing* channel, and calling `.on('postgres_changes', …)` on
 * an already-subscribed channel throws ("cannot add `postgres_changes`
 * callbacks … after `subscribe()`"). Two screens that watch the same row at
 * once — the passenger's trip screen stays mounted underneath the chat screen —
 * therefore crashed the second one. Give every `postgres_changes` subscription
 * its own name.
 *
 * Do NOT use this for a broadcast channel whose sender and receiver must land
 * on the same topic (the chat typing indicator).
 */
export function uniqueChannelName(base: string): string {
  counter += 1;
  return `${base}:${Date.now().toString(36)}${counter.toString(36)}`;
}
