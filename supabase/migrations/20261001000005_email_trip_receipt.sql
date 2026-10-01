-- Email trip receipt (docs/superpowers/specs/2026-10-01-email-trip-receipt-design.md).

-- Passenger consent. Opt-in: a receipt is only emailed automatically when this is true.
alter table public.users add column email_receipts boolean not null default false;

-- Every send attempt. Written only by the send-receipt edge function (service role); clients cannot read or write it.
create table public.receipt_emails (
  id uuid primary key default gen_random_uuid(),
  ride_request_id uuid not null references public.ride_requests(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('auto', 'manual')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

-- One automatic receipt per ride, however many times the completion trigger or a retry fires.
create unique index receipt_emails_one_auto_per_ride on public.receipt_emails (ride_request_id) where kind = 'auto';
create index receipt_emails_user_day on public.receipt_emails (user_id, created_at);

alter table public.receipt_emails enable row level security;
revoke all on public.receipt_emails from public, anon, authenticated;

-- Everything the email needs, for a completed ride. Service role only: the edge function authenticates the
-- caller itself, then reads through this. Returns no phone number and no coordinates.
create or replace function public.get_receipt_for_email(p_ride_request_id uuid)
returns table (
  ride_request_id uuid,
  passenger_id uuid,
  passenger_email text,
  passenger_first_name text,
  email_receipts boolean,
  driver_first_name text,
  plate_no text,
  pickup_label text,
  dest_label text,
  fare numeric,
  seats smallint,
  payment_method payment_method,
  payment_status payment_status,
  completed_at timestamptz,
  distance_km numeric,
  duration_minutes numeric,
  discount_applied boolean,
  discount_percent numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  return query
  select
    rr.id,
    rr.passenger_id,
    p.email,
    p.first_name,
    p.email_receipts,
    d.first_name,
    tr.plate_no,
    rr.pickup_label,
    rr.dest_label,
    coalesce(rr.final_fare, rr.estimated_fare),
    rr.seats_requested,
    tx.method,
    tx.status,
    rr.completed_at,
    rr.distance_km,
    case when t.started_at is not null and t.completed_at is not null
      then extract(epoch from (t.completed_at - t.started_at)) / 60.0
      else null end,
    rr.discount_applied,
    rr.discount_percent
  from public.ride_requests rr
  join public.users p on p.id = rr.passenger_id
  left join public.trips t on t.id = rr.trip_id
  left join public.users d on d.id = t.driver_id
  left join public.tricycles tr on tr.id = t.tricycle_id
  left join public.transactions tx on tx.ride_request_id = rr.id
  where rr.id = p_ride_request_id
    and rr.status = 'completed';
end;
$function$;

revoke execute on function public.get_receipt_for_email(uuid) from public, anon, authenticated;
grant execute on function public.get_receipt_for_email(uuid) to service_role;

-- When a ride completes, ask the edge function to email the receipt, but only for a passenger who agreed.
-- Fire-and-forget through pg_net with the shared Vault secret, like trigger_notify_new_message; a failure here
-- must never block the ride from completing.
create or replace function public.trigger_send_receipt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_secret text;
  v_consent boolean;
begin
  select email_receipts into v_consent from public.users where id = new.passenger_id;
  if not coalesce(v_consent, false) then
    return new;
  end if;

  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_shared_secret';
  if v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://ygdgbvxxqrkxlezpckif.supabase.co/functions/v1/send-receipt',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := jsonb_build_object('rideRequestId', new.id, 'kind', 'auto')
  );
  return new;
exception when others then
  return new;
end;
$$;

revoke execute on function public.trigger_send_receipt() from public, anon, authenticated;

create trigger trg_send_receipt
after update of status on public.ride_requests
for each row
when (new.status = 'completed' and old.status is distinct from 'completed')
execute function public.trigger_send_receipt();
