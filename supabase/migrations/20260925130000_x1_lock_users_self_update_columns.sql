-- X1: users_update_self's WITH CHECK only pins `role`; every other column,
-- including status and email, was directly editable by any authenticated
-- user on their own row via a raw PATCH. E.g. a suspended user could send
-- PATCH users {status:'active'} to unsuspend themselves, or change their own
-- email.
--
-- WITH CHECK cannot compare NEW vs OLD, so this pairs the existing role lock
-- with a BEFORE UPDATE trigger, following the same pattern as
-- enforce_driver_claim_columns_locked / enforce_notification_columns_locked.
--
-- Two adjustments vs. the doc's literal fix text ("non-admins may change only
-- name, contact number, avatar and push token"), found by checking the live
-- client code before applying:
--
-- 1. must_change_password: packages/services/src/auth/index.ts's
--    clearMustChangePassword() legitimately flips this true -> false after the
--    password-change screen succeeds. Locking it completely would break that
--    flow, so only the false -> true direction is blocked (no legitimate
--    self-service use for that direction).
-- 2. full_name: not a generated column, so it already goes stale after any
--    profile edit via updateProfile() (updates first_name/last_name only) --
--    a real pre-existing bug. Rather than lock it (making the staleness
--    permanent), this migration makes it fully derived via a trigger, so it
--    can never drift from first_name/last_name.

create or replace function public.sync_user_full_name()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.full_name := trim(both ' ' from (new.first_name || ' ' || new.last_name));
  return new;
end;
$function$;

create trigger trg_users_sync_full_name
before insert or update on public.users
for each row execute function sync_user_full_name();

create or replace function public.enforce_user_self_columns_locked()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if not is_pso() and (
    new.status is distinct from old.status
    or new.email is distinct from old.email
    or (new.must_change_password and not old.must_change_password)
  ) then
    raise exception 'Cannot modify status or email directly, or re-set must_change_password';
  end if;
  return new;
end;
$function$;

create trigger trg_users_self_columns_locked
before update on public.users
for each row execute function enforce_user_self_columns_locked();

-- New functions default to EXECUTE granted to PUBLIC, which anon/authenticated
-- inherit; verified live via has_function_privilege() that a plain REVOKE
-- targeting anon/authenticated by name has no effect here (their proacl never
-- listed those roles individually), so PUBLIC must be revoked directly.
-- These are pure trigger functions (RETURNS trigger) with no legitimate direct
-- RPC caller, matching Category 2 of 20260915000008_revoke_anon_execute_on_definer_functions.sql.
revoke execute on function public.sync_user_full_name() from public;
revoke execute on function public.enforce_user_self_columns_locked() from public;
