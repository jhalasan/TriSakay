-- Y6 (existing-system audit, UAT panel Adrales): PSO staff can read every
-- user's contact_no/email directly (SCHEMA.MD:1562's `users_select_self`
-- policy is `id = auth.uid() OR is_pso()` — row-level only, no column
-- masking). This is only HALF fixed today: `admin_passenger_directory`
-- already exists (a security_invoker view) and already masks contact_no/
-- email behind `is_supervisor()`, returning null for a plain pso_staff
-- caller — but there is no driver-side equivalent. `admin/drivers.ts`,
-- `admin/tricycles.ts` and `admin/verification.ts` all read contact_no/
-- email straight off `public.users`, completely unmasked, so any plain
-- pso_staff account (not just a supervisor) sees them there regardless of
-- the passenger-side fix.
--
-- Column-level REVOKE on users.contact_no/email was considered and
-- rejected: admin_passenger_directory's own masking CASE still requires
-- `authenticated` to hold column-level SELECT on those columns (a
-- security_invoker view's column references are privilege-checked against
-- the invoker regardless of which CASE branch runs), so revoking them would
-- break the passenger view that already works correctly today. Mirroring
-- the exact same view + masking pattern for drivers is the consistent fix,
-- not a column-grant change.
--
-- Row visibility is unaffected: the same `users_select_self` RLS
-- (`id = auth.uid() OR is_pso()`) applies through this view via
-- security_invoker, so a driver querying it only ever sees their own row —
-- exactly as the passenger-side view already behaves for a passenger.
create view public.admin_driver_directory
with (security_invoker = true)
as
select
  id,
  first_name,
  last_name,
  full_name,
  case when is_supervisor() then contact_no else null end as contact_no,
  case when is_supervisor() then email else null end as email,
  status,
  created_at
from public.users
where role = 'driver';
