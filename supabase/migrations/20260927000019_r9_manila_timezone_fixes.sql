-- R9 (existing-system audit, UAT panel Adrales): the service operates in one
-- city, but several places quietly used UTC (the database's own default) or
-- whatever timezone a browser/phone happens to be set to, instead of
-- Asia/Manila:
--
--   - v_driver_earnings bucketed `completed_at` by UTC calendar day, so a
--     ride finishing after 8 PM Manila time (already past UTC midnight)
--     landed on "tomorrow" in a driver's own earnings breakdown.
--   - notify-expiring-franchises was scheduled `0 8 * * *` — pg_cron runs in
--     UTC, so this actually fires at 4 PM Manila time, not the 8 AM its
--     sibling notify-expiring-driver-documents-daily job (correctly, if
--     coincidentally) already runs at.
--
-- (The admin dashboard's own charts and the driver app's earnings-chart day
-- labels had the same class of bug — new Date(ts).getHours()/
-- toLocaleDateString() with no explicit timeZone, i.e. the ADMIN'S/DRIVER'S
-- OWN DEVICE timezone. Those are client-side fixes with no migration:
-- packages/services/src/admin/reports.ts and
-- apps/driver/src/components/EarningsBarChart/EarningsBarChart.tsx.)
--
-- The double `at time zone 'Asia/Manila'` round-trip below is the standard
-- "bucket by local calendar day, keep a timestamptz column" idiom: the first
-- conversion reads the instant as Manila wall-clock time (giving a plain,
-- zone-less timestamp to truncate), the second reinterprets that truncated
-- wall-clock midnight as being IN Manila time, converting it back to the
-- UTC instant that represents — so `earning_date`'s column type is
-- unchanged (still timestamptz) and this stays a plain CREATE OR REPLACE,
-- no DROP+CREATE needed.
create or replace view public.v_driver_earnings
with (security_invoker = true)
as
select
  t.driver_id,
  (date_trunc('day', rr.completed_at at time zone 'Asia/Manila') at time zone 'Asia/Manila') as earning_date,
  count(distinct rr.id) as rides_completed,
  sum(txn.amount) as total_collected
from trips t
join ride_requests rr on rr.trip_id = t.id and rr.status = 'completed'
join transactions txn on txn.ride_request_id = rr.id and txn.status = 'paid'
group by t.driver_id, (date_trunc('day', rr.completed_at at time zone 'Asia/Manila') at time zone 'Asia/Manila');

-- Was 08:00 UTC = 16:00 (4 PM) Manila. Moved to 8 AM Manila (00:00 UTC),
-- matching the sibling document-expiry job's already-correct hour.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'notify-expiring-franchises'),
  schedule := '0 0 * * *'
);
