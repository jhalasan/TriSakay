-- Backs the driver Earnings screen's peak-hours chart. Replaces the
-- earlier "Notify PSO for settlement" feature (self-reported, gated
-- nothing) with a genuinely decision-useful signal: which hours are
-- busiest, so a driver can choose when to go online. City-wide and
-- aggregate-only (bucket counts, no ride/user rows) so it's safe to
-- expose to any authenticated driver — a driver has no direct RLS read
-- across other drivers'/passengers' ride_requests (see docs/SCHEMA.MD
-- Section 7.5), so this mirrors get_driver_accept_rate's shape: a
-- SECURITY DEFINER function that returns only a safe aggregate.
--
-- Buckets by Asia/Manila LOCAL wall-clock hour, not UTC — same reasoning
-- as the admin Reports "Peak Hours" chart (packages/services/src/admin/
-- reports.ts): "peak hour" means the PSO/driver's own local time.
-- generate_series ensures all 12 buckets are returned even when a bucket
-- has zero rides, so the chart always renders 12 bars.
create or replace function public.get_peak_hour_histogram(p_since timestamptz)
returns table(bucket_index integer, bucket_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.bucket_index,
    count(rr.id)::integer as bucket_count
  from generate_series(0, 11) as b(bucket_index)
  left join public.ride_requests rr
    on rr.status = 'completed'
    and rr.requested_at >= p_since
    and floor(extract(hour from rr.requested_at at time zone 'Asia/Manila') / 2)::integer = b.bucket_index
  group by b.bucket_index
  order by b.bucket_index;
$$;

comment on function public.get_peak_hour_histogram is
  'Driver-facing peak-hours chart (Earnings screen). Aggregate-only (12 two-hour bucket counts, Asia/Manila local time) — no PII. See get_driver_accept_rate for the same SECURITY DEFINER aggregate-only pattern.';
