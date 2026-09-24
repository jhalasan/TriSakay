-- 2026-09-24: rotates the notify-drivers-new-request / notify-expiring-documents
-- shared secret. The old secret was a literal string committed in
-- 20260915000005_notify_drivers_new_request_trigger.sql and
-- 20260921000007_add_document_expiry_notifications.sql, and this repo is
-- public — anyone could read it off GitHub and call either function
-- directly, bypassing the app.
--
-- The new secret's actual value is NOT in this file. It was stored via
-- `select vault.create_secret(<value>, 'notify_shared_secret', ...)` run
-- out-of-band against the live project, and set as the Edge Functions'
-- NOTIFY_SHARED_SECRET secret via `supabase secrets set`. This migration
-- only repoints the trigger function and the cron job at that Vault entry,
-- looked up by name at call time, so the value never appears in git history
-- again.

create or replace function public.trigger_notify_drivers_new_request()
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
    -- Never block the ride request insert over a missing secret — same
    -- best-effort discipline as the exception handler below.
    return new;
  end if;

  perform net.http_post(
    url := 'https://ygdgbvxxqrkxlezpckif.supabase.co/functions/v1/notify-drivers-new-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object('rideRequestId', new.id)
  );
  return new;
exception when others then
  return new;
end;
$$;

-- Re-point the daily document-expiry cron job at the same Vault lookup.
select cron.unschedule('notify-expiring-driver-documents-daily');

select cron.schedule(
  'notify-expiring-driver-documents-daily',
  '0 0 * * *',
  $$
  select net.http_post(
    url := 'https://ygdgbvxxqrkxlezpckif.supabase.co/functions/v1/notify-expiring-documents',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'notify_shared_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
