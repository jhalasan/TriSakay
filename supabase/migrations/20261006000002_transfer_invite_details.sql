-- What an invited driver sees before accepting a transfer.
--
-- The invited driver cannot read the ride yet (ride_requests is only readable by the passenger and the
-- assigned driver), so the prompt could only show the reason text. This function gives that one driver the
-- few facts they need to decide: where to meet the passenger, where the ride goes, the fare, the seats, and
-- how far they are from the meeting point.
--
-- Only the invited driver can read it, only while the invite is still open (status invited and not expired),
-- and it returns place names and numbers, never contact details.
--
-- Output columns have their own names (pickup_place, seats, ride_km ...) so they cannot clash with the table
-- columns inside the query, which is what broke invite_transfer once before.

create or replace function public.get_transfer_invite_details(p_invite_id uuid)
returns table(
  pickup_place text,
  destination_place text,
  seats smallint,
  ride_km numeric,
  fare numeric,
  handoff_after_pickup boolean,
  handoff_km numeric
)
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  if not coalesce(public.is_account_active(), false) then
    raise exception 'Account is not active';
  end if;

  return query
  select
    rr.pickup_label,
    rr.dest_label,
    rr.seats_requested,
    rr.distance_km,
    coalesce(rr.final_fare, rr.estimated_fare),
    rt.after_pickup,
    case
      when dp.current_lat is not null and dp.current_lng is not null
        and rt.handoff_lat is not null and rt.handoff_lng is not null
      then round(public.haversine_km(dp.current_lat, dp.current_lng, rt.handoff_lat, rt.handoff_lng), 1)
    end
  from public.ride_transfers rt
  join public.ride_requests rr on rr.id = rt.ride_request_id
  join public.driver_profiles dp on dp.user_id = rt.to_driver_id
  where rt.id = p_invite_id
    and rt.to_driver_id = auth.uid()
    and rt.status = 'invited'
    and rt.expires_at > now();
end;
$$;

revoke execute on function public.get_transfer_invite_details(uuid) from public, anon, authenticated;
grant execute on function public.get_transfer_invite_details(uuid) to authenticated;
