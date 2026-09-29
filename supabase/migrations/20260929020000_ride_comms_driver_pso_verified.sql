-- Ride comms redesign (docs/design_handoff_trisakay_ride_comms, Part B §B4.2):
-- the matched-ride driver strip hides the rating when the driver has fewer
-- than 5 ratings and hides the "PSO verified" badge when the driver isn't
-- verified. `get_trip_driver_info` already returned `rating_count` (the
-- client just wasn't threading it through), but had no verification signal
-- at all — this adds it as a plain boolean so the client never needs to
-- know the underlying `verification_status` enum.
--
-- Return-type change, so this is a DROP + CREATE, not a plain
-- `create or replace` (Postgres 42P13) — same requirement noted on this
-- function's prior edits.

drop function if exists public.get_trip_driver_info(uuid);

create function public.get_trip_driver_info(p_ride_request_id uuid)
returns table(driver_id uuid, driver_name text, avatar_url text, plate_no text, rating_avg numeric, rating_count integer, pso_verified boolean)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_trip_id uuid;
begin
  select trip_id into v_trip_id
  from public.ride_requests
  where id = p_ride_request_id
    and passenger_id = auth.uid();

  if v_trip_id is null then
    return;
  end if;

  return query
  select u.id, u.full_name, u.avatar_url, t.plate_no, dp.rating_avg, dp.rating_count, dp.verification_status = 'approved'
  from public.trips tr
  join public.users u on u.id = tr.driver_id
  join public.driver_profiles dp on dp.user_id = tr.driver_id
  left join public.tricycles t on t.id = tr.tricycle_id
  where tr.id = v_trip_id;
end $function$;

revoke execute on function public.get_trip_driver_info(uuid) from public, anon;
grant execute on function public.get_trip_driver_info(uuid) to authenticated;
