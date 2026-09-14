# In-app tutorials

One coach-mark overlay, shared by both apps, each fed its own step table. Source design: `docs/design_handoff_trisakay_tutorials/` (README.md + CLAUDE_CODE_PROMPT.md — the copy in the step tables is locked to that handoff; do not paraphrase it).

## Where things live

- `packages/ui/src/tutorial/` — the shared overlay (`TutorialProvider`, `TutorialOverlay`, `CoachMark`, `WelcomeSheet`, `FinishedToast`, `useTutorialTarget`, `geometry.ts`) and the two step tables:
  - `steps.driver.ts` — `DRIVER_STEPS`, `DRIVER_WELCOME_BODY`, `DRIVER_FINISHED_MESSAGE`
  - `steps.passenger.ts` — `PASSENGER_STEPS`, `PASSENGER_WELCOME_BODY`, `PASSENGER_FINISHED_MESSAGE`
- Per app (`apps/driver/`, `apps/passenger/`):
  - `src/constants/tutorial.ts` — the AsyncStorage `*TutorialSeenAt` key
  - `src/hooks/use*TutorialTrigger.ts` — decides when to auto-`start()` the tour
  - `src/hooks/use*TutorialNavigation.ts` — routes to each step's `screen` before it paints (kept out of `packages/ui`, which has no `expo-router` dependency)
  - `src/hooks/useTutorialDemoState.ts` — the fixed demo values/handlers each tour-gated screen substitutes for its real state
  - `app/_layout.tsx` — mounts `<TutorialProvider>` around `<Stack>`, `<TutorialOverlay>` as its last sibling, and writes the seen-at key from `onSkip`/`onFinish`

## How a step works

Each `TutorialStep` has: `screen` (an app-defined key, e.g. `'dashboard'`), `targetId` (what the screen registers via `useTutorialTarget(id)`), `tip` (`'above'` | `'below'`), a design-frame `frame` (390×844 fallback rect, used until the real target reports one), and the locked `title`/`body`.

A screen wires a target by spreading the hook's return onto a **plain `<View>`** (or a ref-forwarding host component like `Pressable`) that already exists — never onto a non-forwardRef composite component like `Card` or `GradientSurface`; wrap those in a thin `<View>` instead, since `ref` would silently do nothing there.

## Adding a step

1. Add an entry to the relevant step table (`steps.driver.ts` / `steps.passenger.ts`) with the exact copy, frame, and a `targetId`.
2. In the target screen, call `useTutorialTarget('your-id')` and spread it onto the element to spotlight.
3. If the step needs the screen in a specific state (a populated card, a disabled real handler), add it to that app's `useTutorialDemoState.ts` and read it in the screen — never mutate a real store for this, only override the screen's own render-time values.
4. If the step's screen key is new, add it to that app's `use*TutorialNavigation.ts` route map.

Driver Complaints is the intended driver step 9 later, on the existing Complaints screen, before the earnings step (per the handoff's "Out of scope" note) — not built yet.
