-- Follow-up to UAT D11 (2026-09-22): get_driver_trip_history was much
-- thinner than get_passenger_trip_history despite reading from the exact
-- same rows (ride_requests/trips/transactions, scoped to the caller's own
-- trips via t.driver_id = auth.uid()) — deferred earlier this session until
-- the live function body could be reviewed; now reviewed via execute_sql
-- and safe to extend (same security model, just more joined columns).
-- Return type changed (new OUT columns), so the old signature must be
-- dropped before recreating it.

drop function if exists public.get_driver_trip_history(integer);

create function public.get_driver_trip_history(p_limit integer default 50)
returns table(
  ride_request_id uuid,
  passenger_name text,
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
    rr.id,
    u.full_name,
    rr.status,
    coalesce(rr.final_fare, rr.estimated_fare),
    rr.completed_at,
    rr.cancelled_at,
    rr.requested_at,
    rr.pickup_label,
    rr.dest_label,
    rr.distance_km,
    case when t.started_at is not null and t.completed_at is not null
      then extract(epoch from (t.completed_at - t.started_at)) / 60.0
      else null end,
    rr.seats_requested,
    tx.method,
    tx.status,
    rr.cancel_reason
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

-- Dropping/recreating the function reset its grants to Postgres defaults,
-- which include an implicit PUBLIC execute grant — revoke it to match the
-- project's existing hardening baseline (get_passenger_trip_history and
-- the other security-definer RPCs have no PUBLIC grant either, per the
-- 2026-09-15 launch audit).
revoke execute on function public.get_driver_trip_history(integer) from public;
grant execute on function public.get_driver_trip_history(integer) to authenticated;
