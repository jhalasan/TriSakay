# Staged migrations

Files here are deliberately **not** in `supabase/migrations/`, so `supabase db push` can never apply them by accident.
Each one waits for a specific go-ahead; move it into `supabase/migrations/` (with the timestamp named in its header) only then.

- `pay2_payment_gate_and_booking_block.sql`: payment settlement Phase B (a ride cannot complete until paid; no booking with an unpaid ride). Waits for the on-device payment walkthrough.
