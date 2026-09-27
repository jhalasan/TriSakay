-- R3 follow-up (same day): 20260927000013's speed check skipped entirely
-- when less than 1 second had passed since the last fix ("too short to
-- judge speed from"), to stop ordinary GPS jitter (a few metres in a
-- fraction of a second) from producing an absurd, false-positive speed.
-- Caught live in this migration's own verification: that guard also meant
-- any two updates sent under 1 second apart bypassed the check entirely,
-- so a scripted client hitting the table directly (bypassing the app's own
-- 8-second throttle) could teleport anywhere for free by simply spacing its
-- fake fixes under a second apart.
--
-- Fix: floor the elapsed time at 1 second instead of skipping the check
-- below that floor. Real jitter (a few metres, real dt near zero) still
-- divides by the 1-second floor and stays a low, unremarkable speed. A
-- large jump crammed into a near-zero real interval now divides by that
-- same floor and produces a huge speed, so it's still rejected.
create or replace function public.enforce_driver_location_integrity()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_dt_hours numeric;
  v_speed_kmh numeric;
begin
  if new.current_lat is not null and new.current_lng is not null
     and (new.current_lat is distinct from old.current_lat or new.current_lng is distinct from old.current_lng) then

    if coalesce(new.is_mocked, false) then
      raise exception 'Mock location detected — location updates from a fake-GPS app are rejected';
    end if;

    new.location_updated_at := now();

    if old.current_lat is not null and old.current_lng is not null and old.location_updated_at is not null then
      v_dt_hours := greatest(extract(epoch from (now() - old.location_updated_at)) / 3600.0, 1.0 / 3600.0);
      v_speed_kmh := public.haversine_km(old.current_lat, old.current_lng, new.current_lat, new.current_lng) / v_dt_hours;
      if v_speed_kmh > 80 then
        raise exception 'Location update rejected: implies about % km/h, faster than physically possible for a tricycle', round(v_speed_kmh);
      end if;
    end if;
  end if;

  return new;
end;
$function$;
