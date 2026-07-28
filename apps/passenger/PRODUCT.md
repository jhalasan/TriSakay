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

- **No backend integration in this build.** Auth, ride booking, matching, and payment are all local mock data/state (Zustand). Wiring a real backend (Supabase vs. PocketBase is currently undecided in this repo) is an explicit, separate follow-up task.
- **No in-app call or chat.** Product constraint carried directly from the wireframe spec, not a gap: once matched, passenger and driver coordinate in person.
- **No real map yet.** Screens use a designed `MapPlaceholder` component; this build is meant to be swapped for a live OpenStreetMap-backed map in a later, separate session — its interface is already shaped for that swap.
- Portrait-only, light-mode only (matches `app.json`).
- Currency is Philippine peso (₱); copy is English.

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
