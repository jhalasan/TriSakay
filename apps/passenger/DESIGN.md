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
| `accentBlue` ("Navy") | `#002E60` | Primary actions, active tab, links — brand mark navy | 13.46:1 with white |
| `accentBluePressed` | `#002043` | Pressed state | 16.31:1 with white |
| `accentBlueSoft` | `#E3EDF7` | Badge + fare-surface backgrounds | 13.76:1 with pressed text |
| `accentGreen` ("Leaf") | `#477434` | Positive status only: Done, Paid, pickup — brand mark green, darkened ~25% off the raw logo swatch to clear 4.5:1 (raw logo green only measured 3.35:1) | 5.50:1 with white |
| `accentGreenPressed` | `#3B602B` | Pressed state | 7.26:1 with white |
| `accentGreenSoft` | `#E9F7E3` | Green badge backgrounds | 6.52:1 with pressed text |
| `danger` | `#B3261E` | Destructive actions, validation | 6.54:1 with white |

Two rules that matter more than the hex values:

- **`line` vs `lineStrong` is a semantic split, not a shade preference.** Decorative dividers may be light, but anything bounding an input or control uses `lineStrong` to hold the 3:1 non-text contrast requirement.
- **Green is reserved for positive/completed status** — Done, Paid, Verified, the pickup marker — never decoration, so it stays meaningful.

## Typography

**Poppins**, loaded at startup via `expo-font` and gated in `app/_layout.tsx` so nothing paints in the system face and then reflows. Geometric and rounded — a deliberately branded look rather than a neutral UI face. Steps are deliberately wide: on a phone held at arm's length outdoors, a 2px difference between levels reads as noise. Negative tracking on large sizes only, floor −0.04em.

**Open question on this face.** Poppins has a short x-height relative to its caps, a single-storey `a`, and near-circular counters that close up on a low-DPI screen in daylight. That works against NFR-3's low-literacy requirement and against the outdoor use these sizes were tuned for; `caption` at 13px is where it shows first. Worth a side-by-side outdoors before this is treated as settled — the previous face (Inter) was chosen for exactly those properties, and reverting is a change to `fontFamily` in `packages/ui/src/theme/typography.ts` plus the four imports in `app/_layout.tsx`.

**Weight lives in the family name, not `fontWeight`.** React Native cannot synthesise weights for a custom face, so each weight is a separate loaded font (`Poppins_400Regular`, `Poppins_600SemiBold`, `Poppins_700Bold`, `Poppins_800ExtraBold`, exported as `fontFamily` from `@trisakay/ui`). Setting `fontWeight` as well makes Android fake-bold *on top of* the real bold face, which reads as smeared — so the `TypeStyle` type omits `fontWeight` entirely and the compiler rejects re-adding one. Anywhere that needs a heavier weight than its token, override `fontFamily`, never `fontWeight`.

If a face fails to load the app still renders, falling back to the system font at regular weight — a missing font degrades the look, it never blocks the app.

| Style | Size / Line height | Family | Tracking |
|---|---|---|---|
| `amount` | 40 / 46 | `extrabold` | −1.2 |
| `display` | 34 / 40 | `extrabold` | −0.8 |
| `h1` | 27 / 33 | `bold` | −0.4 |
| `h2` | 20 / 26 | `bold` | −0.2 |
| `h3` | 17 / 23 | `semibold` | — |
| `body` | 16 / 24 | `regular` | — |
| `bodyStrong` | 16 / 24 | `semibold` | — |
| `caption` | 13 / 18 | `regular` | — |
| `label` | 12 / 16, uppercase | `bold` | +0.6 |
| `button` | 16 / 20 | `bold` | — |
| `buttonSmall` | 14 / 18 | `semibold` | — |

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
- **OsmMap** — the real map. Leaflet + OSM raster tiles inside a `react-native-webview` (included in Expo Go on SDK 54, so no dev build). Sizes itself from `height` exactly like `MapPlaceholder`: no `flex` on the container, WebView on `absoluteFillObject`, so both numeric heights and `height="100%"` work without a parent `flex:1`. Two things are load-bearing and must not be "simplified" away: the `source` object is memoized on props only — never on `hasMoved` — because a fresh literal each render remounts the WebView and throws away the tiles the rider just panned to; and readiness is detected via `onMessage` plus an 8s timeout, because with `source={{html}}` the document always loads and `onError` never fires for dead tiles.
- **Every map is interactive**, via an explicit `interactive` prop rather than by default — freezing takes **both** `pointerEvents="none"` on the WebView **and** Leaflet's own handlers in `mapHtml.ts`, so both are the place to look when this behaviour surprises someone. The first pass unlocked only the three full-screen ride maps, which was backwards: those are exactly the screens that auto-advance on a 2.5–8s timer, so the rider never gets a chance to touch them. The maps you actually dwell on are Home, Set destination and Confirm. **Where a map is interactive, it must not live inside a scroller** — a draggable map competes for the same vertical gesture and wins on Android. Home therefore pins its map (see below); Set destination's map already sat outside its list; Confirm's stays in the scroll flow because the form beneath it is the point of that screen, and there is ample non-map area to scroll from.
- **Home is a fixed frame, not a scrolling page** — greeting, map, and the "Where to?" button are pinned, and only the saved-places list between them scrolls. This resolves the gesture conflict at the source rather than arbitrating it, keeps the map visible while the rider reads the list, and keeps the primary action permanently in thumb reach.
- **Recenter control** — appears only after the rider actually moves the map, and disappears again on use, so it never sits there as permanent chrome. Without it, panning away on Trip in progress would be one-way until the screen remounts. Placement is driven by `bottomInset`, the number of pixels the *screen* knows are covered by its own bottom overlay: it lifts both the recenter button and the OSM attribution, and the button always takes the corner opposite the attribution. This is why Trip in progress passes `bottomInset={100}` — the driver strip's real height plus a gap.
- **MapPlaceholder** — no longer used directly by any screen. It is now `OsmMap`'s loading and offline skeleton: shown at full opacity until the first tile paints, then faded out over `motion.duration.settle`. Kept as a separate component so rollback is a one-line import change and the native WebView dep stays confined to one file.
- **PulseBeacon** (passenger-local) — the searching animation described under Motion.
- **EmptyState / Spinner** — shared empty-list and loading affordances.

## Navigation & interaction conventions

- **Expo Router**, file-based. Auth gating is a manual `useSegments`-watching redirect in the root layout (this SDK's `expo-router` has no `Stack.Protected` API) — splash owns its own timed redirect; the guard covers deep links, back-navigation, and login/logout transitions.
- **The root stack must stay anchored to `index`.** Screens declared as `<Stack.Screen>` children are hoisted ahead of filesystem routes by expo-router's `getSortedChildren`, so `index` is declared first *and* `unstable_settings.initialRouteName` is set. Declaring only `logout` previously made it the launch screen, firing the log-out dialog on app start.
- `router.replace` for auto-advancing trip-flow screens (Finding driver → Driver found → Trip in progress → Payment) so Back never returns to a stale waiting state; `router.push` for user-initiated navigation.
- Mock delays always show a loading state rather than jumping instantly, so those states are exercised even without a network.
- Log out is a `transparentModal` route dismissed via `router.dismiss()` — transparent because the screen renders only an RN `<Modal>`, so an opaque presentation would slide a blank page up behind the dialog.

## Map & OSM compliance

Tiles come from `tile.openstreetmap.org`, OSMF's free community service, whose usage policy is binding and non-obvious:

- **Attribution** — "© OpenStreetMap contributors" renders via Leaflet's own attribution control at 12px in `colors.inkSoft`.
- **User-Agent** — `applicationNameForUserAgent` *appends* `TriSakayPassenger/1.0` to the platform UA. A generic library default is blocked without notice; replacing the UA wholesale risks CDN heuristics.
- **Bounded panning** — riders can pan the maps, which is ordinary permitted use; the policy's actual target is bulk downloading. What keeps this honest is that an interactive map is clamped to a ~27 km box around the city (`maxBounds` at full viscosity) with a zoom floor of 12, so no single gesture can walk the viewport across the planet or pull a continent's worth of tiles.
- **Caching** — `cacheEnabled` stays true; the policy requires honouring cache headers.
- **Quiet bridge** — `ready` and tile-error signals are latched in the page and posted once each. Before panning existed, Leaflet's `load` fired once; now it fires on every completed tile batch, and an unlatched bridge would chatter across the WebView on every drag.

Swapping to a commercial or self-hosted provider for production is one URL and one attribution string in `mapHtml.ts`, kept deliberately in one place.

## Empty by default

The app ships with **no sample content**. There are no invented riders, drivers, destinations, ride histories, notifications or fares anywhere — the modules under `src/mocks/` are empty arrays kept as named seams for the backend to fill. This is a deliberate design constraint, not an unfinished state: fake data hides exactly the screens that are hardest to get right, and a demo full of plausible names reads as working software that isn't.

Three conventions hold the result together:

- **Absent is not zero.** Anything the backend owns is nullable, and the UI distinguishes "unknown" from a real value. A driver rating of `null` hides the stars rather than rendering zero of them — no stars reads as *unrated*, zero stars reads as *terrible*. Fares show `—`, matching the placeholder already used on Profile.
- **Every list has an empty state**, and it says what will appear there, not merely that nothing is there.
- **Partial records degrade to nothing, not to fragments.** A history row missing one endpoint drops the whole route line rather than rendering "→ SM City", which reads as a bug instead of as missing data.

Flows still run end to end so the UI stays walkable for design review: login accepts what you type, and a requested ride now genuinely waits on a real `ride_requests` row rather than a simulated match — the ride sequence past "Finding a driver" isn't reachable in dev until a driver-side flow exists to assign one. Rides completed in a session are appended to history, so the list fills as you use the app.

## Known provisional decisions

- Maps pan and zoom but carry no markers, route line, driver movement, or device GPS — the planned next step. Pickup is `null` until GPS or the backend supplies it, and the map falls back to the service-area centre.
- No backend integration — state is local (Zustand) and empty; see `PRODUCT.md`.
- Light mode only, chosen from the use scene (outdoor daylight), not by category default.
