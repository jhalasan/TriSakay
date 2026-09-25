-- X2: rr_passenger_insert only checks passenger_id/is_account_active — a
-- passenger could INSERT a ride_request directly as status='completed' on
-- someone else's old trip_id (unlimited fake ratings, forged PD1/D1 strikes),
-- or as status='assigned' (permanent access to a driver's live GPS via
-- driver_locations, since that policy only checked status='assigned', not
-- whether the underlying trip is still active), with an arbitrary final_fare
-- and self-set requested_at/expires_at that never goes stale.
--
-- enforce_ride_request_fare_integrity (20260915000001) already recomputes
-- distance_km/estimated_fare/discount_applied/discount_percent server-side;
-- this trigger covers the remaining client-controlled fields, disjoint from
-- that one so ordering between them doesn't matter.

create or replace function public.enforce_ride_request_insert_fields()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.status := 'pending';
  new.trip_id := null;
  new.final_fare := null;
  new.assigned_at := null;
  new.picked_up_at := null;
  new.completed_at := null;
  new.cancelled_at := null;
  new.cancel_reason := null;
  new.requested_at := now();
  -- Matches the column's own DEFAULT (20260915000003): a client-facing
  -- dispatch-countdown deadline, not a hard expiry — see that migration's
  -- comment. Forced here too so a client can't submit a far-future value
  -- that never goes stale.
  new.expires_at := now() + interval '18 seconds';
  return new;
end;
$function$;

create trigger trg_ride_requests_insert_fields
before insert on public.ride_requests
for each row execute function enforce_ride_request_insert_fields();

-- New functions' EXECUTE grant source is inconsistent across this project —
-- some land as a PUBLIC grant (see X1), others as direct per-role grants to
-- anon/authenticated with no PUBLIC entry at all (verified live via proacl
-- for this exact function). Revoke both ways unconditionally so this doesn't
-- need a follow-up correction depending on which pattern this function got.
revoke execute on function public.enforce_ride_request_insert_fields() from public;
revoke execute on function public.enforce_ride_request_insert_fields() from anon, authenticated;

-- Second half of the doc's fix: driver_locations access required only
-- status='assigned' on the ride_request, not that the trip itself is still
-- active — so once a passenger got matched once, they kept live GPS access
-- to that driver forever (completed/cancelled trips included).
drop policy driver_location_select_matched_passenger on public.driver_locations;
create policy driver_location_select_matched_passenger on public.driver_locations for select
  using (exists (
    select 1 from ride_requests rr
    join trips t on t.id = rr.trip_id
    where t.driver_id = driver_locations.user_id
      and rr.passenger_id = auth.uid()
      and rr.status = 'assigned'
      and t.status = 'active'
  ));
