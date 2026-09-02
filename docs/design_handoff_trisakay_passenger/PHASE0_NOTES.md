# Phase 0 — Foundation notes (scratch, not shipped code)

Confirms token coverage and locks the four reusable surface recipes before any screen work starts. No screens were touched in this phase.

## Token coverage check

**Colors** — every hex/token pair the README's colour table lists exists verbatim in `packages/ui/src/theme/colors.ts` (`bg`, `panel`, `ink`, `inkPressed`, `inkSoft`, `inkFaint`, `line`, `lineStrong`, `lineSoft`, `fill`, `accentBlue`, `accentBluePressed`, `accentBlueSoft`, `accentBlueDeep`, `accentGreen`, `accentGreenPressed`, `accentGreenSoft`, `danger`, `dangerPressed`, `dangerSoft`, `overlay`). No gap.

**Typography** — every token the README's type table lists exists in `packages/ui/src/theme/typography.ts` with matching size/line-height/family (`amount`, `display`, `h1b`, `h1`, `h2b`, `h2`, `h3b`, `h3`, `body`, `bodyStrong`, `bodyLg`, `bodySm`, `caption`, `labelSm`, `labelXs`, `eyebrow`, `label`, `button`, `chip`). No gap.

## Gaps found (report, don't invent tokens to fix)

1. **Bottom-sheet radius mismatch.** README specifies bottom sheets at **radius 26, top-only**. The closest existing token is `radius.sheetTop = 28`; `radius.lg = 20` is what `MapOverlaySheet` currently uses. Neither is 26. **Decision for Phase 4:** use a literal `26` for the booking sheets' top corners (matches the spec exactly) rather than reusing `sheetTop` or `lg` — do not add a new token, just don't force-fit an existing one that's off by 2–8px.
2. **Bottom-sheet shadow mismatch.** README: `0 -14px 36px rgba(0,46,96,.16)`. Existing `elevation.sheet`: iOS offset `{0,-6}`, opacity `.16`, radius `24`; Android `elevation: 12`. Opacity matches, offset/blur don't. **Decision:** write the booking sheet's shadow inline (matching `heroShadowWrap`'s pattern of a bespoke wrapper) rather than reusing `elevation.sheet` as-is — same approach `home.styles.ts` already takes for the hero and CTA card, which don't reuse `elevation.card` either.
3. **`MapOverlaySheet` is not a drop-in for the booking sheet.** It renders a gradient "handle" bar (`GradientSurface token="brand"`) the redesign doesn't call for, uses `radius.lg` (20) not 26, and `elevation.sheet` not the spec's shadow. Phase 4 will need its own sheet wrapper/style (following the same structural pattern — absolute-positioned, `colors.panel`, docked bottom) rather than reusing this component unmodified.
4. **Icon-tile radii aren't named tokens.** README calls for 13px (40px tiles), 14–15px (46px tiles), 16px (48px tiles) radii. Only `radius.sm2 = 14` lands exactly; 13 and 15 fall between `xs = 11` and `sm2 = 14`, or `sm2 = 14` and `card = 16`. **Decision:** use literals for 13/15 where the spec calls for them specifically (e.g. `emptyIconTile` already does this in `home.styles.ts` using `radius.sm2` for its 46px tile at 14, not 15 — so the existing code already tolerates ±1px; follow that precedent rather than adding tokens).
5. **`GradientSurface` doesn't use `expo-linear-gradient`.** The README (and the master prompt's hard rule #4) says gradients go through `expo-linear-gradient` via `GradientSurface`. The actual implementation (`packages/ui/src/components/GradientSurface/GradientSurface.tsx`) is built on `react-native-svg` (`LinearGradient`/`Pattern` from `react-native-svg`), not `expo-linear-gradient`. This doesn't block anything — `GradientSurface` is still "the one place gradient logic lives" and the texture overlay is already built in via its `texture`/`textureOpacity` props — just noting the README's wording is stale so nobody goes looking for an `expo-linear-gradient` import that isn't there.
6. **No exact "row/card" shadow token.** README: `0 2px 8px rgba(0,46,96,.07)`. `home.styles.ts`'s `shortcutRow` hand-writes this exact shadow inline rather than using `elevation.card` (which is `{0,3}/.1/8`). Precedent confirmed: for the white-panel row shadow, write it inline matching the spec's numbers, don't reuse `elevation.card`.

None of the above are missing tokens to add — they're either "use a literal, matching existing precedent" or "the README's own words are slightly stale." No new entries needed in `colors.ts`, `typography.ts`, `radius.ts`, or `elevation.ts`.

## Reusable recipes for later phases

### 1. Navy header band
Structure (outer → inner), following the `heroShadowWrap` / `heroPanel` split in `home.styles.ts`:

```tsx
<View style={styles.bandShadowWrap /* shadowColor: accentBlue, offset per spec, opacity, radius — NO overflow/borderRadius here */}>
  <GradientSurface
    token="hero"                 // [accentBlue, '#001A38']
    direction="vertical"         // 'diagonal' only for the home hero (150deg); everything else in this bundle is a straight band
    style={styles.bandPanel /* overflow:'hidden', borderBottomLeftRadius/borderBottomRightRadius: 30 (heroBottom) */}
  >
    <View style={styles.motifTop /* position:absolute, top/right offsets per screen, 12% opacity chevron watermark */} />
    {/* band content — white text/icons */}
  </GradientSurface>
</View>
```
- Shadow (`0 12px 30px rgba(0,46,96,.22)`) lives on the outer wrap only — never combine with `overflow:'hidden'` + `borderRadius` on Android (this is the exact caveat documented at the top of `heroShadowWrap` in `home.styles.ts`).
- `borderBottomLeftRadius`/`borderBottomRightRadius: radius.heroBottom` (30), no top radius — bottom-only per spec.
- Motif watermark is a separate absolutely-positioned child layered above the gradient fill, below the content — same pattern as `heroMotifTop`.
- Login's 88px mark tile that straddles the band's bottom edge renders **after** (as a sibling below, visually overlapping via negative `marginTop: -44`) the band wrapper, so it paints above it — do not nest it inside `bandPanel`'s `overflow:'hidden'`, or it will clip.
- **No chevron texture, on any surface, in any phase.** The redesign spec calls for a 5% white repeating-diagonal-stripe texture on every navy band; per explicit user feedback this reads as visual noise and has been removed entirely — `GradientSurface`'s `texture`/`textureOpacity` props no longer exist (removed from the component, not just unused). Do not reintroduce a texture layer in any later phase, including ones not yet built. The motif watermark (the chevron logo shape, not the stripe pattern) is unaffected and still applies per spec.

### 2. White panel
```ts
whitePanel: {
  backgroundColor: colors.panel,
  borderRadius: radius.card,        // 16
  shadowColor: colors.accentBlue,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 8,
  elevation: 2,                     // matches shortcutRow in home.styles.ts exactly
}
```
Rows inside are divided by `colors.lineSoft` 1px hairlines (`borderBottomWidth: 1, borderBottomColor: colors.lineSoft` on all but the last row), each row carrying a 38–42px icon tile (`radius.md` = 12, or a literal per spec) at its leading edge.

### 3. Bottom sheet (booking flow, docked over map)
Per gap #2/#3 above — don't reuse `MapOverlaySheet` unmodified. New structure for Phase 4:
```ts
bookingSheet: {
  position: 'absolute', left: 0, right: 0, bottom: 0,
  backgroundColor: colors.panel,
  borderTopLeftRadius: 26,           // literal — spec value, no matching token
  borderTopRightRadius: 26,
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.lg,
  paddingBottom: spacing.xl,         // + safe-area bottom inset, passed from call site (see MapOverlaySheet's bottomInset pattern)
  shadowColor: colors.accentBlue,
  shadowOffset: { width: 0, height: -14 },
  shadowOpacity: 0.16,
  shadowRadius: 36,
  elevation: 12,                     // android: no equivalent negative-offset shadow, elevation is the closest available signal
}
```
No gradient handle bar (that's `MapOverlaySheet`'s own addition, not in this redesign's spec) unless a specific screen's screenshot shows one.

### 4. Empty / error state column
Directly reusable as-is — `home.styles.ts`'s `emptyPanel`/`emptyMotif`/`emptyIconTile`/`emptyTitle`/`emptyMessage` already match the README's "Empty / error state" surface description (dashed line-radius-20-ish panel, motif at low opacity, 46px icon tile, title, one line of cause, single action) almost exactly:
```ts
emptyPanel: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, borderRadius: radius.md3 /* 18, README says 20 — close enough per gap #4 precedent, or use literal 20 if a screenshot shows a visible difference */, padding: spacing.tight34, alignItems: 'center', position: 'relative', overflow: 'hidden' },
emptyMotif: { position: 'absolute', top: -20, right: -20 },
emptyIconTile: { width: 46, height: 46, borderRadius: radius.sm2, backgroundColor: colors.accentBlueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
emptyTitle: { ...typography.h3, color: colors.ink, textAlign: 'center' },
emptyMessage: { ...typography.caption, color: colors.inkSoft, textAlign: 'center', marginTop: spacing.xs },
```
For the "bare centered column" variant (owns the whole screen, e.g. offline/no-connection), drop the dashed border/padding, keep icon tile → title → message → action, centered in a flex-1 container.

Primary/secondary actions in every recipe above use the existing `Button` component (`packages/ui/src/components/Button`) — it already handles solid/outline/ghost, tone (primary/neutral/danger), loading, and the gradient-fill primary CTA (`token="button"` → `[accentBlue, accentBluePressed]`). No new button implementation needed in any phase.

## Stopping here per the prompt

Phase 0 complete. No screens changed. Waiting for go-ahead before Phase 1 (tab bar).
