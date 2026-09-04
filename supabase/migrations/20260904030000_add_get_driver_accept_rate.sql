-- Backs the driver Dashboard's "Accept rate" tile, which previously never
-- had anything computing it (permanently showed "—"). Defined as
-- accepted ÷ (accepted + declined) — an "expired" bucket would need a new
-- per-impression log table (nothing today records that a request was ever
-- shown to a driver who neither accepted nor declined it), which is a
-- separate, materially bigger piece of work, deliberately not built here.
--
-- SECURITY DEFINER + auth.uid() only (no caller-supplied driver id), same
-- shape as get_driver_trip_history() — a driver has no direct RLS read
-- across their own historical trips/ride_requests joined together.
create or replace function public.get_driver_accept_rate()
returns table(accepted_count integer, declined_count integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  return query
  select
    (select count(*)::integer from public.ride_requests rr join public.trips t on t.id = rr.trip_id where t.driver_id = auth.uid()),
    (select count(*)::integer from public.ride_request_declines where driver_id = auth.uid());
end;
$$;
