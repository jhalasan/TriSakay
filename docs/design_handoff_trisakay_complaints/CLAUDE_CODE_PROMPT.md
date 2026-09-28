# Claude Code prompt — Passenger Complaints & Case Tracker redesign (TriSakay)

Paste the whole thing. It assumes repo `jhalasan/TriSakay`, branch `main`, Expo Router + React Native, and that `design_handoff_trisakay_complaints/` (README + `screens/*.png` + `TriSakay Complaints Redesign.dc.html`) is in the repo or attached.

---

Implement the redesigned **passenger Complaints tab, new-complaint flow, and complaint tracker** so they match `design_handoff_trisakay_complaints/README.md` and the six screenshots in `screens/` exactly. The README is the spec: every size, colour, copy string and state is in it. When the README and a screenshot disagree, the README wins. When the README says "confirm" or "if available", ask me before you change the backend.

## Ground rules
- Use only `@trisakay/ui` tokens (`colors`, `typography`, `spacing`, `radius`, `elevation`, `gradients`). Values are design px at 390pt. Use the named token where the README gives one; otherwise use `moderateScale(px, deviceWidth)` like the theme files do. Never set `fontWeight`.
- Reuse the existing components: `Avatar`, `Badge`, `Button`, `Card`, `ListRow`, `TextField`, `Textarea`, `EmptyState`, `Spinner`, `OfflineState`, and the Home navy-band texture/motif. Extend a component (e.g. `Button size="lg"`) instead of hand-rolling a lookalike.
- Keep all existing behaviour: `submitComplaint` contract, evidence upload via `readFileBytes`, `attachmentError` warning, `generalComplaint`, `MAX_EVIDENCE_PHOTOS = 3`, offline state, focus refresh, tutorial demo hooks.
- Don't touch any other screen except the three deep links listed in README §5.

## Order of work
1. **Plan first.** Read the README, the screenshots, and these files: `app/(tabs)/complaints.tsx`, `app/complaints/[id].tsx`, `src/styles/tabs/complaints.styles.ts`, `src/styles/complaints/detail.styles.ts`, `src/utils/complaintStages.ts`, `src/hooks/useTutorialDemoState.ts`, `src/hooks/usePassengerTutorialNavigation.ts`, the tutorial step table, `packages/services/src/complaints/index.ts`, and `packages/ui/src/theme/*`. Then reply with:
   - the file list you will create/modify/delete
   - the backend deltas from README §6 you think are needed, and which ones already exist
   - any README value you cannot map to a token.
   **Stop and wait for my OK.**
2. Shared pieces (README §1): `src/utils/complaintCategories.ts` (move `CATEGORY_ICON`/`CATEGORY_TONE`/labels here), `src/utils/complaintStatus.ts` (chip tone + stage-bar segment colours derived from `getComplaintStageStates`, **with unit tests** for all 6 statuses), and `src/components/complaints/` for `NavyBand` (if Home's isn't reusable), `StatusChip`, `StageBar`, `StageTimeline`, `IconTile`, `StickyFooter`.
3. **Tracker** `app/complaints/[id].tsx` (README §4): navy band with the back button **left of** the title block (row, top-aligned), Now card / Decision card, Progress, Details, follow-up line, loading + not-found under the band. No tab bar.
4. **New complaint** `app/complaints/new.tsx` (README §3): one route with `step: 1 | 2 | 'sent'`. Move the form logic here from the tab. Step 1: selected trip card + "Not about a specific ride" radio + 2×3 category grid with no default. Step 2: summary chip, subject + per-category suggestion chips (i18n), message, photos with the wide add tile. Sent: reference card with Copy (`expo-clipboard`), what-happens-next, Track / Back.
5. **Tab** `app/(tabs)/complaints.tsx` (README §2): navy band + stats strip, Report a problem card, Common issues tiles (push `/complaints/new?category=`), Your cases (max 3 + See all), and the empty state.
6. **Deep links + tutorial** (README §5): trip-complete → `/complaints/new`, tutorial `complaint` route → `/complaints/new`, retarget `trip-and-category` / `evidence-and-submit` / `progress-card`, seed the demo state for the new layout, re-measure fallback rects.
7. Add all new copy from README §7 to the i18n files (keep the existing keys that are still used; delete the dead ones).
8. Delete styles that are no longer referenced. Run typecheck, lint and tests.

## Done means
Every box in README §8 is ticked. Send me:
- screenshots of the 6 frames plus the empty list, offline, escalated and dismissed states on a 390pt simulator, placed next to the handoff PNGs
- a short list of anything you had to approximate, and why.
