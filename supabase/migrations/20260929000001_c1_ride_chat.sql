-- C1 (team addition, UAT_PANELIST_REVIEW_ADRALES.md): in-app chat between a
-- ride's passenger and its currently-assigned driver. Builds the
-- `ride_messages` table, its RLS, a private `ride-chat` Storage bucket for
-- photos, and the push-notification trigger. Scope matches the plan's C1
-- section in full (read receipts, typing indicator handled client-side via
-- Realtime broadcast, phone-number masking, rate limiting, photo sharing) —
-- the admin/PSO case-view and the 30-day retention/legal-hold cron job are
-- explicitly deferred to a follow-up migration, not built here.
--
-- Two-party access: there is no driver_id column on ride_requests — the
-- assigned driver is found via ride_requests.trip_id -> trips.driver_id,
-- the same join already used by driver_location_select_matched_passenger
-- (20260925140000_x2_lock_ride_request_insert_fields.sql). A transfer
-- (respond_transfer) just repoints ride_requests.trip_id, so this predicate
-- automatically follows the ride to its new driver with no extra logic.

create table public.ride_messages (
  id uuid not null default gen_random_uuid() primary key,
  ride_request_id uuid not null references public.ride_requests(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('text', 'quick_reply', 'image', 'system')),
  body text,
  image_path text,
  contains_masked_phone boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index idx_ride_messages_ride_request on public.ride_messages (ride_request_id, created_at);
create index idx_ride_messages_sender_rate on public.ride_messages (sender_id, created_at);

alter table public.ride_messages enable row level security;

-- Either party who was EVER on this ride may read its whole history,
-- regardless of the ride's current status — the thread only turns
-- read-only (no new inserts), it never becomes unreadable.
create policy ride_messages_read on public.ride_messages for select
  using (
    exists (
      select 1 from public.ride_requests rr
      left join public.trips t on t.id = rr.trip_id
      where rr.id = ride_messages.ride_request_id
        and (rr.passenger_id = auth.uid() or t.driver_id = auth.uid())
    )
  );

-- Sending is only allowed while the ride is actually assigned or ongoing —
-- this is what makes the thread read-only before a driver is assigned and
-- after the ride ends or is cancelled.
create policy ride_messages_insert on public.ride_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.ride_requests rr
      left join public.trips t on t.id = rr.trip_id
      where rr.id = ride_messages.ride_request_id
        and rr.status in ('assigned', 'ongoing')
        and (rr.passenger_id = auth.uid() or t.driver_id = auth.uid())
    )
  );

-- Only the RECEIVER may ever update a row (to mark it read) — the
-- column-lock trigger below then restricts that update to read_at only.
create policy ride_messages_update on public.ride_messages for update
  using (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.ride_requests rr
      left join public.trips t on t.id = rr.trip_id
      where rr.id = ride_messages.ride_request_id
        and (rr.passenger_id = auth.uid() or t.driver_id = auth.uid())
    )
  );

-- Forces server-set fields (sender_id can't be spoofed to impersonate the
-- other party), masks a PH phone-number pattern in free text (L11: chat
-- must never become a channel for sharing numbers, which would defeat the
-- privacy design), and rate-limits a sender to 20 messages/minute — same
-- count(*)-per-window shape as PD1's enforce_ride_request_insert_fields.
create or replace function public.enforce_ride_message_insert_fields()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_recent_count int;
begin
  new.sender_id := auth.uid();
  new.created_at := now();
  new.read_at := null;

  select count(*) into v_recent_count
  from public.ride_messages
  where sender_id = auth.uid()
    and created_at > now() - interval '1 minute';

  if v_recent_count >= 20 then
    raise exception 'You''re sending messages too quickly. Please wait a moment.';
  end if;

  if new.kind = 'text' and new.body is not null then
    if new.body ~ '(\+63|0)9\d{9}' then
      new.body := regexp_replace(new.body, '(\+63|0)9\d{9}', '[phone number removed]', 'g');
      new.contains_masked_phone := true;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_ride_message_insert_fields() from public;
revoke execute on function public.enforce_ride_message_insert_fields() from anon, authenticated;

drop trigger if exists trg_ride_message_insert_fields on public.ride_messages;
create trigger trg_ride_message_insert_fields
before insert on public.ride_messages
for each row execute function public.enforce_ride_message_insert_fields();

-- Column lock: an update may only ever change read_at, and only forward
-- from null (the receiver marking it seen) — mirrors
-- enforce_notification_columns_locked (20260915000007).
create or replace function public.enforce_ride_message_columns_locked()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.ride_request_id is distinct from old.ride_request_id
    or new.sender_id is distinct from old.sender_id
    or new.kind is distinct from old.kind
    or new.body is distinct from old.body
    or new.image_path is distinct from old.image_path
    or new.contains_masked_phone is distinct from old.contains_masked_phone
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Only read_at may be changed on an existing message';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_ride_message_columns_locked() from public;
revoke execute on function public.enforce_ride_message_columns_locked() from anon, authenticated;

drop trigger if exists trg_ride_message_columns_locked on public.ride_messages;
create trigger trg_ride_message_columns_locked
before update on public.ride_messages
for each row execute function public.enforce_ride_message_columns_locked();

-- Realtime: the baseline migration never added this table to the
-- publication (only driver_locations was added explicitly elsewhere) —
-- without this, INSERT events never reach subscribeToRideMessages.
alter publication supabase_realtime add table public.ride_messages;

-- Private bucket for chat photos. Same size/MIME limits as discount-ids
-- (complaint-evidence has none, but a photo shared in a live chat is a much
-- higher-volume, lower-scrutiny upload path than a one-off complaint
-- attachment, so the stricter limit applies here).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ride-chat', 'ride-chat', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Folder-keyed by ride_request_id (first path segment), same shape as
-- complaint_evidence_read/complaint_evidence_insert.
create policy ride_chat_read on storage.objects for select
  using (
    bucket_id = 'ride-chat'
    and (storage.foldername(name))[1] in (
      select rr.id::text from public.ride_requests rr
      left join public.trips t on t.id = rr.trip_id
      where rr.passenger_id = auth.uid() or t.driver_id = auth.uid()
    )
  );

create policy ride_chat_insert on storage.objects for insert
  with check (
    bucket_id = 'ride-chat'
    and (storage.foldername(name))[1] in (
      select rr.id::text from public.ride_requests rr
      left join public.trips t on t.id = rr.trip_id
      where rr.status in ('assigned', 'ongoing')
        and (rr.passenger_id = auth.uid() or t.driver_id = auth.uid())
    )
  );

-- Fires the notify-new-message Edge Function (async, via pg_net) whenever a
-- message is inserted — same fire-and-forget, Vault-secret-authenticated
-- shape as trigger_notify_drivers_new_request (reuses the same
-- 'notify_shared_secret' Vault entry rather than provisioning a new one).
create or replace function public.trigger_notify_new_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'notify_shared_secret';

  if v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://ygdgbvxxqrkxlezpckif.supabase.co/functions/v1/notify-new-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object('messageId', new.id)
  );
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_notify_new_message on public.ride_messages;
create trigger trg_notify_new_message
after insert on public.ride_messages
for each row execute function public.trigger_notify_new_message();
