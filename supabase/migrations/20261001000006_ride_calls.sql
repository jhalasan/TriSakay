-- In-app voice call (docs/superpowers/specs/2026-10-01-voice-call-design.md).
-- Call state lives here; the audio itself goes through Agora and is never recorded. Every change goes through
-- the functions below — clients can only read their own calls.

create table public.ride_calls (
  id uuid primary key default gen_random_uuid(),
  ride_request_id uuid not null references public.ride_requests(id) on delete cascade,
  caller_id uuid not null references public.users(id) on delete cascade,
  callee_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'ringing'
    check (status in ('ringing', 'answered', 'declined', 'cancelled', 'missed', 'ended')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  check (caller_id <> callee_id)
);

-- Backstops for the checks inside start_ride_call (two near-simultaneous calls cannot both get in).
create unique index ride_calls_one_active_per_ride on public.ride_calls (ride_request_id) where status in ('ringing', 'answered');
create unique index ride_calls_one_active_per_caller on public.ride_calls (caller_id) where status in ('ringing', 'answered');
create unique index ride_calls_one_active_per_callee on public.ride_calls (callee_id) where status in ('ringing', 'answered');
create index ride_calls_ride_created on public.ride_calls (ride_request_id, created_at);
create index ride_calls_caller_created on public.ride_calls (caller_id, created_at);

alter table public.ride_calls enable row level security;
create policy ride_calls_read on public.ride_calls for select
  using (caller_id = auth.uid() or callee_id = auth.uid());
revoke all on public.ride_calls from public, anon, authenticated;
grant select on public.ride_calls to authenticated;

alter publication supabase_realtime add table public.ride_calls;

create or replace function public.start_ride_call(p_ride_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_passenger uuid;
  v_driver uuid;
  v_status ride_status;
  v_callee uuid;
  v_id uuid;
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  if not coalesce(public.is_account_active(), false) then
    raise exception 'Your account cannot place calls right now';
  end if;

  select rr.passenger_id, t.driver_id, rr.status
    into v_passenger, v_driver, v_status
  from public.ride_requests rr
  left join public.trips t on t.id = rr.trip_id
  where rr.id = p_ride_request_id;

  if not found then raise exception 'Ride not found'; end if;
  if v_me <> v_passenger and v_me is distinct from v_driver then
    raise exception 'You are not part of this ride';
  end if;
  if v_status not in ('assigned', 'ongoing') then
    raise exception 'Calls are only available during an active ride';
  end if;

  v_callee := case when v_me = v_passenger then v_driver else v_passenger end;
  if v_callee is null then raise exception 'This ride has no driver yet'; end if;

  -- Free rows whose ring window has passed before looking for conflicts, so a stale 'ringing' row never
  -- blocks a new call while the cron job is up to a minute behind.
  update public.ride_calls
  set status = 'missed', ended_at = now(), end_reason = 'no_answer'
  where status = 'ringing'
    and created_at < now() - interval '30 seconds'
    and (ride_request_id = p_ride_request_id or caller_id in (v_me, v_callee) or callee_id in (v_me, v_callee));

  if (select count(*) from public.ride_calls
      where ride_request_id = p_ride_request_id and created_at > now() - interval '1 hour') >= 6 then
    raise exception 'Too many call attempts for this ride. Please try again later';
  end if;
  if (select count(*) from public.ride_calls
      where caller_id = v_me and created_at > now() - interval '1 day') >= 40 then
    raise exception 'Daily call limit reached. Please try again tomorrow';
  end if;

  if exists (select 1 from public.ride_calls
             where status in ('ringing', 'answered') and ride_request_id = p_ride_request_id) then
    raise exception 'A call is already in progress for this ride';
  end if;
  if exists (select 1 from public.ride_calls
             where status in ('ringing', 'answered') and v_me in (caller_id, callee_id)) then
    raise exception 'You are already on another call';
  end if;
  if exists (select 1 from public.ride_calls
             where status in ('ringing', 'answered') and v_callee in (caller_id, callee_id)) then
    raise exception 'The other person is on another call. Please try again in a moment';
  end if;

  begin
    insert into public.ride_calls (ride_request_id, caller_id, callee_id)
    values (p_ride_request_id, v_me, v_callee)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'A call is already in progress for this ride';
  end;

  return v_id;
end;
$function$;

create or replace function public.answer_ride_call(p_call_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  update public.ride_calls c
  set status = 'answered', answered_at = now()
  where c.id = p_call_id
    and c.callee_id = auth.uid()
    and c.status = 'ringing'
    and c.created_at > now() - interval '30 seconds'
    and exists (select 1 from public.ride_requests rr
                where rr.id = c.ride_request_id and rr.status in ('assigned', 'ongoing'));

  if not found then raise exception 'This call is no longer ringing'; end if;
end;
$function$;

create or replace function public.decline_ride_call(p_call_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  update public.ride_calls
  set status = 'declined', ended_at = now(), end_reason = 'declined'
  where id = p_call_id and callee_id = auth.uid() and status = 'ringing';

  if not found then raise exception 'This call is no longer ringing'; end if;
end;
$function$;

create or replace function public.end_ride_call(p_call_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller uuid;
  v_callee uuid;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select caller_id, callee_id, status into v_caller, v_callee, v_status
  from public.ride_calls where id = p_call_id for update;

  if not found or auth.uid() not in (v_caller, v_callee) then raise exception 'Call not found'; end if;
  if v_status not in ('ringing', 'answered') then return; end if;
  if v_status = 'ringing' and auth.uid() <> v_caller then
    raise exception 'Use decline to reject an incoming call';
  end if;

  update public.ride_calls
  set status = case when v_status = 'ringing' then 'cancelled' else 'ended' end,
      ended_at = now(),
      end_reason = case when v_status = 'ringing' then 'cancelled' else 'hung_up' end
  where id = p_call_id;
end;
$function$;

-- Cleanup run every minute by pg_cron (and callable by the service role): stale rings become missed, calls on
-- a ride that is no longer active or whose driver changed are ended, and any call answered over 2 hours ago is
-- ended as a backstop for a phone that vanished without leaving.
create or replace function public.expire_ride_calls()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.ride_calls
  set status = 'missed', ended_at = now(), end_reason = 'no_answer'
  where status = 'ringing' and created_at < now() - interval '30 seconds';

  update public.ride_calls c
  set status = case when c.status = 'ringing' then 'cancelled' else 'ended' end,
      ended_at = now(),
      end_reason = 'ride_changed'
  from public.ride_requests rr
  left join public.trips t on t.id = rr.trip_id
  where c.ride_request_id = rr.id
    and c.status in ('ringing', 'answered')
    and (
      rr.status not in ('assigned', 'ongoing')
      or not (
        (c.caller_id = rr.passenger_id and c.callee_id = t.driver_id)
        or (c.caller_id = t.driver_id and c.callee_id = rr.passenger_id)
      )
    );

  update public.ride_calls
  set status = 'ended', ended_at = now(), end_reason = 'max_duration'
  where status = 'answered' and answered_at < now() - interval '2 hours';
end;
$function$;

-- A call for the apps, with the other person's first name and photo (a passenger cannot read a driver's users
-- row directly). Ages are measured on the server so a phone with a wrong clock still counts the ring window right.
create or replace function public.list_my_active_calls()
returns table (
  id uuid, ride_request_id uuid, caller_id uuid, callee_id uuid, status text, is_caller boolean,
  age_seconds double precision, answered_age_seconds double precision,
  peer_first_name text, peer_avatar_url text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select c.id, c.ride_request_id, c.caller_id, c.callee_id, c.status,
         c.caller_id = auth.uid(),
         extract(epoch from (now() - c.created_at))::double precision,
         case when c.answered_at is null then null else extract(epoch from (now() - c.answered_at))::double precision end,
         p.first_name, p.avatar_url
  from public.ride_calls c
  join public.users p on p.id = case when c.caller_id = auth.uid() then c.callee_id else c.caller_id end
  where c.status in ('ringing', 'answered') and auth.uid() in (c.caller_id, c.callee_id);
$function$;

create or replace function public.get_ride_call(p_call_id uuid)
returns table (
  id uuid, ride_request_id uuid, caller_id uuid, callee_id uuid, status text, is_caller boolean,
  age_seconds double precision, answered_age_seconds double precision,
  peer_first_name text, peer_avatar_url text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select c.id, c.ride_request_id, c.caller_id, c.callee_id, c.status,
         c.caller_id = auth.uid(),
         extract(epoch from (now() - c.created_at))::double precision,
         case when c.answered_at is null then null else extract(epoch from (now() - c.answered_at))::double precision end,
         p.first_name, p.avatar_url
  from public.ride_calls c
  join public.users p on p.id = case when c.caller_id = auth.uid() then c.callee_id else c.caller_id end
  where c.id = p_call_id and auth.uid() in (c.caller_id, c.callee_id);
$function$;

-- Rings the other phone: fire-and-forget through pg_net with the shared Vault secret, like trigger_notify_new_message.
create or replace function public.trigger_notify_incoming_call()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_shared_secret';
  if v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://ygdgbvxxqrkxlezpckif.supabase.co/functions/v1/notify-incoming-call',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := jsonb_build_object('callId', new.id)
  );
  return new;
exception when others then
  return new;
end;
$$;

create trigger trg_notify_incoming_call
after insert on public.ride_calls
for each row
when (new.status = 'ringing')
execute function public.trigger_notify_incoming_call();

revoke execute on function public.start_ride_call(uuid) from public, anon;
revoke execute on function public.answer_ride_call(uuid) from public, anon;
revoke execute on function public.decline_ride_call(uuid) from public, anon;
revoke execute on function public.end_ride_call(uuid) from public, anon;
revoke execute on function public.list_my_active_calls() from public, anon;
revoke execute on function public.get_ride_call(uuid) from public, anon;
revoke execute on function public.expire_ride_calls() from public, anon, authenticated;
revoke execute on function public.trigger_notify_incoming_call() from public, anon, authenticated;
grant execute on function public.start_ride_call(uuid) to authenticated;
grant execute on function public.answer_ride_call(uuid) to authenticated;
grant execute on function public.decline_ride_call(uuid) to authenticated;
grant execute on function public.end_ride_call(uuid) to authenticated;
grant execute on function public.list_my_active_calls() to authenticated;
grant execute on function public.get_ride_call(uuid) to authenticated;

create extension if not exists pg_cron with schema extensions;

select cron.schedule('expire-ride-calls', '* * * * *', 'select public.expire_ride_calls();');
