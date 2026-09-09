-- Admin-created PSO accounts (supabase/functions/admin-create-pso-user) hand
-- out a temp password with no way to force the recipient off it afterward.
-- This flag lets the admin portal gate every route behind a forced
-- password-change screen until the user sets their own password.
--
-- Covered by the existing users_update_self policy (docs/SCHEMA.MD ~1433):
-- it already lets a signed-in user update their own row as long as `role`
-- is unchanged, so no new RLS policy is needed for the user to clear this
-- flag themselves after changing their password.

alter table public.users
  add column must_change_password boolean not null default false;
