-- Creating a PSO account from the admin portal failed with "Database error creating new user".
--
-- admin-create-pso-user creates the auth user first and sets the staff role in a second step, but
-- handle_new_auth_user() always inserts the row as a passenger. Since users_contact_required_for_pax_driver
-- (R8) a passenger needs a phone number, so that first insert is rejected.
--
-- The trigger now reads the role from raw_app_meta_data.staff_role. app_metadata can only be set with the
-- service role key (auth.admin.createUser); the public signup API only writes user_metadata, so this does
-- not open a way to sign up as staff. Self-service signup still gets 'passenger' or 'driver' only.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  staff_role text := new.raw_app_meta_data->>'staff_role';
  new_role public.user_role;
begin
  new_role := case
    when staff_role in ('pso_staff', 'pso_supervisor', 'admin') then staff_role::public.user_role
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
