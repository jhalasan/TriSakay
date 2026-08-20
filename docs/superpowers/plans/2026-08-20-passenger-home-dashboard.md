# Passenger Home Dashboard + Request a Tricycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the passenger app's Home tab into a branded dashboard (greeting + "Request a Tricycle" CTA + saved places) and a new `app/booking/request.tsx` screen that inherits today's Home map/GPS/pickup-search content, reached by tapping the CTA.

**Architecture:** `app/(tabs)/home.tsx` keeps its route but drops the map entirely, becoming a normal scrolling page (`SafeAreaView` > `ScrollView`, same shape as `app/(tabs)/profile.tsx`) with a gradient CTA card. `app/booking/request.tsx` is a new stack screen carrying today's Home map/GPS logic verbatim, styled to match `confirm.tsx`'s floating-header-over-map pattern. No tab bar changes, no new tab.

**Tech Stack:** Expo Router, React Native, Zustand, `@trisakay/ui` (Card, GradientSurface, BrandMotif, MapSearchBar, OsmMap, MapOverlaySheet, EmptyState, Avatar, Button primitives), `@trisakay/shared` i18n.

**Spec:** `docs/superpowers/specs/2026-08-20-passenger-home-dashboard-design.md`

## Global Constraints

- No new tab in `app/(tabs)/_layout.tsx` — stays at 5 tabs.
- `set-destination.tsx`, `set-pickup.tsx`, `confirm.tsx`, `finding-driver.tsx`, `trip.tsx`, `payment.tsx`, `rate-driver.tsx` are untouched.
- Reuse existing `home.whereTo` / `home.findingLocation` / `home.dragPinToSetPickup` / `home.pickupAccessibilityLabel` / `home.pickupFallback` i18n keys as-is on the new screen — no renaming.
- This repo has no component-render test harness for React Native screens (only `node --test` unit tests for stores/services/utils). Verification for screen-level changes in every task below is: typecheck clean + full `apps/passenger` test suite green + (final task) live Playwright web smoke test — the same pattern used throughout this session's other passenger UI work.
- Every task ends with `npx tsc --build apps/passenger/tsconfig.json` (must produce no output) before committing.

---

### Task 1: Add CTA copy to i18n

**Files:**
- Modify: `packages/shared/src/i18n/en.ts`
- Modify: `packages/shared/src/i18n/fil.ts`

**Interfaces:**
- Produces: `t.home.ctaTitle: string`, `t.home.ctaSubtitle: string` — consumed by Task 3 (`request.tsx`'s header title) and Task 5 (`home.tsx`'s CTA card).

- [ ] **Step 1: Add the two new keys to `en.ts`**

In `packages/shared/src/i18n/en.ts`, inside the `home: { ... }` block, add two keys right after `notificationsAccessibilityLabel` and before `greetingMorning`:

```ts
    profileAccessibilityLabel: 'Profile',
    notificationsAccessibilityLabel: 'Notifications',
    ctaTitle: 'Request a Tricycle',
    ctaSubtitle: 'Book a ride in a few taps',
    greetingMorning: 'Good morning',
```

- [ ] **Step 2: Add the matching keys to `fil.ts`**

In `packages/shared/src/i18n/fil.ts`, same position:

```ts
    profileAccessibilityLabel: 'Profile',
    notificationsAccessibilityLabel: 'Mga Abiso',
    ctaTitle: 'Humiling ng Traysikel',
    ctaSubtitle: 'Mag-book ng sakay sa ilang tap',
    greetingMorning: 'Magandang umaga',
```

- [ ] **Step 3: Run the shared i18n parity test**

Run: `cd packages/shared && node --test ./tests/*.test.ts`
Expected: both tests pass — "en and fil dictionaries have identical key structures" and "every string value is non-empty in both dictionaries". This is the only automated check that would catch a typo'd or missing key between the two files.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --build apps/passenger/tsconfig.json`
Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/i18n/en.ts packages/shared/src/i18n/fil.ts
git commit -m "feat(passenger): add Request a Tricycle CTA copy"
```

---

### Task 2: Create the Request a Tricycle screen's stylesheet

**Files:**
- Create: `apps/passenger/src/styles/booking/request.styles.ts`

**Interfaces:**
- Produces: `styles.container`, `styles.mapFill`, `styles.topFloating`, `styles.headerCard`, `styles.headerRow`, `styles.backButton`, `styles.headerTitle`, `styles.pickupDivider` — all consumed by Task 3.

- [ ] **Step 1: Write the file**

This mirrors `apps/passenger/src/styles/booking/confirm.styles.ts`'s `headerBar`/`backButton`/`headerTitle` (renamed `headerBar`→`headerCard` to match the "control tower" card naming `home.styles.ts` uses) plus `apps/passenger/src/styles/tabs/home.styles.ts`'s `mapFill`/`pickupDivider`, unchanged:

```ts
import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  /**
   * Absolute-fill on purpose: this must ignore the SafeAreaView's own top
   * inset padding so the map itself runs edge-to-edge including behind the
   * status bar — only the floating header above it respects the inset, via
   * its normal in-flow position. Matches Home/set-destination/set-pickup.
   */
  mapFill: {
    ...StyleSheet.absoluteFillObject,
  },
  topFloating: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  /** A solid card rather than bare text over the map — floating text on OSM tiles is illegible against light basemap areas. */
  headerCard: {
    padding: spacing.sm,
    borderTopWidth: 3,
    borderTopColor: colors.accentGreen,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentBlueSoft,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.ink,
    flex: 1,
  },
  pickupDivider: {
    height: 1,
    backgroundColor: colors.lineSoft,
    marginVertical: spacing.xs,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --build apps/passenger/tsconfig.json`
Expected: no output. (This file isn't imported anywhere yet, so this mainly confirms no syntax error.)

- [ ] **Step 3: Commit**

```bash
git add apps/passenger/src/styles/booking/request.styles.ts
git commit -m "feat(passenger): add Request a Tricycle screen styles"
```

---

### Task 3: Create the Request a Tricycle screen

**Files:**
- Create: `apps/passenger/app/booking/request.tsx`

**Interfaces:**
- Consumes: `styles` from Task 2 (`request.styles.ts`); `t.home.ctaTitle`, `t.home.whereTo`, `t.home.findingLocation`, `t.home.dragPinToSetPickup`, `t.home.pickupFallback`, `t.home.pickupAccessibilityLabel` from Task 1 / existing i18n; `useBookingStore`'s existing `pickup`/`setPickup`; `useLocationPermission`'s existing `isGranted`; `reverseGeocode` from `src/utils/geocode.ts`; `LOCATION_REQUIRED_HINT`/`LocationRequiredNotice` from `src/components/LocationRequiredNotice`.
- Produces: the `/booking/request` route, pushed to by Task 5's CTA card. Internally pushes to the existing `/booking/set-destination` and `/booking/set-pickup` routes — unchanged contracts.

This is today's `app/(tabs)/home.tsx` map/GPS/pickup logic, moved verbatim, with the avatar/bell header row replaced by a back-button + title row (matching `confirm.tsx`'s header pattern) and the saved-places section removed entirely (it stays on the dashboard).

- [ ] **Step 1: Write the file**

```tsx
import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, MapSearchBar, OsmMap, colors } from '@trisakay/ui';
import { LOCATION_REQUIRED_HINT, LocationRequiredNotice } from '../../src/components/LocationRequiredNotice';
import { useLocationPermission } from '../../src/hooks/useLocationPermission';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useBookingStore } from '../../src/store/useBookingStore';
import { reverseGeocode } from '../../src/utils/geocode';
import { styles } from '../../src/styles/booking/request.styles';

export default function RequestTricycleScreen() {
  const router = useRouter();
  const pickup = useBookingStore((state) => state.pickup);
  const setPickup = useBookingStore((state) => state.setPickup);
  const t = useTranslation();
  const { isGranted } = useLocationPermission();
  const [locating, setLocating] = useState(false);
  // Guards against firing a second GPS fix while one is in flight (e.g. a
  // fast remount from tab-switching) — a duplicate fix would race the first
  // and could overwrite a pin the rider has since dragged.
  const hasRequestedFix = useRef(false);

  useEffect(() => {
    if (!isGranted || pickup || hasRequestedFix.current) return;
    hasRequestedFix.current = true;
    setLocating(true);
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((position) =>
        reverseGeocode(position.coords.latitude, position.coords.longitude),
      )
      .then((point) => setPickup(point))
      .catch(() => {
        // No GPS fix available — the rider can still drop the pin by hand
        // once the map renders at its default center.
      })
      .finally(() => setLocating(false));
  }, [isGranted, pickup, setPickup]);

  function handlePickupDrag(point: { latitude: number; longitude: number }) {
    setLocating(true);
    reverseGeocode(point.latitude, point.longitude)
      .then((resolved) => setPickup(resolved))
      .finally(() => setLocating(false));
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.mapFill}>
        <OsmMap
          variant="pin"
          caption={locating ? t.home.findingLocation : t.home.dragPinToSetPickup}
          height="100%"
          latitude={pickup?.latitude}
          longitude={pickup?.longitude}
          zoom={16}
          interactive
          edgeToEdge
          marker={pickup ? { latitude: pickup.latitude, longitude: pickup.longitude, draggable: true } : null}
          onMarkerMove={handlePickupDrag}
        />
      </View>

      <View style={styles.topFloating}>
        <Card variant="raised" style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={22} color={colors.accentBluePressed} />
            </Pressable>
            <Text style={styles.headerTitle}>{t.home.ctaTitle}</Text>
          </View>
          <View style={styles.pickupDivider} />
          <MapSearchBar
            variant="flat"
            label={t.home.whereTo}
            disabled={!isGranted}
            onPress={() => (isGranted ? router.push('/booking/set-destination') : router.push('/location-permission'))}
            accessibilityHint={isGranted ? undefined : LOCATION_REQUIRED_HINT}
          />
          <View style={styles.pickupDivider} />
          <MapSearchBar
            variant="flat"
            label={pickup?.label || t.home.pickupFallback}
            disabled={!isGranted}
            onPress={() => (isGranted ? router.push('/booking/set-pickup') : router.push('/location-permission'))}
            accessibilityHint={t.home.pickupAccessibilityLabel}
          />
        </Card>
        {!isGranted && <LocationRequiredNotice />}
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --build apps/passenger/tsconfig.json`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/passenger/app/booking/request.tsx
git commit -m "feat(passenger): add Request a Tricycle screen"
```

---

### Task 4: Rewrite Home's stylesheet for the dashboard layout

**Files:**
- Modify: `apps/passenger/src/styles/tabs/home.styles.ts`

**Interfaces:**
- Produces: `styles.container`, `styles.scrollContent`, `styles.headerCard`, `styles.greeting`, `styles.headerRow`, `styles.avatarRing`, `styles.headerSpacer`, `styles.bellButton`, `styles.bellDot`, `styles.ctaWrap`, `styles.ctaPressed`, `styles.ctaCard`, `styles.ctaMotif`, `styles.ctaIconBadge`, `styles.ctaTextSlot`, `styles.ctaTitle`, `styles.ctaSubtitle`, `styles.sectionLabel`, `styles.shortcuts`, `styles.shortcutRow`, `styles.shortcutIcon`, `styles.shortcutTextSlot`, `styles.shortcutLabel`, `styles.shortcutAddress` — all consumed by Task 5.
- Drops (no longer needed once the map/pickup row moves to Task 3's screen): `mapFill`, `topFloating`, `pickupDivider`, `headerSearchBar`.

- [ ] **Step 1: Replace the file's contents**

```ts
import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  headerCard: {
    padding: spacing.sm,
    borderTopWidth: 3,
    borderTopColor: colors.accentGreen,
  },
  greeting: {
    ...typography.bodyStrong,
    color: colors.ink,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarRing: {
    padding: 2,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.accentGreenSoft,
  },
  /** Pushes the bell to the row's far end now that the search bar (which used to fill this gap) lives on the Request a Tricycle screen instead. */
  headerSpacer: {
    flex: 1,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentBlueSoft,
  },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.panel,
  },
  /** Own pressed-state wrapper (rather than Button) since this is a full custom gradient card, not a text button. */
  ctaWrap: {
    borderRadius: radius.lg,
    ...elevation.card,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  ctaMotif: {
    position: 'absolute',
    top: -30,
    right: -30,
  },
  ctaIconBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTextSlot: {
    flex: 1,
    gap: 2,
  },
  ctaTitle: {
    ...typography.h2,
    color: colors.white,
  },
  ctaSubtitle: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.85,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.inkSoft,
    marginBottom: spacing.md,
  },
  shortcuts: {
    gap: spacing.md,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.fill,
    minHeight: 68,
  },
  shortcutIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutTextSlot: {
    flex: 1,
    gap: 2,
  },
  shortcutLabel: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  shortcutAddress: {
    ...typography.caption,
    color: colors.inkSoft,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --build apps/passenger/tsconfig.json`
Expected: **errors** — `apps/passenger/app/(tabs)/home.tsx` still references the dropped `mapFill`/`topFloating`/`pickupDivider`/`headerSearchBar` styles until Task 5 rewrites it. This is expected; do not try to fix it here.

- [ ] **Step 3: Commit anyway**

The repo's typecheck gate applies to the whole working tree, not per-commit, and Task 5 (next, same session) restores a clean tree — but to keep each commit individually buildable, squash this step into Task 5's commit instead: stage this file now, then commit together with Task 5's changes. Do **not** run a bare `git commit` here — proceed directly to Task 5 with this file already staged:

```bash
git add apps/passenger/src/styles/tabs/home.styles.ts
```

---

### Task 5: Rewrite Home as the dashboard

**Files:**
- Modify: `apps/passenger/app/(tabs)/home.tsx`

**Interfaces:**
- Consumes: `styles` from Task 4; `t.home.ctaTitle`/`t.home.ctaSubtitle` from Task 1; the `/booking/request` route from Task 3; existing `useAuthStore`, `useBookingStore`'s `setDropoff`, `useNotificationsStore`, `useTranslation`, `GradientSurface`/`BrandMotif`/`Card`/`EmptyState`/`Avatar` from `@trisakay/ui` (same imports `profile.tsx` already uses for its own hero band, confirming these are all real exports).
- Produces: nothing new consumed elsewhere — this is the tab's terminal screen.

- [ ] **Step 1: Replace the file's contents**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, BrandMotif, Card, EmptyState, GradientSurface, colors } from '@trisakay/ui';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useNotificationsStore } from '../../src/store/useNotificationsStore';
import type { LocationPoint } from '../../src/types/booking';
import { styles } from '../../src/styles/tabs/home.styles';

/** Saved places come from the rider's account. Empty until the backend lands. */
const SHORTCUTS: { icon: keyof typeof Ionicons.glyphMap; point: LocationPoint }[] = [];

function getGreeting(t: ReturnType<typeof useTranslation>) {
  const hour = new Date().getHours();
  if (hour < 12) return t.home.greetingMorning;
  if (hour < 18) return t.home.greetingAfternoon;
  return t.home.greetingEvening;
}

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setDropoff = useBookingStore((state) => state.setDropoff);
  const unreadCount = useNotificationsStore((state) => state.items.filter((n) => !n.read).length);
  const t = useTranslation();

  function handleShortcutPress(point: LocationPoint) {
    setDropoff(point);
    router.push('/booking/confirm');
  }

  const firstName = user?.name?.trim().split(/\s+/)[0];
  const greeting = firstName ? `${getGreeting(t)}, ${firstName}` : getGreeting(t);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card variant="raised" style={styles.headerCard}>
          <Text style={styles.greeting}>{greeting}</Text>
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.home.profileAccessibilityLabel}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <View style={styles.avatarRing}>
                <Avatar name={user?.name} source={user?.avatarUrl ? { uri: user.avatarUrl } : undefined} size="md" />
              </View>
            </Pressable>
            <View style={styles.headerSpacer} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.home.notificationsAccessibilityLabel}
              style={styles.bellButton}
              onPress={() => router.push('/notifications')}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.accentBluePressed} />
              {unreadCount > 0 && <View style={styles.bellDot} />}
            </Pressable>
          </View>
        </Card>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.home.ctaTitle}
          onPress={() => router.push('/booking/request')}
          style={({ pressed }) => [styles.ctaWrap, pressed && styles.ctaPressed]}
        >
          <GradientSurface token="brand" direction="diagonal" style={styles.ctaCard}>
            <BrandMotif size={140} color={colors.white} opacity={0.12} style={styles.ctaMotif} />
            <View style={styles.ctaIconBadge}>
              <Ionicons name="car-sport" size={26} color={colors.white} />
            </View>
            <View style={styles.ctaTextSlot}>
              <Text style={styles.ctaTitle}>{t.home.ctaTitle}</Text>
              <Text style={styles.ctaSubtitle}>{t.home.ctaSubtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.white} />
          </GradientSurface>
        </Pressable>

        <View>
          <Text style={styles.sectionLabel}>{t.home.savedPlaces}</Text>
          {SHORTCUTS.length === 0 ? (
            <EmptyState
              title={t.home.noSavedPlacesTitle}
              message={t.home.noSavedPlacesMessage}
            />
          ) : (
            <View style={styles.shortcuts}>
              {SHORTCUTS.map((shortcut) => (
                <Pressable
                  key={shortcut.point.label}
                  style={styles.shortcutRow}
                  onPress={() => handleShortcutPress(shortcut.point)}
                  accessibilityRole="button"
                >
                  <View style={styles.shortcutIcon}>
                    <Ionicons name={shortcut.icon} size={20} color={colors.accentBluePressed} />
                  </View>
                  <View style={styles.shortcutTextSlot}>
                    <Text style={styles.shortcutLabel}>{shortcut.point.label}</Text>
                    <Text style={styles.shortcutAddress} numberOfLines={1}>
                      {shortcut.point.address}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --build apps/passenger/tsconfig.json`
Expected: no output (clean — this resolves the errors Task 4 left in place).

- [ ] **Step 3: Run the full passenger test suite**

Run: `cd apps/passenger && npm test`
Expected: all tests pass (16/16 as of this plan's writing — confirm the count matches what's currently on `main` before this change, since other work may have added tests since).

- [ ] **Step 4: Commit both files together**

```bash
git add "apps/passenger/app/(tabs)/home.tsx" apps/passenger/src/styles/tabs/home.styles.ts
git commit -m "feat(passenger): redesign Home as a branded dashboard

Home no longer carries the booking map — it's a normal scrolling page
(greeting card, Request a Tricycle CTA, saved places), matching
Profile's layout shape. The map/GPS/pickup-search flow that used to
live here moved to the new app/booking/request.tsx, reached by
tapping the CTA."
```

---

### Task 6: Live verification

**Files:** none (verification only).

- [ ] **Step 1: Start the passenger web dev server**

Run: `cd apps/passenger && npx expo start --web --port 8090` (background)
Wait for `Waiting on http://localhost:8090` in the log before proceeding.

- [ ] **Step 2: Log in and grant geolocation**

Using Playwright: navigate to `http://localhost:8090`, log in with a test passenger account, then grant geolocation permission via `context.grantPermissions(['geolocation'])` + `context.setGeolocation(...)` (a point inside the service area — reuse whatever coordinates the most recent live-verification session in this repo's history used, since the Nominatim search is bounded to that box).

- [ ] **Step 3: Verify the dashboard**

Navigate to `/home`. Confirm via screenshot: no map visible, greeting card renders with avatar/bell, a gradient "Request a Tricycle" card is visible, saved places section renders below it. Check console for zero errors.

- [ ] **Step 4: Verify the CTA navigates correctly**

Tap the "Request a Tricycle" card. Confirm the URL becomes `/booking/request` and the screen shows the full-bleed map with the header card (back button + "Request a Tricycle" title + "Where to?" row + pickup row). Tap the back button; confirm it returns to `/home`.

- [ ] **Step 5: Verify the booking flow still works end-to-end from the new entry point**

From `/booking/request`: tap "Where to?", search for a destination within the service area bounding box, select a result, confirm destination — should land on `/booking/confirm`. Confirm the Confirm screen still renders correctly (this screen was untouched, but this proves the handoff from the new entry screen didn't break the existing `useBookingStore` state flow).

- [ ] **Step 6: Report results**

Note in the response to the user: typecheck status, test suite pass count, console error count, and a one-line description of what was visually confirmed at each step above. Clean up the dev server process and any Playwright screenshot files afterward (same cleanup pattern used throughout this session — verify the port is no longer listening before finishing).

No commit for this task — it's verification only, not a code change.
