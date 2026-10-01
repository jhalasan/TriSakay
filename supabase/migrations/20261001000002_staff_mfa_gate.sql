-- Staff MFA gate. Staff privileges (is_pso / is_supervisor / is_admin) additionally require a session at MFA
-- level (aal2) once enforcement is on, so a stolen staff password alone reads and changes nothing, even through
-- the API. Passengers and drivers are untouched: those helpers are already false for them.
--
-- This migration installs the gate SWITCHED OFF, so nothing changes. It is switched on by a separate migration
-- (20261001000003_staff_mfa_gate_on.sql), only after an admin has enrolled MFA and signed in with a code on the
-- live portal. Switching it back off is the same one-line change:
--   create or replace function public.staff_mfa_enforced() returns boolean language sql immutable as $$ select false $$;
--
-- Not covered, by design: policies that name app_current_role() directly (users_update_self keeps the user's own
-- role; rr_driver_read is driver-only) and column-lock triggers that use it to RESTRICT callers. Edge functions
-- that read users.role (admin-create-pso-user, admin-reset-mfa) check the role themselves; admin-reset-mfa also
-- requires aal2.

create or replace function public.staff_mfa_enforced()
returns boolean
language sql
immutable
as $$ select false $$;

create or replace function public.staff_aal_ok()
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select not public.staff_mfa_enforced() or coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select public.app_current_role() = 'admin' and public.staff_aal_ok();
$$;

create or replace function public.is_pso()
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select public.app_current_role() in ('pso_staff', 'pso_supervisor', 'admin') and public.staff_aal_ok();
$$;

create or replace function public.is_supervisor()
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select public.app_current_role() in ('pso_supervisor', 'admin') and public.staff_aal_ok();
$$;
