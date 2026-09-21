-- UAT (D2/P4): registration accepted duplicate mobile numbers across
-- passenger and driver signup — contact_no only had a format check, no
-- uniqueness constraint. Postgres unique constraints treat each NULL as
-- distinct from every other NULL, so this doesn't block PSO-created accounts
-- that have no phone on file (see admin-create-pso-user).
--
-- This fires inside handle_new_auth_user(), the AFTER INSERT trigger on
-- auth.users, which runs in the same transaction as the Supabase Auth signup
-- itself — a violation here rolls back the whole signup atomically, same as
-- an email collision does today. packages/services/src/auth/index.ts
-- translates the resulting error into a friendly message client-side.
alter table public.users
  add constraint users_contact_no_unique unique (contact_no);
