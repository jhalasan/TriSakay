# Pull-to-refresh — design spec

**Date:** 2026-08-02
**Scope:** A reusable pull-to-refresh pattern, wired for real on the one passenger screen that currently has something real to refetch.

## Problem

The user asked for a "reload feature sliding down" (pull-to-refresh) across the passenger app. A survey of every candidate screen found only one (`apps/passenger/app/profile/apply-discount.tsx`) does a genuine mount-time data fetch (`getMyDiscount()` via `@trisakay/services`) from a `ScrollView`. `history.tsx` and `notifications.tsx` read from Zustand stores (`useHistoryStore`, `useNotificationsStore`) that are seeded once from a static mock array at store creation, with no refresh action of any kind — adding `RefreshControl` there today would spin and do nothing. `home.tsx`'s GPS fetch is a one-shot guarded by a ref, not designed to be re-triggered. `settings.tsx`, `profile.tsx`, `payment-methods.tsx`, `complaints.tsx` have no fetch to refresh at all.

## Design

**New `apps/passenger/src/hooks/usePullToRefresh.ts`**:
```ts
import { useCallback, useState } from 'react';

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  return { refreshing, onRefresh: handleRefresh };
}
```
A thin wrapper, not a new abstraction layer — every future screen that gains a real fetch (history/item 8, notifications/item 10) can adopt this same hook without inventing its own `refreshing` boolean each time.

**`apply-discount.tsx`**: the file already has a `refresh()` function (fetches `getMyDiscount` and updates local state, called both on mount and after a submission). Wire `usePullToRefresh(refresh)` and attach `<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBluePressed} />` (matching the existing brand-blue accent used elsewhere on this screen) to the form-view's `ScrollView`'s `refreshControl` prop. No changes to the loading/status branches (they already use a plain `View`, and pull-to-refresh only makes sense once the form is actually visible).

**`docs/PASSENGER_TODO.MD`**: add a one-line note to backlog items 8 (ride history + payment history screen) and 10 (notifications) that pull-to-refresh should be wired in using this same hook once those screens gain a real fetch — so the intent isn't lost, without building unused UI now.

## Explicitly out of scope

- `history.tsx`, `notifications.tsx` — no real fetch exists yet to refresh; adding `RefreshControl` now would be decorative (confirmed: neither store has *any* refresh/reload action, only a one-time seed at store creation).
- `home.tsx` — its GPS fetch is a one-shot guarded by a ref; re-triggering it via pull-to-refresh is a different, unasked-for feature (re-requesting device location on gesture), not covered here.
- `settings.tsx`, `profile.tsx`, `payment-methods.tsx`, `complaints.tsx` — no fetch to refresh.

## Testing

No existing test infrastructure covers this app's screens (no RN Testing Library setup) — matches the existing pattern for screen-level changes in this codebase (e.g., the `confirm.tsx`/`finding-driver.tsx` changes in backlog item 4 also had no screen-level tests). Verified by typecheck (`npm run typecheck` from repo root) and a manual check that `apply-discount.tsx`'s pull gesture re-triggers `getMyDiscount()`.
