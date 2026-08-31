# Handoff: TriSakay **driver** app — splash screen

## Overview

The driver app's splash screen, built on the same map-ground illustration system as the locked passenger first-run flow (`design_handoff_first_run_flow`). It reads as a sibling of the passenger splash — identical daylight map ground and geometry — distinguished by the `DRIVER` pill under the lockup and the tricycle marker sitting on the driver's end of the route.

Screenshot: `screens/01-driver-splash.png` · design reference: `TriSakay Driver Splash.dc.html` (option **1b**; option 1a, a navy night variant, is in the reference file but was **not** chosen — ignore it).

Target: `apps/driver` in the `jhalasan/TriSakay` monorepo (Expo Router + React Native, `packages/ui` design tokens). If `apps/driver` does not exist yet, create it mirroring `apps/passenger`'s structure and reuse `packages/ui` unchanged.

Files to create:

| Screen | Files |
|---|---|
| Driver splash | `apps/driver/app/splash.tsx`, `apps/driver/src/styles/splash.styles.ts` |

## About the design files

`TriSakay Driver Splash.dc.html` is a **design reference authored in HTML** — a prototype of look and motion, not production code. Recreate it in React Native using the existing patterns: `packages/ui` theme tokens, `moderateScale` from `packages/ui/src/theme/scale.ts`, Expo Router, and `react-native-reanimated` for the entrance sequence.

Every value below is at the **375 × 812 baseline canvas** — the baseline `moderateScale` is calibrated against — so px values pass through `moderateScale()` unchanged.

## Fidelity

**High-fidelity.** Final colors, type, spacing, motion timings.

---

## Design tokens

All from `packages/ui/src/theme`, including the `map` group added by the passenger handoff. **No new tokens.**

| Token | Hex | Use here |
|---|---|---|
| `navy` | `#002E60` | destination pin |
| `accentGreen` | `#477434` | route line, halo, loading-bar fill, `DRIVER` pill text |
| `surface` | `#FFFFFF` | lockup card, driver marker circle, pin dot |
| `textSecondary` | `#5A646B` | tagline |
| `line` | `#DCE2E6` | loading-bar track |
| `map.ground` | `#EDF1F4` | map ground |
| `map.grid` | `#DCE2E6` | 38px grid lines |
| `map.road` | `#E3EDF7` | road bands |

`DRIVER` pill background is `accentGreen` at 10% — `rgba(71,116,52,.1)`.

**Typography** — Poppins.

| Role | Size / line-height | Weight | Tracking |
|---|---|---|---|
| `DRIVER` pill | 12 / 16 | 700 | +4.0, uppercase |
| Tagline | 16 / 24 | 400 | 0 |

**Radius** `20` lockup card · `999` pill, marker circle, halo, loading bar
**Shadows** lockup card `0 14 40 rgba(0,46,96,.16)` · marker circle `0 8 22 rgba(0,46,96,.18)` · pin `0 4 10 rgba(0,46,96,.24)`

---

## Layout

Full-bleed map ground, no inset panel. Same geometry as the passenger splash:

- **Grid**: 38 × 38 px lines, 1px, `map.grid`.
- **Road bands** (`map.road`): vertical `left: 96, width: 16`, full height · horizontal `top: 236, height: 22` · horizontal `bottom: 198, height: 14`.
- **Route line**: SVG path `M 300 246 L 104 246 L 104 700`, stroke `accentGreen`, width `6`, round caps, opacity `.9`. The direction is **reversed** from the passenger splash — it draws from the destination *toward* the driver, matching the driver's mental model.
- **Destination pin**: `left: 286, top: 231`, `30 × 30`, `navy`, teardrop (`border-radius: 50% 50% 50% 0` + `rotate(-45deg)`), `10 × 10` white dot at `left/top: 10`.
- **Driver marker**: centred on the route's end at `(104, 700)` — `64 × 64` white circle, `overflow: hidden`, holding `assets/trike-icon.png` at `44 × 44` (`object-fit: contain`). An `84 px` `accentGreen` halo loops behind it.

**Centre stack** (vertically centred on the frame): white card, radius `20`, padding `28 32 24`, `align-items: center`:

1. brand lockup `196 × 110`, `object-fit: contain`
2. `DRIVER` pill — `margin-top: 6`, `padding: 6 16`
3. tagline "Your next ride starts here" — `margin-top: 14`

**Loading bar**: `bottom: 64`, centred, `120 × 3`, radius `999`, `overflow: hidden`, track `line`; indeterminate fill `44%` wide in `accentGreen`.

---

## Motion

Runs once on mount. Total ≈ 1.8 s before the loading bar takes over.

| Element | Animation | Duration | Delay | Easing |
|---|---|---|---|---|
| Route line | stroke-dashoffset `660 → 0` | 1150 ms | 150 ms | `cubic-bezier(.4,0,.2,1)` |
| Destination pin | fade + settle from `translate(-24,-24)`, slight overshoot | 500 ms | 100 ms | `cubic-bezier(.34,1.4,.64,1)` |
| Lockup card | fade + scale `.88 → 1.03 → 1` | 700 ms | 350 ms | `cubic-bezier(.2,.7,.3,1)` |
| Driver marker | fade + scale pop | 600 ms | 1200 ms | `cubic-bezier(.2,.7,.3,1)` |
| Halo | scale `.7 → 1.9`, opacity `.55 → 0`, **loops** | 2200 ms | 1250 ms | `cubic-bezier(.3,0,.5,1)` |
| Loading bar | indeterminate sweep, **loops** | 1700 ms | 900 ms | `cubic-bezier(.5,0,.5,1)` |

Implementation notes:

- Route draw: `react-native-svg` `Path` with `strokeDasharray={660}` and an animated `strokeDashoffset` (Reanimated `useSharedValue` + `withDelay(150, withTiming(0, {duration: 1150}))`).
- Pin/marker overshoot: `withSpring` tuned to a single small overshoot, or `withTiming` on the published cubic-bezier — match the bezier for exactness.
- Halo and loading bar: `withRepeat(..., -1)`.
- **Reduced motion**: guard with `AccessibilityInfo.isReduceMotionEnabled()` — render every element in its final state, skip the draw, and hold the loading bar at a static 44%.

## Behaviour

Same contract as the passenger splash: hold for the animation, then navigate. Minimum visible duration `2000 ms`; if auth/bootstrap resolves sooner, still wait out the minimum, then route to the driver walkthrough (first run) or the driver home. Never a blank frame between splash and next screen.

---

## Porting notes

1. **Grid background.** CSS `background-image` layers don't exist in RN. Draw the 38px grid as a `react-native-svg` `Pattern`/repeated `Line` set, or a single tiled `ImageBackground` with a 38 × 38 tile — the SVG route layer is already present, so adding grid lines to it is the cheapest path.
2. **`assets/trike-icon.png`** ships in this bundle; drop it into `apps/driver/assets/` and reference it with `require()`. It has an opaque white field, so it must sit on the white circle — never directly on the map ground.
3. **Teardrop pin**: `borderRadius: '50% 50% 50% 0'` is unsupported in RN — use `borderRadius: 15` with `borderBottomLeftRadius: 0` plus `transform: [{rotate: '-45deg'}]`.
4. **No white logo plate on dark surfaces** is a standing brand rule; it doesn't bite here (the ground is light), but keep it in mind for the driver walkthrough that follows.

## Bundle contents

```
design_handoff_driver_splash/
├── README.md                        ← this file
├── TriSakay Driver Splash.dc.html   ← design reference (open in a browser)
├── support.js                       ← runtime for the reference file
├── assets/
│   ├── trike-icon.png               ← driver marker
│   └── brand/trisakay-lockup.png    ← brand lockup
└── screens/
    └── 01-driver-splash.png
```
