-- UAT D13 follow-up (2026-09-21): proactive push notification before a
-- driver's document expires. Reuses the same Expo-push infra as
-- notify-drivers-new-request (20260915000005), but is time-triggered via
-- pg_cron rather than row-insert-triggered, since "30 days before
-- expiry_date" has no DB event to hang off. See
-- supabase/functions/notify-expiring-documents/index.ts for the function
-- this schedules.

alter table public.driver_documents add column expiry_notified_at timestamptz;
comment on column public.driver_documents.expiry_notified_at is
  'Set by the notify-expiring-documents Edge Function once a push has been sent for the CURRENT expiry_date. Reset to null whenever expiry_date changes (see updateDriverDocumentExpiry in packages/services), so a renewed document becomes eligible to be notified again on its next expiry.';

select cron.schedule(
  'notify-expiring-driver-documents-daily',
  '0 0 * * *',
  $$
  select net.http_post(
    url := 'https://ygdgbvxxqrkxlezpckif.supabase.co/functions/v1/notify-expiring-documents',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer 59a4b603ca44e480a724b4646a33f6da7094f1803cc2825685f09762a3aa47ae'
    ),
    body := '{}'::jsonb
  );
  $$
);
