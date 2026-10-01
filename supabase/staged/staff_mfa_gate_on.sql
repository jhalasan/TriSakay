-- STAGED, not part of the migration history: move to supabase/migrations/ (as 20261001000003_staff_mfa_gate_on.sql) only when it is time to apply.
-- Switches the staff MFA gate ON. Apply ONLY after an admin has enrolled MFA and signed in with a code on the
-- live portal (so at least one admin session is at aal2) and the sign-in flow has been checked end to end.
--
-- Rollback (run in the SQL editor, takes effect at once):
--   create or replace function public.staff_mfa_enforced() returns boolean language sql immutable as $$ select false $$;
--
-- A lone admin locked out by a lost authenticator is recovered in the Supabase dashboard (Authentication > Users >
-- the user > remove the MFA factor), or with the rollback above.

create or replace function public.staff_mfa_enforced()
returns boolean
language sql
immutable
as $$ select true $$;
