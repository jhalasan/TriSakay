-- X9: rr_passenger_cancel's WITH CHECK only pinned the new status to
-- 'cancelled' — passenger_id and status(='pending') were checked in USING,
-- but WITH CHECK can't compare NEW/OLD, so the same UPDATE could also smuggle
-- changes to trip_id, final_fare, or any other column alongside the
-- cancellation.
--
-- cancel_ride_request_as_passenger() already exists (pre-history function,
-- never wired up client-side) and does this correctly: passenger_id/status
-- checked server-side, only status/cancelled_at/cancel_reason touched. Wired
-- the client to it in this same change (packages/services/src/booking/index.ts)
-- and dropping the direct UPDATE policy entirely, per the doc's fix.
--
-- Also adding is_account_active() to the RPC itself — part of X8 (ride RPCs
-- should all check this), landing here since it's the same function.

create or replace function public.cancel_ride_request_as_passenger(p_ride_request_id uuid, p_reason text default null::text)
returns table(ride_request_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not coalesce(is_account_active(), false) then
    raise exception 'Account is not active';
  end if;

  update public.ride_requests
  set status = 'cancelled',
      cancelled_at = now(),
      cancel_reason = coalesce(p_reason, cancel_reason)
  where id = p_ride_request_id
    and passenger_id = auth.uid()
    and status in ('pending', 'assigned');

  if not found then
    raise exception 'Could not cancel — this ride may already be picked up, completed, or no longer active.';
  end if;

  return query select p_ride_request_id;
end;
$function$;

drop policy rr_passenger_cancel on public.ride_requests;
