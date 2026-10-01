# Email trip receipt — design

Implements UAT P1 (docs/UAT_PANELIST_REVIEW_ADRALES.md): "email receipt if the passenger agrees". Passenger app only; the driver app keeps its existing local toggle untouched.

## Behaviour
- **Consent:** `users.email_receipts boolean not null default false`. The passenger Settings switch "Email receipts" becomes this column (it is local-only and dead today). Off until the passenger turns it on.
- **Automatic:** when a ride becomes `completed` and the passenger has consent, one receipt is emailed. Sent at most once per ride (unique log row).
- **On demand:** a passenger can tap "Email me this receipt" on the trip-complete screen and on a history receipt, whether or not the switch is on. Limits: 3 sends per ride, 20 per day per user.
- **Recipient:** only the account's own email (`users.email`), never an address typed in the app.
- **Content (built from the server record, not the local store):** reference code, date, pickup and destination labels, distance, duration, seats, fare, discount (if any), payment method and status, driver first name and plate. No phone number, no coordinates.
- **Sender:** `TriSakay <receipts@trisakaygsc.org>` through Resend. Needs `RESEND_API_KEY` as a Supabase secret and the domain verified in Resend.

## Pieces
1. Migration: `users.email_receipts`; table `receipt_emails` (ride, user, kind `auto|manual`, status `pending|sent|failed`, error, created_at; service-role only; unique partial index = one `auto` per ride); service-role-only RPC `get_receipt_for_email(ride)` returning everything the email needs for a completed ride; trigger on `ride_requests` completion that calls the edge function through pg_net with the existing Vault secret, only when the passenger has consent.
2. Edge function `send-receipt` (verify_jwt off; two callers): the trigger (shared secret, kind auto) and a signed-in passenger (their JWT, kind manual, must own the ride). Reserves a log row, sends via Resend, records sent or failed. Pure `receipt.ts` builds subject, HTML and plain text (HTML-escaped) and is unit-tested.
3. Services: `emailTripReceipt(rideRequestId)`, `getEmailReceiptsConsent()`, `setEmailReceiptsConsent(on)`.
4. Passenger app: Settings switch bound to the column; "Email me this receipt" button on trip-complete and history detail; English and Filipino strings.

## Rulings
- **Opt-in, default off:** the panel's wording is "if the passenger agrees". Cost if wrong: a one-line default change.
- **Send at completion, not at payment:** the receipt shows the payment method and the status at that moment ("pending" for cash until the driver confirms). The on-demand button re-sends later with the updated status. Cost if wrong: a cash receipt may say pending.
- **Log table instead of a single timestamp:** the same table enforces once-only auto sends and the per-ride and per-day limits.
- **Failed sends count toward the limits**, so the endpoint can't be used to hammer Resend.
- **Not built:** driver receipts, resend from admin, receipt PDFs, unsubscribe link (the Settings switch is the unsubscribe).

## Verification
- SQL (rolled back): consent default false; `get_receipt_for_email` refuses non-completed rides and is not callable by `authenticated`; the completion trigger only fires for consenting passengers; one auto row per ride; the log table is unreadable by clients.
- Unit tests: receipt builder (escaping, discount line, missing driver, cash vs GCash), services wrappers, edge-function limit logic.
- Live: after the domain is verified in Resend and the key is set, send one real receipt to the admin's own address.
