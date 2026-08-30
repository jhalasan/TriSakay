# TriSakay — locked homepages, migration notes

Source of truth: `TriSakay Home Final.dc.html` (two screens, two states each).
Repo: `jhalasan/TriSakay` (branch `main`).

## Passenger — Home → `apps/passenger/app/(tabs)/home.tsx`

Structure, top to bottom:
1. **Greeting surface (full-bleed)** — no longer a floating card. Navy gradient `#002E60 → #001A38`, woven chevron texture (`repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)`), chevron motif watermark at 12% top-right, bottom corners radius 30. Extends under the status bar.
   - Ringed avatar 56px (`rgba(255,255,255,.22)` outer + `#E9F7E3` 1.5px ring), greeting eyebrow (uppercase, 11/16, .7px), name 28/32 weight 800, one-line subline at 72% opacity, bell with red dot.
   - Stats strip inside the same surface, divided by `rgba(255,255,255,.14)`: Trips · Discount.
2. **Request a Tricycle** — solid `#477434`, radius 22, texture overlay, 52px translucent circle holding the tricycle mark, title 20/25 w700, fare chip (`rgba(255,255,255,.18)`) + nearby count, forward arrow.
3. **Saved places** — section eyebrow + Manage; white panels radius 16, min-height 70, 42px icon tile (Home navy, Work green, Campus `#E3EDF7`), chevron. Empty state: dashed `#DCE2E6` panel, chevron watermark at 5%, bookmark tile.

Removed vs. earlier explorations: destination search field, Recent/rebook row, docked bottom CTA.

## Driver — Dashboard → `apps/driver/app/(tabs)/dashboard.tsx`

1. **Identity row** — 44px avatar, name, PSO-verified + body number, bell tile.
2. **Duty console (hero)** — online: navy gradient `150deg #002E60 → #001A38` + texture + motif; pulsing `#E9F7E3` dot, "You're online", 56×32 toggle; `Earnings today` eyebrow then ₱ amount at 40/46 w800; meta line (trips · rating · acceptance) above a `rgba(255,255,255,.16)` divider. Offline: white card, grey dot, ₱0.00 in `#14191D`, navy "Go online" button.
3. **Request slot** — always occupied:
   - Incoming request card: `#E9F7E3` header (payment · seats, fare right), pickup/drop-off timeline, Decline (outline) + Accept ride (navy gradient). Countdown chip in the section header.
   - Listening state (no request): white panel radius 24, pulsing `#E3EDF7` circle with radio icon, "Listening for requests" + location line.

## Assets & tokens

- Tricycle mark: `assets/trike-white.png` (white, transparent) — replaces the generic car glyph in every Request a Tricycle affordance. Add a navy variant if it lands on light surfaces.
- All other icons are Ionicons; type is Poppins 400/600/700/800 — unchanged from `packages/ui/src/theme`.
- Colors used: `#002E60`, `#002043`, `#001A38`, `#477434`, `#3B602B`, `#E9F7E3`, `#E3EDF7`, `#F6F7F9`, `#EBEFF2`, `#14191D`, `#5A646B`, `#666F75`, `#B3261E`.

## Open items before implementation

- Confirm the passenger stats strip values come from real data (trips count, discount tier) or drop the strip.
- Driver hero needs a real countdown timer for the request chip (18s in the mock).
- Decide whether saved places keeps `Manage` as a route or a sheet.
