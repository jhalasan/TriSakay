-- X4: driver_update_self's WITH CHECK only pins verification_status (and
-- gates is_available behind is_account_active()). rating_avg/rating_count/
-- license_no/verified_by/verified_at are all directly editable by the driver
-- on their own row. E.g. PATCH driver_profiles {rating_avg:5, rating_count:0}
-- wipes a low rating instantly.
--
-- While designing the bypass for this lock, found refresh_driver_rating()
-- (fires on ratings insert/update/delete) is not SECURITY DEFINER, so its
-- internal `UPDATE driver_profiles SET rating_avg=..., rating_count=...`
-- runs as the *invoking passenger's* role — which driver_update_self's own
-- USING clause (user_id = auth.uid()) already rejects today, independent of
-- this migration. Verified live: a raw UPDATE to another driver's
-- rating_avg/rating_count from a random authenticated session affects 0 rows
-- (silently, RLS-filtered, no error). Driver ratings have not actually been
-- refreshing since driver_profiles' RLS was tightened. Fixed here alongside
-- the lock, since the lock needs an explicit bypass for this write anyway —
-- matching the trisakay.allow_fare_write pattern already used by
-- complete_ride_leg (20260830102244) for the equivalent problem on
-- ride_requests.final_fare.

create or replace function public.refresh_driver_rating()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  target uuid := coalesce(new.driver_id, old.driver_id);
begin
  perform set_config('trisakay.allow_rating_write', 'on', true);

  update public.driver_profiles dp
  set rating_avg = coalesce(sub.avg_stars, 0),
      rating_count = coalesce(sub.cnt, 0)
  from (
    select avg(stars)::numeric(3,2) as avg_stars, count(*) as cnt
    from public.ratings where driver_id = target
  ) sub
  where dp.user_id = target;

  return null;
end $function$;

revoke execute on function public.refresh_driver_rating() from public;
revoke execute on function public.refresh_driver_rating() from anon, authenticated;

create or replace function public.enforce_driver_self_columns_locked()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if is_supervisor() or coalesce(current_setting('trisakay.allow_rating_write', true), '') = 'on' then
    return new;
  end if;

  if new.rating_avg is distinct from old.rating_avg
    or new.rating_count is distinct from old.rating_count
    or new.license_no is distinct from old.license_no
    or new.verified_by is distinct from old.verified_by
    or new.verified_at is distinct from old.verified_at
  then
    raise exception 'Cannot modify rating, license number, or verification fields directly';
  end if;

  return new;
end;
$function$;

create trigger trg_driver_self_columns_locked
before update on public.driver_profiles
for each row execute function enforce_driver_self_columns_locked();

revoke execute on function public.enforce_driver_self_columns_locked() from public;
revoke execute on function public.enforce_driver_self_columns_locked() from anon, authenticated;
