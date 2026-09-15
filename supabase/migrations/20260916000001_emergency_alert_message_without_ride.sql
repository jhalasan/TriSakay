-- The passenger app's new Privacy & Safety Center lets a passenger send an
-- SOS to PSO at any time, not just during an active trip (emergency_alerts.
-- ride_request_id has always been nullable and emergency_insert_own's WITH
-- CHECK never required one, so the schema already supported this — only the
-- PSO-facing notification text assumed a ride was always attached, reading
-- "triggered an emergency alert during a ride" even when ride_request_id is
-- null. Branches the wording instead of leaving PSO with a false claim about
-- an in-progress trip that does not exist.
create or replace function public.notify_pso_on_emergency()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_recent_duplicate boolean;
begin
  select exists(
    select 1 from public.emergency_alerts
    where triggered_by = new.triggered_by
      and id <> new.id
      and created_at > new.created_at - interval '30 seconds'
  ) into v_recent_duplicate;

  if v_recent_duplicate then
    return new;
  end if;

  insert into public.notifications (user_id, type, title, message, ref_id)
  select
    u.id,
    'emergency_alert'::notification_type,
    'Emergency alert',
    case
      when new.ride_request_id is not null then
        format('%s triggered an emergency alert during a ride. Location: %s, %s.',
               initcap(new.triggered_role::text), new.lat, new.lng)
      else
        format('%s triggered an emergency alert (no active ride). Location: %s, %s.',
               initcap(new.triggered_role::text), new.lat, new.lng)
    end,
    new.id
  from public.users u
  where u.role in ('pso_staff', 'pso_supervisor', 'admin');
  return new;
end;
$$;
