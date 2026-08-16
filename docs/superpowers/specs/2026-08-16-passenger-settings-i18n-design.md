# Passenger settings persistence + Filipino i18n (design)

**Status:** Approved for implementation planning
**Scope:** `apps/passenger` only. Corresponds to `docs/PASSENGER_TODO.MD` build-order item 13.

## Problem

`apps/passenger/src/store/useSettingsStore.ts` holds toggle state (push notifications,
location tracking, language, SMS/email receipts) entirely in memory — it resets on every
app restart. The Settings screen's language cycler flips a label between "English" and
"Filipino" but nothing downstream reads it; there is no i18n infrastructure anywhere in
the repo (no library, no dictionaries, no `t()`-style lookups — confirmed by a targeted
codebase search). Every screen's text is hardcoded English JSX.

## Goals

1. Settings (all five fields, not just language) persist across app restarts, device-local.
2. Selecting "Filipino" actually changes the displayed text on the core booking flow
   screens listed below.
3. The translation mechanism is reusable by the driver app later without rework, even
   though this pass only translates passenger-app strings.

## Non-goals

- Translating every screen in the app (deferred — only the 8 screens listed under
  "Screens translated").
- Translating dynamic/backend-sourced content: user names, addresses, fare amounts,
  Supabase/RPC error messages, driver info. These remain in whatever language the data
  arrives in.
- Account-level (cross-device) language sync — explicitly deferred; this is device-local
  via AsyncStorage, matching the existing precedent (Supabase session storage already
  uses AsyncStorage in `src/lib/supabase.ts`).
- Any change to the driver app. It keeps its own separate (still-dead) settings store;
  this work does not wire it up, but the shared dictionary package is positioned so a
  future pass can.
- Pluralization, string interpolation, or additional languages beyond English/Filipino —
  not a current requirement, so no library (react-i18next) is pulled in for it.

## Design

### 1. Dictionary package — `packages/shared/src/i18n/`

Three new files:

- **`en.ts`** — default-export-free named export `en`, a nested object of strings keyed
  by screen name, plus a `common` section for strings reused across screens (e.g.
  `common.cancel`, `common.continue`, `common.loading`):

  ```ts
  export const en = {
    common: { cancel: 'Cancel', continue: 'Continue', loading: 'Loading…', ... },
    home: { ... },
    settings: { ... },
    confirm: { ... },
    findingDriver: { ... },
    trip: { ... },
    payment: { ... },
    rateDriver: { ... },
    setDestination: { ... },
  } as const;
  ```

- **`fil.ts`** — same shape, typed against `en`:

  ```ts
  import type { Translations } from './index.ts';
  export const fil: Translations = { ... };
  ```

  A missing or extra key is a TypeScript compile error, so the two dictionaries cannot
  drift silently.

- **`index.ts`**:

  ```ts
  import { en } from './en.ts';
  import { fil } from './fil.ts';

  export type Translations = typeof en;
  export const translations: Record<'en' | 'fil', Translations> = { en, fil };
  ```

`packages/shared/src/index.ts` re-exports `./i18n/index.ts` alongside its existing
exports.

Exact key inventory is derived screen-by-screen during implementation (see "Screens
translated"); only static UI text gets a key — dynamic values are interpolated by the
consuming component around the translated string, not baked into the dictionary.

### 2. Settings store — `apps/passenger/src/store/useSettingsStore.ts`

- `language: string` (currently `'English' | 'Filipino'` display text) becomes
  `language: 'en' | 'fil'`. Default stays `'en'`.
- The whole store is wrapped in zustand's `persist` middleware, backed by
  `@react-native-async-storage/async-storage` (already a dependency in
  `apps/passenger/package.json` — no new install). Storage key:
  `trisakay-passenger-settings`. All five fields persist (push/location toggles, language,
  SMS/email receipts) — this is what "settings persistence" means in the TODO item, not
  language alone.
- No schema/backend change. This is a client-only, device-local preference.

### 3. Translation hook — `apps/passenger/src/hooks/useTranslation.ts`

```ts
import { translations } from '@trisakay/shared';
import { useSettingsStore } from '../store/useSettingsStore';

export function useTranslation() {
  const language = useSettingsStore((state) => state.language);
  return translations[language];
}
```

Screens call `const t = useTranslation()` and read e.g. `t.home.title`,
`t.confirm.estimatedFare`. Structural typing means a typo'd path is a compile error, not
a silent runtime miss — no fallback/"missing key" handling needed.

### 4. Settings screen changes — `apps/passenger/app/(tabs)/settings.tsx`

- `LANGUAGES = ['English', 'Filipino']` (display strings) becomes a small
  `LANGUAGE_OPTIONS: { code: 'en' | 'fil'; label: string }[]` list; `cycleLanguage()`
  cycles `code`, and the row displays the matching `label` (itself pulled from
  `t.settings.languageEnglish` / `t.settings.languageFilipino` so the *language names
  themselves* are also shown in the current language — matches how the ordinance-style
  screens already behave elsewhere in the app).
- Row labels ("Push notifications", "Location tracking", "Language", "SMS receipts",
  "Email receipts", the screen title, "Log out") move to `t.settings.*`.

### 5. Screens translated

Static UI text only (labels, headers, buttons, empty/error copy that's authored in this
app, not returned from the backend):

| Screen | Notes |
|---|---|
| `app/(tabs)/home.tsx` | Main tab — pickup prompt, CTA copy |
| `app/(tabs)/settings.tsx` | Row labels, title (see above) |
| `app/booking/confirm.tsx` | Section labels ("Seats", "Payment method"), fare card static copy, button label. **Not** the fare value, addresses, or the fare-matrix info line added earlier this session — those stay as literal numbers/citations |
| `app/booking/finding-driver.tsx` | Waiting-state copy, cancel button |
| `app/booking/trip.tsx` | Static labels around live trip state |
| `app/booking/payment.tsx` | Static labels; not the fare amount |
| `app/booking/rate-driver.tsx` | Prompt copy, "Submit rating" / "Skip for now" buttons |
| `app/booking/set-destination.tsx` | Search placeholder, empty-state copy |

Each screen's existing hardcoded `<Text>...</Text>` literals for the above categories are
replaced with `{t.<screen>.<key>}`; component structure and styles are unchanged.

### 6. Testing

- New test in `packages/shared/tests/` (or wherever that package's existing test
  convention lives — confirm during implementation) asserting `en` and `fil` have
  identical key structures via a recursive key-set comparison. This is a belt-and-braces
  runtime check; TypeScript already enforces it at compile time, but guards against a
  future `as any` escape hatch.
- No new snapshot/UI test infrastructure. Verification is manual: run the app, toggle
  the language in Settings, and check each of the 8 screens renders Filipino text.

## Risks / open questions

- **Translation quality.** Filipino strings are written by the implementer (not a native
  reviewer in this pipeline) — should be simple, correct Filipino for common ride-hailing
  UI vocabulary, but worth a native-speaker pass before shipping to real users. Flagging,
  not blocking.
- **`common` section growth.** If per-screen dictionaries end up duplicating the same
  short strings (Cancel/Continue/etc.), the `common` section absorbs them; this is decided
  per-string during implementation, not exhaustively pre-specified here.
