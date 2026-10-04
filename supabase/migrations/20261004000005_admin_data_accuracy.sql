-- Admin portal data accuracy (audit 2026-10-04).
--
-- 1. Reports and charts count COMPLETED rides only. Revenue and average fare come from the
--    rides that finished, not from every paid transaction (cancelled rides had paid cash rows).
-- 2. Report, ride log and transaction lists are built in the database, so a long date range no
--    longer hits the 1,000 row default or a too-long URL.
-- 3. Days are Manila days (the database runs in UTC).
-- 4. A cancelled ride no longer keeps a pending payment.
-- 5. Approving a driver needs the MTOP number, MTOP expiry date and cluster.
-- 6. A driver's trip count counts trips that carried a completed ride.

-- ---------------------------------------------------------------- Manila days

create or replace function public.business_days_since(p_start timestamp with time zone)
returns integer
language sql
stable
set search_path to 'public'
as $$
  select count(*)::int
  from generate_series(
    ((p_start at time zone 'Asia/Manila')::date + 1)::timestamp,
    ((now() at time zone 'Asia/Manila')::date)::timestamp,
    interval '1 day'
  ) d
  where extract(isodow from d) < 6
$$;

create or replace view public.v_expiring_franchises as
select id as tricycle_id,
       driver_id,
       plate_no,
       mtop_no,
       mtop_expiry_date,
       (mtop_expiry_date - (now() at time zone 'Asia/Manila')::date) as days_until_expiry
from public.tricycles t
where is_active = true
  and mtop_expiry_date is not null
  and mtop_expiry_date <= (now() at time zone 'Asia/Manila')::date + 30;

-- ---------------------------------------------------------------- report numbers

create or replace function public.admin_report_summary(p_since timestamptz, p_until timestamptz default null)
returns table (total_rides integer, total_revenue numeric, average_fare numeric)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not coalesce(public.is_pso(), false) then
    raise exception 'Not allowed';
  end if;

  return query
  select count(rr.id)::integer,
         coalesce(sum(tx.amount) filter (where tx.status = 'paid'), 0),
         coalesce(round(avg(coalesce(rr.final_fare, rr.estimated_fare)), 2), 0)
  from public.ride_requests rr
  left join public.transactions tx on tx.ride_request_id = rr.id
  where rr.status = 'completed'
    and coalesce(rr.completed_at, rr.requested_at) >= p_since
    and (p_until is null or coalesce(rr.completed_at, rr.requested_at) < p_until);
end;
$$;

create or replace function public.admin_rides_revenue_daily(p_since timestamptz)
returns table (day date, rides integer, revenue numeric)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not coalesce(public.is_pso(), false) then
    raise exception 'Not allowed';
  end if;

  return query
  select (coalesce(rr.completed_at, rr.requested_at) at time zone 'Asia/Manila')::date as day,
         count(rr.id)::integer,
         coalesce(sum(tx.amount) filter (where tx.status = 'paid'), 0)
  from public.ride_requests rr
  left join public.transactions tx on tx.ride_request_id = rr.id
  where rr.status = 'completed'
    and coalesce(rr.completed_at, rr.requested_at) >= p_since
  group by 1
  order by 1;
end;
$$;

create or replace function public.get_peak_hour_histogram(p_since timestamp with time zone)
returns table (bucket_index integer, bucket_count integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not coalesce(public.is_pso(), false) then
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

-- Ride counts by status for the dashboard donut (rides, not trips).
create or replace function public.admin_ride_status_counts()
returns table (status public.ride_status, ride_count integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not coalesce(public.is_pso(), false) then
    raise exception 'Not allowed';
  end if;

  return query
  select rr.status, count(*)::integer from public.ride_requests rr group by rr.status;
end;
$$;

-- ---------------------------------------------------------------- joined lists

-- One extra row (2001) tells the caller the list was cut at 2,000.
create or replace function public.admin_list_ride_log(p_since timestamptz)
returns table (
  id uuid,
  passenger_name text,
  driver_name text,
  status public.ride_status,
  pickup_label text,
  dest_label text,
  requested_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  final_fare numeric,
  has_emergency_alert boolean,
  fare_flagged boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not coalesce(public.is_pso(), false) then
    raise exception 'Not allowed';
  end if;

  return query
  select rr.id,
         pu.full_name,
         du.full_name,
         rr.status,
         rr.pickup_label,
         rr.dest_label,
         rr.requested_at,
         rr.completed_at,
         rr.cancelled_at,
         rr.final_fare,
         exists (select 1 from public.emergency_alerts ea where ea.ride_request_id = rr.id),
         rr.fare_flagged
  from public.ride_requests rr
  left join public.users pu on pu.id = rr.passenger_id
  left join public.trips t on t.id = rr.trip_id
  left join public.users du on du.id = t.driver_id
  where rr.requested_at >= p_since
  order by rr.requested_at desc
  limit 2001;
end;
$$;

create or replace function public.admin_list_transactions(p_since timestamptz)
returns table (
  id uuid,
  ride_request_id uuid,
  passenger_name text,
  driver_name text,
  amount numeric,
  method public.payment_method,
  status public.payment_status,
  ride_status public.ride_status,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not coalesce(public.is_pso(), false) then
    raise exception 'Not allowed';
  end if;

  return query
  select tx.id,
         tx.ride_request_id,
         pu.full_name,
         du.full_name,
         tx.amount,
         tx.method,
         tx.status,
         rr.status,
         tx.created_at
  from public.transactions tx
  join public.ride_requests rr on rr.id = tx.ride_request_id
  left join public.users pu on pu.id = rr.passenger_id
  left join public.trips t on t.id = rr.trip_id
  left join public.users du on du.id = t.driver_id
  where tx.created_at >= p_since
  order by tx.created_at desc
  limit 2001;
end;
$$;

revoke execute on function public.admin_report_summary(timestamptz, timestamptz) from public, anon;
revoke execute on function public.admin_rides_revenue_daily(timestamptz) from public, anon;
revoke execute on function public.get_peak_hour_histogram(timestamptz) from public, anon;
revoke execute on function public.admin_ride_status_counts() from public, anon;
revoke execute on function public.admin_list_ride_log(timestamptz) from public, anon;
revoke execute on function public.admin_list_transactions(timestamptz) from public, anon;
grant execute on function public.admin_report_summary(timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_rides_revenue_daily(timestamptz) to authenticated;
grant execute on function public.get_peak_hour_histogram(timestamptz) to authenticated;
grant execute on function public.admin_ride_status_counts() to authenticated;
grant execute on function public.admin_list_ride_log(timestamptz) to authenticated;
grant execute on function public.admin_list_transactions(timestamptz) to authenticated;

-- ---------------------------------------------------------------- trips per driver

-- Trips that carried at least one completed ride (a trip that only held cancelled rides is not a trip served).
create or replace function public.get_driver_trip_counts(p_driver_ids uuid[])
returns table (driver_id uuid, trip_count bigint)
language sql
stable
set search_path to 'public'
as $$
  select t.driver_id, count(*)
  from public.trips t
  where t.driver_id = any(p_driver_ids)
    and exists (select 1 from public.ride_requests rr where rr.trip_id = t.id and rr.status = 'completed')
  group by t.driver_id;
$$;

-- ---------------------------------------------------------------- cancelled rides keep no pending payment

create or replace function public.void_pending_payment_on_cancel()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.transactions
  set status = 'failed'
  where ride_request_id = new.id
    and status = 'pending';
  return new;
end;
$$;

revoke execute on function public.void_pending_payment_on_cancel() from public, anon, authenticated;

drop trigger if exists trg_void_pending_payment_on_cancel on public.ride_requests;
create trigger trg_void_pending_payment_on_cancel
after update of status on public.ride_requests
for each row
when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
execute function public.void_pending_payment_on_cancel();

-- Existing cancelled rides that still show a pending payment.
update public.transactions tx
set status = 'failed'
from public.ride_requests rr
where rr.id = tx.ride_request_id
  and rr.status = 'cancelled'
  and tx.status = 'pending';

-- ---------------------------------------------------------------- approval needs the franchise details

create or replace function public.perform_verification_decision(p_driver_id uuid, p_decision verification_status, p_notes text default null::text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_has_rejected boolean;
  v_list text;
  v_message text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not coalesce(public.is_supervisor(), false) then
    raise exception 'Only a PSO Supervisor or Admin may approve or reject a verification case';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  select exists (
    select 1 from public.driver_documents where driver_id = p_driver_id and status = 'rejected'
  ) into v_has_rejected;

  if p_decision = 'approved' and v_has_rejected then
    raise exception 'A document is still marked rejected. Approve it first, or reject the application.';
  end if;

  if p_decision = 'approved' and exists (
    select 1 from public.tricycles
    where driver_id = p_driver_id
      and is_active
      and (coalesce(btrim(mtop_no), '') = '' or mtop_expiry_date is null or cluster is null)
  ) then
    raise exception 'Enter the MTOP number, the MTOP expiry date and the cluster before approving.';
  end if;

  if p_decision = 'rejected' and not v_has_rejected and coalesce(btrim(p_notes), '') = '' then
    raise exception 'Mark at least one document as rejected, or give a reason.';
  end if;

  update public.driver_profiles
  set verification_status = p_decision,
      verified_by = auth.uid(),
      verified_at = now()
  where user_id = p_driver_id;

  update public.tricycles
  set verification_status = p_decision,
      verified_by = auth.uid(),
      verified_at = now()
  where driver_id = p_driver_id
    and is_active;

  if p_decision = 'approved' then
    update public.driver_documents
    set status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        remarks = p_notes
    where driver_id = p_driver_id;
  elsif not v_has_rejected then
    update public.driver_documents
    set status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        remarks = btrim(p_notes)
    where driver_id = p_driver_id;
  end if;

  if p_decision = 'approved' then
    v_message := 'Your driver verification has been approved. You can now go online and accept ride requests.';
  else
    select string_agg(public.driver_document_label(doc_type) || ': ' || remarks, E'\n' order by doc_type)
    into v_list
    from public.driver_documents
    where driver_id = p_driver_id and status = 'rejected' and remarks is not null;

    v_message := 'Your driver verification was rejected.'
      || case when v_list is not null then E'\nPlease replace:\n' || v_list else '' end
      || case when v_has_rejected and coalesce(btrim(p_notes), '') <> '' then E'\nNote: ' || btrim(p_notes) else '' end;
  end if;

  insert into public.notifications (user_id, type, title, message)
  values (
    p_driver_id,
    'verification_status'::notification_type,
    case when p_decision = 'approved' then 'Verification approved' else 'Verification rejected' end,
    v_message
  );
end;
$function$;
