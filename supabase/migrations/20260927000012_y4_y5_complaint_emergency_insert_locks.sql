-- Y4 (existing-system audit, UAT panel Adrales): `complaints_submit`'s RLS
-- WITH CHECK only verifies submitted_by = auth.uid() — every other column
-- (status, against_user_id, ride_request_id, triaged_by/at, dh_*,
-- mediation_*, resolved_*) is free-form on INSERT. A submitter could open a
-- complaint pre-marked 'resolved', accuse an arbitrary user, or attach it to
-- a ride they were never part of. The existing 10s cooldown
-- (enforce_complaint_submission_cooldown) only throttles spam, it doesn't
-- validate content.
--
-- against_user_id is now always derived server-side from ride_request_id
-- (the submitter's counterpart on that ride) rather than left to the client
-- — note the app's own submitComplaint() never actually set this column
-- before, so this also makes "who a complaint is about" work for the first
-- time, not just lock it down. A complaint with no ride_request_id can't
-- accuse anyone (against_user_id forced null) since there's nothing to
-- derive a counterpart from.
create or replace function public.enforce_complaint_insert_fields()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_passenger_id uuid;
  v_driver_id uuid;
  v_daily_count smallint;
  v_ride_count smallint;
begin
  new.status := 'open';
  new.triaged_by := null;
  new.triaged_at := null;
  new.dh_reviewed_by := null;
  new.dh_reviewed_at := null;
  new.dh_directive := null;
  new.mediation_scheduled_by := null;
  new.mediation_scheduled_at := null;
  new.mediation_meeting_at := null;
  new.mediation_location := null;
  new.resolved_by := null;
  new.resolved_at := null;
  new.resolution_notes := null;

  if new.ride_request_id is not null then
    select rr.passenger_id, t.driver_id into v_passenger_id, v_driver_id
    from public.ride_requests rr
    left join public.trips t on t.id = rr.trip_id
    where rr.id = new.ride_request_id;

    if v_passenger_id is null then
      raise exception 'Ride not found';
    end if;

    if new.submitted_by = v_passenger_id then
      new.against_user_id := v_driver_id;
    elsif v_driver_id is not null and new.submitted_by = v_driver_id then
      new.against_user_id := v_passenger_id;
    else
      raise exception 'You can only file a complaint about a ride you were part of';
    end if;
  else
    new.against_user_id := null;
  end if;

  -- Max 5 complaints/day per user, max 2 per ride — separate from the
  -- existing 10s anti-spam cooldown, which only stops rapid-fire submits.
  select count(*) into v_daily_count
  from public.complaints
  where submitted_by = new.submitted_by and created_at > now() - interval '1 day';

  if v_daily_count >= 5 then
    raise exception 'You have reached the daily limit for complaints. Please try again tomorrow.';
  end if;

  if new.ride_request_id is not null then
    select count(*) into v_ride_count
    from public.complaints
    where ride_request_id = new.ride_request_id and submitted_by = new.submitted_by;

    if v_ride_count >= 2 then
      raise exception 'You already filed the maximum number of complaints for this ride.';
    end if;
  end if;

  return new;
end;
$function$;

create trigger trg_complaints_insert_fields
  before insert on public.complaints
  for each row execute function public.enforce_complaint_insert_fields();

revoke execute on function public.enforce_complaint_insert_fields() from public, anon, authenticated;

-- Extends the existing pso_staff lock (previously only resolution/mediation
-- columns) to also cover complaint content and the dh_* columns — a plain
-- PSO Staff account could otherwise rewrite the complainant's own subject/
-- message, re-target the complaint at a different user, or write a
-- department-head directive directly, impersonating that review step.
create or replace function public.enforce_complaint_supervisor_columns_locked()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if public.app_current_role() = 'pso_staff' and (
    new.status in ('resolved', 'dismissed', 'mediation_scheduled')
    or new.resolved_by is distinct from old.resolved_by
    or new.resolved_at is distinct from old.resolved_at
    or new.resolution_notes is distinct from old.resolution_notes
    or new.mediation_scheduled_by is distinct from old.mediation_scheduled_by
    or new.mediation_scheduled_at is distinct from old.mediation_scheduled_at
    or new.mediation_meeting_at is distinct from old.mediation_meeting_at
    or new.mediation_location is distinct from old.mediation_location
    or new.dh_reviewed_by is distinct from old.dh_reviewed_by
    or new.dh_reviewed_at is distinct from old.dh_reviewed_at
    or new.dh_directive is distinct from old.dh_directive
    or new.subject is distinct from old.subject
    or new.message is distinct from old.message
    or new.category is distinct from old.category
    or new.submitted_by is distinct from old.submitted_by
    or new.against_user_id is distinct from old.against_user_id
    or new.ride_request_id is distinct from old.ride_request_id
  ) then
    raise exception 'PSO Staff cannot rewrite complaint content, re-target it, act as department head, schedule mediation, or record a resolution directly — only a PSO Supervisor or Admin may';
  end if;

  return new;
end;
$function$;

-- Y5: `emergency_insert_own`'s RLS WITH CHECK only verifies
-- triggered_by = auth.uid() — triggered_role, counterpart_id and status are
-- all free-form on INSERT, so a user could falsely accuse an arbitrary
-- counterpart_id or pre-mark their own alert 'reviewed'/'closed' to keep it
-- off PSO's open queue. Same fix shape as the complaints trigger above:
-- derive role/counterpart from the ride (or from the user's own account
-- role when there's no ride_request_id — e.g. a driver in distress while
-- idle), and always force status='logged'.
create or replace function public.enforce_emergency_alert_insert_fields()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_passenger_id uuid;
  v_driver_id uuid;
  v_account_role public.user_role;
begin
  new.status := 'logged';

  if new.ride_request_id is not null then
    select rr.passenger_id, t.driver_id into v_passenger_id, v_driver_id
    from public.ride_requests rr
    left join public.trips t on t.id = rr.trip_id
    where rr.id = new.ride_request_id;

    if v_passenger_id is null then
      raise exception 'Ride not found';
    end if;

    if new.triggered_by = v_passenger_id then
      new.triggered_role := 'passenger';
      new.counterpart_id := v_driver_id;
    elsif v_driver_id is not null and new.triggered_by = v_driver_id then
      new.triggered_role := 'driver';
      new.counterpart_id := v_passenger_id;
    else
      raise exception 'You can only raise an emergency alert for a ride you are part of';
    end if;
  else
    select role into v_account_role from public.users where id = new.triggered_by;
    new.triggered_role := case when v_account_role = 'driver' then 'driver' else 'passenger' end;
    new.counterpart_id := null;
  end if;

  return new;
end;
$function$;

create trigger trg_emergency_insert_fields
  before insert on public.emergency_alerts
  for each row execute function public.enforce_emergency_alert_insert_fields();

revoke execute on function public.enforce_emergency_alert_insert_fields() from public, anon, authenticated;

-- The existing 30s exact-duplicate dedup (v_recent_duplicate) still lets a
-- panicking user re-trigger every 31 seconds — about 2,880/day, all fanned
-- out to every PSO account. The row is still always accepted/logged either
-- way (this is a notify-only throttle, not a write block, matching FR-12's
-- "never let anything here block the real safety action" NFR-4); once a
-- user has 5 alerts logged in the last hour, further alerts that hour are
-- still recorded but stop fanning out new PSO notifications.
create or replace function public.notify_pso_on_emergency()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_recent_duplicate boolean;
  v_hour_count int;
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

  select count(*) into v_hour_count
  from public.emergency_alerts
  where triggered_by = new.triggered_by
    and id <> new.id
    and created_at > new.created_at - interval '1 hour';

  if v_hour_count >= 5 then
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
$function$;

-- "PSO can mark false alarms, which are counted per user" — a plain column
-- rather than a new pipeline: is_supervisor()-gated UPDATE access already
-- exists via emergency_review_supervisor, so no new RLS policy is needed.
-- Counting per user is an ad-hoc `count(*) where triggered_by = x and
-- is_false_alarm` query for whoever reviews repeat offenders (same
-- unautomated pattern as account_actions) — not built as its own feature here.
alter table public.emergency_alerts
  add column if not exists is_false_alarm boolean not null default false;
