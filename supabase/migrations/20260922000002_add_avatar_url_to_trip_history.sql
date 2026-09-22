-- Trip history (driver + passenger) never surfaced the other party's
-- avatar_url, even though users.avatar_url exists and is already used
-- elsewhere (get_trip_driver_info, get_trip_passenger_info, DriverInfoCard)
-- for the exact same "other party" relationship during an active trip. Not
-- a deliberate omission — just never added when these RPCs were written.
-- The return column list changes, so Postgres requires DROP + CREATE
-- (not CREATE OR REPLACE) — this resets grants to the default (implicit
-- PUBLIC execute), so both functions' authenticated-only grant is
-- re-applied explicitly below, matching this project's no-PUBLIC-grant
-- baseline (see get_driver_trip_history's original migration).

drop function if exists public.get_driver_trip_history(integer);
drop function if exists public.get_passenger_trip_history(integer);

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
  cancel_reason text
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
    rr.seats_requested, tx.method, tx.status, rr.cancel_reason
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

create function public.get_passenger_trip_history(p_limit integer default 50)
returns table(
  ride_request_id uuid,
  driver_name text,
  driver_avatar_url text,
  driver_rating numeric,
  plate_no text,
  body_no text,
  pickup_label text,
  dest_label text,
  status ride_status,
  fare numeric,
  seats smallint,
  payment_method payment_method,
  payment_status payment_status,
  requested_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  distance_km numeric,
  duration_minutes numeric,
  discount_applied boolean,
  discount_percent numeric,
  cancel_reason text
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  return query
  select
    rr.id,
    u.full_name,
    u.avatar_url,
    dp.rating_avg,
    tr.plate_no,
    tr.body_no,
    rr.pickup_label,
    rr.dest_label,
    rr.status,
    coalesce(rr.final_fare, rr.estimated_fare),
    rr.seats_requested,
    tx.method,
    tx.status,
    rr.requested_at,
    rr.completed_at,
    rr.cancelled_at,
    rr.distance_km,
    case when t.started_at is not null and t.completed_at is not null
      then extract(epoch from (t.completed_at - t.started_at)) / 60.0
      else null end,
    rr.discount_applied,
    rr.discount_percent,
    rr.cancel_reason
  from public.ride_requests rr
  left join public.trips t on t.id = rr.trip_id
  left join public.users u on u.id = t.driver_id
  left join public.driver_profiles dp on dp.user_id = t.driver_id
  left join public.tricycles tr on tr.id = t.tricycle_id
  left join public.transactions tx on tx.ride_request_id = rr.id
  where rr.passenger_id = auth.uid()
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

revoke execute on function public.get_passenger_trip_history(integer) from public, anon;
grant execute on function public.get_passenger_trip_history(integer) to authenticated;
