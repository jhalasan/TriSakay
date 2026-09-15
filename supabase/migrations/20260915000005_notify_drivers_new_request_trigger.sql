-- P1-12 (2026-09-15 launch audit): fires the notify-drivers-new-request
-- Edge Function (async, via pg_net) whenever a new pending ride_request is
-- inserted, so a backgrounded driver's app can be woken by a push
-- notification rather than only ever finding out via the foreground
-- Realtime board. Fire-and-forget: net.http_post queues the request and
-- returns immediately, so a slow/unreachable Expo push endpoint never
-- blocks or fails the passenger's own ride-request insert.
--
-- Verified live end-to-end 2026-09-15: inserting a real ride_request row
-- produced a row in net._http_response with status_code 200 and content
-- {"sent":0} (0 correctly, since no real push tokens are registered in this
-- pilot dataset yet). A separate direct-curl test against the function
-- confirmed the eligibility query itself finds a real available/verified/
-- capacity-matching driver ({"sent":1} once a driver briefly held a test
-- token, cleaned up immediately after).

create extension if not exists pg_net;

create or replace function public.trigger_notify_drivers_new_request()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform net.http_post(
    url := 'https://ygdgbvxxqrkxlezpckif.supabase.co/functions/v1/notify-drivers-new-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer 59a4b603ca44e480a724b4646a33f6da7094f1803cc2825685f09762a3aa47ae'
    ),
    body := jsonb_build_object('rideRequestId', new.id)
  );
  return new;
exception when others then
  -- Never let a push-notification failure block the ride request itself
  -- from being created — this is best-effort delivery, not a required step.
  return new;
end;
$$;

drop trigger if exists trg_notify_drivers_new_request on public.ride_requests;
create trigger trg_notify_drivers_new_request
after insert on public.ride_requests
for each row
when (new.status = 'pending')
execute function public.trigger_notify_drivers_new_request();
