-- 20260830130000_fix_driver_location_pii_exposure.sql
-- Fixes forward from 20260830120000_live_tracking_and_pickup_confirmation.sql:
-- driver_select_matched_passenger granted a matched passenger SELECT on the
-- driver's ENTIRE driver_profiles row (RLS is row-scoped, not column-scoped),
-- and authenticated already holds table-wide column grants including
-- license_no (real PII) and declared_dest_lat/lng. That let a matched
-- passenger read the driver's license number directly via REST, and shipped
-- it in every Realtime UPDATE payload on that row (~every 8s while tracking).
--
-- Fix: a narrow driver_locations table, kept in sync from driver_profiles via
-- trigger, carrying only the columns a matched passenger's live-tracking
-- subscription actually needs. Chosen over a view because Realtime
-- postgres_changes requires an actual table in the publication (a plain view
-- isn't eligible), and over a SECURITY DEFINER RPC (this codebase's existing
-- pattern for narrow reads, e.g. get_trip_driver_info) because an RPC can't
-- be pushed to over Realtime — only fetched point-in-time. A real table with
-- its own RLS policy is the only option that supports both the initial
-- reconcile fetch and the live subscription.

create table public.driver_locations (
  user_id uuid primary key references public.driver_profiles(user_id) on delete cascade,
  current_lat numeric,
  current_lng numeric,
  location_updated_at timestamptz
);

alter table public.driver_locations enable row level security;

-- Same predicate as the old driver_select_matched_passenger policy on
-- driver_profiles (status = 'assigned' — the passenger app only subscribes
-- to live location while the leg hasn't been picked up yet).
create policy driver_location_select_matched_passenger on public.driver_locations
  for select using (
    exists (
      select 1 from public.ride_requests rr
      join public.trips t on t.id = rr.trip_id
      where t.driver_id = driver_locations.user_id
        and rr.passenger_id = auth.uid()
        and rr.status = 'assigned'
    )
  );

-- Backfill existing rows so the table isn't empty for drivers already online.
insert into public.driver_locations (user_id, current_lat, current_lng, location_updated_at)
select user_id, current_lat, current_lng, location_updated_at from public.driver_profiles
on conflict (user_id) do nothing;

create or replace function public.sync_driver_location()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.driver_locations (user_id, current_lat, current_lng, location_updated_at)
  values (new.user_id, new.current_lat, new.current_lng, new.location_updated_at)
  on conflict (user_id) do update set
    current_lat = excluded.current_lat,
    current_lng = excluded.current_lng,
    location_updated_at = excluded.location_updated_at;
  return new;
end;
$function$;

create trigger trg_driver_profiles_sync_location
  after insert or update on public.driver_profiles
  for each row execute function public.sync_driver_location();

-- Publish the new table for Realtime so subscribeToDriverLocation can
-- postgres_changes-subscribe to it instead of driver_profiles.
alter publication supabase_realtime add table public.driver_locations;

-- The whole point: a matched passenger gets NO base-table access anymore,
-- not even defended by column-level tricks.
drop policy driver_select_matched_passenger on public.driver_profiles;
