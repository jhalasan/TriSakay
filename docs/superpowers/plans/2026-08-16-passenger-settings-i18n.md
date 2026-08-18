# Passenger Settings Persistence + Filipino i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/passenger`'s settings persist across restarts (device-local) and make the Filipino language toggle actually translate the core booking-flow screens.

**Architecture:** A typed English/Filipino string dictionary lives in `packages/shared/src/i18n/` (reusable by the driver app later). `apps/passenger`'s settings store gets zustand `persist` middleware backed by AsyncStorage, behind a swappable storage indirection so it stays unit-testable without touching real AsyncStorage. A small `useTranslation()` hook in the passenger app reads the store's `language` field and returns the matching dictionary; 8 screens (home, settings, confirm, finding-driver, trip, payment, rate-driver, set-destination) read their static UI text from it instead of hardcoded English literals.

**Tech Stack:** React Native / Expo, TypeScript, zustand (`persist` middleware), `@react-native-async-storage/async-storage` (already a dependency — no new installs), Node's built-in test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-08-16-passenger-settings-i18n-design.md`

## Global Constraints

- Device-local persistence only (AsyncStorage) — no backend/schema change, no cross-device sync.
- Only static, app-authored UI text is translated. Dynamic content (names, addresses, fare amounts, Supabase/RPC error messages returned from services) stays in whatever language it arrives in.
- `en` and `fil` dictionaries must be structurally identical — enforced by TypeScript (`fil: Translations = ...`) and a runtime test.
- No new npm dependencies.
- Exactly these 8 screens get translated in this pass: `app/(tabs)/home.tsx`, `app/(tabs)/settings.tsx`, `app/booking/confirm.tsx`, `app/booking/finding-driver.tsx`, `app/booking/trip.tsx`, `app/booking/payment.tsx`, `app/booking/rate-driver.tsx`, `app/booking/set-destination.tsx`.

---

### Task 1: i18n dictionary package (`packages/shared`)

**Files:**
- Create: `packages/shared/src/i18n/en.ts`
- Create: `packages/shared/src/i18n/fil.ts`
- Create: `packages/shared/src/i18n/index.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.tests.json`
- Create: `packages/shared/tests/i18n.test.ts`
- Modify: `package.json` (root)

**Interfaces:**
- Produces: `export type Translations` and `export const translations: Record<'en' | 'fil', Translations>` from `@trisakay/shared`. Every later task's `useTranslation()` hook and every translated screen imports the `Translations` shape (implicitly, through the hook's return type) and reads paths like `t.home.savedPlaces`.

- [ ] **Step 1: Write `en.ts`**

```ts
// packages/shared/src/i18n/en.ts
export const en = {
  common: {
    gcash: 'GCash',
    cash: 'Cash',
  },
  home: {
    profileAccessibilityLabel: 'Profile',
    notificationsAccessibilityLabel: 'Notifications',
    whereTo: 'Where to?',
    findingLocation: 'Finding your location…',
    dragPinToSetPickup: 'Drag the pin to set pickup',
    savedPlaces: 'Saved places',
    noSavedPlacesTitle: 'No saved places yet',
    noSavedPlacesMessage: 'Places you save will appear here for one-tap booking.',
  },
  settings: {
    title: 'Settings',
    pushNotifications: 'Push notifications',
    locationTracking: 'Location tracking',
    language: 'Language',
    languageEnglish: 'English',
    languageFilipino: 'Filipino',
    smsReceipts: 'SMS receipts',
    emailReceipts: 'Email receipts',
    logOut: 'Log out',
  },
  confirm: {
    title: 'Confirm ride',
    noDestinationSelected: 'No destination selected yet.',
    chooseDestination: 'Choose a destination',
    pickupPointFallback: 'Pickup point',
    notSetYetFallback: 'Not set yet',
    routePreview: 'Route preview',
    seats: 'Seats',
    estimatedFare: 'Estimated fare',
    viewFareMatrix: 'View fare matrix',
    discountAppliedSuffix: '% discount applied',
    roadDistanceLabel: 'Road distance:',
    couldNotReachFareService: 'Could not reach the fare service.',
    estimatingFare: 'Estimating fare…',
    fareConfirmedAtDropoff: 'Final fare is confirmed at drop-off',
    applyForDiscountPrompt: 'Senior, PWD, or student? Apply for a fare discount',
    paymentMethod: 'Payment method',
    requestRide: 'Request ride',
    couldNotRequestRide: 'Could not request a ride. Please try again.',
  },
  findingDriver: {
    title: 'Finding a driver',
    lookingForTricycleTo: 'Looking for a tricycle to',
    lookingForTricycleNearby: 'Looking for a tricycle nearby',
    cancelRequest: 'Cancel request',
  },
  trip: {
    noDriverMatchedTitle: 'No driver matched',
    noDriverMatchedMessage: 'Try requesting a ride again.',
    backToHome: 'Back to Home',
    mapCaption: 'Map · trip route',
    driverAssigned: 'Driver assigned',
    noInAppCallNotice: 'No in-app call or message — coordination is in person.',
  },
  payment: {
    title: 'Payment',
    amountDue: 'Amount due',
    tripTo: 'Trip to',
    payWith: 'Pay with',
    gcashWalletTitle: 'GCash Wallet',
    gcashWalletSubtitle: 'Pay using your GCash balance',
    cashSubtitle: 'Pay the driver directly',
    missingRideDetails: 'Missing ride details — please go back and try again.',
    waitingForCashConfirm: 'Waiting for the driver to confirm cash received…',
    waitingForGcashConfirm: 'Waiting for PayMongo to confirm your payment…',
    stillWaitingCashConfirm: 'Still waiting for the driver to confirm cash received.',
    paymentFailedRetry: 'Payment failed. You can retry.',
    couldNotStartGcashCheckout: 'Could not start GCash checkout.',
    couldNotConfirmPaymentYet: "We couldn't confirm your payment yet. You can retry.",
    checkAgain: 'Check again',
    retryGcash: 'Retry GCash',
    openingPaymongo: 'Opening PayMongo…',
    payNow: 'Pay now',
  },
  rateDriver: {
    yourDriverFallback: 'Your driver',
    howWasYourRide: 'How was your ride?',
    commentLabel: 'Comment (optional)',
    commentPlaceholder: 'Tell us about your trip',
    submitRating: 'Submit rating',
    skipForNow: 'Skip for now',
    couldNotConfirmDriver: "We couldn't confirm your driver for this trip — you can still continue.",
    continue: 'Continue',
  },
  setDestination: {
    locatingPin: 'Locating pin…',
    tapOrDragPin: 'Tap or drag the pin to drop a destination',
    searchForDestination: 'Search for a destination',
    searchResults: 'Search results',
    droppedPin: 'Dropped pin',
    searching: 'Searching…',
    noMatches: 'No matches',
    lookingForPlacesNearby: 'Looking for places nearby.',
    tryDifferentSearchTerm: 'Try a different search term, or drop a pin on the map instead.',
    typePlaceNameOrTapMap: 'Type a place name, or tap the map to drop a pin.',
    confirmDestination: 'Confirm destination',
  },
} as const;
```

- [ ] **Step 2: Write `fil.ts`**

```ts
// packages/shared/src/i18n/fil.ts
import type { Translations } from './index.ts';

export const fil: Translations = {
  common: {
    gcash: 'GCash',
    cash: 'Cash',
  },
  home: {
    profileAccessibilityLabel: 'Profile',
    notificationsAccessibilityLabel: 'Mga Abiso',
    whereTo: 'Saan ka pupunta?',
    findingLocation: 'Hinahanap ang iyong lokasyon…',
    dragPinToSetPickup: 'Ilipat ang pin para itakda ang sakayan',
    savedPlaces: 'Mga Naka-save na Lugar',
    noSavedPlacesTitle: 'Wala pang naka-save na lugar',
    noSavedPlacesMessage: 'Makikita rito ang mga lugar na iyong ise-save para sa mas mabilis na pag-book.',
  },
  settings: {
    title: 'Mga Setting',
    pushNotifications: 'Push Notifications',
    locationTracking: 'Location Tracking',
    language: 'Wika',
    languageEnglish: 'Ingles',
    languageFilipino: 'Filipino',
    smsReceipts: 'SMS na Resibo',
    emailReceipts: 'Email na Resibo',
    logOut: 'Mag-log Out',
  },
  confirm: {
    title: 'Kumpirmahin ang Sakay',
    noDestinationSelected: 'Wala pang napiling destinasyon.',
    chooseDestination: 'Pumili ng Destinasyon',
    pickupPointFallback: 'Sakayan',
    notSetYetFallback: 'Hindi pa naitatakda',
    routePreview: 'Preview ng Ruta',
    seats: 'Upuan',
    estimatedFare: 'Tinatayang Pamasahe',
    viewFareMatrix: 'Tingnan ang Fare Matrix',
    discountAppliedSuffix: '% diskwento ang naaplay',
    roadDistanceLabel: 'Distansya sa kalsada:',
    couldNotReachFareService: 'Hindi ma-access ang fare service.',
    estimatingFare: 'Kinukwenta ang pamasahe…',
    fareConfirmedAtDropoff: 'Ang huling pamasahe ay kukumpirmahin pagdating sa destinasyon',
    applyForDiscountPrompt: 'Senior, PWD, o estudyante? Mag-apply para sa diskwento sa pamasahe',
    paymentMethod: 'Paraan ng Pagbabayad',
    requestRide: 'Humiling ng Sakay',
    couldNotRequestRide: 'Hindi makapag-request ng sakay. Pakisubukang muli.',
  },
  findingDriver: {
    title: 'Naghahanap ng Driver',
    lookingForTricycleTo: 'Naghahanap ng traysikel papuntang',
    lookingForTricycleNearby: 'Naghahanap ng traysikel sa malapit',
    cancelRequest: 'Kanselahin ang Request',
  },
  trip: {
    noDriverMatchedTitle: 'Walang na-match na driver',
    noDriverMatchedMessage: 'Subukang humiling muli ng sakay.',
    backToHome: 'Bumalik sa Home',
    mapCaption: 'Mapa · ruta ng biyahe',
    driverAssigned: 'May Nakatalagang Driver',
    noInAppCallNotice: 'Walang tawag o mensahe sa app — personal na pag-uusap na lang.',
  },
  payment: {
    title: 'Bayad',
    amountDue: 'Halagang Babayaran',
    tripTo: 'Biyahe papuntang',
    payWith: 'Magbayad gamit ang',
    gcashWalletTitle: 'GCash Wallet',
    gcashWalletSubtitle: 'Magbayad gamit ang iyong GCash balance',
    cashSubtitle: 'Direktang magbayad sa driver',
    missingRideDetails: 'Kulang ang detalye ng sakay — bumalik at subukang muli.',
    waitingForCashConfirm: 'Hinihintay ang kumpirmasyon ng driver na natanggap ang cash…',
    waitingForGcashConfirm: 'Hinihintay ang kumpirmasyon ng PayMongo sa iyong bayad…',
    stillWaitingCashConfirm: 'Hinihintay pa rin ang kumpirmasyon ng driver na natanggap ang cash.',
    paymentFailedRetry: 'Nabigo ang pagbabayad. Maaari mong subukang muli.',
    couldNotStartGcashCheckout: 'Hindi masimulan ang GCash checkout.',
    couldNotConfirmPaymentYet: 'Hindi pa namin makumpirma ang iyong bayad. Maaari mong subukang muli.',
    checkAgain: 'Tingnan Muli',
    retryGcash: 'Subukang Muli ang GCash',
    openingPaymongo: 'Binubuksan ang PayMongo…',
    payNow: 'Magbayad Ngayon',
  },
  rateDriver: {
    yourDriverFallback: 'Iyong driver',
    howWasYourRide: 'Kumusta ang biyahe mo?',
    commentLabel: 'Komento (opsyonal)',
    commentPlaceholder: 'Ikwento ang iyong biyahe',
    submitRating: 'Isumite ang Rating',
    skipForNow: 'Laktawan Muna',
    couldNotConfirmDriver: 'Hindi namin makumpirma ang driver para sa biyaheng ito — maaari ka pa ring magpatuloy.',
    continue: 'Magpatuloy',
  },
  setDestination: {
    locatingPin: 'Hinahanap ang lokasyon ng pin…',
    tapOrDragPin: 'Pindutin o ilipat ang pin para itakda ang destinasyon',
    searchForDestination: 'Maghanap ng destinasyon',
    searchResults: 'Mga Resulta ng Paghahanap',
    droppedPin: 'Inilagay na pin',
    searching: 'Naghahanap…',
    noMatches: 'Walang natugma',
    lookingForPlacesNearby: 'Naghahanap ng mga lugar sa malapit.',
    tryDifferentSearchTerm: 'Subukan ang ibang termino, o maglagay na lang ng pin sa mapa.',
    typePlaceNameOrTapMap: 'Mag-type ng pangalan ng lugar, o pindutin ang mapa para maglagay ng pin.',
    confirmDestination: 'Kumpirmahin ang Destinasyon',
  },
};
```

- [ ] **Step 3: Write `index.ts`**

```ts
// packages/shared/src/i18n/index.ts
import { en } from './en.ts';
import { fil } from './fil.ts';

export type Translations = typeof en;
export const translations: Record<'en' | 'fil', Translations> = { en, fil };
```

- [ ] **Step 4: Re-export from the package root**

In `packages/shared/src/index.ts`, add a fourth line:

```ts
export * from './constants';
export * from './types';
export * from './utils';
export * from './i18n/index.ts';
```

- [ ] **Step 5: Wire up the test script**

`packages/shared/package.json` currently has no `type`, `scripts`, or `test` entry (unlike `packages/services`/`packages/ui`, which both have `"type": "module"` and `"test": "node --test ./tests/*.test.ts"`). Replace the whole file:

```json
{
  "name": "@trisakay/shared",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "private": true,
  "scripts": {
    "test": "node --test ./tests/*.test.ts"
  }
}
```

- [ ] **Step 6: Add a tests-only tsconfig, mirroring `packages/services/tsconfig.tests.json`**

```json
// packages/shared/tsconfig.tests.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "composite": false,
    "declaration": false,
    "emitDeclarationOnly": false,
    "noEmit": true,
    "rootDir": "."
  },
  "references": [{ "path": "./tsconfig.json" }],
  "include": ["tests/**/*"]
}
```

- [ ] **Step 7: Write the failing test**

```ts
// packages/shared/tests/i18n.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { translations } from '../src/i18n/index.ts';

function collectKeyPaths(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    collectKeyPaths(value, prefix ? `${prefix}.${key}` : key),
  );
}

test('en and fil dictionaries have identical key structures', () => {
  const enKeys = collectKeyPaths(translations.en).sort();
  const filKeys = collectKeyPaths(translations.fil).sort();
  assert.deepEqual(filKeys, enKeys);
});

test('every string value is non-empty in both dictionaries', () => {
  for (const lang of ['en', 'fil'] as const) {
    for (const path of collectKeyPaths(translations[lang])) {
      const value = path.split('.').reduce<unknown>((acc, key) => (acc as Record<string, unknown>)[key], translations[lang]);
      assert.equal(typeof value, 'string', `${lang}.${path} should be a string`);
      assert.ok((value as string).length > 0, `${lang}.${path} should not be empty`);
    }
  }
});
```

- [ ] **Step 8: Run the test to verify it currently fails (module doesn't exist yet if steps 1-4 were skipped) or passes (if run after steps 1-4)**

Run: `npm --workspace packages/shared run test`
Expected: both tests PASS (the dictionaries were written correctly in steps 1-2). If step 5 hasn't been done yet, this command doesn't exist yet — do steps 1-6 before running this.

- [ ] **Step 9: Register the workspace test script at the repo root**

In the root `package.json`, add a line after `"test:ui"`:

```json
    "test:shared": "npm --workspace packages/shared run test",
```

- [ ] **Step 10: Add the tests project to the root typecheck script**

In the root `package.json`, change:

```json
    "typecheck": "tsc -b && tsc -p packages/services/tsconfig.tests.json && tsc -p packages/ui/tsconfig.tests.json"
```

to:

```json
    "typecheck": "tsc -b && tsc -p packages/services/tsconfig.tests.json && tsc -p packages/ui/tsconfig.tests.json && tsc -p packages/shared/tsconfig.tests.json"
```

- [ ] **Step 11: Run typecheck and the new test script, confirm both pass**

Run: `npm run typecheck && npm run test:shared`
Expected: PASS (typecheck clean, both `i18n.test.ts` tests green).

- [ ] **Step 12: Commit**

```bash
git add packages/shared/src/i18n packages/shared/src/index.ts packages/shared/package.json packages/shared/tsconfig.tests.json packages/shared/tests/i18n.test.ts package.json
git commit -m "feat(shared): add English/Filipino i18n dictionary"
```

---

### Task 2: Settings store persistence (`apps/passenger`)

**Files:**
- Create: `apps/passenger/src/store/settingsStorage.ts`
- Modify: `apps/passenger/src/store/useSettingsStore.ts`
- Create: `apps/passenger/tests/settingsStore.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `useSettingsStore` state shape becomes `{ pushNotificationsEnabled: boolean; locationTrackingEnabled: boolean; language: 'en' | 'fil'; smsReceipts: boolean; emailReceipts: boolean; togglePushNotifications(): void; toggleLocationTracking(): void; setLanguage(language: 'en' | 'fil'): void; toggleSmsReceipts(): void; toggleEmailReceipts(): void }` — note `language` is now a code, not a display string, and there's a new `setLanguage` action replacing the screen's direct `useSettingsStore.setState({ language: ... })` call. `__setSettingsStorageForTests(fake: StateStorage): void` is exported from `settingsStorage.ts` for tests (and for Task 3's screen work, which doesn't need it, but future tests of any store consumer can reuse it).

- [ ] **Step 1: Write the storage indirection**

`AsyncStorage.getItem`/`setItem` throw when called outside a real React Native runtime (verified: `require('@react-native-async-storage/async-storage').default.getItem('x')` under plain Node throws `window is not defined`). zustand's `createJSONStorage(() => AsyncStorage)` resolves `AsyncStorage` once at store-creation time, so a test can't swap it out after the fact by reassigning a variable the store already captured — the swap has to happen inside the storage object's own method bodies, which are only invoked at read/write time, not at store creation. Hence this indirection object:

```ts
// apps/passenger/src/store/settingsStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

let backend: StateStorage = AsyncStorage;

/** Indirection so tests can swap the backend before persist() ever touches real AsyncStorage — see settingsStore.test.ts. */
export const settingsStorage: StateStorage = {
  getItem: (name) => backend.getItem(name),
  setItem: (name, value) => backend.setItem(name, value),
  removeItem: (name) => backend.removeItem(name),
};

export function __setSettingsStorageForTests(fake: StateStorage): void {
  backend = fake;
}
```

- [ ] **Step 2: Rewrite the settings store**

Replace the full contents of `apps/passenger/src/store/useSettingsStore.ts`:

```ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { settingsStorage } from './settingsStorage.ts';

export type SettingsLanguage = 'en' | 'fil';

interface SettingsState {
  pushNotificationsEnabled: boolean;
  locationTrackingEnabled: boolean;
  language: SettingsLanguage;
  smsReceipts: boolean;
  emailReceipts: boolean;
  togglePushNotifications: () => void;
  toggleLocationTracking: () => void;
  setLanguage: (language: SettingsLanguage) => void;
  toggleSmsReceipts: () => void;
  toggleEmailReceipts: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      pushNotificationsEnabled: true,
      locationTrackingEnabled: true,
      language: 'en',
      smsReceipts: false,
      emailReceipts: true,
      togglePushNotifications: () =>
        set((state) => ({ pushNotificationsEnabled: !state.pushNotificationsEnabled })),
      toggleLocationTracking: () =>
        set((state) => ({ locationTrackingEnabled: !state.locationTrackingEnabled })),
      setLanguage: (language) => set({ language }),
      toggleSmsReceipts: () => set((state) => ({ smsReceipts: !state.smsReceipts })),
      toggleEmailReceipts: () => set((state) => ({ emailReceipts: !state.emailReceipts })),
    }),
    {
      name: 'trisakay-passenger-settings',
      storage: createJSONStorage(() => settingsStorage),
    },
  ),
);
```

- [ ] **Step 3: Write the failing test**

```ts
// apps/passenger/tests/settingsStore.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';

function makeMemoryStorage() {
  const mem = new Map<string, string>();
  return {
    getItem: (name: string) => (mem.has(name) ? (mem.get(name) as string) : null),
    setItem: (name: string, value: string) => {
      mem.set(name, value);
    },
    removeItem: (name: string) => {
      mem.delete(name);
    },
    __mem: mem,
  };
}

test('togglePushNotifications flips the flag', async () => {
  const { __setSettingsStorageForTests } = await import('../src/store/settingsStorage.ts');
  __setSettingsStorageForTests(makeMemoryStorage());
  const { useSettingsStore } = await import('../src/store/useSettingsStore.ts');

  const before = useSettingsStore.getState().pushNotificationsEnabled;
  useSettingsStore.getState().togglePushNotifications();
  assert.equal(useSettingsStore.getState().pushNotificationsEnabled, !before);
});

test('setLanguage updates language to the given code', async () => {
  const { __setSettingsStorageForTests } = await import('../src/store/settingsStorage.ts');
  __setSettingsStorageForTests(makeMemoryStorage());
  const { useSettingsStore } = await import('../src/store/useSettingsStore.ts');

  useSettingsStore.getState().setLanguage('fil');
  assert.equal(useSettingsStore.getState().language, 'fil');
  useSettingsStore.getState().setLanguage('en');
  assert.equal(useSettingsStore.getState().language, 'en');
});

test('toggling a setting persists the whole state (minus actions) to the injected storage', async () => {
  const { __setSettingsStorageForTests } = await import('../src/store/settingsStorage.ts');
  const storage = makeMemoryStorage();
  __setSettingsStorageForTests(storage);
  const { useSettingsStore } = await import('../src/store/useSettingsStore.ts');

  useSettingsStore.getState().toggleSmsReceipts();
  // persist() writes asynchronously — flush microtasks.
  await Promise.resolve();
  await Promise.resolve();

  const raw = storage.__mem.get('trisakay-passenger-settings');
  assert.ok(raw, 'expected the store to have written to storage');
  const parsed = JSON.parse(raw as string);
  assert.equal(typeof parsed.state.smsReceipts, 'boolean');
  assert.equal(parsed.state.togglePushNotifications, undefined, 'actions must not be persisted');
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm --workspace apps/passenger run test`
Expected: FAIL — `settingsStore.test.ts` can't find `__setSettingsStorageForTests` / `setLanguage` (steps 1-2 not done yet if run now) or passes cleanly (if run after steps 1-2 are already in place). Do steps 1-2 first, then this step should already be green — there's no red state to chase here since the store rewrite and the test are written together; instead, treat this run as verification, and if it's red for any reason other than "not implemented yet", fix the store before moving on.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm --workspace apps/passenger run test`
Expected: PASS — all 3 new tests plus the pre-existing `mapHtml.test.ts`, `notificationsStore.test.ts`, `route.test.ts`, `sample.test.js` still green.

- [ ] **Step 6: Commit**

```bash
git add apps/passenger/src/store/settingsStorage.ts apps/passenger/src/store/useSettingsStore.ts apps/passenger/tests/settingsStore.test.ts
git commit -m "feat(passenger): persist settings via zustand persist + AsyncStorage"
```

---

### Task 3: `useTranslation` hook + Settings screen

**Files:**
- Create: `apps/passenger/src/hooks/useTranslation.ts`
- Modify: `apps/passenger/app/(tabs)/settings.tsx`

**Interfaces:**
- Consumes: `translations` from `@trisakay/shared` (Task 1), `useSettingsStore` with `language: 'en' | 'fil'` and `setLanguage` (Task 2).
- Produces: `useTranslation(): Translations` — every remaining task (4-10) calls this at the top of its screen component as `const t = useTranslation()`.

- [ ] **Step 1: Write the hook**

```ts
// apps/passenger/src/hooks/useTranslation.ts
import { translations, type Translations } from '@trisakay/shared';
import { useSettingsStore } from '../store/useSettingsStore.ts';

export function useTranslation(): Translations {
  const language = useSettingsStore((state) => state.language);
  return translations[language];
}
```

- [ ] **Step 2: Translate the Settings screen**

Replace the full contents of `apps/passenger/app/(tabs)/settings.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Toggle, colors } from '@trisakay/ui';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useSettingsStore, type SettingsLanguage } from '../../src/store/useSettingsStore';
import { styles } from '../../src/styles/tabs/settings.styles';

const LANGUAGE_CODES: SettingsLanguage[] = ['en', 'fil'];

function CheckboxRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      style={styles.row}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Ionicons name="checkmark" size={15} color={colors.white} />}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const t = useTranslation();
  const {
    pushNotificationsEnabled,
    locationTrackingEnabled,
    language,
    smsReceipts,
    emailReceipts,
    togglePushNotifications,
    toggleLocationTracking,
    setLanguage,
    toggleSmsReceipts,
    toggleEmailReceipts,
  } = useSettingsStore();

  const languageLabels: Record<SettingsLanguage, string> = {
    en: t.settings.languageEnglish,
    fil: t.settings.languageFilipino,
  };

  function cycleLanguage() {
    const nextIndex = (LANGUAGE_CODES.indexOf(language) + 1) % LANGUAGE_CODES.length;
    setLanguage(LANGUAGE_CODES[nextIndex]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{t.settings.title}</Text>

        <View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t.settings.pushNotifications}</Text>
            <Toggle value={pushNotificationsEnabled} onValueChange={togglePushNotifications} />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t.settings.locationTracking}</Text>
            <Toggle value={locationTrackingEnabled} onValueChange={toggleLocationTracking} />
          </View>
          <Pressable style={styles.row} onPress={cycleLanguage} accessibilityRole="button">
            <Text style={styles.rowLabel}>{t.settings.language}</Text>
            <View style={styles.rowValueSlot}>
              <Text style={styles.rowValue}>{languageLabels[language]}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
            </View>
          </Pressable>
          <CheckboxRow label={t.settings.smsReceipts} checked={smsReceipts} onToggle={toggleSmsReceipts} />
          <CheckboxRow label={t.settings.emailReceipts} checked={emailReceipts} onToggle={toggleEmailReceipts} />
        </View>

        <View style={styles.logoutWrap}>
          <Button label={t.settings.logOut} variant="outline" tone="danger" fullWidth onPress={() => router.push('/logout')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS. This is the first screen consuming both Task 1's `@trisakay/shared` export and Task 2's `setLanguage`/`language: 'en' | 'fil'` — a real compile error here means one of those two tasks' interface doesn't match what's written above; fix the mismatch before continuing (don't paper over it in this file).

- [ ] **Step 4: Manual verification**

Run the passenger app (`npm run start:passenger`), open Settings, tap "Language" — it should cycle "English" → "Filipino" → "English", and every row label on the screen should switch to the Filipino dictionary strings from `fil.ts` when set to Filipino. Restart the app (kill and reopen, not just reload) and confirm the language choice and every toggle's state survived — this is the actual persistence behavior Task 2 built.

- [ ] **Step 5: Commit**

```bash
git add apps/passenger/src/hooks/useTranslation.ts "apps/passenger/app/(tabs)/settings.tsx"
git commit -m "feat(passenger): wire the language toggle to real Filipino translations"
```

---

### Task 4: Home screen

**Files:**
- Modify: `apps/passenger/app/(tabs)/home.tsx`

**Interfaces:**
- Consumes: `useTranslation()` from Task 3.

- [ ] **Step 1: Add the hook and translate strings**

In `apps/passenger/app/(tabs)/home.tsx`, add the import (alongside the other hooks):

```tsx
import { useTranslation } from '../../src/hooks/useTranslation';
```

Inside `HomeScreen`, add near the other store reads:

```tsx
const t = useTranslation();
```

Then apply these exact replacements:

| Original | Replacement |
|---|---|
| `caption={locating ? 'Finding your location…' : 'Drag the pin to set pickup'}` | `caption={locating ? t.home.findingLocation : t.home.dragPinToSetPickup}` |
| `accessibilityLabel="Profile"` | `accessibilityLabel={t.home.profileAccessibilityLabel}` |
| `label="Where to?"` | `label={t.home.whereTo}` |
| `accessibilityLabel="Notifications"` | `accessibilityLabel={t.home.notificationsAccessibilityLabel}` |
| `<Text style={styles.sectionLabel}>Saved places</Text>` | `<Text style={styles.sectionLabel}>{t.home.savedPlaces}</Text>` |
| `title="No saved places yet"` | `title={t.home.noSavedPlacesTitle}` |
| `message="Places you save will appear here for one-tap booking."` | `message={t.home.noSavedPlacesMessage}` |

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Manual verification**

Switch to Filipino in Settings, navigate to Home. Confirm: the search bar reads "Saan ka pupunta?", the "Saved places" section header and empty-state copy are in Filipino, and (if you can trigger it) the map caption while locating reads "Hinahanap ang iyong lokasyon…".

- [ ] **Step 4: Commit**

```bash
git add "apps/passenger/app/(tabs)/home.tsx"
git commit -m "feat(passenger): translate the Home screen"
```

---

### Task 5: Confirm ride screen

**Files:**
- Modify: `apps/passenger/app/booking/confirm.tsx`

**Interfaces:**
- Consumes: `useTranslation()` from Task 3.

- [ ] **Step 1: Add the hook**

Add the import:

```tsx
import { useTranslation } from '../../src/hooks/useTranslation';
```

Inside `ConfirmScreen`, add near the other store reads:

```tsx
const t = useTranslation();
```

- [ ] **Step 2: Apply these exact replacements**

| Original | Replacement |
|---|---|
| `<ScreenHeader title="Confirm ride" />` (both occurrences — the early-return empty state and the main return) | `<ScreenHeader title={t.confirm.title} />` |
| `<Text style={styles.emptyText}>No destination selected yet.</Text>` | `<Text style={styles.emptyText}>{t.confirm.noDestinationSelected}</Text>` |
| `<Button label="Choose a destination" onPress={() => router.replace('/booking/set-destination')} />` | `<Button label={t.confirm.chooseDestination} onPress={() => router.replace('/booking/set-destination')} />` |
| `setRequestError(error ?? 'Could not request a ride. Please try again.');` | `setRequestError(error ?? t.confirm.couldNotRequestRide);` |
| `caption="Route preview"` | `caption={t.confirm.routePreview}` |
| `{pickup?.label ?? 'Pickup point'}` | `{pickup?.label ?? t.confirm.pickupPointFallback}` |
| `{pickup?.address ?? 'Not set yet'}` | `{pickup?.address ?? t.confirm.notSetYetFallback}` |
| `<Text style={styles.sectionLabel}>Seats</Text>` | `<Text style={styles.sectionLabel}>{t.confirm.seats}</Text>` |
| `<Text style={styles.fareLabel}>Estimated fare</Text>` | `<Text style={styles.fareLabel}>{t.confirm.estimatedFare}</Text>` |
| `accessibilityLabel="View fare matrix"` | `accessibilityLabel={t.confirm.viewFareMatrix}` |
| `<Badge label={`${discountRatePercent ?? 20}% discount applied`} tone="green" />` | `<Badge label={`${discountRatePercent ?? 20}${t.confirm.discountAppliedSuffix}`} tone="green" />` |
| `{route && <Text style={styles.fareNote}>Road distance: {route.distanceKm.toFixed(1)} km</Text>}` | `{route && (<Text style={styles.fareNote}>{t.confirm.roadDistanceLabel} {route.distanceKm.toFixed(1)} km</Text>)}` |
| `? 'Could not reach the fare service.'` | `? t.confirm.couldNotReachFareService` |
| `: fare === null\n                ? 'Estimating fare…'` | `: fare === null\n                ? t.confirm.estimatingFare` |
| `: 'Final fare is confirmed at drop-off'` | `: t.confirm.fareConfirmedAtDropoff` |
| `<Text style={styles.discountLink}>Senior, PWD, or student? Apply for a fare discount</Text>` | `<Text style={styles.discountLink}>{t.confirm.applyForDiscountPrompt}</Text>` |
| `<Text style={styles.sectionLabelSpaced}>Payment method</Text>` | `<Text style={styles.sectionLabelSpaced}>{t.confirm.paymentMethod}</Text>` |
| `options={[\n              { label: 'GCash', value: 'gcash' },\n              { label: 'Cash', value: 'cash' },\n            ]}` | `options={[\n              { label: t.common.gcash, value: 'gcash' },\n              { label: t.common.cash, value: 'cash' },\n            ]}` |
| `label="Request ride"` | `label={t.confirm.requestRide}` |

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Switch to Filipino, run the booking flow up to Confirm ride. Confirm the header, "Upuan" (Seats), "Tinatayang Pamasahe" (Estimated fare), the road-distance line, the payment-method segmented control ("GCash"/"Cash" — these stay as-is per `common`, which is correct: they're brand/product names), and "Humiling ng Sakay" (Request ride) all render in Filipino.

- [ ] **Step 5: Commit**

```bash
git add apps/passenger/app/booking/confirm.tsx
git commit -m "feat(passenger): translate the Confirm ride screen"
```

---

### Task 6: Finding-driver screen

**Files:**
- Modify: `apps/passenger/app/booking/finding-driver.tsx`

**Interfaces:**
- Consumes: `useTranslation()` from Task 3.

- [ ] **Step 1: Add the hook**

Add the import:

```tsx
import { useTranslation } from '../../src/hooks/useTranslation';
```

Inside `FindingDriverScreen`, add near the other store reads:

```tsx
const t = useTranslation();
```

- [ ] **Step 2: Apply these exact replacements**

| Original | Replacement |
|---|---|
| `<Text style={styles.title}>Finding a driver</Text>` | `<Text style={styles.title}>{t.findingDriver.title}</Text>` |
| `{dropoff ? `Looking for a tricycle to ${dropoff.label}` : 'Looking for a tricycle nearby'}` | `{dropoff ? `${t.findingDriver.lookingForTricycleTo} ${dropoff.label}` : t.findingDriver.lookingForTricycleNearby}` |
| `label="Cancel request"` | `label={t.findingDriver.cancelRequest}` |

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Switch to Filipino, request a ride, and check the "Finding a driver" screen reads "Naghahanap ng Driver" with the "Naghahanap ng traysikel papuntang {destination}" subtitle and a "Kanselahin ang Request" cancel button.

- [ ] **Step 5: Commit**

```bash
git add apps/passenger/app/booking/finding-driver.tsx
git commit -m "feat(passenger): translate the Finding-driver screen"
```

---

### Task 7: Trip screen

**Files:**
- Modify: `apps/passenger/app/booking/trip.tsx`

**Interfaces:**
- Consumes: `useTranslation()` from Task 3.

- [ ] **Step 1: Add the hook**

Add the import:

```tsx
import { useTranslation } from '../../src/hooks/useTranslation';
```

Inside `TripScreen`, add near the other store reads:

```tsx
const t = useTranslation();
```

- [ ] **Step 2: Apply these exact replacements**

| Original | Replacement |
|---|---|
| `<EmptyState title="No driver matched" message="Try requesting a ride again." />` | `<EmptyState title={t.trip.noDriverMatchedTitle} message={t.trip.noDriverMatchedMessage} />` |
| `<Button label="Back to Home" onPress={() => router.replace('/(tabs)/home')} />` | `<Button label={t.trip.backToHome} onPress={() => router.replace('/(tabs)/home')} />` |
| `caption="Map · trip route"` | `caption={t.trip.mapCaption}` |
| `<Badge label="Driver assigned" tone="blue" dot />` | `<Badge label={t.trip.driverAssigned} tone="blue" dot />` |
| `<Text style={styles.caption}>No in-app call or message — coordination is in person.</Text>` | `<Text style={styles.caption}>{t.trip.noInAppCallNotice}</Text>` |

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Switch to Filipino, get past matching to the Trip screen. Confirm "May Nakatalagang Driver" badge and the "Walang tawag o mensahe sa app — personal na pag-uusap na lang." caption render correctly.

- [ ] **Step 5: Commit**

```bash
git add apps/passenger/app/booking/trip.tsx
git commit -m "feat(passenger): translate the Trip screen"
```

---

### Task 8: Payment screen

**Files:**
- Modify: `apps/passenger/app/booking/payment.tsx`

**Interfaces:**
- Consumes: `useTranslation()` from Task 3.

- [ ] **Step 1: Add the hook**

Add the import:

```tsx
import { useTranslation } from '../../src/hooks/useTranslation';
```

Inside `PaymentScreen`, add near the other store reads:

```tsx
const t = useTranslation();
```

- [ ] **Step 2: Move `PAYMENT_OPTIONS` inside the component**

`PAYMENT_OPTIONS` is currently a module-level constant, but it needs `t` (only available inside the component), so it moves inside `PaymentScreen`, right after the `const t = useTranslation();` line. Delete the module-level `const PAYMENT_OPTIONS: ... = [...]` declaration entirely and add this inside the component instead:

```tsx
  const PAYMENT_OPTIONS: { value: PaymentMethod; title: string; subtitle: string }[] = [
    { value: 'gcash', title: t.payment.gcashWalletTitle, subtitle: t.payment.gcashWalletSubtitle },
    { value: 'cash', title: t.common.cash, subtitle: t.payment.cashSubtitle },
  ];
```

- [ ] **Step 3: Apply these exact replacements in the rest of the file**

| Original | Replacement |
|---|---|
| `setPaymentError('Missing ride details — please go back and try again.');` (both occurrences — the cash-flow guard and `handlePayNowGcash`) | `setPaymentError(t.payment.missingRideDetails);` |
| `setPaymentError('Still waiting for the driver to confirm cash received.');` | `setPaymentError(t.payment.stillWaitingCashConfirm);` |
| `setPaymentError(error ?? 'Could not start GCash checkout.');` | `setPaymentError(error ?? t.payment.couldNotStartGcashCheckout);` |
| `setPaymentError('Payment failed. You can retry.');` | `setPaymentError(t.payment.paymentFailedRetry);` |
| `setPaymentError("We couldn't confirm your payment yet. You can retry.");` | `setPaymentError(t.payment.couldNotConfirmPaymentYet);` |
| `<ScreenHeader title="Payment" showBack={false} />` | `<ScreenHeader title={t.payment.title} showBack={false} />` |
| `<Text style={styles.amountLabel}>Amount due</Text>` | `<Text style={styles.amountLabel}>{t.payment.amountDue}</Text>` |
| `{dropoff && <Text style={styles.amountNote}>Trip to {dropoff.label}</Text>}` | `{dropoff && <Text style={styles.amountNote}>{t.payment.tripTo} {dropoff.label}</Text>}` |
| `<Text style={styles.sectionLabel}>Pay with</Text>` | `<Text style={styles.sectionLabel}>{t.payment.payWith}</Text>` |
| `<Badge label={option.value === 'gcash' ? 'GCash' : 'Cash'} tone="neutral" />` | `<Badge label={option.value === 'gcash' ? t.common.gcash : t.common.cash} tone="neutral" />` |
| `? 'Waiting for the driver to confirm cash received…'` | `? t.payment.waitingForCashConfirm` |
| `: 'Waiting for PayMongo to confirm your payment…'}` | `: t.payment.waitingForGcashConfirm}` |
| `<Button label="Check again" onPress={handleCheckAgainCash} />` | `<Button label={t.payment.checkAgain} onPress={handleCheckAgainCash} />` |
| `<Button label="Retry GCash" onPress={handleRetryGcash} />` | `<Button label={t.payment.retryGcash} onPress={handleRetryGcash} />` |
| `label={paymentPhase === 'opening' ? 'Opening PayMongo…' : 'Pay now'}` | `label={paymentPhase === 'opening' ? t.payment.openingPaymongo : t.payment.payNow}` |

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS. Pay close attention here — `PAYMENT_OPTIONS` moving from module scope into the component is the one structural change in this task; if anything outside `PaymentScreen` referenced it (nothing currently does, per the file read during planning), typecheck will catch it.

- [ ] **Step 5: Manual verification**

Switch to Filipino, reach the Payment screen with a completed trip. Confirm "Bayad" header, "Halagang Babayaran" (Amount due), the GCash/Cash option titles and subtitles, and (if you can trigger cash/GCash waiting or failure states) the corresponding Filipino status/error text.

- [ ] **Step 6: Commit**

```bash
git add apps/passenger/app/booking/payment.tsx
git commit -m "feat(passenger): translate the Payment screen"
```

---

### Task 9: Rate-driver screen

**Files:**
- Modify: `apps/passenger/app/booking/rate-driver.tsx`

**Interfaces:**
- Consumes: `useTranslation()` from Task 3.

- [ ] **Step 1: Add the hook**

Add the import:

```tsx
import { useTranslation } from '../../src/hooks/useTranslation';
```

Inside `RateDriverScreen`, add near the other store reads:

```tsx
const t = useTranslation();
```

- [ ] **Step 2: Apply these exact replacements**

| Original | Replacement |
|---|---|
| `<Text style={styles.name}>{driver?.name ?? 'Your driver'}</Text>` | `<Text style={styles.name}>{driver?.name ?? t.rateDriver.yourDriverFallback}</Text>` |
| `<Text style={styles.subtitle}>How was your ride?</Text>` | `<Text style={styles.subtitle}>{t.rateDriver.howWasYourRide}</Text>` |
| `label="Comment (optional)"` | `label={t.rateDriver.commentLabel}` |
| `placeholder="Tell us about your trip"` | `placeholder={t.rateDriver.commentPlaceholder}` |
| `label="Submit rating"` | `label={t.rateDriver.submitRating}` |
| `<Button label="Skip for now" variant="outline" fullWidth onPress={finish} />` | `<Button label={t.rateDriver.skipForNow} variant="outline" fullWidth onPress={finish} />` |
| `We couldn't confirm your driver for this trip — you can still continue.` (inside the `<Text style={styles.fallbackNote}>`) | `{t.rateDriver.couldNotConfirmDriver}` |
| `<Button label="Continue" fullWidth onPress={finish} />` | `<Button label={t.rateDriver.continue} fullWidth onPress={finish} />` |

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Switch to Filipino, reach the rate-driver screen after a payment. Confirm "Kumusta ang biyahe mo?" subtitle, the comment placeholder, and "Isumite ang Rating" / "Laktawan Muna" buttons render in Filipino. If reachable, also check the no-driver fallback copy and its "Magpatuloy" button.

- [ ] **Step 5: Commit**

```bash
git add apps/passenger/app/booking/rate-driver.tsx
git commit -m "feat(passenger): translate the Rate-driver screen"
```

---

### Task 10: Set-destination screen

**Files:**
- Modify: `apps/passenger/app/booking/set-destination.tsx`

**Interfaces:**
- Consumes: `useTranslation()` from Task 3.

- [ ] **Step 1: Add the hook**

Add the import:

```tsx
import { useTranslation } from '../../src/hooks/useTranslation';
```

Inside `SetDestinationScreen`, add near the other store reads:

```tsx
const t = useTranslation();
```

- [ ] **Step 2: Apply these exact replacements**

| Original | Replacement |
|---|---|
| `caption={resolvingPin ? 'Locating pin…' : 'Tap or drag the pin to drop a destination'}` | `caption={resolvingPin ? t.setDestination.locatingPin : t.setDestination.tapOrDragPin}` |
| `placeholder="Search for a destination"` | `placeholder={t.setDestination.searchForDestination}` |
| `<Text style={styles.resultsLabel}>Search results</Text>` | `<Text style={styles.resultsLabel}>{t.setDestination.searchResults}</Text>` |
| `setSelected({ ...resolved, label: 'Dropped pin' });` | `setSelected({ ...resolved, label: t.setDestination.droppedPin });` |
| `title={searching ? 'Searching…' : query ? 'No matches' : 'Search for a destination'}` | `title={searching ? t.setDestination.searching : query ? t.setDestination.noMatches : t.setDestination.searchForDestination}` |
| `? 'Looking for places nearby.'` | `? t.setDestination.lookingForPlacesNearby` |
| `? 'Try a different search term, or drop a pin on the map instead.'` | `? t.setDestination.tryDifferentSearchTerm` |
| `: 'Type a place name, or tap the map to drop a pin.'` | `: t.setDestination.typePlaceNameOrTapMap` |
| `<Button label="Confirm destination" fullWidth disabled={!selected} onPress={handleConfirm} />` | `<Button label={t.setDestination.confirmDestination} fullWidth disabled={!selected} onPress={handleConfirm} />` |

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Switch to Filipino, open "Where to?" from Home. Confirm the search placeholder, "Mga Resulta ng Paghahanap" label, and the various empty-state title/message combinations (before typing, while typing, no results) all render in Filipino, and dropping a pin on the map labels it "Inilagay na pin".

- [ ] **Step 5: Commit**

```bash
git add apps/passenger/app/booking/set-destination.tsx
git commit -m "feat(passenger): translate the Set-destination screen"
```

---

## Final check

After Task 10, run the full verification sweep once more end to end:

```bash
npm run typecheck
npm run test:shared
npm run test:passenger
```

Expected: all three PASS. Then do one more manual pass: set language to Filipino, and walk the entire booking flow start to finish (Home → Set destination → Confirm → Finding driver → Trip → Payment → Rate driver), confirming every screen touched in this plan renders Filipino text, and that switching back to English and force-quitting/reopening the app preserves the English choice (persistence, from Task 2).
