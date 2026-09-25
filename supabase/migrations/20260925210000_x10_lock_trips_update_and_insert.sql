-- X10: trips_update has no column locking at all (driver_id = auth.uid() on
-- both sides, nothing else) — a driver could mark their own trip completed
-- directly while passengers are still assigned/ongoing on it, stranding them
-- (no way to cancel or rebook once the trip is 'completed').
--
-- Checked packages/services for any legitimate direct client UPDATE to
-- `trips` before locking: there is none. Trip creation is a direct client
-- INSERT (acceptRideRequest, sets status='active'/started_at at creation —
-- legitimate, left alone), and the only place trips.status/completed_at
-- ever change afterward is end_trip() (SECURITY DEFINER RPC, bypasses RLS
-- entirely). So the whole direct-UPDATE policy is unused by the app today —
-- removing it entirely matches the doc's fix ("status, timestamps and
-- tricycle_id change only through RPCs") without needing to carve out an
-- allow-list.
--
-- Also, per the doc: trips_insert never checked the tricycle actually
-- belongs to the inserting driver — a driver could set tricycle_id to a
-- different driver's tricycle.

drop policy trips_update on public.trips;

drop policy trips_insert on public.trips;
create policy trips_insert on public.trips for insert
  with check (
    driver_id = auth.uid()
    and tricycle_id in (select id from tricycles where driver_id = auth.uid())
  );
