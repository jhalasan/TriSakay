-- UAT P20: passenger Settings had no account deletion/deactivation option at
-- all. account_status already has a 'deactivated' value and the passenger
-- app already gates on it (app/account-suspended.tsx), but the only path
-- that could ever set it was the PSO-only perform_account_action() RPC
-- (account_actions' actions_flag_staff RLS policy requires is_supervisor()
-- for a 'deactivate' row) — a passenger had no self-service way to close
-- their own account. This adds a narrow, self-scoped RPC: it can only ever
-- touch the caller's own row, only from 'active' status (an already
-- flagged/suspended/deactivated account must go through the PSO office, not
-- this path), and still writes the required account_actions audit row
-- (performed_by = target_user_id, distinguishing it from a PSO-performed
-- deactivation in the audit trail).
create or replace function public.self_deactivate_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status account_status;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select status into v_status from public.users where id = v_uid;

  if v_status is null then
    raise exception 'Account not found';
  end if;

  if v_status <> 'active' then
    raise exception 'This account cannot be self-deactivated from its current status — visit the PSO office.';
  end if;

  update public.users set status = 'deactivated' where id = v_uid;

  insert into public.account_actions (target_user_id, action_type, performed_by, reason)
  values (v_uid, 'deactivate', v_uid, 'Self-service deactivation from the app.');
end;
$$;

revoke execute on function public.self_deactivate_account() from public;
revoke execute on function public.self_deactivate_account() from anon;
grant execute on function public.self_deactivate_account() to authenticated;
