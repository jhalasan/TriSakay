-- Split public.users.full_name into first_name/last_name so admin reports
-- can format names per official convention (Last, First) instead of
-- parsing a free-text string. full_name becomes a generated column kept
-- for the ~20 read-only call sites that just display a name.

alter table public.users add column first_name text;
alter table public.users add column last_name  text;

-- Best-effort backfill of existing rows: first word -> first_name,
-- remaining word(s) -> last_name. Single-word names get an empty last_name.
update public.users
set
  first_name = split_part(full_name, ' ', 1),
  last_name  = trim(substring(full_name from length(split_part(full_name, ' ', 1)) + 1))
where first_name is null;

alter table public.users alter column first_name set not null;
alter table public.users alter column last_name  set not null;

-- v_flagged_low_ratings selects users.full_name, so it must be dropped
-- before the column and recreated after (definition unchanged).
drop view public.v_flagged_low_ratings;

alter table public.users drop column full_name;

alter table public.users add column full_name text
  generated always as (trim(both ' ' from first_name || ' ' || last_name)) stored;

comment on column public.users.first_name is 'Given name; collected separately from last_name for official-report formatting (Last, First).';
comment on column public.users.last_name  is 'Surname; see first_name.';
comment on column public.users.full_name  is 'Generated from first_name + last_name for display; not directly writable.';

create view public.v_flagged_low_ratings
with (security_invoker = true) as
select
  dp.user_id as driver_id,
  u.full_name,
  dp.rating_avg,
  dp.rating_count
from public.driver_profiles dp
join public.users u on u.id = dp.user_id
cross join lateral (select low_rating_threshold from public.system_settings where is_active limit 1) s
where dp.rating_count >= 5
  and dp.rating_avg < s.low_rating_threshold;

-- Update the signup trigger to populate first_name/last_name instead of full_name.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_role public.user_role;
begin
  new_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'passenger');

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
