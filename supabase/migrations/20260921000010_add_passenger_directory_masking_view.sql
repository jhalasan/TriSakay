-- UAT A7 follow-up (2026-09-21): the first A7 pass only hid contact_no/email
-- from PSO Staff in the admin UI — real closure needs the restriction
-- enforced at the database level, since RLS on public.users is row-level
-- (users_select_self: id = auth.uid() or is_pso()), not column-level, so a
-- technically-inclined Staff user could still fetch the full row directly.
--
-- security_invoker = true (same pattern as v_driver_earnings /
-- v_flagged_low_ratings, 2026-07-31) so the view runs with the CALLER's own
-- privileges/RLS, not the view owner's — defense in depth on top of the
-- explicit is_supervisor() column mask below, not instead of it.

create or replace view public.admin_passenger_directory
with (security_invoker = true) as
select
  id,
  first_name,
  last_name,
  full_name,
  case when public.is_supervisor() then contact_no else null end as contact_no,
  case when public.is_supervisor() then email else null end as email,
  status,
  created_at
from public.users
where role = 'passenger';

comment on view public.admin_passenger_directory is
  'UAT A7 — read path for the admin Passenger Management screen. Masks contact_no/email to null for any caller that is not PSO Supervisor+ (is_supervisor()), at the database level rather than only in the admin UI. Replaces listPassengersForAdmin()''s direct select from public.users.';

grant select on public.admin_passenger_directory to authenticated;
