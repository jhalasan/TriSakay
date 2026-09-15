-- P0-0 security fix (2026-09-15 launch audit): restore the signup role
-- allowlist that 20260913084750_split_users_full_name silently reverted.
--
-- That migration rewrote handle_new_auth_user() via CREATE OR REPLACE to
-- populate first_name/last_name instead of full_name, and in doing so
-- dropped the role allowlist added by
-- 20260815115632_restrict_signup_role_to_passenger_or_driver (that file
-- predates this repo's migration history and is not checked in — recovered
-- from supabase_migrations.schema_migrations on the live project). Without
-- the allowlist, raw_user_meta_data (fully client-controlled via the public
-- auth.signUp() endpoint) let any caller self-assign role: 'admin' and
-- fully compromise the system. Live audit on 2026-09-15 confirmed the
-- unguarded version was live; this migration was applied directly via the
-- Supabase MCP first, then checked in here for the historical record.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  new_role public.user_role;
begin
  -- Self-service signup may only ever grant 'passenger' or 'driver'.
  -- raw_user_meta_data is fully client-controlled (any caller of the public
  -- signup API can put arbitrary JSON in it), so pso_staff/pso_supervisor/
  -- admin must never be reachable through it, regardless of what the value
  -- claims to be.
  new_role := case
    when requested_role = 'driver' then 'driver'::public.user_role
    else 'passenger'::public.user_role
  end;

  insert into public.users (id, first_name, last_name, email, role, contact_no)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', 'Unnamed'),
    coalesce(new.raw_user_meta_data->>'last_name', 'User'),
    new.email,
    new_role,
    new.raw_user_meta_data->>'phone'
  );

  if new_role = 'driver' then
    insert into public.driver_profiles (user_id) values (new.id);
  end if;

  return new;
end;
$function$;

comment on function public.handle_new_auth_user() is
  'Provisions public.users (+ driver_profiles for drivers) on auth signup. Only ever grants passenger/driver from client-controlled metadata — pso_staff/pso_supervisor/admin are unreachable via self-service signup by design. Re-fixed 2026-09-15 after 20260913084750_split_users_full_name silently reverted this via CREATE OR REPLACE.';
