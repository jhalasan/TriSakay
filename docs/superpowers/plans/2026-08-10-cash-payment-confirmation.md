# Cash Payment Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the passenger app's cash-payment path to the real, driver-confirmed `transactions` row instead of a fake `wait(800)`.

**Architecture:** `app/booking/payment.tsx` already has a fully working GCash flow that subscribes to `transactions` status via `subscribeToTransactionStatus` (from `packages/services/src/payments`) and only advances the UI on a real `'paid'` row. Cash needs the same subscription, minus the checkout-creation step, started automatically on mount instead of on a button tap. No backend or `packages/services` changes are needed — everything cash needs (auto-provisioned pending row, driver-side confirm toggle, RLS, Realtime publication) already exists and is verified against `docs/SCHEMA.MD` and `apps/driver/app/trip/active.tsx`.

**Tech Stack:** React Native (Expo Router), Zustand (`useBookingStore`), `packages/services` (`subscribeToTransactionStatus`), TypeScript.

## Global Constraints

- Single file changes only: `apps/passenger/app/booking/payment.tsx`. No changes to `packages/services`, the driver app, or the DB schema — all confirmed already correct in the design spec (`docs/superpowers/specs/2026-08-10-cash-payment-confirmation-design.md`).
- Cash timeout is 30s (`CASH_WAIT_TIMEOUT_MS`); GCash timeout stays 120s (`GCASH_WAIT_TIMEOUT_MS`, unchanged).
- Cash failed-state has exactly one action: "Check again" (re-subscribe). No fallback-to-another-method button (already cash).
- GCash's existing button-triggered flow (checkout creation, `WebBrowser.openBrowserAsync`, retry / "pay cash instead") must be unchanged in behavior.
- No new tests: this repo has no component-level test harness for passenger screens (only `node --test` over plain `.ts`/`.js` utility files in `apps/passenger/tests/`), and the service functions being reused (`subscribeToTransactionStatus`) are already covered in `packages/services` tests. Verify via `npm run typecheck` at the repo root and manual smoke-test.

---

### Task 1: Generalize payment phase/error state and wire the cash auto-subscribe flow

**Files:**
- Modify: `apps/passenger/app/booking/payment.tsx` (full rewrite of the state/handlers section, lines 1–169; JSX in lines 170–231 gets targeted edits only)

**Interfaces:**
- Consumes: `subscribeToTransactionStatus(rideRequestId: string, onChange: (row: {id: string; status: string}) => void, onError?: (message: string) => void): () => void` — already exported from `@trisakay/services` (`packages/services/src/payments/index.ts`), already imported in this file. No signature change.
- Consumes: `createGcashCheckout(rideRequestId: string): Promise<{checkoutUrl: string | null; error: string | null}>` — already imported, unchanged.
- Produces: nothing consumed by other tasks — this is the only task.

This is a single cohesive change (state rename + new effect + JSX branching all depend on the same renamed variables), so it's one task rather than split into sub-steps with separate commits — splitting would leave the file in a non-compiling state between commits.

- [ ] **Step 1: Rename GCash-specific state to method-neutral names**

In `apps/passenger/app/booking/payment.tsx`, replace:

```ts
  const [gcashPhase, setGcashPhase] = useState<GcashPhase>('idle');
  const [gcashError, setGcashError] = useState<string | null>(null);
```

with:

```ts
  const [paymentPhase, setPaymentPhase] = useState<PaymentPhase>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);
```

Rename the type alias near the top of the file:

```ts
type GcashPhase = 'idle' | 'opening' | 'waiting' | 'failed';
```

becomes:

```ts
type PaymentPhase = 'idle' | 'opening' | 'waiting' | 'failed';
```

Add the new timeout constant next to the existing one:

```ts
const GCASH_WAIT_TIMEOUT_MS = 120_000;
const CASH_WAIT_TIMEOUT_MS = 30_000;
```

Then do a straight find-and-replace of every remaining `gcashPhase`/`setGcashPhase`/`gcashError`/`setGcashError` reference in the file (inside `handlePayNowGcash`, `handleRetryGcash`, `handleFallbackToCash`, and the JSX) with `paymentPhase`/`setPaymentPhase`/`paymentError`/`setPaymentError`. Do not rename the functions themselves (`handlePayNowGcash`, `handleRetryGcash`, `handleFallbackToCash`, `gcashBusy`) — those stay GCash-specific in name since their bodies remain GCash-only.

**Step 1 has no independent test** — it's a pure rename with no behavior change yet; the file won't fully compile again until Step 2 restores the cash caller. Proceed directly to Step 2.

- [ ] **Step 2: Replace the fake cash handler with a real subscribe-on-mount flow**

Delete the current `handlePayNowCash`:

```ts
  async function handlePayNowCash() {
    setPaying(true);
    await wait(800);
    setPaying(false);
    finishSuccessfulPayment();
  }
```

Remove the now-unused `wait` import:

```ts
import { wait } from '../../src/mocks/delay';
```

Remove the `paying`/`setPaying` state (`const [paying, setPaying] = useState(false);`) — it was only ever used by cash's fake delay; GCash already has its own `gcashPhase === 'opening'` loading indicator and cash no longer has a tappable button (see Step 3).

Add a new effect, placed directly after the existing cleanup `useEffect` (the one that clears `unsubscribeRef`/`timeoutRef` on unmount):

```ts
  useEffect(() => {
    if (paymentMethod !== 'cash' || !rideRequestId) return;

    function startCashWait() {
      setPaymentPhase('waiting');
      setPaymentError(null);

      unsubscribeRef.current?.();
      unsubscribeRef.current = subscribeToTransactionStatus(
        rideRequestId!,
        (row) => {
          if (row.status === 'paid') {
            unsubscribeRef.current?.();
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            finishSuccessfulPayment();
          }
        },
        (message) => {
          unsubscribeRef.current?.();
          unsubscribeRef.current = null;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setPaymentError(message);
          setPaymentPhase('failed');
        },
      );

      timeoutRef.current = setTimeout(() => {
        unsubscribeRef.current?.();
        setPaymentError('Still waiting for the driver to confirm cash received.');
        setPaymentPhase('failed');
      }, CASH_WAIT_TIMEOUT_MS);
    }

    startCashWait();
    cashWaitRestartRef.current = startCashWait;
  }, [paymentMethod, rideRequestId]);
```

Add the ref this effect uses (next to the existing `unsubscribeRef`/`timeoutRef` declarations):

```ts
  const cashWaitRestartRef = useRef<(() => void) | null>(null);
```

Add a `handleCheckAgainCash` function (placed after `handleFallbackToCash`) for the "Check again" button:

```ts
  function handleCheckAgainCash() {
    unsubscribeRef.current?.();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    cashWaitRestartRef.current?.();
  }
```

Note: `row.status === 'failed'` is intentionally not handled for cash — a cash `transactions` row's status only ever moves `pending → paid` (per `txn_cash_needs_confirmation`, there's no cash-specific failure path the way GCash has a PayMongo failure webhook); only the timeout and Realtime-connection-drop paths can put cash into `'failed'` UI state.

- [ ] **Step 3: Update the `handlePayNow` dispatcher and JSX to route cash automatically instead of through the footer button**

Replace:

```ts
  async function handlePayNow() {
    if (paymentMethod === 'gcash') {
      await handlePayNowGcash();
    } else {
      await handlePayNowCash();
    }
  }
```

with (GCash keeps its button; cash has nothing left for this dispatcher to do since it starts on mount):

```ts
  async function handlePayNow() {
    await handlePayNowGcash();
  }
```

In the JSX, update the status/error text block. Replace:

```tsx
        {gcashPhase === 'waiting' && (
          <Text style={styles.gcashStatusText}>Waiting for PayMongo to confirm your payment…</Text>
        )}
        {gcashPhase === 'failed' && gcashError && (
          <View style={styles.gcashErrorBox}>
            <Text style={styles.gcashErrorText}>{gcashError}</Text>
            <View style={styles.gcashErrorActions}>
              <Button label="Retry GCash" onPress={handleRetryGcash} />
              <Button label="Pay cash instead" variant="outline" onPress={handleFallbackToCash} />
            </View>
          </View>
        )}
```

with:

```tsx
        {paymentPhase === 'waiting' && (
          <Text style={styles.gcashStatusText}>
            {paymentMethod === 'cash'
              ? 'Waiting for the driver to confirm cash received…'
              : 'Waiting for PayMongo to confirm your payment…'}
          </Text>
        )}
        {paymentPhase === 'failed' && paymentError && (
          <View style={styles.gcashErrorBox}>
            <Text style={styles.gcashErrorText}>{paymentError}</Text>
            <View style={styles.gcashErrorActions}>
              {paymentMethod === 'cash' ? (
                <Button label="Check again" onPress={handleCheckAgainCash} />
              ) : (
                <>
                  <Button label="Retry GCash" onPress={handleRetryGcash} />
                  <Button label="Pay cash instead" variant="outline" onPress={handleFallbackToCash} />
                </>
              )}
            </View>
          </View>
        )}
```

Update `gcashBusy` and the footer button to hide "Pay now" entirely for cash:

Replace:

```ts
  const gcashBusy = gcashPhase === 'opening' || gcashPhase === 'waiting';
```

with:

```ts
  const gcashBusy = paymentPhase === 'opening' || paymentPhase === 'waiting';
```

Replace the footer:

```tsx
      <View style={styles.footer}>
        <Button
          label={gcashPhase === 'opening' ? 'Opening PayMongo…' : 'Pay now'}
          fullWidth
          loading={paying || gcashPhase === 'opening'}
          disabled={gcashPhase === 'waiting' || gcashPhase === 'failed'}
          onPress={handlePayNow}
        />
      </View>
```

with:

```tsx
      {paymentMethod === 'gcash' && (
        <View style={styles.footer}>
          <Button
            label={paymentPhase === 'opening' ? 'Opening PayMongo…' : 'Pay now'}
            fullWidth
            loading={paymentPhase === 'opening'}
            disabled={paymentPhase === 'waiting' || paymentPhase === 'failed'}
            onPress={handlePayNow}
          />
        </View>
      )}
```

The payment-method radio row (`PAYMENT_OPTIONS.map(...)`) already disables selection while `gcashBusy` is true — no change needed there since it now reads the renamed `paymentPhase`-derived `gcashBusy`.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck` (repo root)
Expected: no errors in `apps/passenger/app/booking/payment.tsx`. If `tsc` reports an unused-import or unused-variable error, confirm every reference to `wait`, `paying`, `gcashPhase`, `gcashError`, and `GcashPhase` has been removed/renamed per Steps 1–2.

- [ ] **Step 5: Manual smoke test**

This repo has no emulator/live-Supabase access in this environment (same caveat as every prior passenger-flow change this session — see `docs/PASSENGER_TODO.MD` item 5's note). Flag this task as **typecheck-verified, not device-verified** until a human runs it:
1. Start a ride as a passenger, select "Cash" as the payment method, complete the trip.
2. On the driver app, before or after tapping "Complete trip" (whichever the driver does first — both orders must work since the row may already be `paid` when the passenger's screen mounts), toggle "Confirm cash received."
3. Confirm the passenger's payment screen shows no visible "Pay now" button for cash, and either flashes briefly to "waiting" then proceeds to `rate-driver`, or (if the driver hadn't confirmed yet) shows "Waiting for the driver to confirm cash received…" until the driver toggles it, then proceeds.
4. Confirm the GCash path (button tap → checkout → waiting → paid) still behaves exactly as before.

- [ ] **Step 6: Commit**

```bash
git add apps/passenger/app/booking/payment.tsx
git commit -m "$(cat <<'EOF'
feat(passenger): wire real cash-payment confirmation flow

Replaces payment.tsx's fake wait(800) cash path with a subscription
to the real transactions row (driver-confirmed per FR-9.9), reusing
the same subscribeToTransactionStatus GCash already relies on.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Post-plan follow-up (not part of this plan)

- `docs/PASSENGER_TODO.MD` item 6's row should be marked done and its "Defer GCash to the `gcash-webhook` Edge Function" note struck through/updated — GCash was already implemented in a prior session (`createGcashCheckout`, `packages/services/src/payments`) but the backlog doc wasn't updated to reflect it. Out of scope for this plan (docs-only cleanup, no code dependency), but worth a follow-up edit so the doc stops saying GCash doesn't exist yet.
