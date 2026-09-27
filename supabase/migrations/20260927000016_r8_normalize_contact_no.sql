-- R8 (existing-system audit, UAT panel Adrales): `contact_no` already has a
-- UNIQUE constraint (`users_contact_no_unique`) meant to stop the same real
-- phone number backing two accounts, but the format check behind it
-- (`users_contact_format`, `^[0-9+()\-\s]{7,20}$`) is loose enough that
-- '0922 444 4955' and '09224444955' are two DIFFERENT values for the same
-- real number — defeating the point of the unique constraint, and defeating
-- any cooldown/ban logic that ever keys off this column the same way.
--
-- Fix: normalize to digits-only BEFORE either constraint is checked — a
-- BEFORE ROW trigger's edits to NEW land before Postgres validates CHECK/
-- UNIQUE for that row — then tighten the format check to the strict local
-- PH mobile shape the client already validates against
-- (`isValidLocalMobile` in both apps' `src/utils/validation.ts`). Verified
-- live before writing this: every existing non-null contact_no is already
-- bare `09XXXXXXXXX` digits with no punctuation, and the only null rows
-- belong to admin/pso_staff/pso_supervisor accounts — so both new
-- constraints below apply cleanly with zero existing violations.
create or replace function public.normalize_contact_no()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.contact_no is not null then
    new.contact_no := regexp_replace(new.contact_no, '\D', '', 'g');
    if new.contact_no = '' then
      new.contact_no := null;
    end if;
  end if;
  return new;
end;
$function$;

create trigger trg_users_normalize_contact_no
  before insert or update on public.users
  for each row execute function public.normalize_contact_no();

revoke execute on function public.normalize_contact_no() from public, anon, authenticated;

alter table public.users drop constraint users_contact_format;
alter table public.users add constraint users_contact_format
  check (contact_no is null or contact_no ~ '^09\d{9}$');

-- Required for passenger/driver (the roles the app actually collects it
-- from at signup); left optional for pso_staff/pso_supervisor/admin, which
-- don't collect it today — matches the tracker's own "make it required for
-- passengers and drivers" wording rather than a blanket NOT NULL.
alter table public.users add constraint users_contact_required_for_pax_driver
  check (role not in ('passenger', 'driver') or contact_no is not null);
