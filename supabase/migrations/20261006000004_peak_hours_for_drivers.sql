-- Let drivers read the peak hours chart again.
--
-- 20261004000005_admin_data_accuracy.sql limited get_peak_hour_histogram to PSO staff while fixing the admin
-- reports. The driver app's Earnings screen calls the same function for its read only "peak hours" chart
-- (packages/services/src/analytics, FR-2.12), so every driver request since then was refused with
-- "Not allowed" (19 refused calls in one day of testing).
--
-- The function only returns 12 counts of completed rides per two hour block, never rows, so it is safe for a
-- driver to read. This keeps it closed to passengers and to anyone who is not signed in: the caller must be
-- an active PSO user or a driver with a profile. The counting itself is unchanged.

create or replace function public.get_peak_hour_histogram(p_since timestamptz)
returns table(bucket_index integer, bucket_count integer)
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  if not coalesce(public.is_account_active(), false) then
    raise exception 'Not allowed';
  end if;

  if not (
    coalesce(public.is_pso(), false)
    or exists (select 1 from public.driver_profiles dp where dp.user_id = auth.uid())
  ) then
    raise exception 'Not allowed';
  end if;

  return query
  select b.bucket_index,
         count(rr.id)::integer
  from generate_series(0, 11) as b(bucket_index)
  left join public.ride_requests rr
    on rr.status = 'completed'
    and coalesce(rr.completed_at, rr.requested_at) >= p_since
    and floor(extract(hour from coalesce(rr.completed_at, rr.requested_at) at time zone 'Asia/Manila') / 2)::integer = b.bucket_index
  group by b.bucket_index
  order by b.bucket_index;
end;
$$;

revoke execute on function public.get_peak_hour_histogram(timestamptz) from public, anon, authenticated;
grant execute on function public.get_peak_hour_histogram(timestamptz) to authenticated;
