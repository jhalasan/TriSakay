-- P1-22 (2026-09-15 launch audit): listDriversForAdmin()/listPassengersForAdmin()
-- used to fetch every `trips`/`ride_requests` row ever created and tally counts
-- client-side. These two RPCs push the aggregation server-side so the admin
-- driver/passenger lists no longer download the entire history table on every
-- page load.
--
-- Not SECURITY DEFINER: they run as the caller and are still bound by RLS on
-- `trips`/`ride_requests`, exactly like the client-side query they replace.
--
-- NOTE: this migration was originally applied live (as
-- `add_admin_trip_ride_count_aggregates`, 2026-09-15) without ever being
-- written to disk — this file reconstructs it from the live definitions for
-- repo/schema parity. While reconstructing it, a real gap was found and
-- fixed live in the same pass (see below): Postgres grants EXECUTE on a new
-- function to PUBLIC by default, and — unlike the SECURITY DEFINER functions
-- in 20260915000008, which Supabase granted directly to `anon` — these two
-- plain SQL functions were only ever granted to PUBLIC, so
-- `revoke ... from anon` was a silent no-op (verified via pg_proc.proacl:
-- `{=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`,
-- where `=X` denotes the PUBLIC grant). Revoking from PUBLIC and re-granting
-- to `authenticated` explicitly is folded into this file so a fresh apply
-- lands in the same anon-cannot-execute end state that is live now.
create or replace function public.get_driver_trip_counts(p_driver_ids uuid[])
returns table(driver_id uuid, trip_count bigint)
language sql
stable
set search_path to 'public'
as $$
  select t.driver_id, count(*)
  from public.trips t
  where t.driver_id = any(p_driver_ids)
  group by t.driver_id;
$$;

create or replace function public.get_passenger_completed_ride_counts(p_passenger_ids uuid[])
returns table(passenger_id uuid, ride_count bigint)
language sql
stable
set search_path to 'public'
as $$
  select rr.passenger_id, count(*)
  from public.ride_requests rr
  where rr.passenger_id = any(p_passenger_ids)
    and rr.status = 'completed'
  group by rr.passenger_id;
$$;

revoke execute on function public.get_driver_trip_counts(uuid[]) from public;
revoke execute on function public.get_passenger_completed_ride_counts(uuid[]) from public;
grant execute on function public.get_driver_trip_counts(uuid[]) to authenticated;
grant execute on function public.get_passenger_completed_ride_counts(uuid[]) to authenticated;
