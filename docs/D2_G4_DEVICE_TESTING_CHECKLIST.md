# D2 + G4 Device Testing Checklist (Person 1)

Run this once all coding is done and you're ready to test on a real device. Everything code-side is already verified (2026-09-27): D2 migration `20260927000001` applied and confirmed live, `npm install`/`typecheck`/full test suite all green (541 tests, 0 failures). This file is the remaining, device-only work from the Person 3 → Person 1 handoff in `UAT_PANELIST_REVIEW_ADRALES.md`.

---

## Before you start

- **Test accounts:** 1 driver + 2–3 passenger accounts, seeded in the DB you're testing against.
- **A build with `react-native-maps` working.** The driver app uses `expo-dev-client` + `react-native-maps` (native module) — plain `expo start` / Expo Go will **not** load it. You need one of:
  - An existing dev-client APK already installed on the test device, or
  - `eas build --profile development` for `apps/driver`.
  - Note: the tracker originally planned to bundle this with G2's dev build. If G2 is still blocked, it's fine to build the driver dev client on its own — D2 and G4 don't depend on Google Maps being wired up.
- **Real GPS**, or a GPS-simulated environment (mock location app / emulator location controls) — needed for the distance-based D2 rules.
- **Filipino language toggle** available in the app settings, for the G4 check.

---

## D2: nearest-next-stop sort

1. **Basic ordering:** Accept 2+ rides. Cards should be ordered by distance to each passenger's next stop (pickup while waiting, drop-off once on board). The top card reads **"Next stop · x.x km"**; others show their own distance. The map pin and Navigate button point at the top card's stop.
2. **No-jump rule:** Drive toward the second card's stop. It should only move to the top once it's at least **150 m** closer than the current top — no flickering between near-equal stops.
3. **GPS lost:** Turn off location. The order should freeze at the last shown order, with no distances displayed.
4. **Running-late rule:** Start a ride and wait more than **7.5 minutes** (1.5× the assumed-20km/h normal time, floor 5 min) since accept or pickup — that passenger should jump to the top ahead of closer stops. This depends on the `assigned_at`/`picked_up_at`/`distance_km` columns from migration `20260927000001`, which is already applied and verified live.
5. **Transfer-pickup priority:** Not device-testable yet — it needs Person 2's D1 (`isTransferPickup`) to exist. Currently covered only by unit tests (already passing). Re-test on device once D1 ships.

## G4: help tips

1. Walk through every field with a tip and check spacing/wrapping in **English**:
   - Passenger: set-pickup / set-destination (tip shows under the search bar only while empty), register, profile edit.
   - Driver: register, profile edit, documents (expiry date).
   - Admin: Force password change (two tips side by side above the strength checklist), Settings → fare (three number fields), Discount review, Driver verification.
2. Switch the app language to **Filipino** once and re-check the same screens — look for any tip that wraps badly.
3. Fix any layout issue directly in that screen's styles. Tip wording itself lives in `packages/shared/src/i18n/{en,fil}.ts` under `hints` (admin wording is inline per route) — don't touch wording unless it's actually wrong, only fix layout.

---

## When both pass

Mark **D2** and **G4** `DONE` in the tracker (`docs/UAT_PANELIST_REVIEW_ADRALES.md`), noting the device/build used and the date.
