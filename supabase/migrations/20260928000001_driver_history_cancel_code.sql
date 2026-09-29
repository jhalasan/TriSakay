-- Driver redesign v2, Phase 2 (Trip history): the redesigned cancelled-trip
-- card needs a localizable reason ("Passenger didn't show up", "Vehicle
-- issue", etc.) plus who cancelled, so it can show the passenger-cancel
-- label distinctly from a driver-cancel reason. PD1's migration
-- (20260927000005_pd1_cancellation_policy.sql) already added
-- ride_requests.cancelled_by/cancel_reason_code, but get_driver_trip_history
-- (last touched 20260922000002, before PD1 landed) was never updated to
-- return them — the client only ever saw the free-text `cancel_reason`
-- column, which PD1's RPCs leave null unless a caller explicitly passes
-- free text (the driver app's cancel flow only ever sends a reason code).
--
-- The return column list changes, so Postgres requires DROP + CREATE (not
-- CREATE OR REPLACE) — this resets grants to the default, so the
-- authenticated-only grant is re-applied explicitly below, same as the
-- 20260922000002 migration this one is layered on.

drop function if exists public.get_driver_trip_history(integer);

create function public.get_driver_trip_history(p_limit integer default 50)
returns table(
  ride_request_id uuid,
  passenger_name text,
  passenger_avatar_url text,
  status ride_status,
  fare numeric,
  completed_at timestamptz,
  cancelled_at timestamptz,
  requested_at timestamptz,
  pickup_label text,
  dest_label text,
  distance_km numeric,
  duration_minutes numeric,
  seats smallint,
  payment_method payment_method,
  payment_status payment_status,
  cancel_reason text,
  cancelled_by text,
  cancel_reason_code text
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  return query
  select
    rr.id, u.full_name, u.avatar_url, rr.status,
    coalesce(rr.final_fare, rr.estimated_fare),
    rr.completed_at, rr.cancelled_at, rr.requested_at,
    rr.pickup_label, rr.dest_label, rr.distance_km,
    case when t.started_at is not null and t.completed_at is not null
      then extract(epoch from (t.completed_at - t.started_at)) / 60.0
      else null end,
    rr.seats_requested, tx.method, tx.status, rr.cancel_reason,
    rr.cancelled_by, rr.cancel_reason_code
  from public.ride_requests rr
  join public.trips t on t.id = rr.trip_id
  join public.users u on u.id = rr.passenger_id
  left join public.transactions tx on tx.ride_request_id = rr.id
  where t.driver_id = auth.uid()
    and rr.status in ('completed', 'cancelled')
  order by coalesce(rr.completed_at, rr.cancelled_at, rr.requested_at) desc
  limit p_limit;
end;
$function$;

-- DROP FUNCTION resets Supabase's default privileges too, which grant
-- EXECUTE to anon automatically on newly created functions — revoke that
-- explicitly, not just the PUBLIC grant (same gotcha as
-- 20260915000008_revoke_anon_execute_on_definer_functions.sql).
revoke execute on function public.get_driver_trip_history(integer) from public, anon;
grant execute on function public.get_driver_trip_history(integer) to authenticated;
