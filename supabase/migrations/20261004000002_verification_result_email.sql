-- Email the driver when the PSO decides on their verification.
--
-- perform_verification_decision() already writes an in-app notification of type
-- 'verification_status' (approved, or rejected with each document's reason).
-- This trigger hands that notification to the notify-verification-result edge
-- function, which emails the same text to the driver's account address through
-- Resend. Same pg_net + Vault shared secret pattern as trg_notify_new_message,
-- and like it, a failure here never blocks the decision itself.

create or replace function public.trigger_email_verification_result()
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
    url := 'https://ygdgbvxxqrkxlezpckif.supabase.co/functions/v1/notify-verification-result',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object('notificationId', new.id)
  );
  return new;
exception when others then
  return new;
end;
$$;

revoke execute on function public.trigger_email_verification_result() from public, anon, authenticated;

drop trigger if exists trg_email_verification_result on public.notifications;
create trigger trg_email_verification_result
after insert on public.notifications
for each row
when (new.type = 'verification_status')
execute function public.trigger_email_verification_result();
