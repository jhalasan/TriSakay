-- S1 (team addition, UAT_PANELIST_REVIEW_ADRALES.md): the admin/PSO case-view
-- of a ride's chat thread that C1's own migration (20260929000001_c1_ride_chat)
-- explicitly deferred. ride_messages' RLS is strictly two-party (the ride's
-- passenger and its currently-assigned driver) — this adds the one narrow
-- exception the plan calls for: a PSO account may read a ride's thread only
-- when that ride is already referenced by a complaint or an emergency alert,
-- and every such read is written to a new audit trail (`ride_message_view_log`),
-- mirroring how perform_account_action() atomically authorizes-and-audits in
-- one SECURITY DEFINER call rather than trusting the client to log its own
-- access (L16: "PSO case access with a junk reason" — the reason is required
-- and stored, not merely a client-side prompt).
--
-- Deliberately NOT built here (still future work per the plan's S1 section):
-- the full case-view (route trail, call log, timeline) and the 30-day
-- retention/legal-hold cron. This migration is scoped to the chat-thread
-- slice only.

create table public.ride_message_view_log (
  id uuid not null default gen_random_uuid() primary key,
  ride_request_id uuid not null references public.ride_requests(id) on delete cascade,
  complaint_id uuid references public.complaints(id) on delete set null,
  emergency_alert_id uuid references public.emergency_alerts(id) on delete set null,
  viewed_by uuid not null references public.users(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

create index idx_ride_message_view_log_ride on public.ride_message_view_log (ride_request_id, created_at);

alter table public.ride_message_view_log enable row level security;

-- Same visibility as account_actions (actions_read_pso) — any signed-in PSO
-- account may read the audit trail, not just supervisors; transparency
-- across tiers is the existing convention (see AuditLog.tsx's doc comment).
create policy ride_message_view_log_read_pso on public.ride_message_view_log for select
  using (is_pso());

-- No insert/update/delete policy for any role: the only writer is the
-- SECURITY DEFINER function below, which runs as the function owner and so
-- bypasses RLS entirely — exactly like perform_account_action's insert into
-- account_actions today.

-- Returns a ride's message history to a PSO caller, but only once that ride
-- is linked to a complaint or an emergency alert (the S1 gate), and only
-- after writing an audit row for this specific view. A caller who isn't PSO,
-- or whose reason is blank, or whose ride has no qualifying complaint/alert,
-- gets an exception and no rows — there is no partial/silent-empty result.
create or replace function public.admin_view_ride_messages(p_ride_request_id uuid, p_reason text)
returns setof public.ride_messages
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_complaint_id uuid;
  v_emergency_alert_id uuid;
begin
  if not is_pso() then
    raise exception 'Not authorized.';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to view a ride''s chat thread.';
  end if;

  select id into v_complaint_id from public.complaints where ride_request_id = p_ride_request_id order by created_at desc limit 1;
  select id into v_emergency_alert_id from public.emergency_alerts where ride_request_id = p_ride_request_id order by created_at desc limit 1;

  if v_complaint_id is null and v_emergency_alert_id is null then
    raise exception 'This ride has no linked complaint or emergency alert — its chat thread is not accessible here.';
  end if;

  insert into public.ride_message_view_log (ride_request_id, complaint_id, emergency_alert_id, viewed_by, reason)
  values (p_ride_request_id, v_complaint_id, v_emergency_alert_id, auth.uid(), trim(p_reason));

  return query
    select *
    from public.ride_messages
    where ride_request_id = p_ride_request_id
    order by created_at asc;
end;
$$;

-- Matches the repo-wide convention (20260915000008_revoke_anon_execute_on_definer_functions.sql):
-- a real RPC a signed-in user legitimately calls loses EXECUTE from anon
-- only — the function's own is_pso() check is the actual gate for
-- authenticated callers who aren't PSO.
revoke execute on function public.admin_view_ride_messages(uuid, text) from public;
revoke execute on function public.admin_view_ride_messages(uuid, text) from anon;
grant execute on function public.admin_view_ride_messages(uuid, text) to authenticated;
