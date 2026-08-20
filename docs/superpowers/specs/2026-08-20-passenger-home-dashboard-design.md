# Passenger Home Dashboard + Request a Tricycle — Design

**Date:** 2026-08-20
**Scope:** `apps/passenger` only.

## Problem

The passenger app's Home tab (`app/(tabs)/home.tsx`) is the booking map
screen: full-bleed `OsmMap`, GPS pickup fetch on mount, "Where to?" /
pickup rows, saved places sheet. It's the first thing every rider sees
on every app open, but it reads as a generic ride-hailing map template
with no branding beyond the recent greeting-card pass — there's no
room for it to feel like a dashboard, because it *is* the booking flow,
not a landing page.

## Decision

Split Home into two screens:

1. **`app/(tabs)/home.tsx`** (same route, new content) — a branded
   dashboard: greeting card (unchanged from the recent redesign), a
   large `brand`-gradient CTA card ("Request a Tricycle"), and the
   saved-places section (unchanged). No map, no GPS fetch.
2. **`app/booking/request.tsx`** (new) — today's Home content, moved
   verbatim: full-bleed map, GPS pickup auto-fetch, "Where to?" /
   pickup rows. Becomes the entry point into the existing booking
   stack (`set-destination.tsx`, `set-pickup.tsx`, `confirm.tsx`, …),
   reached by tapping the dashboard's CTA card.

Tab bar (`app/(tabs)/_layout.tsx`) is untouched — still 5 tabs, no new
tab. This matches how booking already works: it's a stack reached from
Home, not a tab of its own.

## Why this approach over a 6th tab

A 6th icon on a 5-icon bottom bar is cramped on phone widths, and every
other booking screen (`set-destination`, `set-pickup`, `confirm`,
`finding-driver`, `trip`, `payment`, `rate-driver`) already lives
outside the tab bar under `app/booking/*`. Making "Request a Tricycle"
consistent with that pattern (a stack entry, not a tab) costs nothing
and matches the existing architecture.

## Files touched

- `app/(tabs)/home.tsx` — rewritten: greeting card (kept as-is) + new
  CTA card + saved places (kept as-is). Loses: `OsmMap`, GPS
  `useEffect`, pickup/destination `MapSearchBar` rows,
  `useLocationPermission`/`useBookingStore` pickup wiring,
  `handlePickupDrag`.
- `app/booking/request.tsx` (new) — today's `home.tsx` map/pickup
  content, unchanged logic, just relocated. Screen title: "Request a
  Tricycle" (floating header card, same treatment as `confirm.tsx`'s
  redesigned header).
- `src/styles/tabs/home.styles.ts` — drops map/pickup-row styles
  (`mapFill`, `pickupDivider`, `headerSearchBar`'s map-specific bits
  stay only if still used), gains CTA card styles.
- `src/styles/booking/request.styles.ts` (new) — copy of today's
  `home.styles.ts` map/pickup-row styles, renamed file.
- `packages/shared/src/i18n/{en,fil}.ts` — new `home.ctaTitle`/
  `home.ctaSubtitle` (or similar) keys for the CTA card copy; existing
  `home.whereTo`/`pickupFallback`/etc. keys move conceptually to
  `request.*` naming only if reused verbatim — reuse the existing
  `home.*` keys as-is to avoid an unnecessary rename (the screen
  changed, the copy didn't).

## Navigation

- Dashboard CTA `onPress`: `router.push('/booking/request')` (mirrors
  how `set-destination.tsx` already pushes further into the stack).
- `request.tsx`'s existing internal pushes (`/booking/set-destination`,
  `/booking/set-pickup`) are unchanged — those routes don't care what
  pushed them.
- `request.tsx` needs a way back to the dashboard: a floating back
  button in its header card, same as `confirm.tsx`'s `router.back()`.

## What doesn't change

- `set-destination.tsx`, `set-pickup.tsx`, `confirm.tsx`,
  `finding-driver.tsx`, `trip.tsx`, `payment.tsx`, `rate-driver.tsx` —
  untouched, still reached the same way.
- `app/(tabs)/_layout.tsx`, other tabs, auth/splash redirect logic —
  untouched.
- GPS auto-fetch behavior is unchanged in substance, just relocated:
  it now fires when the rider opens "Request a Tricycle" instead of on
  every Home mount — a behavior improvement (fewer GPS permission
  prompts on cold app opens that never book), not a regression.

## Testing

- Typecheck (`npx tsc --build apps/passenger/tsconfig.json`).
- Full passenger test suite (`npm test` in `apps/passenger`).
- Live web verification: dashboard renders (greeting + CTA + saved
  places, no map), CTA opens Request a Tricycle, GPS/search/pickup
  flow still works unchanged, confirm flow still reachable end-to-end.
