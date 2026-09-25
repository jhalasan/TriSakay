-- G2 (Google Maps): backs the maps-proxy Edge Function's per-user rate
-- limit (L14 in docs/UAT_PANELIST_REVIEW_ADRALES.md — "60 searches and 20
-- routes per hour"), so a scripted or buggy client can't burn through the
-- shared Google API quota on everyone else's behalf.
--
-- Applied directly against the live database (`supabase db query --linked
-- --file ...`), not `supabase db push` — see the 2026-09-24 note on X0:
-- the live project has migrations this repo doesn't track yet, so a normal
-- push is refused until that's reconciled.

create table public.maps_proxy_usage (
  user_id uuid not null references public.users(id) on delete cascade,
  -- Truncated to the hour, matching the plan's "N per hour" limits — not a
  -- rolling window, a fixed bucket, same trade-off the app's other simple
  -- rate limits (10s/30s complaint and emergency cooldowns) already make.
  usage_hour timestamptz not null,
  places_count integer not null default 0,
  routes_count integer not null default 0,
  primary key (user_id, usage_hour)
);

alter table public.maps_proxy_usage enable row level security;
-- No policies: written only by increment_maps_proxy_usage() below (called
-- by the maps-proxy Edge Function's service-role client, never directly by
-- a user). RLS with zero policies is still default-deny for anon/
-- authenticated, matching this repo's other internal-only tables.

-- p_user_id is an explicit parameter (not auth.uid()) because the caller is
-- the Edge Function's service-role client, which has already verified the
-- real user's JWT itself (same pattern as create-gcash-checkout) before
-- calling this — service-role calls have no JWT session for auth.uid() to
-- read. Returns true when the call should be allowed, false when the
-- caller has hit p_limit for this hour (the Edge Function then falls back
-- to Nominatim/straight-line rather than erroring).
create or replace function public.increment_maps_proxy_usage(p_user_id uuid, p_kind text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_hour timestamptz := date_trunc('hour', now());
  v_count integer;
begin
  if p_kind not in ('places', 'routes') then
    raise exception 'invalid kind: %', p_kind;
  end if;

  insert into public.maps_proxy_usage (user_id, usage_hour, places_count, routes_count)
  values (
    p_user_id,
    v_hour,
    case when p_kind = 'places' then 1 else 0 end,
    case when p_kind = 'routes' then 1 else 0 end
  )
  on conflict (user_id, usage_hour) do update set
    places_count = public.maps_proxy_usage.places_count + case when p_kind = 'places' then 1 else 0 end,
    routes_count = public.maps_proxy_usage.routes_count + case when p_kind = 'routes' then 1 else 0 end
  returning (case when p_kind = 'places' then places_count else routes_count end) into v_count;

  return v_count <= p_limit;
end;
$$;

-- No legitimate direct caller — only the Edge Function's service-role
-- client calls this, same "Category 2" treatment as this repo's other
-- internal-only functions (20260915000008_revoke_anon_execute_on_definer_functions.sql).
--
-- All three REVOKEs are required, confirmed live 2026-09-25: Postgres
-- grants EXECUTE on every newly created function to PUBLIC by default, and
-- `anon`/`authenticated` inherit that as implicit PUBLIC members. Revoking
-- FROM anon, authenticated alone leaves proacl showing `{=X/postgres,...}`
-- — that leading `=` (no role name) IS the PUBLIC grant — so
-- has_function_privilege('anon', ...) still returned true until PUBLIC
-- itself was revoked too. Verified after all three: anon and authenticated
-- both false, service_role still true.
revoke execute on function public.increment_maps_proxy_usage(uuid, text, integer) from anon;
revoke execute on function public.increment_maps_proxy_usage(uuid, text, integer) from authenticated;
revoke execute on function public.increment_maps_proxy_usage(uuid, text, integer) from public;

-- Cheap cleanup — old hourly buckets serve no purpose past their hour.
-- Run daily; keeps the table from growing unbounded.
select cron.schedule(
  'maps-proxy-usage-cleanup-daily',
  '30 3 * * *',
  $$ delete from public.maps_proxy_usage where usage_hour < now() - interval '2 days'; $$
);
