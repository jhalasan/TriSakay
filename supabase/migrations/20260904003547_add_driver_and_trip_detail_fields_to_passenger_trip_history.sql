-- Already applied live via MCP apply_migration on 2026-09-04. Recorded here
-- for repo history; this project has no local CLI-managed migration chain
-- (see the note on the neighboring 20260830_add_ride_requests_expires_at.sql).
--
-- Adds driver_rating, plate_no, body_no, seats, and duration_minutes to
-- get_passenger_trip_history's return columns so the passenger app's ride
-- history detail screen can show the driver's rating/plate, seat count, and
-- trip duration without a second round trip. Postgres can't change a
-- function's return row shape in place, hence the drop-and-recreate (same
-- pattern as the prior 20260830084635 migration on this function).

drop function public.get_passenger_trip_history(integer);

create function public.get_passenger_trip_history(p_limit integer default 50)
returns table (
  ride_request_id uuid,
  driver_name     text,
  driver_rating   numeric,
  plate_no        text,
  body_no         text,
  pickup_label    text,
  dest_label      text,
  status          ride_status,
  fare            numeric,
  seats           smallint,
  payment_method  payment_method,
  payment_status  payment_status,
  requested_at    timestamptz,
  completed_at    timestamptz,
  cancelled_at    timestamptz,
  distance_km       numeric,
  duration_minutes  numeric,
  discount_applied  boolean,
  discount_percent  numeric,
  cancel_reason     text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    rr.id,
    u.full_name,
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
$$;
