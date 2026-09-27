-- Y8 (UAT panel, Adrales, existing-system audit): "one active ride" is only
-- checked with an EXISTS query inside a BEFORE INSERT trigger
-- (enforce_one_active_ride_request_per_passenger, 20260915000004) — no
-- unique constraint backs it. Two concurrent inserts for the same passenger
-- (two devices, or a retried request racing the first) can both pass the
-- EXISTS check before either commits, landing two 'pending' rows for the
-- same passenger. The trigger stays (it gives a fast, friendly error on the
-- common single-device case); this index is the actual race-safe backstop —
-- same trips_one_active_per_driver pattern already used for the driver side.
--
-- The predicate covers the same three statuses the trigger checks
-- ('pending','assigned','ongoing'), so it keeps enforcing "at most one" as a
-- request moves through its lifecycle, not just at the moment of insert.
create unique index ride_requests_one_active_per_passenger
  on public.ride_requests (passenger_id)
  where (status in ('pending', 'assigned', 'ongoing'));
