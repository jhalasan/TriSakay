-- docs/CHECKLIST.MD:59 tracked this as unscheduled since 2026-08-05: the
-- function existed (notify_expiring_franchises(), pinned search_path,
-- EXECUTE revoked from client-facing roles) but pg_cron was never enabled
-- and the job was never scheduled, so the "franchise_expiry_notifications"
-- toggle in System Settings did nothing. F4's verification screen now
-- transcribes mtop_no/mtop_expiry_date (docs/ADMIN_TODO.MD F4), so
-- v_expiring_franchises can actually have rows to notify on.

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'notify-expiring-franchises', '0 8 * * *', 'select public.notify_expiring_franchises();'
);
