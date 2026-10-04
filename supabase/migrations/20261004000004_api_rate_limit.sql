-- A shared per user request limit for edge functions that have no limit of
-- their own (create-gcash-checkout, call-token). Same increment-and-check idea
-- as increment_maps_proxy_usage, but the bucket name and the window length are
-- arguments, so one table and one function serve every function that needs it.
--
-- Only edge functions touch this, through the service role: RLS is on with no
-- policies and every API role is revoked. Rows older than a day are deleted
-- daily.

create table public.api_rate_usage (
  user_id uuid not null,
  bucket text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (user_id, bucket, window_start)
);

alter table public.api_rate_usage enable row level security;
revoke all on table public.api_rate_usage from anon, authenticated, public;

-- Returns true when this request is still inside the limit for its window.
create or replace function public.increment_api_usage(
  p_user_id uuid,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into public.api_rate_usage (user_id, bucket, window_start, request_count)
  values (p_user_id, p_bucket, v_window, 1)
  on conflict (user_id, bucket, window_start)
  do update set request_count = public.api_rate_usage.request_count + 1
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$function$;

revoke execute on function public.increment_api_usage(uuid, text, integer, integer) from public, anon, authenticated;

select cron.schedule(
  'api-rate-usage-cleanup-daily',
  '40 3 * * *',
  $$ delete from public.api_rate_usage where window_start < now() - interval '1 day'; $$
);
