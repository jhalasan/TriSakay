-- X11: rr_driver_update's real checks are status='pending' + role/active-account
-- on the way in, and status='assigned' + "trip_id belongs to this driver" on
-- the way out — an offline driver, with no active trip in the request's
-- cluster, or one who already declined this exact request, could still claim
-- it by id. F6's accept_ride_request RPC (checks availability, active
-- account, not declined, cluster, seats) doesn't exist yet and is out of
-- scope here, so this hardens the existing direct-UPDATE policy in place
-- instead of removing it, closing the specific gaps the doc names:
--
-- - availability: driver_profiles.is_available wasn't checked at all.
-- - active trip: WITH CHECK only required trip_id to belong to the driver,
--   not that the trip itself was 'active' — a completed/cancelled trip's id
--   would have passed.
-- - cluster: not checked at all. Uses the SAME null-passthrough convention as
--   supabase/functions/match-ride-request/index.ts's isClusterAuthorized(),
--   not the stricter public.is_cluster_authorized() DB function directly —
--   pickup_barangay_id is currently always NULL (no barangay-boundary
--   resolution exists yet, per that Edge Function's own header comment), so
--   the strict function would reject every claim, always.
-- - not declined: a driver who already declined this request (ride_request_declines)
--   could still claim it via direct UPDATE.
--
-- Seat capacity is already enforced independently by the existing
-- enforce_trip_seat_capacity trigger, so it's not duplicated here.

drop policy rr_driver_update on public.ride_requests;
create policy rr_driver_update on public.ride_requests for update
  using (
    status = 'pending'
    and app_current_role() = 'driver'
    and is_account_active()
    and exists (select 1 from driver_profiles dp where dp.user_id = auth.uid() and dp.is_available)
    and not exists (select 1 from ride_request_declines d where d.ride_request_id = ride_requests.id and d.driver_id = auth.uid())
    and exists (
      select 1
      from trips t
      join tricycles tc on tc.id = t.tricycle_id
      left join barangays b on b.id = ride_requests.pickup_barangay_id
      where t.driver_id = auth.uid()
        and t.status = 'active'
        and tc.cluster is not null
        and (b.cluster is null or tc.cluster = b.cluster or (b.cluster = 'melting_pot' and tc.cluster <> 'melting_pot'))
    )
  )
  with check (
    status = 'assigned'
    and trip_id in (select id from trips where driver_id = auth.uid() and status = 'active')
  );
