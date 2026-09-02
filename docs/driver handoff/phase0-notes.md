# Phase 0 — Foundation notes

Written per `CLAUDE_CODE_PROMPT.md`'s Phase 0 instructions. No screens changed.

## Token audit — no gaps

Every hex, radius, spacing, and type size the README/MIGRATION.md reference against `packages/ui/src/theme/*` already exists:

- **Colors** (`colors.ts`): `#002E60`→`accentBlue`, `#001A38`→`accentBlueDeep`, `#002043`→`accentBluePressed`, `#477434`→`accentGreen`, `#3B602B`→`accentGreenPressed`, `#E9F7E3`→`accentGreenSoft`, `#E3EDF7`→`accentBlueSoft`, `#F6F7F9`→`bg`, `#EBEFF2`→`lineSoft`, `#DCE2E6`→`line`, `#14191D`→`ink`, `#5A646B`→`inkSoft`, `#666F75`→`inkFaint`, `#B3261E`→`danger`, `overlay`→`rgba(10,14,17,.58)`. The two documented exceptions (map-placeholder greys, `#8D959B`→`inkFaint`) are already called out by the README itself.
- **Radius** (`radius.ts`): 30→`heroBottom`, 16→`card`, 18→`md3`, 20→`lg`, 11→`xs`, 12→`md`, 26≈`sheetTop` (28, close — see below), pill→`pill`.
- **Type**: eyebrows/labels/amount/h-scale all present (`typography.eyebrow`, `.amount` at 40/46 w800 extrabold, `.h2b` 22/25 bold — driver CTA weight, `.h3b` 19/25 bold, `.bodySm` 14/20 semibold, `.labelSm` 11/15). `fontFamily.{regular,semibold,bold,extrabold}` — never set `fontWeight` (enforced by `TypeStyle`'s omitted field).
- **Gradients** (`gradients.ts`): `hero` = `[accentBlue, '#001A38']` — exactly the navy band pair.

**Minor, non-blocking deltas** (existing generic tokens are close but not pixel-identical to a couple of README numbers — not a "missing token," just don't reach for the generic token where the mock is more specific):
- `radius.sheetTop` is 28; README's bottom sheet is 26. Use a literal `26` for the sheet, like `dashboard.styles.ts` already does for its own one-off radii (`radius.lg2`=22, `radius.xl2`=24 sit alongside bespoke inline values).
- No named `elevation.*` preset matches the README's exact shadow specs (see Recipe 1 below) — **this is expected, not a gap.** `elevation.ts`'s own doc comment says every shadow is navy-tinted; the README's franchise-card shadow is green-tinted (`rgba(71,116,52,.26)`), which no existing preset covers and shouldn't — write it bespoke, same as `dashboard.styles.ts`'s `listeningPanelShadowWrap` (shadowOffset {0,8}, opacity .1, radius 24) already does inline rather than forcing a named preset.

## Recipes (grounded in `GradientSurface`, `dashboard.styles.ts`, `BrandMotif`, `account-suspended.styles.ts`)

### 1. Navy header band
```
<View style={shadowWrap}>              // shadowColor: accentBlue, shadowOffset {0,12}, shadowOpacity .22, shadowRadius 30, elevation ~10 (Android)
  <GradientSurface token="hero" direction="diagonal" texture textureOpacity={0.05}
                    style={{ borderRadius: radius.heroBottom, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
    <BrandMotif size={X} color={colors.white} opacity={0.12} style={{ position:'absolute', top:-Y, right:-Y }} />
    {content in white}
  </GradientSurface>
</View>
```
- Shadow **never** on the `GradientSurface` itself — its own `styles.container` already sets `overflow:'hidden'`, and combining Android `elevation` with `overflow:'hidden'`+`borderRadius` on the same view bleeds an unclipped shadow rectangle past the rounded corners (documented in `dashboard.styles.ts` next to `listeningPanelShadowWrap`/`goOnlineButtonShadowWrap`). Wrap in an outer plain `View` that carries only the shadow + matching `borderRadius` (for iOS's shadow-shape); the inner `GradientSurface` clips the texture/motif/content.
- Radius: bottom corners only, `radius.heroBottom` (30). Top corners square when full-bleed under the status bar (login, Profile); GradientSurface has no per-corner radius props today — pass explicit `borderTopLeftRadius/borderTopRightRadius: 0` alongside a general `borderRadius` on its `style` (React Native lets more specific radius props override the general one).
- Texture: `texture` + `textureOpacity={0.05}` prop, already built into `GradientSurface` — matches the README's 5% chevron stripe spec directly, no separate overlay needed.
- Motif: `BrandMotif` positioned absolutely, offset negative top/right so it bleeds off-canvas (see `profile.styles.ts`'s `motif: { position:'absolute', top:-50, right:-50 }` for the existing offset convention), `opacity` per-screen (12% login/profile band per README vs 5%/9% on gate screens — pass explicitly each time, don't hardcode one value).
- Shadow spec to write bespoke (no existing preset matches): `shadowColor: colors.accentBlue, shadowOffset:{width:0,height:12}, shadowOpacity:0.22, shadowRadius:30` + an Android `elevation` (10–12 reads right against the other presets' opacity-to-elevation ratios — confirm visually in Phase 2).

### 2. White panel (grouped rows)
Two variants already exist as precedent, pick per content:
- **Card-based** (`packages/ui` `Card` component + `ListRow`, as in passenger's `profile.tsx` `navGroup`) for navigation lists — radius from `Card`'s own default, hairline dividers via `ListRow`'s `divider` prop, 34px info-row icon tiles / 38px nav-row tiles at `radius.xs` (11) / `radius.md` (12) respectively — build a local icon-badge `View` per the `IconBadge` pattern already used in driver's own redesigned `profile/settings.tsx` (2026-08-23 pass) and passenger's `settings.tsx`.
- **Bespoke shadow-wrapped panel** (`dashboard.styles.ts`'s `listeningPanelShadowWrap`/`listeningPanel` split) when the panel needs to be free-floating rather than in a scroll rhythm with other cards — same shadow-never-on-the-clipped-view rule as Recipe 1.
Shadow to match README (`0 2px 8px rgba(0,46,96,.07)`): bespoke, not `elevation.card` (which is offset 3 / opacity .1) — write `shadowOffset:{0,2}, shadowOpacity:0.07, shadowRadius:8` directly where the mock calls for this exact panel weight; `elevation.card` remains fine for generic cards where the README doesn't specify an exact shadow.

### 3. Docked bottom sheet
`packages/ui`'s `MapOverlaySheet` already implements this shape: `position:absolute` bottom-anchored, `borderTopLeftRadius/borderTopRightRadius`, `elevation.sheet`-family shadow, a `GradientSurface token="brand"` handle bar. For the driver redesign's *navy textured* sheet variant (Active trip, per README: "the docked sheet is the navy textured surface"), the sheet's own background needs to become a `GradientSurface token="hero" texture` fill instead of `MapOverlaySheet`'s current plain `colors.panel` — check whether that's a prop addition to the shared component (affects passenger too, so confirm scope before editing `packages/ui`) or a driver-local sheet variant. Radius: use literal `26` (README) rather than `radius.sheetTop` (28). `bottomInset` prop already handles safe-area (see this session's earlier `trip/active.tsx` scroll fix for the established usage pattern, including the shadow/overflow caveat).

### 4. Gate / empty-state column
`account-suspended.styles.ts` (driver's own, already live) is already this exact recipe: centered column, 64px `radius.pill` icon tile (tone-colored soft background — `dangerSoft` for the one red gate, `accentBlueSoft` elsewhere), `typography.h2` title, `typography.body` cause line, full-width primary (+ optional secondary) in an `actions` block. Reuse this structure directly for Verification-pending/Finish-registration; only the icon tile tone, copy, and (per README) a 5% `BrandMotif` watermark differ. For the "dashed panel inside a populated screen" variant (not owning the whole screen), no existing driver precedent yet — build from this same column recipe plus a `borderWidth:1, borderStyle:'dashed', borderColor: colors.line, borderRadius: radius.lg` (20) wrapper.

## Blocking finding — flagging before Phase 7, not before Phase 0/1

The prompt's own preface says "Run this **after** the passenger redesign — phases 1, 6 and 7 reuse passenger screens directly," and Phase 7 says to build driver's shared screens "from the passenger implementations... same band, avatar-breaking-the-seam, panels, toggles, notification cards and modal."

**Checked directly: that passenger redesign has not landed for the screens Phase 7 needs.**
- `apps/passenger/app/(tabs)/profile.tsx` is a *different, older* design — a 132px **rounded** (not full-bleed) hero at `radius:24`, avatar pulled up `-48` (not `-42`), no `ACCOUNT` eyebrow, no green `#E9F7E3` avatar ring, no green camera badge, no "Verified · rating" shield line, no franchise/discount card in the README's described treatment. It does not match this handoff's "Profile anatomy" spec at all.
- `apps/passenger/app/(tabs)/settings.tsx` has no version-line footer element.
- `apps/passenger/app/(tabs)/_layout.tsx` (and driver's own, checked too) is the **stock** Expo Router `<Tabs>` — no custom `tabBarButton`, no marker. Phase 1's own wording ("mirror the passenger implementation *if it already exists*") already anticipates this — Phase 1 is not blocked, it just has nothing to mirror and should implement the marker fresh for driver.
- `apps/passenger/app/notifications.tsx` *is* already well-polished (type icons/tones, filter chips, tagline+unread pill, relative timestamps — built in an earlier, unrelated pass), but it uses a plain `ScreenHeader`, not this handoff's navy chevron-textured full-bleed band system. It's a different, unconnected redesign lineage, not this one.
- `apps/passenger/app/logout.tsx` is a plain `ConfirmModal` — likely fine as-is per the README ("Identical modal; only body copy differs"), no action needed there.

So: only the **locked dashboard/home** (`TriSakay Home Final.dc.html`, per `MIGRATION.md`) has actually shipped this visual system on either app. Nothing else on the passenger side embodies it yet.

**This does not block Phases 0–6** (auth, gates, requests, active trip, earnings/history/ratings are all driver-only, self-contained, no passenger dependency). **It blocks Phase 7 exactly as written** — "copy the passenger screen's styles" has nothing matching to copy for Profile/Settings. Per rule #7, this session will not touch the passenger app to fix that.

Options for when we reach Phase 7 (not a decision needed now): (a) redesign passenger's profile/settings first, as its own separate, explicitly-scoped session — likely the cleanest, since the README frames these as shared/identical screens; (b) build driver's versions fresh to the README's spec without an actual passenger file to copy, and treat *driver's* result as the reference passenger should later adopt; (c) descope Phase 7's "copy passenger" instruction to "match the README's Profile-anatomy spec directly." Flagging now so it's known well before Phase 7 comes up, not discovered mid-phase.

## Change log

No screens changed. This file only.
