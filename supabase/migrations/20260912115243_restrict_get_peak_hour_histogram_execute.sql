-- get_peak_hour_histogram was documented as "safe to expose to any
-- authenticated driver", but Postgres grants EXECUTE to PUBLIC by default
-- on a new function, so an unauthenticated anon caller could also invoke
-- it via PostgREST. Restrict it to match the stated posture.
revoke execute on function public.get_peak_hour_histogram(timestamptz) from public, anon;
grant  execute on function public.get_peak_hour_histogram(timestamptz) to authenticated;
