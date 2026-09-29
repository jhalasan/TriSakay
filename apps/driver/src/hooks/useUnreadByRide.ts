import { useEffect, useState } from 'react';
import { listMessages } from '@trisakay/services';

/**
 * One-shot per-ride unread count (Part C §C2's passenger switcher badges,
 * also `trip/active.tsx`'s own chat badges) — not a live subscription per
 * thread, since the full live experience only opens once a thread is
 * actually open (`useChatStore`'s own subscription). Re-runs whenever the
 * passenger roster itself changes, not on every GPS tick.
 */
export function useUnreadByRide(rideRequestIds: string[], selfUserId: string | undefined): Record<string, number> {
  const [unread, setUnread] = useState<Record<string, number>>({});
  const key = rideRequestIds.join(',');

  useEffect(() => {
    if (!selfUserId || !key) {
      setUnread({});
      return;
    }
    let cancelled = false;
    Promise.all(
      key.split(',').map(async (id) => {
        const { data } = await listMessages(id);
        return [id, data.filter((m) => m.senderId !== selfUserId && m.readAt === null).length] as const;
      })
    ).then((entries) => {
      if (!cancelled) setUnread(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [key, selfUserId]);

  return unread;
}
