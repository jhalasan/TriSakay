-- F5 (UAT panel, Adrales): trip-complete.tsx built its receipt from
-- useBookingStore's local client state instead of the server's ride record.
-- get_passenger_trip_history() already returns everything a receipt needs
-- (driver, plate, fare, distance, payment, discount) but only as a recent-N
-- list with no way to ask for one specific ride. Adding an optional
-- p_ride_request_id narrows it to that one row (still scoped to
-- rr.passenger_id = auth.uid(), same as every other row) without touching
-- the existing list behavior any current caller relies on.
--
-- Signature change requires DROP + CREATE (new parameter = new identity),
-- same as every other return/signature change in this project's history —
-- resets the default grants, so re-applying the authenticated-only grant
-- explicitly below, same as 20260922000002.

drop function if exists public.get_passenger_trip_history(integer);

create function public.get_passenger_trip_history(p_limit integer default 50, p_ride_request_id uuid default null)
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
as $$
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
    and (p_ride_request_id is null or rr.id = p_ride_request_id)
  order by coalesce(rr.completed_at, rr.cancelled_at, rr.requested_at) desc
  limit p_limit;
end;
$$;

revoke execute on function public.get_passenger_trip_history(integer, uuid) from public, anon;
grant execute on function public.get_passenger_trip_history(integer, uuid) to authenticated;
