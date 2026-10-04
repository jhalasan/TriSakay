-- Second attempt at "Database error creating new user" when an admin creates a PSO account.
--
-- The previous fix (20261004000006) read the staff role from raw_app_meta_data, but the auth server
-- attaches app_metadata after it has already inserted the user, so the insert trigger still saw a plain
-- user and made a passenger without a phone number (rejected by users_contact_required_for_pax_driver).
--
-- admin-create-pso-user now records the role for the email in pending_staff_accounts (service role only)
-- right before creating the auth user. The insert trigger reads and removes that row, so the user row is
-- created with the staff role in one step. A row only counts for 2 minutes, nothing else can write the
-- table, and public signup still gets 'passenger' or 'driver' only.

create table if not exists public.pending_staff_accounts (
  email text primary key,
  role public.user_role not null check (role in ('pso_staff', 'pso_supervisor', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.pending_staff_accounts enable row level security;
revoke all on public.pending_staff_accounts from public, anon, authenticated;
grant select, insert, update, delete on public.pending_staff_accounts to service_role;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  staff_role public.user_role;
  new_role public.user_role;
begin
  delete from public.pending_staff_accounts
  where lower(email) = lower(new.email)
    and created_at > now() - interval '2 minutes'
  returning role into staff_role;

  -- Leftovers from a creation that failed half way.
  delete from public.pending_staff_accounts where created_at <= now() - interval '2 minutes';

  new_role := case
    when staff_role is not null then staff_role
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
$$;
