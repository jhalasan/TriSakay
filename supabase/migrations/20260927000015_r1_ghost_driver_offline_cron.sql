-- R1 (existing-system audit, UAT panel Adrales): a driver who kills the app
-- (rather than tapping "Go offline") stays `is_available = true` forever —
-- nothing ever flips it back. They keep counting as nearby (pre-R2) or, now
-- that R2 requires a fresh `location_updated_at`, simply stop being matched
-- or counted anywhere — but `driver_profiles.is_available` itself, and
-- anything reading it directly (the admin dashboard, the driver's own app
-- on next launch via getDriverAvailability/checkAvailability), still shows
-- them as online indefinitely.
--
-- The other half of R1 ("logout waits for, or queues, the offline write")
-- is already handled: apps/driver/app/logout.tsx awaits setAvailable(false)
-- before calling logout() (the session must still be live for the RLS-
-- scoped write to succeed) — nothing to change there.
--
-- Same "location fix older than 5 minutes" threshold the tracker specifies,
-- and the same plain-function-on-a-schedule pattern already used for
-- cancel_stale_pending_ride_requests/release_expired_transfer_invites.
create or replace function public.mark_ghost_drivers_offline()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.driver_profiles
  set is_available = false
  where is_available
    and (location_updated_at is null or location_updated_at < now() - interval '5 minutes');
end;
$function$;

revoke execute on function public.mark_ghost_drivers_offline() from public, anon, authenticated;

select cron.schedule('mark-ghost-drivers-offline', '* * * * *', 'select public.mark_ghost_drivers_offline();');
