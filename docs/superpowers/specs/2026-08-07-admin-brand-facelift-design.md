# Admin Web App Brand Facelift — Design Spec

Date: 2026-08-07
Status: Approved by user, ready for implementation planning

## Purpose

`apps/admin` (the PSO/Admin web dashboard) currently uses the driver/passenger
brand *colors* (`tokens.css` already copies `packages/ui/src/theme/colors.ts`
by hand) but none of the rest of the brand system. It's still styled as the
low-fidelity wireframe kit it was built from: a flat 3px corner radius,
system-ui everywhere, almost no shadows, and no actual logo anywhere — the
Sidebar and Login screen both show the plain text "TriSakay Admin" or
initials, and the browser tab has no favicon at all.

Goal: bring the admin app's *styling* in line with the driver/passenger
mobile apps (radius scale, colored shadows, restrained gradient use, Poppins
for brand/heading text) and put the real TriSakay logo where the mobile apps
put it, so the admin reads as clearly the same product — without turning a
dense, information-heavy admin UI into a mobile app skin.

## Non-goals

- No change to information architecture, routes, or data/table density.
- No gradient or Poppins body text on data screens (Dashboard, Drivers,
  tables, etc.) — restrained to brand/heading moments only, matching the
  restraint the mobile app's own `gradients.ts` and `typography.ts` already
  document.
- No new npm dependencies — Poppins is loaded via a Google Fonts `<link>` in
  `index.html`, not a font package.

## Design tokens (`apps/admin/src/styles/tokens.css`)

Add, alongside the existing (already-correct) color tokens:

```css
/* Radius scale — mirrors packages/ui/src/theme/radius.ts */
--r-sm: 8px;   /* inputs, textareas, small controls */
--r-md: 12px;  /* buttons, panels/cards, stat tiles */
--r-lg: 20px;  /* modals, Login card */
--r-pill: 999px; /* badges, pill controls */

/* Elevation — navy-tinted shadows, mirrors packages/ui/src/theme/elevation.ts */
--shadow-card: 0 3px 8px rgba(0, 46, 96, 0.10);
--shadow-button: 0 4px 10px rgba(0, 46, 96, 0.22);
--shadow-sheet: 0 -6px 24px rgba(0, 46, 96, 0.16);

/* Hero gradient — Login page background only */
--gradient-hero: linear-gradient(180deg, var(--primary) 0%, #001A38 100%);
```

The existing `--r: 3px` token is removed once all 13 consumers below are
migrated — no file should reference `--r` afterward.

**Typography**: add a Google Fonts `<link>` for Poppins weights 600/700/800
to `apps/admin/index.html` (`<head>`), and a `--font-brand: 'Poppins', var(--sans);`
token. Apply `--font-brand` only to: Sidebar brand wordmark, Login card
title, TopBar `<h1>` page title, StatTile `.value`. Everything else
(table cells, inputs, mono labels, body copy) keeps `--sans` — Poppins'
short x-height and closed counters are documented (in `typography.ts`) as
hurting legibility at small sizes, which is exactly what a dense data table
is.

## Logo assets

Copy three existing brand files from the repo-root `/assets/brand/` (and
`/assets/favicon.png`) into a new `apps/admin/public/brand/` directory —
Vite serves `public/` at the site root, so no other app or build config
changes:

- `trisakay-mark.png` — icon only (pin + tricycle mark)
- `trisakay-lockup.png` — icon + "TriSakay" wordmark, stacked (same asset
  the mobile splash screens use)
- `favicon.png` → `apps/admin/public/favicon.png`, linked from `index.html`
  (the tab currently has no icon)

## Logo placement

- **Sidebar** (`Sidebar.tsx` / `.module.css`) — brand row becomes
  `trisakay-mark.png` (~28px) + "TriSakay Admin" in `--font-brand` semibold,
  replacing the current plain-text-only brand.
- **Login** (`Login.tsx` / `.module.css`) — page background becomes
  `--gradient-hero` (full navy gradient, matching the mobile auth screens).
  `trisakay-lockup.png` sits on a white, shadowed (`--shadow-card`) circular/
  rounded badge above the login card — same composition as
  `apps/driver/app/splash.tsx`. The existing Avatar-initials brand row
  *inside* the card is removed (the logo above the card already carries the
  brand); the card keeps its "Log in" heading and the existing
  "PSO Staff / Supervisor / Administrator" subtitle line.
- **Browser tab** — `favicon.png` linked in `index.html`.
- **TopBar** — unchanged structurally; stays title-focused, no logo.

## Component-level radius/shadow migration

All 13 current `var(--r)` consumers move to the tier that matches their
`packages/ui` equivalent:

| Component | Old | New | Shadow |
|---|---|---|---|
| TextField, Textarea, Select | `--r` | `--r-sm` | — |
| Button | `--r` | `--r-md` | `--shadow-button` on `.solid` variant only (not outline/ghost) |
| StatTile, DataTable container, EmptyState, `.panel` (globals.css) | `--r` | `--r-md` | `--shadow-card` |
| ConfirmModal, Login card | `--r` | `--r-lg` | `--shadow-sheet` (ConfirmModal), `--shadow-card` (Login card, it's not edge-docked) |
| Badge | hardcoded `10px` | `--r-pill` | — |
| TopBar `.search` | `--r` | `--r-sm` | — |

`RideMonitoring.module.css` and `DriverVerification.module.css` (2 of the 13
files) use `var(--r)` on placeholder/map boxes — these move to `--r-md` to
match the panel tier they sit inside.

## Sidebar nav rows

Active/hover nav list items move from their current sharp-edged left-border
highlight to `--r-sm` (8px) rounded corners, so the nav list reads as part of
the same rounder system as the rest of the app. Still a compact, dense list
— not resized for touch.

## Testing

No new test infra needed — this is a pure CSS/asset/markup change. Existing
admin tests (`apps/admin/tests`) should continue to pass unmodified since no
component props, routes, or behavior change. Manually verify in a browser:
Sidebar brand row, Login screen (gradient + badge + card), favicon in the
tab, and spot-check that solid buttons/panels/modals show the new radius and
shadows without visual regressions in the data tables.
