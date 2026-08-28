# TriSakay Home & Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate the locked passenger Home and driver Dashboard designs (`docs/design_handoff_trisakay_home/`) pixel-faithfully in the Expo/React Native monorepo, extending `packages/ui` primitives rather than one-off screen styles, and wiring the three previously-mock data points (passenger stats, request countdown, nearby-driver count) to real Supabase data.

**Architecture:** Extend `packages/ui/src/theme` with the spec's missing tokens; extend three existing shared components (`GradientSurface`, `StatTile`, `RequestCard`) rather than forking them; add one new shared component (`PulseRing`); add two small Supabase Edge Functions + one generated column for the two pieces of data the client can't currently source; rebuild the two screens on top of that foundation.

**Tech Stack:** Expo Router, React Native, `react-native-svg`, `react-native-reanimated` (already used by `apps/passenger`, newly introduced to `apps/driver`), Zustand stores, Supabase (Postgres + Realtime + Edge Functions), `node:test` for pure-logic unit tests (this repo has no RN component-render test setup — UI composition is verified by running the app, per existing convention).

**Spec:** `docs/design_handoff_trisakay_home/README.md` (primary spec), `docs/design_handoff_trisakay_home/MIGRATION.md` (condensed), `docs/design_handoff_trisakay_home/TriSakay Home Final.dc.html` + `screenshots/` (visual reference — design reference only, do not port HTML/CSS).

## Decisions locked in before this plan (confirmed with the user)

1. **Passenger stats strip** — backed by real data: trips = count of `status === 'completed'` from `listPassengerTripHistory(50)`; discount = `getMyDiscount()` category (if `status === 'approved'`) + live `getFareDiscountRate()` percent.
2. **Request countdown** — backed by a real `expires_at` field added to the dispatch payload (Task 8), not a client-only timer.
3. **Saved places "Manage"** — a dedicated route (Task 13), not a sheet.
4. **CTA "N nearby" count** — backed by a real query (Task 9: new `nearby-driver-count` Edge Function), not dropped or faked.
5. **Driver "Body no."** — the spec's copy ("PSO verified · Body no. 042") maps to real columns that exist but aren't wired yet: `tricycles.body_no` (keyed by `tricycles.driver_id`) for the number, `driver_profiles.verification_status === 'approved'` for "PSO verified". Task 11 adds the query.

## Global Constraints

- Match the spec's hex/px/weight values exactly (README "Design Tokens" section) — add any missing value to `packages/ui/src/theme` instead of hardcoding it in a screen.
- Type is Poppins 400/600/700/800 via `fontFamily` tokens only — never set RN `fontWeight` (breaks custom-font rendering, see `typography.ts` header comment).
- No hit target below 44px; the driver Accept/Decline row is 48px.
- Both states of each screen (online/offline, request/listening, saved places populated/empty) must be reachable in dev without live backend state — use a `__DEV__`-gated mock toggle, not a code path that only works in production data.
- The two pulse animations (driver status dot, listening-panel circle) must respect `useReducedMotion()` from `react-native-reanimated`, the same pattern as `apps/passenger/src/components/PopEntrance.tsx`.
- New user-facing copy goes in `packages/shared/src/i18n/en.ts`, mirrored with a same-shape entry in `packages/shared/src/i18n/fil.ts` (repo keeps the two in lockstep — every existing namespace has both).
- `packages/ui` components are consumed as source (`@trisakay/ui`, no build step) — editing `packages/ui/src/**` is immediately visible to both apps.
- Icons are Ionicons everywhere except the tricycle mark, which uses the new `assets/trike-white.png` / `assets/trike-navy.png` raster images (client-supplied artwork, not vectorizable — this is a deliberate exception to the "new decorative art is inline SVG" convention documented in `BrandMotif`).
- Task 8 and Task 9 write to the live Supabase project (ref `ygdgbvxxqrkxlezpckif`, per project memory) via a generated column + two new Edge Functions. **Applying these requires the user's explicit go-ahead at execution time** (hard-to-reverse, affects shared/production state) — do not run `apply_migration` or `deploy_edge_function` without that confirmation, even though the plan defines the exact SQL/code to apply.

---

## File Structure

**`packages/ui/src/theme/`** — extend `colors.ts`, `spacing.ts`, `radius.ts`, `typography.ts`, `motion.ts` with the spec's missing tokens. No new files.

**`packages/ui/src/components/`**
- `PulseRing/` — new. Reduce-motion-aware pulsing dot/ring (`scale .9→1.9, opacity .55→0`, configurable duration).
- `GradientSurface/GradientSurface.tsx` — extend with a `texture` prop (repeating diagonal stripe overlay).
- `StatTile/` — promoted from `apps/driver/src/components/StatTile/`, extended with `tone`/`bare` props for the passenger stats-strip and any future on-dark usage.
- `RequestCard/` — promoted from `apps/driver/src/components/RequestCard/`, extended with a `variant: 'compact' | 'incoming'` prop; `'compact'` is byte-for-byte the current design (used by Requests tab and Trip Active), `'incoming'` is the new spec design (used only by Dashboard).

**`packages/services/src/`**
- `driver-profile/index.ts` — add `getDriverUnit()`.
- `booking/index.ts` — extend `RideRequestRow`/`subscribeToPendingRideRequests` mapping to carry `distance_km` and `expires_at` through; add `getNearbyDriverCount(lat, lng)`.
- `passenger-stats/index.ts` — new. `getPassengerStats()` combining trip count + discount label.

**`supabase/functions/`**
- `match-ride-request/index.ts` — stop stripping `distanceKm`; also select/return `expires_at`.
- `nearby-driver-count/` — new Edge Function.

**`packages/shared/src/i18n/en.ts` + `fil.ts`** — new keys under `home` (passenger) and a few under `driver.dashboard`/new `driver.requestCard` incoming-variant keys.

**`assets/`** — add `trike-white.png`, `trike-navy.png` (repo keeps all raster assets at root, not per-app — matches existing `assets/brand/*` convention).

**`apps/passenger/`**
- `app/(tabs)/home.tsx` + `src/styles/tabs/home.styles.ts` — rebuilt per spec.
- `src/hooks/usePassengerStats.ts` — new, wraps `getPassengerStats()`.
- `src/hooks/useNearbyDriverCount.ts` — new, wraps `getNearbyDriverCount()`.
- `app/saved-places/manage.tsx` + `src/styles/saved-places/manage.styles.ts` — new route for "Manage".

**`apps/driver/`**
- `app/(tabs)/dashboard.tsx` + `src/styles/tabs/dashboard.styles.ts` — rebuilt per spec.
- `src/hooks/useRequestCountdown.ts` — new, pure countdown derived from `expiresAt`.
- `src/hooks/useDriverUnit.ts` — new, wraps `getDriverUnit()`.
- `src/types/request.ts` — extend `PendingRequest` with `pickupDistanceMeters` and `expiresAt`.
- `src/store/useRequestsStore.ts` — extend `toPendingRequest()` mapping.
- Delete `apps/driver/src/components/StatTile/`, `apps/driver/src/components/RequestCard/` after Tasks 4–5 promote them; update the 3 import sites (`dashboard.tsx`, `requests.tsx`, `trip/active.tsx`).

---

### Task 1: Theme tokens

**Files:**
- Modify: `packages/ui/src/theme/colors.ts`
- Modify: `packages/ui/src/theme/spacing.ts`
- Modify: `packages/ui/src/theme/radius.ts`
- Modify: `packages/ui/src/theme/typography.ts`
- Modify: `packages/ui/src/theme/motion.ts`
- Test: `packages/ui/tests/theme-tokens.test.ts`

**Interfaces:**
- Produces: `colors.accentBlueDeep`, `spacing2/6/10/14/18/22/26/34/44` — see below for exact naming (numeric keys aren't valid identifiers on their own so they're prefixed), `radius.xs/sm2/md2/lg2/xl/xxl/xxxl` — see naming below, `typography.h1b/h2b/h3b/bodyLg/labelSm/labelXs/eyebrow`, `motion.duration.pulseStatus = 2000`, `motion.duration.pulseListening = 2400`.
- Consumed by: every task below.

Naming rationale: the existing `spacing`/`radius`/`typography` tokens use semantic names (`sm`, `md`, `lg`...), not raw pixel numbers — stay consistent rather than introducing a parallel numeric scale. Below is the exact mapping from spec pixel value → new token name, chosen so each name describes where it's used in this spec (matches how `typography.chip`/`typography.amount` are named for their use, not their size).

- [ ] **Step 1: Write the failing test**

```typescript
// packages/ui/tests/theme-tokens.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { colors } from '../src/theme/colors.ts';
import { spacing } from '../src/theme/spacing.ts';
import { radius } from '../src/theme/radius.ts';
import { typography } from '../src/theme/typography.ts';
import { motion } from '../src/theme/motion.ts';

test('colors.accentBlueDeep matches the spec navy-ink stop', () => {
  assert.equal(colors.accentBlueDeep, '#001A38');
});

test('spacing exposes the redesign-specific steps at the 375px baseline', () => {
  assert.equal(spacing.tight2, 2);
  assert.equal(spacing.tight6, 6);
  assert.equal(spacing.tight10, 10);
  assert.equal(spacing.tight14, 14);
  assert.equal(spacing.tight18, 18);
  assert.equal(spacing.tight22, 22);
  assert.equal(spacing.tight26, 26);
  assert.equal(spacing.tight34, 34);
  assert.equal(spacing.tight44, 44);
});

test('radius exposes the redesign-specific steps at the 375px baseline', () => {
  assert.equal(radius.xs, 11);
  assert.equal(radius.sm2, 14);
  assert.equal(radius.md3, 18);
  assert.equal(radius.lg2, 22);
  assert.equal(radius.xl2, 24);
  assert.equal(radius.heroBottom, 30);
});

test('typography exposes the redesign-specific type styles', () => {
  assert.equal(typography.h1b.fontSize, 28);
  assert.equal(typography.h1b.fontFamily, 'Poppins_800ExtraBold');
  assert.equal(typography.h2b.fontSize, 22);
  assert.equal(typography.h3b.fontSize, 19);
  assert.equal(typography.bodyLg.fontSize, 15);
  assert.equal(typography.bodySm.fontSize, 14);
  assert.equal(typography.labelSm.fontSize, 11);
  assert.equal(typography.labelXs.fontSize, 10);
  assert.equal(typography.eyebrow.fontSize, 12);
  assert.equal(typography.eyebrow.textTransform, 'uppercase');
});

test('motion exposes the two redesign pulse durations', () => {
  assert.equal(motion.duration.pulseStatus, 2000);
  assert.equal(motion.duration.pulseListening, 2400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace packages/ui run test`
Expected: FAIL — `colors.accentBlueDeep`, `spacing.tight2`, etc. are `undefined`.

- [ ] **Step 3: Add the tokens**

`packages/ui/src/theme/colors.ts` — add one line inside the `accentBlue*` group:
```typescript
  accentBlue: '#002E60', // 13.46:1 with white — primary actions, brand navy
  accentBluePressed: '#002043',
  accentBlueSoft: '#E3EDF7',
  /** Deepest navy stop in the redesign's hero/duty-console gradients — same hue as accentBlue, no new contrast pairing (never sits behind text on its own). */
  accentBlueDeep: '#001A38',
```

`packages/ui/src/theme/spacing.ts` — add a second block, scaled the same way as the existing named steps:
```typescript
export const spacing = {
  xs: moderateScale(4, deviceWidth),
  sm: moderateScale(8, deviceWidth),
  md: moderateScale(12, deviceWidth),
  lg: moderateScale(16, deviceWidth),
  xl: moderateScale(24, deviceWidth),
  xxl: moderateScale(32, deviceWidth),
  xxxl: moderateScale(48, deviceWidth),
  // Fine-grained steps used by the TriSakay Home redesign (see
  // docs/design_handoff_trisakay_home/README.md § Design Tokens). Named
  // `tightN` rather than the raw px value since these sit between the
  // semantic steps above, not replacing them.
  tight2: moderateScale(2, deviceWidth),
  tight6: moderateScale(6, deviceWidth),
  tight10: moderateScale(10, deviceWidth),
  tight14: moderateScale(14, deviceWidth),
  tight18: moderateScale(18, deviceWidth),
  tight22: moderateScale(22, deviceWidth),
  tight26: moderateScale(26, deviceWidth),
  tight34: moderateScale(34, deviceWidth),
  tight44: moderateScale(44, deviceWidth),
} as const;
```

`packages/ui/src/theme/radius.ts`:
```typescript
export const radius = {
  sm: moderateScale(8, deviceWidth),
  md: moderateScale(12, deviceWidth),
  card: moderateScale(16, deviceWidth),
  lg: moderateScale(20, deviceWidth),
  sheetTop: moderateScale(28, deviceWidth),
  // TriSakay Home redesign steps not covered by the names above.
  xs: moderateScale(11, deviceWidth),
  sm2: moderateScale(14, deviceWidth),
  md3: moderateScale(18, deviceWidth),
  lg2: moderateScale(22, deviceWidth),
  xl2: moderateScale(24, deviceWidth),
  /** The full-bleed hero surface's bottom-corner radius — named for what it's for, not its number, since it's a one-off structural value rather than a general step. */
  heroBottom: moderateScale(30, deviceWidth),
  pill: 999,
} as const;
```

`packages/ui/src/theme/typography.ts` — add after `h3`:
```typescript
  /** Passenger Home's greeting name. One step below `display`. */
  h1b: { fontSize: scaleFont(28), lineHeight: scaleFont(32), fontFamily: fontFamily.extrabold, letterSpacing: -0.7 },
  /** Driver duty-console "Go online" CTA title weight/size. */
  h2b: { fontSize: scaleFont(22), lineHeight: scaleFont(25), fontFamily: fontFamily.bold, letterSpacing: -0.3 },
  /** "Listening for requests" panel title. */
  h3b: { fontSize: scaleFont(19), lineHeight: scaleFont(25), fontFamily: fontFamily.bold },
  /** Request-card stop values (pickup/dropoff address lines). */
  bodyLg: { fontSize: scaleFont(15), lineHeight: scaleFont(21), fontFamily: fontFamily.semibold },
  /** Request-card meta text, driver duty-console meta line. */
  bodySm: { fontSize: scaleFont(14), lineHeight: scaleFont(20), fontFamily: fontFamily.semibold },
  /** Stats-strip values, listening-panel body copy. */
  labelSm: { fontSize: scaleFont(11), lineHeight: scaleFont(15), fontFamily: fontFamily.regular },
  /** Stats-strip labels. */
  labelXs: {
    fontSize: scaleFont(10),
    lineHeight: scaleFont(14),
    fontFamily: fontFamily.bold,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  /** Section eyebrows ("SAVED PLACES", "INCOMING REQUEST", "YOU'RE ONLINE") — same shape as `label` but with the redesign's slightly wider tracking. */
  eyebrow: {
    fontSize: scaleFont(12),
    lineHeight: scaleFont(16),
    fontFamily: fontFamily.bold,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
```

`packages/ui/src/theme/motion.ts` — extend `duration`:
```typescript
  duration: {
    instant: 90,
    quick: 180,
    settle: 320,
    pulse: 1400,
    /** Driver duty-console online status dot. */
    pulseStatus: 2000,
    /** Driver "Listening for requests" panel circle. */
    pulseListening: 2400,
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace packages/ui run test`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no new errors (theme changes are additive).

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/theme packages/ui/tests/theme-tokens.test.ts
git commit -m "feat(ui): add TriSakay Home redesign theme tokens"
```

---

### Task 2: `PulseRing` component

**Files:**
- Create: `packages/ui/src/components/PulseRing/PulseRing.tsx`
- Create: `packages/ui/src/components/PulseRing/index.ts`
- Modify: `packages/ui/src/components/index.ts`
- Modify: `packages/ui/package.json` (add `react-native-reanimated` as a peer dep — currently only a passenger devDependency; check first, see Step 1)

**Interfaces:**
- Produces: `PulseRing({ size: number; color: string; durationMs: number; style? }): JSX.Element` — renders `children`-less filled circle of `size`/`color` that continuously runs `scale .9→1.9, opacity .55→0` over `durationMs`, ease-out, holding at the end (matches spec: "ease-out, infinite; 70% → end holds"). Renders a static circle at rest (no animation) when `useReducedMotion()` is true.
- Consumed by: driver duty-console status dot (Task 14, size 10, color `colors.accentGreenSoft`, `motion.duration.pulseStatus`), listening-panel circle (Task 14, size 74 host + this as the pulse layer behind it, `motion.duration.pulseListening`).

- [ ] **Step 1: Confirm `react-native-reanimated` is resolvable from `packages/ui`**

Run: `grep -n "react-native-reanimated" "d:/Projects/TRISAKAY_APP/packages/ui/package.json" "d:/Projects/TRISAKAY_APP/apps/driver/package.json"`
Expected: present in `apps/driver/package.json` dependencies already (Expo SDK 54 ships it in most starter templates — confirm) or add it: `npm --workspace apps/driver install react-native-reanimated` if missing, and add `"react-native-reanimated": "*"` to `packages/ui/package.json`'s `peerDependencies` (matching how `react-native-svg` is already listed there).

- [ ] **Step 2: Write the component**

```tsx
// packages/ui/src/components/PulseRing/PulseRing.tsx
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export interface PulseRingProps {
  size: number;
  color: string;
  /** Full cycle length in ms — 2000 for the driver status dot, 2400 for the listening-panel circle (see `motion.duration.pulseStatus`/`pulseListening`). */
  durationMs: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The redesign's one pulse keyframe, shared by the driver status dot and the
 * listening-panel circle: `scale(.9) opacity .55` → `scale(1.9) opacity 0`,
 * ease-out, looping. Renders a static circle at rest instead of animating
 * when the OS reduced-motion setting is on (`useReducedMotion`, same as
 * `apps/passenger/src/components/PopEntrance.tsx`).
 */
export function PulseRing({ size, color, durationMs, style }: PulseRingProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(reducedMotion ? 1 : 0.9);
  const opacity = useSharedValue(reducedMotion ? 1 : 0.55);

  if (!reducedMotion) {
    scale.value = withRepeat(withTiming(1.9, { duration: durationMs, easing: Easing.out(Easing.ease) }), -1, false);
    opacity.value = withRepeat(withTiming(0, { duration: durationMs, easing: Easing.out(Easing.ease) }), -1, false);
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        animatedStyle,
        style,
      ]}
    />
  );
}
```

```typescript
// packages/ui/src/components/PulseRing/index.ts
export * from './PulseRing';
```

- [ ] **Step 3: Barrel it**

Add `export * from './PulseRing';` to `packages/ui/src/components/index.ts` in its alphabetical position (after `OsmMap`, before `SegmentedControl`).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (No unit test here — this is pure RN animation wiring with no branch worth asserting on beyond what Step 1's reduced-motion check already covers via type-checking; visual verification happens in Task 16.)

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/PulseRing packages/ui/src/components/index.ts packages/ui/package.json apps/driver/package.json package-lock.json
git commit -m "feat(ui): add reduce-motion-aware PulseRing component"
```

---

### Task 3: `GradientSurface` texture overlay

**Files:**
- Modify: `packages/ui/src/components/GradientSurface/GradientSurface.tsx`

**Interfaces:**
- Produces: new optional props `texture?: boolean` (default `false`), `textureOpacity?: number` (default `0.05`) on `GradientSurfaceProps`.
- Consumed by: passenger hero panel + CTA card (Task 12), driver duty console online state (Task 14).

- [ ] **Step 1: Extend the component**

Add a diagonal repeating-stripe `<Pattern>` layer, painted after the gradient `<Rect>` and before `children` are rendered (so it sits under content, over the gradient) — this directly recreates the spec's `repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)` using SVG's native pattern primitive (already a dependency, matches the file's own "the one place gradient logic lives" convention):

```tsx
// packages/ui/src/components/GradientSurface/GradientSurface.tsx
import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Defs, LinearGradient, Line, Pattern, Rect, Stop } from 'react-native-svg';
import { gradients, type GradientToken } from '../../theme';

export interface GradientSurfaceProps extends ViewProps {
  token?: GradientToken;
  direction?: 'diagonal' | 'vertical';
  /** Overlays the redesign's woven-texture pattern (135° repeating diagonal stripes) on top of the gradient. */
  texture?: boolean;
  /** Stripe opacity when `texture` is set — spec uses 0.05–0.07 depending on the surface. */
  textureOpacity?: number;
}

export function GradientSurface({
  token = 'hero',
  direction = 'vertical',
  texture = false,
  textureOpacity = 0.05,
  style,
  children,
  ...viewProps
}: GradientSurfaceProps) {
  const [from, to] = gradients[token];
  const id = `gradientSurface-${token}-${direction}`;
  const patternId = `${id}-texture`;
  const end = direction === 'diagonal' ? { x2: '100%', y2: '100%' } : { x2: '0%', y2: '100%' };

  return (
    <View style={[styles.container, style]} {...viewProps}>
      <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0%" y1="0%" {...end}>
            <Stop offset="0%" stopColor={from} />
            <Stop offset="100%" stopColor={to} />
          </LinearGradient>
          {texture && (
            <Pattern id={patternId} patternUnits="userSpaceOnUse" width={14} height={14} patternTransform="rotate(135)">
              <Line x1="0" y1="0" x2="0" y2="14" stroke="#FFFFFF" strokeWidth={2} strokeOpacity={textureOpacity} />
            </Pattern>
          )}
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
        {texture && <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${patternId})`} />}
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. `texture`/`textureOpacity` are optional so every existing call site (passenger CTA already using `GradientSurface`, driver has none yet) keeps compiling unchanged.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/GradientSurface/GradientSurface.tsx
git commit -m "feat(ui): add woven-texture overlay option to GradientSurface"
```

---

### Task 4: Promote and extend `StatTile`

**Files:**
- Create: `packages/ui/src/components/StatTile/StatTile.tsx`
- Create: `packages/ui/src/components/StatTile/StatTile.styles.ts`
- Create: `packages/ui/src/components/StatTile/index.ts`
- Modify: `packages/ui/src/components/index.ts`
- Delete: `apps/driver/src/components/StatTile/StatTile.tsx`, `apps/driver/src/components/StatTile/StatTile.styles.ts`, `apps/driver/src/components/StatTile/index.ts`

**Interfaces:**
- Produces: `StatTileProps { label: string; value: string; tone?: 'default' | 'onNavy'; bare?: boolean }`. `tone='onNavy'` renders white/mint text instead of ink/inkSoft (for the passenger stats strip, which sits on the navy hero, not a white `Card`). `bare=true` skips the `Card` wrapper entirely (the stats-strip cells are plain, divided by a hairline the parent draws — not individual cards).
- Consumed by: passenger Home stats strip (Task 12, `tone="onNavy" bare`).

Note: this component is **not** reused by the driver Dashboard redesign — the spec replaces the old 4-tile stat grid with the duty console's inline earnings amount + meta line (Task 14), which don't fit the label/value-pair shape. `StatTile` is promoted because the passenger stats strip needs exactly this shape, and promoting-and-extending an existing component (per the handoff's explicit instruction) is preferable to writing a new one from scratch.

- [ ] **Step 1: Write the component**

```tsx
// packages/ui/src/components/StatTile/StatTile.tsx
import { Text, View } from 'react-native';
import { Card } from '../Card';
import { styles } from './StatTile.styles';

export interface StatTileProps {
  label: string;
  value: string;
  /** 'onNavy' is for placement on a navy/gradient surface (white label at 60% opacity, mint or white value) — the passenger Home stats strip. Defaults to the original ink-on-white card styling. */
  tone?: 'default' | 'onNavy';
  /** Skips the Card wrapper/shadow — used when the parent surface already provides the background and a hairline divider (the stats strip), not a floating tile. */
  bare?: boolean;
}

export function StatTile({ label, value, tone = 'default', bare = false }: StatTileProps) {
  const content = (
    <>
      <Text style={[styles.label, tone === 'onNavy' && styles.labelOnNavy]}>{label}</Text>
      <Text style={[styles.value, tone === 'onNavy' && styles.valueOnNavy]}>{value}</Text>
    </>
  );

  if (bare) return <View style={styles.bare}>{content}</View>;
  return <Card style={styles.card}>{content}</Card>;
}
```

```typescript
// packages/ui/src/components/StatTile/StatTile.styles.ts
import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    padding: spacing.md,
    gap: spacing.xs,
  },
  bare: {
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    ...typography.labelXs,
    color: colors.inkSoft,
  },
  labelOnNavy: {
    color: colors.white,
    opacity: 0.6,
  },
  value: {
    ...typography.bodyLg,
    color: colors.ink,
  },
  valueOnNavy: {
    color: colors.white,
  },
});
```

```typescript
// packages/ui/src/components/StatTile/index.ts
export * from './StatTile';
```

- [ ] **Step 2: Barrel it and delete the driver-local copy**

Add `export * from './StatTile';` to `packages/ui/src/components/index.ts` (alphabetical, after `SegmentedControl`... actually before `SegmentedControl`, after `Spinner` — check current alphabetical order in the file and insert correctly).

```bash
git rm -r apps/driver/src/components/StatTile
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: FAILS at this point — `apps/driver/app/(tabs)/dashboard.tsx` still imports the deleted local `StatTile` and renders the old 4-tile grid. This is expected; Task 14 removes that usage as part of the Dashboard rebuild. Leave this red until Task 14 — do not patch it here with a temporary re-export, since the old stat grid is being deliberately removed, not moved.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/StatTile packages/ui/src/components/index.ts
git commit -m "feat(ui): promote StatTile to packages/ui with onNavy/bare variants"
```

(Leave the `apps/driver` deletion staged but uncommitted, or commit it in the same commit — either is fine since Task 14 will need to touch `dashboard.tsx` regardless and that commit will make the tree green again. Simplest: fold the `git rm` into this commit.)

---

### Task 5: Promote and extend `RequestCard`

**Files:**
- Create: `packages/ui/src/components/RequestCard/RequestCard.tsx`
- Create: `packages/ui/src/components/RequestCard/RequestCard.styles.ts`
- Create: `packages/ui/src/components/RequestCard/index.ts`
- Modify: `packages/ui/src/components/index.ts`
- Modify: `apps/driver/app/(tabs)/requests.tsx` (import path only)
- Modify: `apps/driver/app/trip/active.tsx` (import path only)
- Delete: `apps/driver/src/components/RequestCard/*`
- Test: `packages/ui/tests/request-card-copy.test.ts`

**Interfaces:**
- Consumes: `PendingRequest` type — this task widens it (see Task 8) but does not require Task 8 to land first; new fields are optional so `variant='compact'` keeps working with the current shape.
- Produces: `RequestCardProps { request: PendingRequest; onAccept: () => void; onDecline: () => void; accepting?: boolean; variant?: 'compact' | 'incoming' }`. Default `variant='compact'` is pixel-identical to the current design (Avatar + route text + seats badge + two buttons) — this is what `requests.tsx` and `trip/active.tsx` keep using unchanged. `variant='incoming'` is the new spec design (mint header band with payment/seats + fare, timeline rail with pickup/dropoff stops, outline Decline + gradient Accept) — used only by the Dashboard (Task 14), which also renders the "INCOMING REQUEST" eyebrow + countdown chip itself, outside this component (per spec, the countdown chip sits in the section header, not inside the card).
- This task does NOT depend on Task 8's `expiresAt`/`pickupDistanceMeters` fields — it renders `request.pickupDistanceMeters` and formats it only if present (`? "Pickup · {n} m away" : "Pickup"`), so it degrades gracefully before Task 8 lands and picks up real data after.

- [ ] **Step 1: Write the failing test** (pure copy-formatting logic, the only non-trivial branching in this component)

```typescript
// packages/ui/tests/request-card-copy.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPickupLabel, formatPaymentSeatsLabel } from '../src/components/RequestCard/RequestCard.ts';

test('formatPickupLabel appends distance when known', () => {
  assert.equal(formatPickupLabel(400), 'Pickup · 400 m away');
});

test('formatPickupLabel falls back to plain "Pickup" when distance is unknown', () => {
  assert.equal(formatPickupLabel(null), 'Pickup');
});

test('formatPaymentSeatsLabel uppercases payment method and pluralizes seats', () => {
  assert.equal(formatPaymentSeatsLabel('cash', 2), 'CASH · 2 SEATS');
  assert.equal(formatPaymentSeatsLabel('gcash', 1), 'GCASH · 1 SEAT');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace packages/ui run test`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Write the component**

```tsx
// packages/ui/src/components/RequestCard/RequestCard.tsx
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Badge, Button, Card } from '..';
import { colors } from '../../theme';
import type { PendingRequest } from './types';
import { styles } from './RequestCard.styles';

export interface RequestCardCopy {
  decline: string;
  accept: string;
  newRideRequest: string;
  seatsSingular: string;
  seatsPlural: string;
  pickupLabel: string;
  dropoffLabel: string;
  pickupAwaySuffix: string;
}

export interface RequestCardProps {
  request: PendingRequest;
  onAccept: () => void;
  onDecline: () => void;
  accepting?: boolean;
  variant?: 'compact' | 'incoming';
  copy: RequestCardCopy;
}

/** "Pickup · 400 m away" once distance is known, else plain "Pickup". */
export function formatPickupLabel(distanceMeters: number | null, awaySuffix = 'm away', pickupWord = 'Pickup'): string {
  if (distanceMeters == null) return pickupWord;
  return `${pickupWord} · ${Math.round(distanceMeters)} ${awaySuffix}`;
}

/** "CASH · 2 SEATS" / "GCASH · 1 SEAT" — the incoming-card header band label. */
export function formatPaymentSeatsLabel(paymentMethod: string, seats: number): string {
  const seatWord = seats === 1 ? 'SEAT' : 'SEATS';
  return `${paymentMethod.toUpperCase()} · ${seats} ${seatWord}`;
}

export function RequestCard({ request, onAccept, onDecline, accepting = false, variant = 'compact', copy }: RequestCardProps) {
  const seatsLabel = `${request.seats} ${request.seats > 1 ? copy.seatsPlural : copy.seatsSingular}`;
  const routeLabel =
    request.pickupLabel && request.dropoffLabel ? `${request.pickupLabel} → ${request.dropoffLabel}` : copy.newRideRequest;

  if (variant === 'compact') {
    return (
      <Card style={styles.card}>
        <View style={styles.topRow}>
          <Avatar size="md" />
          <Text style={styles.route} numberOfLines={1}>
            {routeLabel}
          </Text>
          <Badge label={seatsLabel} tone="blue" />
        </View>
        <View style={styles.actions}>
          <View style={styles.actionButton}>
            <Button label={copy.decline} variant="outline" tone="neutral" size="sm" fullWidth disabled={accepting} onPress={onDecline} />
          </View>
          <View style={styles.actionButton}>
            <Button label={copy.accept} size="sm" fullWidth disabled={accepting} loading={accepting} onPress={onAccept} />
          </View>
        </View>
      </Card>
    );
  }

  const fareLabel = request.fare != null ? `₱${Math.round(request.fare)}` : '—';

  return (
    <Card style={styles.incomingCard} variant="raised">
      <View style={styles.headerBand}>
        <View style={styles.headerBandLeft}>
          <Ionicons name="cash-outline" size={18} color={colors.accentGreenPressed} />
          <Text style={styles.headerBandLabel}>{formatPaymentSeatsLabel(request.paymentMethod, request.seats)}</Text>
        </View>
        <Text style={styles.fare}>{fareLabel}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.timelineRail}>
          <View style={styles.timelineDotOuter} />
          <View style={styles.timelineConnector} />
          <View style={styles.timelineDotDest} />
        </View>
        <View style={styles.stops}>
          <View style={styles.stop}>
            <Text style={styles.stopLabel}>{formatPickupLabel(request.pickupDistanceMeters, copy.pickupAwaySuffix, copy.pickupLabel)}</Text>
            <Text style={styles.stopValue} numberOfLines={1}>
              {request.pickupLabel ?? copy.newRideRequest}
            </Text>
          </View>
          <View style={styles.stop}>
            <Text style={styles.stopLabel}>{copy.dropoffLabel}</Text>
            <Text style={styles.stopValue} numberOfLines={1}>
              {request.dropoffLabel ?? copy.newRideRequest}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.incomingActions}>
        <View style={styles.declineButton}>
          <Button label={copy.decline} variant="outline" tone="neutral" size="sm" disabled={accepting} onPress={onDecline} />
        </View>
        <View style={styles.acceptButton}>
          <Button label={copy.accept} size="sm" fullWidth disabled={accepting} loading={accepting} onPress={onAccept} icon={<Ionicons name="checkmark" size={20} color={colors.white} />} />
        </View>
      </View>
    </Card>
  );
}
```

```typescript
// packages/ui/src/components/RequestCard/types.ts
export type PaymentMethod = 'cash' | 'gcash';

export interface PendingRequest {
  id: string;
  seats: number;
  paymentMethod: PaymentMethod;
  pickupLabel: string | null;
  dropoffLabel: string | null;
  fare: number | null;
  createdAt: string;
  /** null until Task 8's Edge Function change lands — component degrades to plain "Pickup" until then. */
  pickupDistanceMeters: number | null;
  /** null until Task 8 lands — the incoming-request countdown (Task 14/15) has nothing to count down from until this is populated. */
  expiresAt: string | null;
}
```

```typescript
// packages/ui/src/components/RequestCard/RequestCard.styles.ts
import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  // --- compact variant (unchanged from the pre-redesign component) ---
  card: { padding: spacing.md, gap: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  route: { flex: 1, ...typography.bodyStrong, color: colors.ink },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { flex: 1 },

  // --- incoming variant ---
  incomingCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: 0,
    ...elevation.floatingCard,
  },
  headerBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accentGreenSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.tight14,
  },
  headerBandLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerBandLabel: { ...typography.eyebrow, color: colors.accentGreenPressed },
  fare: { fontSize: 22, lineHeight: 26, fontFamily: 'Poppins_800ExtraBold', letterSpacing: -0.6, color: colors.accentGreenPressed },
  body: { flexDirection: 'row', padding: spacing.lg, gap: spacing.tight14 },
  timelineRail: { alignItems: 'center', width: 12, paddingTop: 4 },
  timelineDotOuter: { width: 9, height: 9, borderRadius: 4.5, borderWidth: 2, borderColor: colors.accentBlue },
  timelineConnector: { flex: 1, width: 2, backgroundColor: colors.line, marginVertical: 4 },
  timelineDotDest: { width: 9, height: 9, backgroundColor: colors.accentGreen },
  stops: { flex: 1, gap: spacing.md },
  stop: { gap: 2 },
  stopLabel: { fontSize: 11, lineHeight: 15, fontFamily: 'Poppins_400Regular', textTransform: 'uppercase', color: colors.inkFaint },
  stopValue: { ...typography.bodyLg, color: colors.ink },
  incomingActions: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, paddingTop: 0 },
  declineButton: { width: 96, minHeight: 48, justifyContent: 'center' },
  acceptButton: { flex: 1, minHeight: 48, justifyContent: 'center' },
});
```

- [ ] **Step 4: Barrel it**

```typescript
// packages/ui/src/components/RequestCard/index.ts
export * from './RequestCard';
export * from './types';
```

Add `export * from './RequestCard';` to `packages/ui/src/components/index.ts` (alphabetical, before `SegmentedControl`).

- [ ] **Step 5: Run test to verify it passes**

Run: `npm --workspace packages/ui run test`
Expected: PASS

- [ ] **Step 6: Update the 3 driver call sites and delete the local copy**

`apps/driver/app/(tabs)/requests.tsx` line 4 and `apps/driver/app/trip/active.tsx` line 6: change
```typescript
import { RequestCard } from '../../src/components/RequestCard';
```
to
```typescript
import { RequestCard } from '@trisakay/ui';
```
Both call sites pass no `variant` (defaults to `'compact'`) and no `copy` prop yet — **this will fail typecheck** until Step 7 below, since `copy` is required. Pass it inline at both sites using the existing `t.driver.requestCard.*` keys:
```tsx
<RequestCard
  request={item}
  accepting={acceptingId === item.id}
  onAccept={() => acceptRideRequest(item.id)}
  onDecline={() => decline(item.id)}
  copy={{
    decline: t.driver.requestCard.decline,
    accept: t.driver.requestCard.accept,
    newRideRequest: t.driver.requestCard.newRideRequest,
    seatsSingular: t.driver.requestCard.seatsSingular,
    seatsPlural: t.driver.requestCard.seatsPlural,
    pickupLabel: t.driver.requestCard.pickupLabel,
    dropoffLabel: t.driver.requestCard.dropoffLabel,
    pickupAwaySuffix: t.driver.requestCard.pickupAwaySuffix,
  }}
/>
```
(`t` is already in scope in both files via `useTranslation()`.) Task 7 adds the two new keys (`pickupLabel`, `dropoffLabel`, `pickupAwaySuffix`) this references — do that before this step compiles cleanly, or do Task 7 first; either ordering works since these are independent additions to `en.ts`.

```bash
git rm -r apps/driver/src/components/RequestCard
```

`apps/driver/app/(tabs)/dashboard.tsx` still imports the deleted local copy at this point — expected red, fixed by Task 14.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: PASS for `requests.tsx`/`trip/active.tsx`; `dashboard.tsx` stays red until Task 14 (same as Task 4's note).

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/components/RequestCard packages/ui/src/components/index.ts packages/ui/tests/request-card-copy.test.ts apps/driver/app
git commit -m "feat(ui): promote RequestCard with a spec-matching incoming variant"
```

---

### Task 6: Tricycle mark assets

**Files:**
- Create: `assets/trike-white.png` (copy of `docs/design_handoff_trisakay_home/assets/trike-white.png`)
- Create: `assets/trike-navy.png` (copy of `docs/design_handoff_trisakay_home/assets/trike-navy.png`)

**Interfaces:**
- Produces: two static image files at the repo's existing root `assets/` directory (matches the established convention — confirmed neither `apps/passenger` nor `apps/driver` has a per-app `assets/` folder; both `app.json`s reference the root one).
- Consumed by: passenger CTA card (Task 12), driver duty-console offline "Go online" button icon substitution is NOT in scope (spec keeps a power Ionicon there) — the trike mark is used only in "Request a Tricycle" affordances, which today exist only on the passenger Home.

- [ ] **Step 1: Copy the files**

```bash
cp "docs/design_handoff_trisakay_home/assets/trike-white.png" "assets/trike-white.png"
cp "docs/design_handoff_trisakay_home/assets/trike-navy.png" "assets/trike-navy.png"
```

- [ ] **Step 2: Verify**

Run: `ls -la assets/trike-white.png assets/trike-navy.png`
Expected: both files present, non-zero size.

- [ ] **Step 3: Commit**

```bash
git add assets/trike-white.png assets/trike-navy.png
git commit -m "chore: add tricycle mark assets for the Request a Tricycle CTA"
```

---

### Task 7: i18n copy

**Files:**
- Modify: `packages/shared/src/i18n/en.ts`
- Modify: `packages/shared/src/i18n/fil.ts`

**Interfaces:**
- Produces: new keys under `home` (passenger) with exact spec copy; new keys under `driver.dashboard` and `driver.requestCard`.
- Consumed by: Tasks 5, 12, 13, 14.

- [ ] **Step 1: Add passenger `home` keys**

In `packages/shared/src/i18n/en.ts`, inside the existing `home: { ... }` block, add (copy is verbatim from the spec — do not paraphrase):

```typescript
  home: {
    // ...existing keys unchanged...
    heroTagline: 'Your ride is just a tap away.', // already exists, keep as-is
    statsTripsLabel: 'Trips',
    statsDiscountLabel: 'Discount',
    statsTripsEmptyValue: '0',
    statsDiscountEmptyValue: 'Not set',
    ctaFareChipPrefix: 'Fares from ₱25',
    ctaNearbySuffix: '{count} nearby',
    savedPlacesManage: 'Manage',
    savedPlacesEmptyTitle: 'No saved places yet',
    savedPlacesEmptyMessage: 'Places you save will appear here for one-tap booking.',
    discountLabelSeniorCitizen: 'Senior',
    discountLabelPwd: 'PWD',
    discountLabelStudent: 'Student',
  },
```

Note: `noSavedPlacesTitle`/`noSavedPlacesMessage` already exist with this exact copy (confirmed in the current file) — reuse them for the redesigned empty state rather than adding `savedPlacesEmptyTitle/Message` duplicates. **Correction to the block above:** drop `savedPlacesEmptyTitle`/`savedPlacesEmptyMessage` and use the existing `noSavedPlacesTitle`/`noSavedPlacesMessage` keys in Task 12.

- [ ] **Step 2: Add a `savedPlacesManagement` namespace for the new route (Task 13)**

```typescript
  savedPlacesManagement: {
    title: 'Saved places',
    emptyTitle: 'No saved places yet',
    emptyMessage: 'Places you save from a trip will appear here.',
    removeAccessibilityLabel: 'Remove {label}',
    backAccessibilityLabel: 'Back',
  },
```

- [ ] **Step 3: Add driver keys**

Inside the existing `driver.dashboard` block, add:
```typescript
    dashboard: {
      // ...existing keys unchanged...
      goOnline: 'Go online',
      offlineNote: "You won't receive ride requests while offline. Go online to start listening.",
      earningsTodayEyebrow: 'EARNINGS TODAY',
      statTrips: '{count} trips',
      statRating: '{rating}',
      statAcceptance: '{percent}% accepted',
      noRatingsYet: 'No ratings',
      pso: 'PSO verified',
      pendingVerification: 'Verification pending',
      bodyNoPrefix: 'Body no.',
      listeningTitle: 'Listening for requests',
      listeningMessage: "You're online near {area}. The next ride will appear right here.",
      listeningEyebrow: 'LISTENING',
      incomingRequestEyebrow: 'INCOMING REQUEST',
      requestExpired: 'expired',
    },
```

Inside the existing `driver.requestCard` block, add the three new keys Task 5 references:
```typescript
    requestCard: {
      decline: 'Decline',
      accept: 'Accept ride',
      newRideRequest: 'New ride request',
      seatsSingular: 'seat',
      seatsPlural: 'seats',
      pickupLabel: 'Pickup',
      dropoffLabel: 'Drop-off',
      pickupAwaySuffix: 'm away',
    },
```
(`accept` changes from `'Accept'` to `'Accept ride'` per the spec's incoming-card button copy — this also affects the existing compact-variant Accept button on `requests.tsx`/`trip/active.tsx`; confirm that's acceptable since the spec doesn't distinguish compact-variant copy. It reads fine in both contexts, so reuse the one key rather than forking it.)

- [ ] **Step 4: Mirror every new key in `fil.ts`**

Open `packages/shared/src/i18n/fil.ts`, find the matching `home`/`driver.dashboard`/`driver.requestCard` blocks, and add the same keys with a reasonable Filipino translation (the existing file already translates every other key in these namespaces — follow its tone). Keep this mechanical: same keys, same interpolation placeholders (`{count}`, `{rating}`, `{percent}`, `{area}`, `{label}`), translated values.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS — `Translations` type (wherever it's derived, likely `typeof en`) must still line up with `fil.ts`; if `packages/shared` has a test asserting key-parity between `en.ts` and `fil.ts`, run it too:
Run: `npm --workspace packages/shared run test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/i18n/en.ts packages/shared/src/i18n/fil.ts
git commit -m "feat(i18n): add TriSakay Home redesign copy"
```

---

### Task 8: `expires_at` on `ride_requests` + expose it and pickup distance (requires user confirmation to apply)

**⚠️ This task modifies the live Supabase project schema and a deployed Edge Function. Do not run the `apply_migration`/`deploy_edge_function` steps without the user explicitly confirming at execution time — this is a hard-to-reverse, shared-state change per this session's operating rules.**

**Files:**
- Migration (via Supabase MCP `apply_migration` or the Supabase CLI, whichever the user prefers): adds a generated column.
- Modify: `supabase/functions/match-ride-request/index.ts`
- Modify: `packages/services/src/booking/index.ts` (the `RideRequestRow` type / `subscribeToPendingRideRequests` mapping — check its exact current shape first, this file wasn't fully read; grep for `RideRequestRow` export before editing)
- Modify: `apps/driver/src/types/request.ts`
- Modify: `apps/driver/src/store/useRequestsStore.ts`
- Test: `apps/driver/tests/requestsStore.test.js` (extend existing file — it already tests this store)

**Interfaces:**
- Produces: `ride_requests.expires_at` (generated, `requested_at + interval '18 seconds'`), returned by `match-ride-request` as `expires_at`; `RideRequestRow.expires_at: string` and `RideRequestRow.distance_km: number | null`; `PendingRequest.expiresAt: string | null` and `PendingRequest.pickupDistanceMeters: number | null`.
- Consumed by: Task 15's `useRequestCountdown` hook, Task 5's `RequestCard` (`pickupDistanceMeters`).

Design note on scope: this repo's dispatch model is a shared pending-request pool (any eligible driver can see and accept a request), not a per-driver timed offer. A true "this specific offer expires in 18s and reassigns to the next driver" system would need a new dispatch/offer table and is out of scope for this redesign. What Task 8 delivers instead — and what satisfies "a real expiry from the dispatch payload" — is a real, server-computed deadline (`requested_at + 18s`) that the UI counts down to and then treats the request as stale (clears it from the slot back to "Listening", same visual behavior the spec describes). It is not a claim that the request is reassigned server-side at that instant.

- [ ] **Step 1: Locate the current `RideRequestRow` type and mapping**

Run: `grep -n "RideRequestRow\|distanceKm\|distance_km" "d:/Projects/TRISAKAY_APP/packages/services/src/booking/index.ts"`
Read the surrounding ~40 lines to see the exact current `.select(...)` column list and returned type shape before editing — this plan doesn't have that file's exact current content, so confirm field names match `ride_requests`' real columns (`id, passenger_id, pickup_lat, pickup_lng, pickup_label, dest_lat, dest_lng, dest_label, seats_requested, distance_km, estimated_fare, ..., preferred_method, requested_at, ...` per `database.types.ts`) before writing the diff.

- [ ] **Step 2: Write the migration SQL**

```sql
alter table public.ride_requests
  add column expires_at timestamptz generated always as (requested_at + interval '18 seconds') stored;

comment on column public.ride_requests.expires_at is
  'Client-facing dispatch deadline for the driver-facing countdown UI (18s from requested_at). Not a hard reassignment trigger — the request stays visible to other eligible drivers in the shared pending pool regardless of this value; the client just treats it as stale past this point.';
```

**Present this SQL to the user and get explicit confirmation before applying** (via `mcp__claude_ai_Supabase__apply_migration` on project ref `ygdgbvxxqrkxlezpckif`, or hand it to the user to run themselves — ask which they prefer). Do not proceed to Step 3 until applied.

- [ ] **Step 3: Regenerate types**

Run (after the migration is applied): use `mcp__claude_ai_Supabase__generate_typescript_types` for project `ygdgbvxxqrkxlezpckif`, and overwrite `packages/services/src/supabase/database.types.ts` with the result (or the equivalent Supabase CLI command if the user prefers CLI-driven workflow — check for a `supabase gen types` script first).

- [ ] **Step 4: Update `match-ride-request` to stop stripping distance and to return `expires_at`**

Read `supabase/functions/match-ride-request/index.ts` around line 231 (the `.map(({ bearingDiffDeg: _b, distanceKm: _d, detourRatio: _r, ...row }) => row)` line) and change it to keep `distanceKm` (rename the exposed field to `distance_meters` for direct client consumption, converting km→m: `distanceKm * 1000`) while still dropping the internal `bearingDiffDeg`/`detourRatio`:
```typescript
.map(({ bearingDiffDeg: _b, distanceKm, detourRatio: _r, ...row }) => ({
  ...row,
  distance_meters: Math.round(distanceKm * 1000),
}));
```
Also confirm the initial `.select(...)` in this function includes `expires_at` (it will automatically once Step 3's types are regenerated and the select uses `*` or an explicit column list you extend — check which).

**Present this diff to the user and get explicit confirmation before deploying** (via `mcp__claude_ai_Supabase__deploy_edge_function`). Do not proceed until deployed.

- [ ] **Step 5: Update `packages/services/src/booking/index.ts`**

Extend the returned row type with `expires_at: string` and `distance_meters: number | null`, matching the Edge Function's actual response shape from Step 4.

- [ ] **Step 6: Write the failing store test**

```javascript
// apps/driver/tests/requestsStore.test.js — add to the existing file
test('toPendingRequest carries expiresAt and pickupDistanceMeters through from the row', () => {
  // follow this file's existing pattern for constructing a fake RideRequestRow
  // and asserting on the mapped PendingRequest shape — see the tests already
  // in this file for the exact mock/import style used here.
});
```
(Write this against the existing test file's actual conventions — read it first via `Read apps/driver/tests/requestsStore.test.js` since this plan hasn't inspected its contents; match its mocking style exactly rather than introducing a new one.)

- [ ] **Step 7: Update types and mapping**

`packages/ui/src/components/RequestCard/types.ts` (Task 5) is now the canonical `PendingRequest` — `apps/driver/src/types/request.ts` must re-export it rather than keeping its own duplicate definition, or the two will drift the first time either one changes:

```typescript
// apps/driver/src/types/request.ts
export type { PaymentMethod, PendingRequest } from '@trisakay/ui';
import type { PendingRequest } from '@trisakay/ui';

export interface AcceptedRequest extends PendingRequest {
  tripId: string;
}
```

This also means Task 5's `packages/ui/src/components/RequestCard/types.ts` must already have `pickupDistanceMeters`/`expiresAt` on it (it does — see Task 5 Step 3) before this step, so there's nothing left to add to the shape itself here, only to repoint the driver app's import.

`apps/driver/src/store/useRequestsStore.ts`, `toPendingRequest`:
```typescript
function toPendingRequest(row: RideRequestRow): PendingRequest {
  return {
    id: row.id,
    seats: row.seats_requested,
    paymentMethod: row.preferred_method,
    pickupLabel: row.pickup_label,
    dropoffLabel: row.dest_label,
    fare: row.estimated_fare,
    createdAt: row.requested_at,
    pickupDistanceMeters: row.distance_meters ?? null,
    expiresAt: row.expires_at ?? null,
  };
}
```

- [ ] **Step 8: Run tests**

Run: `npm --workspace apps/driver run test`
Expected: PASS

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add supabase/functions/match-ride-request packages/services/src/booking apps/driver/src/types/request.ts apps/driver/src/store/useRequestsStore.ts apps/driver/tests/requestsStore.test.js packages/services/src/supabase/database.types.ts
git commit -m "feat(driver): expose real request expiry and pickup distance from dispatch"
```

---

### Task 9: Nearby-driver-count Edge Function (requires user confirmation to apply)

**⚠️ Same live-project caveat as Task 8 — confirm with the user before `deploy_edge_function`.**

**Files:**
- Create: `supabase/functions/nearby-driver-count/index.ts`
- Modify: `packages/services/src/driver-profile/index.ts` or a new `packages/services/src/discovery/index.ts` (pick based on whether "nearby count" fits better next to driver-profile queries or as its own small module — given it queries `driver_profiles` but is passenger-facing, a new `discovery` module is cleaner; use that)
- Test: none new (this is a thin fetch wrapper — the interesting logic lives server-side in the Edge Function, which isn't unit-testable from this repo's Node test setup; verify it via Task 16's manual pass)

**Interfaces:**
- Produces: `getNearbyDriverCount(lat: number, lng: number): Promise<{ count: number | null; error: string | null }>`.
- Consumed by: Task 12's CTA chip via a new `useNearbyDriverCount` hook.

- [ ] **Step 1: Write the Edge Function**

Mirrors `match-ride-request`'s haversine + `system_settings.search_radius_km` pattern for consistency (same "nearby" radius definition used everywhere else in the app):

```typescript
// supabase/functions/nearby-driver-count/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

const EARTH_RADIUS_KM = 6371;

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  try {
    const { lat, lng } = await req.json();
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return new Response(JSON.stringify({ error: 'lat/lng required' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: settings } = await supabase
      .from('system_settings')
      .select('search_radius_km')
      .limit(1)
      .maybeSingle();
    const radiusKm = settings?.search_radius_km ?? 3;

    const { data: drivers, error } = await supabase
      .from('driver_profiles')
      .select('current_lat, current_lng')
      .eq('is_available', true)
      .not('current_lat', 'is', null)
      .not('current_lng', 'is', null);

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    const count = (drivers ?? []).filter(
      (d) => haversineKm(lat, lng, d.current_lat!, d.current_lng!) <= radiusKm,
    ).length;

    return new Response(JSON.stringify({ count }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
```

**Present this function to the user and get explicit confirmation before deploying** (`mcp__claude_ai_Supabase__deploy_edge_function`, project `ygdgbvxxqrkxlezpckif`). Do not proceed to Step 2's client wiring being exercised end-to-end until deployed — the client code itself is safe to write and commit regardless, it just won't return real data until the function exists.

- [ ] **Step 2: Write the client wrapper**

```typescript
// packages/services/src/discovery/index.ts
import { getSupabaseClient } from '../supabase/client.ts';

export interface NearbyDriverCountResult {
  count: number | null;
  error: string | null;
}

/** Backs the passenger Home CTA's "· N nearby" chip. Returns count: null (not 0) on any failure so the UI can omit the segment rather than claim zero drivers are nearby. */
export async function getNearbyDriverCount(lat: number, lng: number): Promise<NearbyDriverCountResult> {
  const { data, error } = await getSupabaseClient().functions.invoke('nearby-driver-count', {
    body: { lat, lng },
  });
  if (error) return { count: null, error: error.message };
  return { count: data?.count ?? null, error: null };
}
```

Check `packages/services/src/index.ts` (or wherever the package barrels its modules) and add `export * from './discovery/index.ts';` following the existing pattern for `discount`, `trip-history`, etc.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/nearby-driver-count packages/services/src/discovery packages/services/src/index.ts
git commit -m "feat(services): add nearby-driver-count for the passenger CTA chip"
```

---

### Task 10: Passenger stats data (`usePassengerStats`)

**Files:**
- Create: `packages/services/src/passenger-stats/index.ts`
- Create: `packages/services/src/passenger-stats/formatDiscountLabel.ts`
- Modify: `packages/services/src/index.ts`
- Create: `apps/passenger/src/hooks/usePassengerStats.ts`
- Test: `packages/services/tests/formatDiscountLabel.test.ts` (check the exact existing test location/pattern for this package first — `packages/services` test dir wasn't enumerated in this plan's research; follow whatever convention `packages/ui/tests` and `apps/*/tests` establish, likely `packages/services/tests/*.test.ts` run via `node --test`)

**Interfaces:**
- Produces: `formatDiscountLabel(category: DiscountCategory, ratePercent: number, labels: { seniorCitizen: string; pwd: string; student: string }): string` — pure, e.g. `formatDiscountLabel('student', 20, labels) === 'Student 20%'`.
- Produces: `getPassengerStats(): Promise<{ trips: number | null; discount: { category: DiscountCategory; ratePercent: number } | null; error: string | null }>`.
- Consumed by: Task 12.

- [ ] **Step 1: Write the failing test for the pure formatter**

```typescript
// packages/services/tests/formatDiscountLabel.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDiscountLabel } from '../src/passenger-stats/formatDiscountLabel.ts';

const labels = { seniorCitizen: 'Senior', pwd: 'PWD', student: 'Student' };

test('formats a student discount at the given rate', () => {
  assert.equal(formatDiscountLabel('student', 20, labels), 'Student 20%');
});

test('formats a senior citizen discount', () => {
  assert.equal(formatDiscountLabel('senior_citizen', 20, labels), 'Senior 20%');
});

test('formats a PWD discount', () => {
  assert.equal(formatDiscountLabel('pwd', 20, labels), 'PWD 20%');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace packages/services run test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the formatter and the data function**

```typescript
// packages/services/src/passenger-stats/formatDiscountLabel.ts
import type { Database } from '../supabase/database.types.ts';

export type DiscountCategory = Database['public']['Enums']['discount_category'];

export function formatDiscountLabel(
  category: DiscountCategory,
  ratePercent: number,
  labels: { seniorCitizen: string; pwd: string; student: string },
): string {
  const categoryLabel =
    category === 'senior_citizen' ? labels.seniorCitizen : category === 'pwd' ? labels.pwd : labels.student;
  return `${categoryLabel} ${ratePercent}%`;
}
```

```typescript
// packages/services/src/passenger-stats/index.ts
import { getMyDiscount } from '../discount/index.ts';
import { getFareDiscountRate } from '../fare/index.ts';
import { listPassengerTripHistory } from '../trip-history/index.ts';
import type { DiscountCategory } from './formatDiscountLabel.ts';

export { formatDiscountLabel } from './formatDiscountLabel.ts';
export type { DiscountCategory } from './formatDiscountLabel.ts';

export interface PassengerStats {
  /** Count of completed trips in the most recent 50 — this repo has no dedicated count RPC yet; 50 is the same cap `listPassengerTripHistory`'s only other caller (trip history screen) already uses. A passenger with more than 50 lifetime trips will see this figure undercount. */
  trips: number;
  discount: { category: DiscountCategory; ratePercent: number } | null;
  error: string | null;
}

export async function getPassengerStats(): Promise<PassengerStats> {
  const [historyResult, discountResult, rateResult] = await Promise.all([
    listPassengerTripHistory(50),
    getMyDiscount(),
    getFareDiscountRate(),
  ]);

  const trips = historyResult.data.filter((row) => row.status === 'completed').length;

  const approvedCategory =
    discountResult.data?.status === 'approved' ? (discountResult.data.category as DiscountCategory) : null;
  const discount =
    approvedCategory && rateResult.discountRatePercent != null
      ? { category: approvedCategory, ratePercent: rateResult.discountRatePercent }
      : null;

  const error = historyResult.error ?? discountResult.error ?? rateResult.error ?? null;
  return { trips, discount, error };
}
```

- [ ] **Step 4: Barrel it**

Add `export * from './passenger-stats/index.ts';` to `packages/services/src/index.ts` (match the file's existing export style — check whether it uses `.ts` extensions in its own re-exports first).

- [ ] **Step 5: Run test to verify it passes**

Run: `npm --workspace packages/services run test`
Expected: PASS

- [ ] **Step 6: Write the passenger hook**

```typescript
// apps/passenger/src/hooks/usePassengerStats.ts
import { useEffect, useState } from 'react';
import { getPassengerStats, type PassengerStats } from '@trisakay/services';

/** Loads once per mount — Home doesn't need live updates to trips/discount within a session. */
export function usePassengerStats() {
  const [stats, setStats] = useState<PassengerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPassengerStats().then((result) => {
      if (!cancelled) {
        setStats(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, loading };
}
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/services/src/passenger-stats packages/services/src/index.ts packages/services/tests/formatDiscountLabel.test.ts apps/passenger/src/hooks/usePassengerStats.ts
git commit -m "feat(services): wire real trips/discount data for the passenger stats strip"
```

---

### Task 11: Driver unit/verification data (`useDriverUnit`)

**Files:**
- Modify: `packages/services/src/driver-profile/index.ts`
- Create: `apps/driver/src/hooks/useDriverUnit.ts`
- Test: `packages/services/tests/driver-profile.test.ts` if one already exists (check first) — otherwise skip a dedicated test, since this function has no branching logic worth asserting beyond what TypeScript already enforces (a straight `select().eq().maybeSingle()`, same shape as `getMyDiscount` above, which also has no direct unit test in the codebase per the earlier research).

**Interfaces:**
- Produces: `getDriverUnit(): Promise<{ bodyNo: string | null; verificationStatus: VerificationStatus | null; error: string | null }>`.
- Consumed by: Task 14.

- [ ] **Step 1: Add the function**

```typescript
// packages/services/src/driver-profile/index.ts — add near getDriverVerificationStatus
export interface DriverUnitResult {
  bodyNo: string | null;
  verificationStatus: VerificationStatus | null;
  error: string | null;
}

/** Backs the Dashboard identity row's "PSO verified · Body no. {n}" line — body_no lives on `tricycles`, keyed by driver_id, not on driver_profiles. */
export async function getDriverUnit(): Promise<DriverUnitResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { bodyNo: null, verificationStatus: null, error: 'Not signed in' };

  const { data, error } = await getSupabaseClient()
    .from('tricycles')
    .select('body_no, verification_status')
    .eq('driver_id', userId)
    .maybeSingle();

  if (error) return { bodyNo: null, verificationStatus: null, error: error.message };
  return { bodyNo: data?.body_no ?? null, verificationStatus: data?.verification_status ?? null, error: null };
}
```
(Check `getSignedInUserId` is actually exported/available in this file's scope first — `getDriverEarnings` in this same file uses it per the earlier research, so it should already be imported at the top of the file; confirm before assuming.)

- [ ] **Step 2: Write the hook**

```typescript
// apps/driver/src/hooks/useDriverUnit.ts
import { useEffect, useState } from 'react';
import { getDriverUnit, type DriverUnitResult } from '@trisakay/services';

export function useDriverUnit() {
  const [unit, setUnit] = useState<DriverUnitResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDriverUnit().then((result) => {
      if (!cancelled) setUnit(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return unit;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/services/src/driver-profile/index.ts apps/driver/src/hooks/useDriverUnit.ts
git commit -m "feat(services): wire real body-number/verification data for the driver identity row"
```

---

### Task 12: Rebuild passenger Home

**Files:**
- Modify: `apps/passenger/app/(tabs)/home.tsx`
- Modify: `apps/passenger/src/styles/tabs/home.styles.ts`
- Create: `apps/passenger/src/hooks/useNearbyDriverCount.ts`

**Interfaces:**
- Consumes: `usePassengerStats()` (Task 10), `useNearbyDriverCount()` (new, below), `useLocationPermission()` (existing), `StatTile` `tone="onNavy" bare` (Task 4), `GradientSurface texture` (Task 3), `assets/trike-white.png` (Task 6), new i18n keys (Task 7).
- Removes: the destination-search field and Recent/rebook row were already absent (confirmed in current `home.tsx`); the docked-CTA visual merge (negative-margin trick) is replaced by two visually separate full-bleed surfaces per spec — hero surface with `radius.heroBottom` bottom corners only, CTA card fully rounded below it, no negative margin overlap.

- [ ] **Step 1: Write `useNearbyDriverCount`**

```typescript
// apps/passenger/src/hooks/useNearbyDriverCount.ts
import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { getNearbyDriverCount } from '@trisakay/services';
import { useLocationPermission } from './useLocationPermission';

/** Never prompts for permission — Home shouldn't interrupt the user just to show a count. Silently omits the count (returns null) if permission isn't already granted or the last-known position isn't available. */
export function useNearbyDriverCount() {
  const { isGranted } = useLocationPermission();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isGranted) return;
    let cancelled = false;
    Location.getLastKnownPositionAsync()
      .then((position) => {
        if (!position || cancelled) return null;
        return getNearbyDriverCount(position.coords.latitude, position.coords.longitude);
      })
      .then((result) => {
        if (!cancelled && result) setCount(result.count);
      })
      .catch(() => {
        /* leave count null — chip omits the segment */
      });
    return () => {
      cancelled = true;
    };
  }, [isGranted]);

  return count;
}
```

- [ ] **Step 2: Rebuild `home.styles.ts`**

Replace the file with styles matching the spec's exact values. Key changes from the current file: `heroPanel` gets `borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: radius.heroBottom, borderBottomRightRadius: radius.heroBottom` (full-bleed, not a rounded card — remove `overflow: hidden` rounding on top corners) and extends under the status bar (the `SafeAreaView`'s `edges` prop drops `'top'` for the hero specifically — see Step 3); a new `statsStrip`/`statsCell`/`statsDivider` group; the CTA card becomes `#477434` solid (no `GradientSurface`, since it's one flat color — but keep the texture overlay, added via a small local absolutely-positioned `<Svg>` reusing the same pattern technique as `GradientSurface`, or simpler: pass `GradientSurface token` a new degenerate two-stop-same-color gradient — cleaner to just render `<View style={{backgroundColor: colors.accentGreen}}>` and reuse `GradientSurface`'s texture pattern by extracting it, OR pass `GradientSurface` a same-color pair; simplest and most consistent with "one place gradient logic lives": add `solid?: string` prop to `GradientSurface` in Task 3 that skips the `<LinearGradient>` and fills with a flat color instead, keeping texture support. **Revise Task 3** to include this (see amendment below) rather than duplicating texture logic here.

**Amendment to Task 3:** add `solid?: string` to `GradientSurfaceProps` — when set, the `<Rect fill>` uses the solid color directly instead of `url(#${id})`, and no `<LinearGradient>` def is created; `texture` still works identically on top. This keeps "the one place gradient/texture logic lives" true. Go back and add this before starting Task 12's Step 2 if Task 3 is already committed — it's a small additive change, same commit-amend-or-new-commit choice as any other retroactive fix; prefer a new commit over amending if Task 3 was already merged/reviewed.

With that amendment, the CTA card is `<GradientSurface solid={colors.accentGreen} texture textureOpacity={0.06} style={styles.ctaCard}>`.

Full styles file:

```typescript
// apps/passenger/src/styles/tabs/home.styles.ts
import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingBottom: spacing.tight44 * 1.7, gap: spacing.lg },

  heroPanel: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: radius.heroBottom,
    borderBottomRightRadius: radius.heroBottom,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 10,
  },
  heroMotifTop: { position: 'absolute', top: -46, right: -52 },
  heroRow: { paddingHorizontal: spacing.tight18, paddingBottom: spacing.tight22, gap: spacing.tight14 },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  heroIdentityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  avatarOuterRing: { padding: 3, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.22)' },
  avatarInnerRing: { padding: 2, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.accentGreenSoft },
  heroTextSlot: { flex: 1, gap: 2 },
  heroGreetingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  heroGreetingLabel: { ...typography.eyebrow, color: colors.white, opacity: 0.8 },
  heroName: { ...typography.h1b, color: colors.white },
  heroTagline: { ...typography.caption, color: colors.white, opacity: 0.72, marginTop: spacing.xs },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
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
    borderColor: colors.accentBlueDeep,
  },

  statsStrip: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: spacing.tight18,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  statsDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.14)', marginHorizontal: spacing.md },

  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },

  ctaCard: { borderRadius: radius.lg2, ...elevation.card },
  ctaMotif: { position: 'absolute', top: -34, right: -30 },
  ctaCardInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.tight18 },
  ctaIconBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trikeMark: { width: 30, height: 30 },
  ctaTextSlot: { flex: 1, gap: 4 },
  ctaTitle: { ...typography.h2b, color: colors.white },
  ctaChipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  ctaChip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  ctaChipText: { ...typography.chip, color: colors.white },
  ctaNearbyText: { ...typography.chip, color: colors.white, opacity: 0.8 },
  ctaSubtitle: { ...typography.caption, color: colors.white, opacity: 0.85 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sectionLabel: { ...typography.eyebrow, color: colors.inkSoft },
  manageLink: { ...typography.chip, color: colors.accentBlue },

  shortcuts: { gap: spacing.tight10 },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight14,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.tight14,
    backgroundColor: colors.white,
    minHeight: 70,
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  shortcutIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  shortcutTextSlot: { flex: 1, gap: 2 },
  shortcutLabel: { ...typography.bodyStrong, color: colors.ink },
  shortcutAddress: { ...typography.caption, color: colors.inkSoft },

  emptyPanel: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.md3,
    padding: spacing.tight34,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  emptyMotif: { position: 'absolute', top: -20, right: -20 },
  emptyIconTile: {
    width: 46,
    height: 46,
    borderRadius: radius.sm2,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { ...typography.h3, color: colors.ink, textAlign: 'center' },
  emptyMessage: { ...typography.caption, color: colors.inkSoft, textAlign: 'center', marginTop: spacing.xs },
});
```

- [ ] **Step 3: Rebuild `home.tsx`**

```tsx
// apps/passenger/app/(tabs)/home.tsx
import { useCallback } from 'react';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, BrandMotif, EmptyState, GradientSurface, Spinner, StatTile, colors } from '@trisakay/ui';
import { useTranslation } from '../../src/hooks/useTranslation';
import { usePassengerStats } from '../../src/hooks/usePassengerStats';
import { useNearbyDriverCount } from '../../src/hooks/useNearbyDriverCount';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useNotificationsStore } from '../../src/store/useNotificationsStore';
import { useSavedPlacesStore } from '../../src/store/useSavedPlacesStore';
import { formatDiscountLabel } from '@trisakay/services';
import type { SavedPlaceIcon, SavedPlaceRow } from '@trisakay/services';
import type { LocationPoint } from '../../src/types/booking';
import { styles } from '../../src/styles/tabs/home.styles';

// Dev-only override for reaching the empty saved-places state without clearing real data.
// Toggle in the debugger: globalThis.__TRISAKAY_MOCK_EMPTY_SAVED_PLACES__ = true
declare global {
  // eslint-disable-next-line no-var
  var __TRISAKAY_MOCK_EMPTY_SAVED_PLACES__: boolean | undefined;
}

function getGreeting(t: ReturnType<typeof useTranslation>) {
  const hour = new Date().getHours();
  if (hour < 12) return t.home.greetingMorning;
  if (hour < 18) return t.home.greetingAfternoon;
  return t.home.greetingEvening;
}

function getGreetingIcon(): keyof typeof Ionicons.glyphMap {
  const hour = new Date().getHours();
  if (hour < 12) return 'partly-sunny-outline';
  if (hour < 18) return 'sunny-outline';
  return 'moon-outline';
}

const SHORTCUT_ICON_TONE: Record<string, { bg: string; icon: string }> = {
  'home-outline': { bg: colors.accentBlue, icon: colors.white },
  'briefcase-outline': { bg: colors.accentGreen, icon: colors.white },
  'school-outline': { bg: colors.accentBlueSoft, icon: colors.accentBluePressed },
};
const DEFAULT_SHORTCUT_TONE = { bg: colors.accentBlueSoft, icon: colors.accentBluePressed };

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setDropoff = useBookingStore((state) => state.setDropoff);
  const unreadCount = useNotificationsStore((state) => state.items.filter((n) => !n.read).length);
  const t = useTranslation();
  const savedPlacesReal = useSavedPlacesStore((state) => state.items);
  const savedPlaces = __DEV__ && globalThis.__TRISAKAY_MOCK_EMPTY_SAVED_PLACES__ ? [] : savedPlacesReal;
  const savedPlacesLoading = useSavedPlacesStore((state) => state.loading);
  const savedPlacesError = useSavedPlacesStore((state) => state.error);
  const loadSavedPlaces = useSavedPlacesStore((state) => state.load);
  const removeSavedPlace = useSavedPlacesStore((state) => state.remove);
  const { stats } = usePassengerStats();
  const nearbyCount = useNearbyDriverCount();

  useFocusEffect(
    useCallback(() => {
      void loadSavedPlaces();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  function handleShortcutPress(point: LocationPoint) {
    setDropoff(point);
    router.push('/booking/request');
  }

  async function performDeleteSavedPlace(id: string) {
    const { error } = await removeSavedPlace(id);
    if (error) Alert.alert(t.home.savedPlacesErrorTitle, error);
  }

  function handleDeleteSavedPlace(item: SavedPlaceRow) {
    Alert.alert(t.home.deleteSavedPlaceTitle, t.home.deleteSavedPlaceMessage, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: () => void performDeleteSavedPlace(item.id) },
    ]);
  }

  const firstName = user?.name?.trim().split(/\s+/)[0];
  const discountValue = stats?.discount
    ? formatDiscountLabel(stats.discount.category, stats.discount.ratePercent, {
        seniorCitizen: t.home.discountLabelSeniorCitizen,
        pwd: t.home.discountLabelPwd,
        student: t.home.discountLabelStudent,
      })
    : t.home.statsDiscountEmptyValue;
  const tripsValue = stats ? String(stats.trips) : t.home.statsTripsEmptyValue;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <GradientSurface token="hero" direction="diagonal" texture textureOpacity={0.05} style={styles.heroPanel}>
          <BrandMotif size={230} color={colors.white} opacity={0.12} style={styles.heroMotifTop} />
          <SafeAreaView edges={['top']}>
            <View style={styles.heroRow}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroIdentityRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t.home.profileAccessibilityLabel}
                    onPress={() => router.push('/(tabs)/profile')}
                  >
                    <View style={styles.avatarOuterRing}>
                      <View style={styles.avatarInnerRing}>
                        <Avatar name={user?.name} source={user?.avatarUrl ? { uri: user.avatarUrl } : undefined} size="lg" />
                      </View>
                    </View>
                  </Pressable>
                  <View style={styles.heroTextSlot}>
                    <View style={styles.heroGreetingRow}>
                      <Ionicons name={getGreetingIcon()} size={14} color={colors.white} style={{ opacity: 0.75 }} />
                      <Text style={styles.heroGreetingLabel}>{getGreeting(t)}</Text>
                    </View>
                    <Text style={styles.heroName} numberOfLines={1}>
                      {firstName ?? user?.name ?? t.home.ctaTitle}
                    </Text>
                    <Text style={styles.heroTagline}>{t.home.heroTagline}</Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.home.notificationsAccessibilityLabel}
                  style={styles.bellButton}
                  onPress={() => router.push('/notifications')}
                >
                  <Ionicons name="notifications-outline" size={20} color={colors.white} />
                  {unreadCount > 0 && <View style={styles.bellDot} />}
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
          <View style={styles.statsStrip}>
            <StatTile tone="onNavy" bare label={t.home.statsTripsLabel} value={tripsValue} />
            <View style={styles.statsDivider} />
            <StatTile tone="onNavy" bare label={t.home.statsDiscountLabel} value={discountValue} />
          </View>
        </GradientSurface>

        <View style={styles.content}>
          <Pressable accessibilityRole="button" accessibilityLabel={t.home.ctaTitle} onPress={() => router.push('/booking/request')}>
            <GradientSurface solid={colors.accentGreen} texture textureOpacity={0.06} style={styles.ctaCard}>
              <BrandMotif size={150} color={colors.white} opacity={0.14} style={styles.ctaMotif} />
              <View style={styles.ctaCardInner}>
                <View style={styles.ctaIconBadge}>
                  <Image source={require('../../../../assets/trike-white.png')} style={styles.trikeMark} contentFit="contain" />
                </View>
                <View style={styles.ctaTextSlot}>
                  <Text style={styles.ctaTitle}>{t.home.ctaTitle}</Text>
                  {nearbyCount != null ? (
                    <View style={styles.ctaChipRow}>
                      <View style={styles.ctaChip}>
                        <Text style={styles.ctaChipText}>{t.home.ctaFareChipPrefix}</Text>
                      </View>
                      <Text style={styles.ctaNearbyText}>· {t.home.ctaNearbySuffix.replace('{count}', String(nearbyCount))}</Text>
                    </View>
                  ) : (
                    <Text style={styles.ctaSubtitle}>{t.home.ctaSubtitle}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.white} />
              </View>
            </GradientSurface>
          </Pressable>

          <View>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>{t.home.savedPlaces}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/saved-places/manage')}>
                <Text style={styles.manageLink}>{t.home.savedPlacesManage}</Text>
              </Pressable>
            </View>
            {savedPlacesLoading && savedPlaces.length === 0 ? (
              <Spinner size="small" />
            ) : savedPlacesError ? (
              <EmptyState title={t.home.savedPlacesErrorTitle} message={t.home.savedPlacesErrorMessage} />
            ) : savedPlaces.length === 0 ? (
              <View style={styles.emptyPanel}>
                <BrandMotif size={160} color={colors.accentBlue} opacity={0.05} style={styles.emptyMotif} />
                <View style={styles.emptyIconTile}>
                  <Ionicons name="bookmark-outline" size={22} color={colors.accentBluePressed} />
                </View>
                <Text style={styles.emptyTitle}>{t.home.noSavedPlacesTitle}</Text>
                <Text style={styles.emptyMessage}>{t.home.noSavedPlacesMessage}</Text>
              </View>
            ) : (
              <View style={styles.shortcuts}>
                {savedPlaces.map((item) => {
                  const tone = SHORTCUT_ICON_TONE[item.icon] ?? DEFAULT_SHORTCUT_TONE;
                  return (
                    <Pressable
                      key={item.id}
                      style={styles.shortcutRow}
                      onPress={() =>
                        handleShortcutPress({ label: item.label, address: item.address, latitude: item.latitude, longitude: item.longitude })
                      }
                      onLongPress={() => handleDeleteSavedPlace(item)}
                      accessibilityRole="button"
                    >
                      <View style={[styles.shortcutIcon, { backgroundColor: tone.bg }]}>
                        <Ionicons name={item.icon as SavedPlaceIcon} size={20} color={tone.icon} />
                      </View>
                      <View style={styles.shortcutTextSlot}>
                        <Text style={styles.shortcutLabel}>{item.label}</Text>
                        <Text style={styles.shortcutAddress} numberOfLines={1}>
                          {item.address}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

Notes on deviations that need a second pass once running on-device:
- Confirm `expo-image`'s `Image`/`contentFit` is already a dependency (used elsewhere in `apps/passenger`) — if not, `Image` + `resizeMode="contain"` from `react-native` works identically for a static local asset and avoids adding a new dependency; check `apps/passenger/package.json` for `expo-image` before assuming it's available.
- The outer `SafeAreaView edges={['left','right']}` plus an inner `SafeAreaView edges={['top']}` wrapping only the hero's content row is what makes the gradient extend under the status bar while the greeting text still sits below the notch — verify this renders correctly on both iOS and Android; if the nested `SafeAreaView` fights with `GradientSurface`'s `overflow: hidden`, swap it for `useSafeAreaInsets()` and a manual `paddingTop: insets.top` on `heroRow` instead.
- The relative import path `../../../../assets/trike-white.png` from `apps/passenger/app/(tabs)/home.tsx` — verify this resolves (4 `..` to reach the repo root from `apps/passenger/app/(tabs)/`, matching the depth difference from `apps/driver/app.json`'s confirmed `../../assets/icon.png`). If Metro can't resolve it, check `apps/passenger/metro.config.js` for a `watchFolders`/asset-root restriction limiting it to the app directory, and add the root `assets/` folder to that config the same way the existing `icon`/`splash` references in `app.json` already work around it (those are resolved by Expo's config, not Metro's bundler, which is why they don't hit this problem the same way — `require()` in-component IS subject to Metro's resolution rules, so this needs an explicit check, not an assumption).

- [ ] **Step 4: Verify in dev**

Run: `npm run start:passenger`, open on a device/simulator, confirm the hero renders under the status bar, stats strip shows real (or "0"/"Not set" empty-state) values, CTA card is solid green with the trike mark, saved places list/empty state both render (toggle `globalThis.__TRISAKAY_MOCK_EMPTY_SAVED_PLACES__ = true` in the debugger console to check the empty state without deleting real saved places).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/passenger/app/\(tabs\)/home.tsx apps/passenger/src/styles/tabs/home.styles.ts apps/passenger/src/hooks/useNearbyDriverCount.ts packages/ui/src/components/GradientSurface/GradientSurface.tsx
git commit -m "feat(passenger): rebuild Home per the TriSakay redesign spec"
```

---

### Task 13: Saved-places "Manage" route

**Files:**
- Create: `apps/passenger/app/saved-places/manage.tsx`
- Create: `apps/passenger/src/styles/saved-places/manage.styles.ts`

**Interfaces:**
- Consumes: `useSavedPlacesStore` (existing), `savedPlacesManagement.*` i18n keys (Task 7).
- Produces: route `/saved-places/manage`, linked from Task 12's "Manage" text.

- [ ] **Step 1: Write the screen**

A simple list-with-delete screen reusing the same row visual as Home's shortcut rows (import the same icon-tone mapping logic — extract `SHORTCUT_ICON_TONE`/`DEFAULT_SHORTCUT_TONE` from `home.tsx` into a small shared `apps/passenger/src/utils/savedPlaceIconTone.ts` first, since both files need it — do this as part of Step 1, not a separate task, since it's a 5-line extraction):

```typescript
// apps/passenger/src/utils/savedPlaceIconTone.ts
import { colors } from '@trisakay/ui';

export const SHORTCUT_ICON_TONE: Record<string, { bg: string; icon: string }> = {
  'home-outline': { bg: colors.accentBlue, icon: colors.white },
  'briefcase-outline': { bg: colors.accentGreen, icon: colors.white },
  'school-outline': { bg: colors.accentBlueSoft, icon: colors.accentBluePressed },
};
export const DEFAULT_SHORTCUT_TONE = { bg: colors.accentBlueSoft, icon: colors.accentBluePressed };
```

Update Task 12's `home.tsx` to import these from here instead of defining them locally (small follow-up edit to the file just written in Task 12).

```tsx
// apps/passenger/app/saved-places/manage.tsx
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, Spinner, colors } from '@trisakay/ui';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useSavedPlacesStore } from '../../src/store/useSavedPlacesStore';
import { SHORTCUT_ICON_TONE, DEFAULT_SHORTCUT_TONE } from '../../src/utils/savedPlaceIconTone';
import type { SavedPlaceIcon, SavedPlaceRow } from '@trisakay/services';
import { styles } from '../../src/styles/saved-places/manage.styles';

export default function ManageSavedPlacesScreen() {
  const router = useRouter();
  const t = useTranslation();
  const items = useSavedPlacesStore((state) => state.items);
  const loading = useSavedPlacesStore((state) => state.loading);
  const error = useSavedPlacesStore((state) => state.error);
  const load = useSavedPlacesStore((state) => state.load);
  const remove = useSavedPlacesStore((state) => state.remove);

  useFocusEffect(
    useCallback(() => {
      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  async function performDelete(id: string) {
    const { error: deleteError } = await remove(id);
    if (deleteError) Alert.alert(t.home.savedPlacesErrorTitle, deleteError);
  }

  function handleDelete(item: SavedPlaceRow) {
    Alert.alert(t.home.deleteSavedPlaceTitle, t.home.deleteSavedPlaceMessage, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: () => void performDelete(item.id) },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.savedPlacesManagement.backAccessibilityLabel}
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{t.savedPlacesManagement.title}</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading && items.length === 0 ? (
          <Spinner size="small" />
        ) : error ? (
          <EmptyState title={t.home.savedPlacesErrorTitle} message={t.home.savedPlacesErrorMessage} />
        ) : items.length === 0 ? (
          <EmptyState title={t.savedPlacesManagement.emptyTitle} message={t.savedPlacesManagement.emptyMessage} />
        ) : (
          items.map((item) => {
            const tone = SHORTCUT_ICON_TONE[item.icon] ?? DEFAULT_SHORTCUT_TONE;
            return (
              <View key={item.id} style={styles.row}>
                <View style={[styles.icon, { backgroundColor: tone.bg }]}>
                  <Ionicons name={item.icon as SavedPlaceIcon} size={20} color={tone.icon} />
                </View>
                <View style={styles.textSlot}>
                  <Text style={styles.label}>{item.label}</Text>
                  <Text style={styles.address} numberOfLines={1}>
                    {item.address}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.savedPlacesManagement.removeAccessibilityLabel.replace('{label}', item.label)}
                  style={styles.removeButton}
                  onPress={() => handleDelete(item)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

```typescript
// apps/passenger/src/styles/saved-places/manage.styles.ts
import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h2, color: colors.ink },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.tight10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight14,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.tight14,
    backgroundColor: colors.white,
    minHeight: 70,
  },
  icon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  textSlot: { flex: 1, gap: 2 },
  label: { ...typography.bodyStrong, color: colors.ink },
  address: { ...typography.caption, color: colors.inkSoft },
  removeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 2: Verify in dev**

Navigate Home → "Manage" → confirm the list renders, delete works, empty/error states render.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/passenger/app/saved-places apps/passenger/src/styles/saved-places apps/passenger/src/utils/savedPlaceIconTone.ts "apps/passenger/app/(tabs)/home.tsx"
git commit -m "feat(passenger): add saved-places management route"
```

---

### Task 14: Rebuild driver Dashboard

**Files:**
- Modify: `apps/driver/app/(tabs)/dashboard.tsx`
- Modify: `apps/driver/src/styles/tabs/dashboard.styles.ts`

**Interfaces:**
- Consumes: `RequestCard variant="incoming"` (Task 5), `PulseRing` (Task 2), `GradientSurface texture`/`solid` (Tasks 3/12-amendment), `useDriverUnit()` (Task 11), `useRequestCountdown()` (Task 15 — write Task 15 first, or stub inline here and extract in Task 15; **do Task 15 before this task**, reordering the execution sequence even though it's numbered after — the countdown hook is a dependency of this screen's JSX).
- Removes: the 4-tile `statGrid` entirely (replaced by the duty console's inline earnings + meta line).

- [ ] **Step 1: Rebuild `dashboard.styles.ts`**

```typescript
// apps/driver/src/styles/tabs/dashboard.styles.ts
import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.lg, paddingBottom: spacing.tight44 * 1.7 },

  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityTextSlot: { flex: 1, gap: 2 },
  identityName: { ...typography.bodyStrong, fontSize: 16, lineHeight: 21, color: colors.ink },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  verifiedText: { ...typography.caption, fontSize: 12, lineHeight: 16, color: colors.inkSoft },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: radius.sm2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    ...elevation.card,
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.white,
  },

  // --- duty console: online ---
  consoleOnline: { borderRadius: radius.lg2, overflow: 'hidden', padding: spacing.tight18, paddingBottom: spacing.tight22, position: 'relative' },
  consoleMotif: { position: 'absolute', bottom: -60, right: -46 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pulseHost: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  statusDotStatic: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accentGreenSoft },
  statusLabelOnline: { ...typography.bodySm, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.white },
  toggleTrack: { width: 56, height: 32, borderRadius: 16, justifyContent: 'center', padding: 3 },
  toggleTrackOn: { backgroundColor: colors.accentGreenSoft, alignItems: 'flex-end' },
  toggleTrackOff: { backgroundColor: colors.line, alignItems: 'flex-start' },
  toggleKnob: { width: 26, height: 26, borderRadius: 13 },
  toggleKnobOn: { backgroundColor: colors.accentBlue },
  toggleKnobOff: { backgroundColor: colors.white },

  earningsEyebrow: { ...typography.bodySm, fontSize: 11, lineHeight: 15, letterSpacing: 0.9, color: colors.white, opacity: 0.6, marginTop: spacing.tight14 },
  earningsAmount: { fontSize: 40, lineHeight: 46, fontFamily: 'Poppins_800ExtraBold', letterSpacing: -1.2, color: colors.white },

  metaRow: {
    flexDirection: 'row',
    gap: spacing.tight14,
    marginTop: spacing.tight14,
    paddingTop: spacing.tight14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.16)',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaTextOnline: { ...typography.bodySm, color: colors.white },

  // --- duty console: offline ---
  consoleOffline: { borderRadius: radius.lg2, borderWidth: 1, borderColor: colors.lineSoft, backgroundColor: colors.white, padding: spacing.tight18, paddingBottom: spacing.tight22 },
  statusDotOffline: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.inkFaint },
  statusLabelOffline: { ...typography.bodySm, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.inkSoft },
  earningsEyebrowOffline: { ...typography.bodySm, fontSize: 11, lineHeight: 15, letterSpacing: 0.9, color: colors.inkSoft, marginTop: spacing.tight14 },
  earningsAmountOffline: { fontSize: 40, lineHeight: 46, fontFamily: 'Poppins_800ExtraBold', letterSpacing: -1.2, color: colors.ink },
  metaTextOffline: { ...typography.bodySm, color: colors.inkSoft },
  goOnlineButton: {
    marginTop: spacing.lg,
    minHeight: 52,
    borderRadius: radius.sm2,
    ...elevation.button,
  },
  goOnlineInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: '100%' },
  goOnlineText: { ...typography.h3b, fontSize: 16, lineHeight: 20, color: colors.white },

  offlineStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.fill,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  offlineStripText: { flex: 1, ...typography.caption, fontSize: 13, lineHeight: 19, color: colors.inkSoft },

  // --- request slot ---
  requestSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  countdownChip: { backgroundColor: colors.dangerSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  countdownChipText: { ...typography.bodySm, fontSize: 11, lineHeight: 16, color: colors.danger },

  listeningPanel: {
    borderRadius: radius.xl2,
    backgroundColor: colors.white,
    paddingVertical: spacing.tight44,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
  },
  listeningMotif: { position: 'absolute', top: -30, right: -30 },
  listeningIconHost: { width: 74, height: 74, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  listeningIconCircle: {
    position: 'absolute',
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listeningTitle: { ...typography.h3b, color: colors.ink },
  listeningMessage: { ...typography.caption, color: colors.inkSoft, textAlign: 'center', marginTop: spacing.xs, maxWidth: 250 },

  error: { ...typography.caption, color: colors.danger },
});
```

- [ ] **Step 2: Rebuild `dashboard.tsx`**

```tsx
// apps/driver/app/(tabs)/dashboard.tsx
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, GradientSurface, PulseRing, RequestCard, colors } from '@trisakay/ui';
import { useAcceptRideRequest } from '../../src/hooks/useAcceptRideRequest';
import { useDriverUnit } from '../../src/hooks/useDriverUnit';
import { useRequestCountdown } from '../../src/hooks/useRequestCountdown';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useDriverStore } from '../../src/store/useDriverStore';
import { useNotificationsStore } from '../../src/store/useNotificationsStore';
import { useRequestsStore } from '../../src/store/useRequestsStore';
import { useTripStore } from '../../src/store/useTripStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/tabs/dashboard.styles';

// Dev-only overrides for reaching every state without live backend data:
// globalThis.__TRISAKAY_MOCK_ONLINE__ = true | false
// globalThis.__TRISAKAY_MOCK_REQUEST__ = true  (forces the incoming-request slot with a fake request)
declare global {
  // eslint-disable-next-line no-var
  var __TRISAKAY_MOCK_ONLINE__: boolean | undefined;
  // eslint-disable-next-line no-var
  var __TRISAKAY_MOCK_REQUEST__: boolean | undefined;
}

const MOCK_REQUEST = {
  id: '__mock__',
  seats: 2,
  paymentMethod: 'cash' as const,
  pickupLabel: 'Poblacion Plaza, waiting shed',
  dropoffLabel: 'Public Market, Stall 14',
  fare: 45,
  createdAt: new Date().toISOString(),
  pickupDistanceMeters: 400,
  expiresAt: new Date(Date.now() + 18_000).toISOString(),
};

export default function DashboardScreen() {
  const router = useRouter();
  const t = useTranslation();
  const user = useAuthStore((state) => state.user);
  const driverUnit = useDriverUnit();

  const isAvailableReal = useDriverStore((state) => state.isAvailable);
  const isAvailable = __DEV__ && globalThis.__TRISAKAY_MOCK_ONLINE__ !== undefined ? globalThis.__TRISAKAY_MOCK_ONLINE__ : isAvailableReal;
  const setAvailable = useDriverStore((state) => state.setAvailable);
  const availabilityError = useDriverStore((state) => state.error);
  const todayEarnings = useDriverStore((state) => state.todayEarnings);
  const todayTrips = useDriverStore((state) => state.todayTrips);
  const rating = useDriverStore((state) => state.rating);
  const ratingCount = useDriverStore((state) => state.ratingCount);
  const acceptRate = useDriverStore((state) => state.acceptRate);

  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const unreadCount = useNotificationsStore((state) => state.items.filter((item) => !item.read).length);

  const pendingReal = useRequestsStore((state) => state.pending);
  const pending = __DEV__ && globalThis.__TRISAKAY_MOCK_REQUEST__ ? [MOCK_REQUEST, ...pendingReal] : pendingReal;
  const requestError = useRequestsStore((state) => state.error);
  const decline = useRequestsStore((state) => state.decline);

  const { acceptRideRequest, acceptingId } = useAcceptRideRequest();
  const activeTrip = useTripStore((state) => state.current);

  const incoming = pending[0];
  const countdown = useRequestCountdown(incoming?.expiresAt ?? null);

  async function handleToggleAvailable(next: boolean) {
    setTogglingAvailability(true);
    let coords: { lat: number; lng: number } | undefined;
    if (next) {
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      } catch {
        useDriverStore.setState({ error: t.driver.dashboard.locationError });
        setTogglingAvailability(false);
        return;
      }
    }
    await setAvailable(next, coords);
    setTogglingAvailability(false);
  }

  if (activeTrip) {
    return <Redirect href="/trip/active" />;
  }

  const requestExpired = incoming?.expiresAt != null && countdown === 0;
  const showListening = isAvailable && (!incoming || requestExpired);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.scrollContent}>
        <View style={styles.identityRow}>
          <Avatar name={user?.name} source={user?.avatarUrl ? { uri: user.avatarUrl } : undefined} size="md" />
          <View style={styles.identityTextSlot}>
            <Text style={styles.identityName} numberOfLines={1}>
              {user?.name ?? t.driver.dashboard.driverFallback}
            </Text>
            <View style={styles.verifiedRow}>
              <Ionicons name="shield-checkmark-outline" size={13} color={colors.accentGreen} />
              <Text style={styles.verifiedText}>
                {driverUnit?.verificationStatus === 'approved' ? t.driver.dashboard.pso : t.driver.dashboard.pendingVerification}
                {driverUnit?.bodyNo ? ` · ${t.driver.dashboard.bodyNoPrefix} ${driverUnit.bodyNo}` : ''}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.driver.dashboard.notificationsAccessibilityLabel}
            style={styles.bellButton}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={21} color={colors.ink} />
            {unreadCount > 0 && <View style={styles.bellDot} />}
          </Pressable>
        </View>

        {isAvailable ? (
          <GradientSurface token="hero" direction="vertical" texture textureOpacity={0.05} style={styles.consoleOnline}>
            <View style={styles.consoleMotif} />
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <View style={styles.pulseHost}>
                  <PulseRing size={10} color={colors.accentGreenSoft} durationMs={2000} style={{ position: 'absolute' }} />
                  <View style={styles.statusDotStatic} />
                </View>
                <Text style={styles.statusLabelOnline}>{t.driver.dashboard.onlineBadge.toUpperCase()}</Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: true, disabled: togglingAvailability }}
                onPress={() => handleToggleAvailable(false)}
                disabled={togglingAvailability}
                style={[styles.toggleTrack, styles.toggleTrackOn]}
                hitSlop={8}
              >
                <View style={[styles.toggleKnob, styles.toggleKnobOn]} />
              </Pressable>
            </View>

            <Text style={styles.earningsEyebrow}>{t.driver.dashboard.earningsTodayEyebrow}</Text>
            <Text style={styles.earningsAmount}>{formatCurrency(todayEarnings)}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="navigate-outline" size={15} color={colors.white} />
                <Text style={styles.metaTextOnline}>{t.driver.dashboard.statTrips.replace('{count}', String(todayTrips))}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="star" size={15} color={colors.accentGreenSoft} />
                <Text style={styles.metaTextOnline}>
                  {ratingCount > 0 && rating !== null ? t.driver.dashboard.statRating.replace('{rating}', rating.toFixed(1)) : t.driver.dashboard.noRatingsYet}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="checkmark-circle-outline" size={15} color={colors.white} />
                <Text style={styles.metaTextOnline}>
                  {acceptRate !== null ? t.driver.dashboard.statAcceptance.replace('{percent}', String(Math.round(acceptRate * 100))) : '—'}
                </Text>
              </View>
            </View>
          </GradientSurface>
        ) : (
          <View style={styles.consoleOffline}>
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <View style={styles.statusDotOffline} />
                <Text style={styles.statusLabelOffline}>{t.driver.dashboard.offlineBadge.toUpperCase()}</Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: false, disabled: togglingAvailability }}
                onPress={() => handleToggleAvailable(true)}
                disabled={togglingAvailability}
                style={[styles.toggleTrack, styles.toggleTrackOff]}
                hitSlop={8}
              >
                <View style={[styles.toggleKnob, styles.toggleKnobOff]} />
              </Pressable>
            </View>

            <Text style={styles.earningsEyebrowOffline}>{t.driver.dashboard.earningsTodayEyebrow}</Text>
            <Text style={styles.earningsAmountOffline}>{formatCurrency(0)}</Text>

            <View style={styles.metaRow}>
              <Text style={styles.metaTextOffline}>{t.driver.dashboard.statTrips.replace('{count}', '0')}</Text>
              <Text style={styles.metaTextOffline}>{t.driver.dashboard.noRatingsYet}</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.driver.dashboard.goOnline}
              onPress={() => handleToggleAvailable(true)}
              disabled={togglingAvailability}
            >
              <GradientSurface token="button" direction="diagonal" style={styles.goOnlineButton}>
                <View style={styles.goOnlineInner}>
                  <Ionicons name="power" size={19} color={colors.white} />
                  <Text style={styles.goOnlineText}>{t.driver.dashboard.goOnline}</Text>
                </View>
              </GradientSurface>
            </Pressable>
          </View>
        )}

        {availabilityError && <Text style={styles.error}>{availabilityError}</Text>}

        {!isAvailable && (
          <View style={styles.offlineStrip}>
            <Ionicons name="radio-outline" size={20} color={colors.accentBlue} />
            <Text style={styles.offlineStripText}>{t.driver.dashboard.offlineNote}</Text>
          </View>
        )}

        {isAvailable && incoming && !requestExpired && (
          <View>
            <View style={styles.requestSectionHeader}>
              <Text style={styles.identityName}>{t.driver.dashboard.incomingRequestEyebrow}</Text>
              {countdown !== null && (
                <View style={styles.countdownChip}>
                  <Text style={styles.countdownChipText}>{countdown}s</Text>
                </View>
              )}
            </View>
            <RequestCard
              request={incoming}
              variant="incoming"
              accepting={acceptingId === incoming.id}
              onAccept={() => acceptRideRequest(incoming.id)}
              onDecline={() => decline(incoming.id)}
              copy={{
                decline: t.driver.requestCard.decline,
                accept: t.driver.requestCard.accept,
                newRideRequest: t.driver.requestCard.newRideRequest,
                seatsSingular: t.driver.requestCard.seatsSingular,
                seatsPlural: t.driver.requestCard.seatsPlural,
                pickupLabel: t.driver.requestCard.pickupLabel,
                dropoffLabel: t.driver.requestCard.dropoffLabel,
                pickupAwaySuffix: t.driver.requestCard.pickupAwaySuffix,
              }}
            />
          </View>
        )}

        {requestError && <Text style={styles.error}>{requestError}</Text>}

        {showListening && (
          <View>
            <Text style={styles.identityName}>{t.driver.dashboard.listeningEyebrow}</Text>
            <View style={styles.listeningPanel}>
              <View style={styles.listeningIconHost}>
                <PulseRing size={74} color={colors.accentBlueSoft} durationMs={2400} style={{ position: 'absolute' }} />
                <View style={styles.listeningIconCircle}>
                  <Ionicons name="radio-outline" size={32} color={colors.accentBlue} />
                </View>
              </View>
              <Text style={styles.listeningTitle}>{t.driver.dashboard.listeningTitle}</Text>
              <Text style={styles.listeningMessage}>
                {t.driver.dashboard.listeningMessage.replace('{area}', 'Poblacion')}
              </Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
```

Note on `{area}`: the spec's copy is "You're online near Poblacion" — there's no existing reverse-geocoded "current area name" data source for the driver (this repo's `apps/passenger/src/utils/geocode.ts` reverse-geocodes for the passenger booking flow, not for the driver). Hardcoding `'Poblacion'` here is a known gap, not a resolved decision — flag it to the user in the same pass as Task 16's manual verification; if they want it real, that's a `getCurrentAreaLabel()` addition using the driver's `current_lat/lng` (already stored) through a reverse-geocode call, out of scope for this plan unless they ask for it.

- [ ] **Step 3: Verify in dev**

Run: `npm run start:driver`. Toggle `globalThis.__TRISAKAY_MOCK_ONLINE__ = true/false` and `globalThis.__TRISAKAY_MOCK_REQUEST__ = true` in the debugger to reach all four states without needing a live matched request. Confirm: online hero pulses (and holds static under OS reduce-motion), offline card shows the "Go online" button, incoming-request card shows the countdown ticking down and expiring back to Listening, hit targets ≥44px (Decline/Accept row is 48).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "apps/driver/app/(tabs)/dashboard.tsx" apps/driver/src/styles/tabs/dashboard.styles.ts
git commit -m "feat(driver): rebuild Dashboard per the TriSakay redesign spec"
```

---

### Task 15: `useRequestCountdown` hook (do this before Task 14's Step 2)

**Files:**
- Create: `apps/driver/src/hooks/useRequestCountdown.ts`
- Test: `apps/driver/tests/useRequestCountdown.test.js`

**Interfaces:**
- Produces: `useRequestCountdown(expiresAt: string | null): number | null` — seconds remaining (integer, floor, clamped ≥0), `null` when `expiresAt` is `null`. Ticks every 1000ms via `setInterval`.
- Produces (pure, tested separately from the hook itself): `secondsUntil(expiresAt: string, now: number): number` — the clampable math, extracted so it's testable without a React renderer (this repo's `node:test` setup can't render hooks — see `packages/ui/tests/scale.test.ts` for why pure-function extraction is the established pattern here).
- Consumed by: Task 14.

- [ ] **Step 1: Write the failing test for the pure function**

```javascript
// apps/driver/tests/useRequestCountdown.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { secondsUntil } = require('../src/hooks/useRequestCountdown.ts');

test('returns the whole seconds remaining before expiry', () => {
  const now = Date.parse('2026-01-01T00:00:00.000Z');
  const expiresAt = '2026-01-01T00:00:15.400Z';
  assert.equal(secondsUntil(expiresAt, now), 15);
});

test('clamps to 0 once expired, never negative', () => {
  const now = Date.parse('2026-01-01T00:00:20.000Z');
  const expiresAt = '2026-01-01T00:00:15.000Z';
  assert.equal(secondsUntil(expiresAt, now), 0);
});

test('returns 0 exactly at the expiry instant', () => {
  const now = Date.parse('2026-01-01T00:00:15.000Z');
  const expiresAt = '2026-01-01T00:00:15.000Z';
  assert.equal(secondsUntil(expiresAt, now), 0);
});
```

(Check `apps/driver/tests/*.test.js`'s existing convention for importing a `.ts` source file from a `.js` test first — `apps/driver/tests/interpolate.test.ts` exists per the earlier directory listing alongside `.js` files, so this repo's Node test runner is configured to load `.ts` directly; follow whichever import style its sibling tests already use rather than guessing `require` vs `import`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace apps/driver run test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the hook**

```typescript
// apps/driver/src/hooks/useRequestCountdown.ts
import { useEffect, useState } from 'react';

/** Whole seconds remaining before `expiresAt`, clamped to 0 — never negative, never fractional. */
export function secondsUntil(expiresAt: string, now: number): number {
  const remainingMs = Date.parse(expiresAt) - now;
  return Math.max(0, Math.floor(remainingMs / 1000));
}

/** Ticks every second toward 0. Returns null when there's no request to count down (matches the "no expiresAt yet" degrade path in RequestCard/PendingRequest). */
export function useRequestCountdown(expiresAt: string | null): number | null {
  const [seconds, setSeconds] = useState<number | null>(expiresAt ? secondsUntil(expiresAt, Date.now()) : null);

  useEffect(() => {
    if (!expiresAt) {
      setSeconds(null);
      return;
    }
    setSeconds(secondsUntil(expiresAt, Date.now()));
    const interval = setInterval(() => {
      setSeconds(secondsUntil(expiresAt, Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return seconds;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace apps/driver run test`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/driver/src/hooks/useRequestCountdown.ts apps/driver/tests/useRequestCountdown.test.js
git commit -m "feat(driver): add pure request-expiry countdown hook"
```

---

### Task 16: Manual verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npm run test:passenger && npm run test:driver && npm run test:services && npm run test:ui && npm run test:shared`
Expected: all PASS

- [ ] **Step 2: Full typecheck**

Run: `npm run typecheck`
Expected: PASS, zero errors

- [ ] **Step 3: Run both apps and screenshot all four states**

Use the `run` skill (or `npm run start:passenger` / `npm run start:driver` directly) to launch both apps. Capture:
1. Passenger Home — populated (real or mock saved places)
2. Passenger Home — empty saved places (`globalThis.__TRISAKAY_MOCK_EMPTY_SAVED_PLACES__ = true`)
3. Driver Dashboard — incoming request (`globalThis.__TRISAKAY_MOCK_REQUEST__ = true`)
4. Driver Dashboard — listening (`globalThis.__TRISAKAY_MOCK_ONLINE__ = true`, no mock request)

Compare each against the corresponding file in `docs/design_handoff_trisakay_home/screenshots/` (`01-passenger-home`, `02-passenger-home-empty`, `03-driver-incoming-request`, `04-driver-listening`). Note any pixel-level mismatch (color, spacing, radius) and fix before proceeding — this is the fidelity check the spec calls "high-fidelity... recreate pixel-faithfully."

- [ ] **Step 4: Reduce-motion check**

On a device/simulator, enable "Reduce Motion" (iOS: Settings → Accessibility → Motion; Android: Settings → Accessibility → Remove animations) and confirm the driver status dot and listening-panel circle render as static (no pulsing) rather than crashing or animating anyway.

- [ ] **Step 5: Hit-target check**

Confirm with the layout inspector (or manual measurement) that every tappable element is ≥44px in both dimensions: bell buttons, avatar, toggle, saved-place rows, Manage link (44px min touch area even if visually smaller — add `hitSlop` if the text itself is smaller than 44px), Decline/Accept row (48px).

- [ ] **Step 6: Report gaps to the user**

Two things this plan flags as needing a follow-up decision rather than resolving unilaterally:
- The driver listening panel's `{area}` placeholder is hardcoded to `'Poblacion'` (Task 14 note) — no real "current area name" data source exists.
- If Tasks 8/9's Supabase changes weren't confirmed/applied during execution, the countdown and nearby-count features are live in the UI but will show `null`/omitted state until those are deployed — flag this explicitly rather than letting it look silently broken.

No commit for this task — it's verification, not a code change (any fixes found in Step 3 go back into the relevant task's files as a follow-up commit on that task, not a new task).
