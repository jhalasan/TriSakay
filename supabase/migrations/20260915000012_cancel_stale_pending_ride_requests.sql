-- P2 (2026-09-15 launch audit): "Search timeout leaves orphaned pending
-- requests" — finding-driver.tsx routes the passenger to no-drivers-nearby
-- after a 60s client-side search timeout, but deliberately leaves the
-- ride_request row `pending` (so a driver who accepts moments later still
-- correctly reconnects the passenger via no-drivers-nearby.tsx's own status
-- subscription). If the passenger never returns/cancels, that row stays
-- `pending` indefinitely — cluttering every driver's request board with a
-- request whose passenger gave up long ago.
--
-- This is deliberately NOT keyed off `expires_at` (18s) — that column is
-- documented as a display-only per-card countdown for the driver UI, "not a
-- hard reassignment trigger" (see its own column comment,
-- 20260915000003_add_ride_requests_expires_at.sql). Conflating the two would
-- cancel requests almost immediately, breaking real matching. This instead
-- uses a much more generous 15-minute-since-requested_at threshold — long
-- enough that any request still pending is unambiguously abandoned, not
-- just slow to match.
--
-- cancel_reason avoids the word "driver" on purpose: ride-cancelled.tsx
-- (passenger app) infers `byDriver` from
-- `cancel_reason.toLowerCase().includes('driver')` to pick its copy, and a
-- reason like "no driver accepted" would false-positive that check.
--
-- Verified live 2026-09-15: a rolled-back transaction inserted a synthetic
-- pending request, backdated its requested_at by 20 minutes, ran this
-- function, and confirmed it flipped to status='cancelled' with the
-- expected cancel_reason and a set cancelled_at.
create or replace function public.cancel_stale_pending_ride_requests()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.ride_requests
  set status = 'cancelled',
      cancelled_at = now(),
      cancel_reason = 'Expired — no match found in time'
  where status = 'pending'
    and requested_at < now() - interval '15 minutes';
end;
$$;

revoke execute on function public.cancel_stale_pending_ride_requests() from public, anon, authenticated;

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'cancel-stale-pending-ride-requests', '*/5 * * * *', 'select public.cancel_stale_pending_ride_requests();'
);
