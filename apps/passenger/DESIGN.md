# Design

## World

TriSakay Passenger is an **Operate**-mode utility app: task clarity, native platform conventions, and consistency outrank visual flourish. Brand shows up in restrained, precise details — two deep accent colors, a confident but plain component language — not in decoration. The design system is a direct elevation of the wireframe kit's own grayscale token vocabulary (`--bg`, `--panel`, `--ink`, `.btn`, `.field`, `.badge`, `.avatar`, `.stars`, `.bnav`) into a real, native-feeling visual system.

## Color strategy: neutrals + two deep accents

The accents are deliberately deep rather than pastel. This app is used **outdoors in daylight**, and the first-pass pale palette failed WCAG badly — white-on-blue button labels measured **2.63:1** against a 4.5 requirement, on every primary button in the app. Every pairing below is now measured and verified.

| Token | Hex | Role | Verified |
|---|---|---|---|
| `bg` | `#F6F7F9` | App background | — |
| `panel` | `#FFFFFF` | Card/surface | — |
| `ink` | `#14191D` | Primary text | 16.5:1 on bg |
| `inkSoft` | `#5A646B` | Secondary/label text | 5.65:1 on bg |
| `inkFaint` | `#666F75` | Placeholders, inactive labels | 4.78:1 on bg |
| `line` | `#DCE2E6` | **Decorative dividers only** | — |
| `lineStrong` | `#838B91` | **Input/control boundaries** | 3.46:1 on panel |
| `lineSoft` | `#EBEFF2` | Hairline separators | — |
| `fill` | `#EDF1F4` | Neutral fill, inactive chips | — |
| `accentBlue` ("Sky") | `#0B6BAF` | Primary actions, active tab, links | 5.62:1 with white |
| `accentBluePressed` | `#095A94` | Pressed state | 7.24:1 with white |
| `accentBlueSoft` | `#E3EFFA` | Badge + fare-surface backgrounds | 6.20:1 with pressed text |
| `accentGreen` ("Leaf") | `#157A4B` | Positive status only: Done, Paid, pickup | 5.36:1 with white |
| `accentGreenPressed` | `#10633D` | Pressed state | — |
| `accentGreenSoft` | `#E1F1E8` | Green badge backgrounds | 6.24:1 with pressed text |
| `danger` | `#B3261E` | Destructive actions, validation | 6.54:1 with white |

Two rules that matter more than the hex values:

- **`line` vs `lineStrong` is a semantic split, not a shade preference.** Decorative dividers may be light, but anything bounding an input or control uses `lineStrong` to hold the 3:1 non-text contrast requirement.
- **Green is reserved for positive/completed status** — Done, Paid, Verified, the pickup marker — never decoration, so it stays meaningful.

## Typography

System font (SF on iOS, Roboto on Android) — no custom font load, matching native expectations for an Operate surface. Steps are deliberately wide: on a phone held at arm's length outdoors, a 2px difference between levels reads as noise. Negative tracking on large sizes only, floor −0.04em.

| Style | Size / Line height | Weight | Tracking |
|---|---|---|---|
| `amount` | 40 / 46 | 800 | −1.2 |
| `display` | 34 / 40 | 800 | −0.8 |
| `h1` | 27 / 33 | 700 | −0.4 |
| `h2` | 20 / 26 | 700 | −0.2 |
| `h3` | 17 / 23 | 600 | — |
| `body` | 16 / 24 | 400 | — |
| `bodyStrong` | 16 / 24 | 600 | — |
| `caption` | 13 / 18 | 400 | — |
| `label` | 12 / 16, uppercase | 700 | +0.6 |
| `button` | 16 / 20 | 700 | — |
| `buttonSmall` | 14 / 18 | 600 | — |

`amount` exists for one job: fares and amounts due. Money is what the rider is scanning for, so it gets its own step at the top of the scale **and** its own tinted surface (`accentBlueSoft`, `radius.lg`) on both Confirm and Payment — the number reads identically at estimate time and at pay time.

## Spacing & radius

Spacing (4px base): `xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32 · xxxl 48`. Group related content tightly, separate distinct groups generously, and leave more space above a heading than below it.

Radius: `sm 8` (fields, badges) · `md 12` (cards, buttons) · `lg 20` (sheets, modals, fare surface) · `pill 999` (segmented track, badges, toggle).

Touch targets: buttons ≥52pt tall, stepper and segment controls ≥44pt, list rows ≥64pt.

## Elevation

Two levels only. Resting cards rely on a `line` border rather than shadow. `elevation.sheet` is reserved for surfaces that genuinely float — the Finding-a-driver and Driver-found bottom sheets, and the Log-out dialog. Every shadow carries an offset and a soft blur; no zero-offset halos.

## Motion

Tokenized in `theme/motion.ts` so timing reads as one system: `instant 90ms` (press feedback), `quick 180ms`, `settle 320ms`, `pulse 1400ms`, with an exponential ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`).

There is **one authored moment**, not scattered effects: the ride-status flow. While searching, `PulseBeacon` sends staggered rings outward across the map so the screen is alive rather than a spinner on a dead page; when the match lands, the driver sheet settles up from below (`translateY 28 → 0` with fade). Everything else is functional feedback only — a `0.97` press scale on tappable surfaces. All animation runs on the native driver, and content settles from an already-visible default rather than fading in from nothing.

## Component conventions (`packages/ui/src/components`)

Each primitive lives in its own folder with a colocated `ComponentName.styles.ts` (RN `StyleSheet.create`) — no shared/global stylesheet file, since React Native has no `.module.css` on native builds. This convention applies identically to passenger-local composites in `apps/passenger/src/components`.

- **Button** — `solid` / `outline` / `ghost` × `primary` / `neutral` / `danger`, `md`/`sm`, with `loading` and `disabled`. Outline borders use `lineStrong`; press scales to 0.97.
- **TextField / Textarea** — label above, `lineStrong` border, focus ring thickens to 2px in `accentBlue`, error state in `danger` with inline message.
- **Card** — `flat` (bordered) or `raised` (`elevation.card`). Never nested.
- **Badge/StatusPill** — `neutral` / `blue` / `green` / `danger`; always paired with a text label, optional leading dot — status is never color-only.
- **Toggle** — restyled `Switch`, `accentBlue` track when on.
- **Avatar** — initials fallback (no photo assets in this mock-data build), `xs`–`xl`.
- **StarRating** — real `Ionicons` star glyphs, read-only or interactive — a deliberate elevation over the wireframe's filled/empty squares.
- **ListRow** — leading slot + two-line text + trailing slot, optional divider, ≥64pt tall.
- **SegmentedControl** — GCash/Cash. The active segment is a solid `accentBlue` fill with white text, not a subtle tint.
- **Stepper** — seat count, min/max clamped, 44pt targets, disabled at bounds.
- **ConfirmModal** — dimmed backdrop + floating card (`elevation.sheet`), Cancel (outline) / Confirm (solid, optionally `danger`).
- **MapPlaceholder** — SVG road-grid plus optional pin or dashed route and a caption chip. Props (`variant`, `caption`, `height`) are intentionally minimal so a live OpenStreetMap view can replace the internals without touching call sites — a confirmed follow-up.
- **PulseBeacon** (passenger-local) — the searching animation described under Motion.
- **EmptyState / Spinner** — shared empty-list and loading affordances.

## Navigation & interaction conventions

- **Expo Router**, file-based. Auth gating is a manual `useSegments`-watching redirect in the root layout (this SDK's `expo-router` has no `Stack.Protected` API) — splash owns its own timed redirect; the guard covers deep links, back-navigation, and login/logout transitions.
- **The root stack must stay anchored to `index`.** Screens declared as `<Stack.Screen>` children are hoisted ahead of filesystem routes by expo-router's `getSortedChildren`, so `index` is declared first *and* `unstable_settings.initialRouteName` is set. Declaring only `logout` previously made it the launch screen, firing the log-out dialog on app start.
- `router.replace` for auto-advancing trip-flow screens (Finding driver → Driver found → Trip in progress → Payment) so Back never returns to a stale waiting state; `router.push` for user-initiated navigation.
- Mock delays always show a loading state rather than jumping instantly, so those states are exercised even without a network.
- Log out is a `transparentModal` route dismissed via `router.dismiss()` — transparent because the screen renders only an RN `<Modal>`, so an opaque presentation would slide a blank page up behind the dialog.

## Known provisional decisions

- `MapPlaceholder` stands in for a live map; OpenStreetMap integration is a planned follow-up.
- No backend integration — all data is local mock state (Zustand); see `PRODUCT.md`.
- Light mode only, chosen from the use scene (outdoor daylight), not by category default.
