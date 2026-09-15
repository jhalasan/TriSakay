-- P2 (2026-09-15 launch audit): notif_own was `FOR ALL`, so a signed-in
-- user could forge new notifications for themselves (insert) or destroy
-- their own notification history (delete) via a raw REST call — neither is
-- ever done by client code (verified: packages/services/src/notifications
-- only ever SELECTs and UPDATEs is_read). Real notifications are always
-- created server-side by SECURITY DEFINER triggers/RPCs
-- (notify_pso_on_emergency, perform_verification_decision, etc.), which
-- are unaffected by this since they run with the function owner's
-- privileges, not the caller's RLS-restricted role.
--
-- The UPDATE is also now pinned to `is_read` only, via a companion
-- trigger — the same column-lock pattern already used elsewhere in this
-- migration set — so a user can mark a notification read but can't rewrite
-- its title/message/type/ref_id or reassign it to someone else.
--
-- Verified live 2026-09-15: a legitimate is_read update succeeded; a
-- forged insert, a delete, and a message rewrite were all rejected.
drop policy if exists notif_own on public.notifications;

create policy notif_select_own on public.notifications
  for select using (user_id = auth.uid());

create policy notif_update_own on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.enforce_notification_columns_locked()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.type is distinct from old.type
    or new.title is distinct from old.title
    or new.message is distinct from old.message
    or new.ref_id is distinct from old.ref_id
    or new.user_id is distinct from old.user_id
  then
    raise exception 'Only is_read may be changed on an existing notification';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notification_columns_locked on public.notifications;
create trigger trg_notification_columns_locked
before update on public.notifications
for each row execute function public.enforce_notification_columns_locked();
