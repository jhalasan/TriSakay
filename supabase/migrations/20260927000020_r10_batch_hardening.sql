-- R10 (existing-system audit, UAT panel Adrales): backlog batch — several
-- small, independent gaps bundled together since each is a one- or
-- two-function fix, not worth its own migration:
--
--   1. nearby-driver-count could be used to pinpoint a lone driver: an exact
--      count of 1, combined with moving the query point around, lets a
--      caller triangulate that one driver's live location. Now rate-limited
--      per user per hour (same increment-and-check pattern as
--      increment_maps_proxy_usage) and the returned count is rounded up to
--      the nearest 3 so "exactly 1" is never revealed.
--   2. admin-create-pso-user only checked the caller's role, never their
--      account status — a suspended/deactivated admin whose session token
--      hadn't yet expired could still create PSO accounts. Client-side fix,
--      no migration (see the edge function's own diff).
--   3. Cash can be confirmed before the ride is completed: confirmCashPayment
--      is a plain UPDATE gated only by RLS (driver owns the ride + it's a
--      cash row), with no check on the ride's progress at all — a driver
--      could mark cash "received" the instant a ride is assigned, before
--      ever picking the passenger up. The literal fix text ("before the
--      ride is completed") would also block the app's own real UX: the
--      cash-confirm toggle is shown DURING the ride (apps/driver/app/
--      trip/active.tsx renders it for both 'assigned' and 'ongoing'
--      passengers, confirmed then completed as separate steps), not after —
--      requiring `status = 'completed'` outright would break that working
--      flow with no UI redesign to replace it. Scoped instead to the part
--      that's unambiguously wrong: cash can no longer be confirmed before
--      the passenger has actually been picked up (`status in ('ongoing',
--      'completed')`), closing the "never even drove them" fraud case
--      while leaving the existing confirm-then-complete flow intact.
--
-- 1. nearby-driver-count rate limiting -------------------------------------
create table public.nearby_driver_count_usage (
  user_id uuid not null,
  usage_hour timestamptz not null,
  request_count integer not null default 0,
  primary key (user_id, usage_hour)
);

-- No client-facing RLS policy at all, same as maps_proxy_usage — only ever
-- touched via the SECURITY DEFINER function below, called with the
-- service-role client from inside the edge function.
alter table public.nearby_driver_count_usage enable row level security;

create or replace function public.increment_nearby_driver_count_usage(p_user_id uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_hour timestamptz := date_trunc('hour', now());
  v_count integer;
begin
  insert into public.nearby_driver_count_usage (user_id, usage_hour, request_count)
  values (p_user_id, v_hour, 1)
  on conflict (user_id, usage_hour) do update set request_count = public.nearby_driver_count_usage.request_count + 1
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$function$;

revoke execute on function public.increment_nearby_driver_count_usage(uuid, integer) from public, anon, authenticated;

-- Same daily cleanup pattern as maps-proxy-usage-cleanup-daily.
select cron.schedule(
  'nearby-driver-count-usage-cleanup-daily',
  '35 3 * * *',
  $$ delete from public.nearby_driver_count_usage where usage_hour < now() - interval '2 days'; $$
);

-- 3. Cash confirmed only after the ride is actually completed --------------
create or replace function public.enforce_cash_confirm_after_completion()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.method = 'cash' and new.status = 'paid' and old.status is distinct from 'paid' then
    if not exists (
      select 1 from public.ride_requests
      where id = new.ride_request_id and status in ('ongoing', 'completed')
    ) then
      raise exception 'Cannot confirm cash payment before the passenger has been picked up';
    end if;
  end if;

  return new;
end;
$function$;

create trigger trg_cash_confirm_after_completion
  before update on public.transactions
  for each row execute function public.enforce_cash_confirm_after_completion();

revoke execute on function public.enforce_cash_confirm_after_completion() from public, anon, authenticated;
