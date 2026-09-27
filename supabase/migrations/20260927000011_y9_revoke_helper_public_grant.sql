-- Y9 follow-up (same day): driver_has_expired_requirements() was created in
-- 20260927000010 without an explicit revoke — Postgres grants EXECUTE to
-- PUBLIC by default on function creation, so anon/authenticated could call
-- it directly (e.g. via PostgREST's RPC endpoint) and probe an arbitrary
-- driver_id's document/MTOP expiry status. Caught via the same live
-- has_function_privilege check every other function in this project is
-- verified with post-push.
--
-- Revoking authenticated too (not just anon) means
-- enforce_driver_verified_before_available — which is NOT security definer
-- and therefore runs as the driver themselves when they flip is_available —
-- would no longer be able to call this helper from inside its own body: a
-- nested function call still checks EXECUTE against whichever role is
-- currently executing, even though the trigger's own invocation never
-- required EXECUTE on the trigger function itself. Making the trigger
-- function SECURITY DEFINER (same fix PD1's enforce_ride_request_insert_fields
-- needed for the same reason) resolves this: it then runs as the function
-- owner regardless of the calling driver's own grants, so the full
-- public/anon/authenticated revoke on the helper below is safe.
create or replace function public.enforce_driver_verified_before_available()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  has_verified_active_unit boolean;
begin
  if new.is_available and not old.is_available then
    if new.verification_status <> 'approved' then
      raise exception 'Driver % cannot go available: driver verification is not approved', new.user_id;
    end if;

    select exists(
      select 1 from public.tricycles
      where driver_id = new.user_id
        and is_active
        and verification_status = 'approved'
    ) into has_verified_active_unit;

    if not has_verified_active_unit then
      raise exception 'Driver % cannot go available: no active, verified tricycle assigned', new.user_id;
    end if;

    if public.driver_has_expired_requirements(new.user_id) then
      raise exception 'Driver % cannot go available: a required document or the MTOP franchise has expired', new.user_id;
    end if;
  end if;

  return new;
end $function$;

revoke execute on function public.driver_has_expired_requirements(uuid) from public, anon, authenticated;
