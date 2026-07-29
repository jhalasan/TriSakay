# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

TriSakay Passenger targets iOS and Android natively from one Expo/React Native codebase. `app.json` also emits a web target (favicon only); web is incidental and out of scope for this design pass.

## Users

Filipino commuters booking short local tricycle trips — mobile-primary, variable tech literacy, frequently outdoors in bright light and one-handed while walking or waiting at a corner.

## Product Purpose

Let a passenger book, track, pay for, and rate a tricycle ride quickly and unambiguously, mirroring the trust and simplicity of established Southeast Asian ride-hailing apps but tailored to informal/local tricycle dispatch. No in-app call or chat is a deliberate trust/simplicity constraint — coordination between passenger and driver happens in person once matched — not a missing feature.

## Positioning

A focused utility app, not a discovery or multi-service super-app. It competes with ad hoc phone-call or street-hail booking, not with ride-hailing platforms that also do food delivery, courier, etc.

## Operating Context

Primarily outdoor, on-the-go use; one-handed thumb reach on booking screens; bright-sunlight readability matters more than dense information density. Network- and loading-state design is treated as a first-class concern even though this build phase has no real network calls.

## Capabilities and Constraints

- **No backend integration, and no sample content either.** Auth, booking, matching, and payment are local state (Zustand), and every data module now starts empty — no invented drivers, destinations, ride history, notifications or fares. Screens render their empty states, and values the backend owns show a placeholder rather than a plausible-looking default. Wiring a real backend (Supabase vs. PocketBase is currently undecided in this repo) is an explicit, separate follow-up task; `src/mocks/` is kept as the named seam to wire it into.
- **The flows still run end to end** so the UI stays reviewable: login accepts what you type, and the ride sequence advances through to Payment and Rate driver with an unpopulated driver record.
- **No in-app call or chat.** Product constraint carried directly from the wireframe spec, not a gap: once matched, passenger and driver coordinate in person.
- **Real OpenStreetMap basemap.** All six map surfaces render live OSM tiles via Leaflet inside a WebView, centred on General Santos City. Markers, route lines, driver movement, and device GPS are a deliberate next step — the current maps show the correct area but do not yet plot the trip. `MapPlaceholder` is retained as the loading/offline skeleton.
- **All six maps pan and zoom** — drag, pinch, and double-tap, with a recenter button that appears once the rider has moved off the home view. Home pins its map above a scrolling list so the map gesture and the page gesture never compete.
- **Tiles come from OSMF's free community service**, which permits development and low-volume use only. Production requires a commercial or self-hosted tile provider. Interactive maps are bounded to roughly 27 km around the city with a zoom floor, so panning cannot turn into bulk tile fetching.
- Portrait-only, light-mode only (matches `app.json`).
- Currency is Philippine peso (₱); copy is English.
- **Service area is General Santos City** (centre 6.116243, 125.171738). That centre is the map's fallback when no pickup has been resolved; it is a service-area constant, not sample data.

## Brand Commitments

Neutral base surface with two deep accents — blue for primary actions/navigation, green reserved for positive/completed status semantics (Verified, Done, Active, Paid). Accents are deliberately saturated rather than pastel because the app is used outdoors in daylight; every colour pairing is contrast-verified (see `DESIGN.md`). Native platform conventions are preferred over custom chrome.

## Evidence on Hand

A low-fidelity grayscale wireframe kit (17 screens, flow diagram, and a placeholder component vocabulary) is the authoritative source for this app's information architecture, screen content, and navigation flow. It is explicitly "layout & flow only, not final visual design" — its grayscale tokens/components are a structural reference to elevate, not to copy literally. No user research or analytics exist yet; this is an assumption-driven MVP.

## Product Principles

- One clear next action per screen.
- Never lose the rider's place in an active booking (drives keeping booking state in a single store that survives navigation).
- Status is always visible, and never signaled by color alone.
- No surprise charges — fare is shown before requesting a ride, amount due is shown before paying.
- Prefer native platform conventions over inventing new interaction patterns.

## Accessibility & Inclusion

Touch targets at least 44×44pt; AA text contrast for `ink`/`inkSoft` against `bg`/`panel`; accent colors reserved for large-scale fills, icons, and buttons, never small body text; OS font-scaling supported; screen-reader labels provided on icon-only controls (notification bell, back chevron, stepper +/−); status communicated with text labels, never color alone.
