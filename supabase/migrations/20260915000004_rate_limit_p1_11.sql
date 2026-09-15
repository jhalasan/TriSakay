-- P1-11 (2026-09-15 launch audit): no rate limiting existed anywhere on
-- ride_requests, complaints, or emergency_alerts inserts, so any of the
-- three could be spammed. Each fix below is scoped to the actual harm
-- without ever blocking a genuine safety-critical action.
--
-- Verified live 2026-09-15 (rolled back): a second concurrent pending
-- ride_request for the same passenger was rejected, while a
-- cancel-then-reinsert succeeded; a second complaint within 10 seconds was
-- rejected; two emergency alerts inserted seconds apart both created their
-- audit row (2 rows), but the notification count went 4 -> 7 -> 7 — the
-- second alert's fan-out (which would have added 3 more, matching the 3
-- PSO accounts) was correctly suppressed while the alert record itself was
-- never blocked.

-- ---------------------------------------------------------------------
-- Emergency alerts: the alert INSERT itself (the audit record) and the
-- client-side 911/PNP dial-out (FR-12.2, entirely independent of this
-- database write) are NEVER throttled — a real emergency must never be
-- silently dropped or delayed. What's throttled is only the PSO
-- notification fan-out: notify_pso_on_emergency() used to insert one
-- notifications row per PSO account on every single insert, so a loop
-- calling triggerEmergencyAlert() could flood the table PSO's live safety
-- dashboard subscribes to and bury a real emergency in noise. A duplicate
-- fan-out is skipped only if the SAME triggering user already has another
-- alert in the last 30 seconds — the alert row itself is still always
-- created and visible in the Emergency Alerts list either way.
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
    format('%s triggered an emergency alert during a ride. Location: %s, %s.',
           initcap(new.triggered_role::text), new.lat, new.lng),
    new.id
  from public.users u
  where u.role in ('pso_staff', 'pso_supervisor', 'admin');
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Complaints: not safety-critical, so a straightforward cooldown is safe.
-- No more than one complaint submission per 10 seconds per submitter —
-- generous enough that no genuine user is ever blocked from filing a real
-- complaint, tight enough to stop a scripted spam loop.
create or replace function public.enforce_complaint_submission_cooldown()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if exists (
    select 1 from public.complaints
    where submitted_by = new.submitted_by
      and created_at > now() - interval '10 seconds'
  ) then
    raise exception 'Please wait a moment before submitting another complaint.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_complaints_submission_cooldown on public.complaints;
create trigger trg_complaints_submission_cooldown
before insert on public.complaints
for each row execute function public.enforce_complaint_submission_cooldown();

-- ---------------------------------------------------------------------
-- Ride requests: cap at one active (pending/assigned/ongoing) request per
-- passenger at a time. This is both an anti-spam measure and a sensible
-- product invariant — nothing in the app UI supports a passenger tracking
-- two simultaneous ride requests, and the matching heuristic assumes one
-- fare/seat count per passenger per trip.
create or replace function public.enforce_one_active_ride_request_per_passenger()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if exists (
    select 1 from public.ride_requests
    where passenger_id = new.passenger_id
      and status in ('pending', 'assigned', 'ongoing')
  ) then
    raise exception 'You already have an active ride request.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ride_requests_one_active_per_passenger on public.ride_requests;
create trigger trg_ride_requests_one_active_per_passenger
before insert on public.ride_requests
for each row execute function public.enforce_one_active_ride_request_per_passenger();
