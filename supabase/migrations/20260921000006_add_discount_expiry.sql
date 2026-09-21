-- UAT A11: fare discounts had no validity period — once approved, a
-- discount applied forever with no re-verification date. 1 year from
-- approval, per the decided policy default.
alter table public.passenger_discounts add column expires_at timestamptz;

comment on column public.passenger_discounts.expires_at is
  'UAT A11 — set to reviewed_at + 1 year on approval (see approveDiscount() in packages/services). Null for pending/rejected/unsubmitted rows.';

-- compute_fare() previously only checked status = 'approved' — an expired
-- discount (status still 'approved', but past its expires_at) must stop
-- reducing the fare even though nothing flips its status automatically
-- (no scheduler exists in this codebase to do that lazily-checked-at-use is
-- the only enforcement point available without one).
create or replace function public.compute_fare(
  p_distance_km  numeric,
  p_seats        smallint default 1,
  p_passenger_id uuid default null
) returns numeric language plpgsql stable set search_path = public as $$
declare
  cfg  public.fare_config%rowtype;
  base_fare_per_seat numeric;
  total_fare numeric;
  is_eligible boolean;
begin
  select * into cfg from public.fare_config where is_active limit 1;
  if not found then
    raise exception 'No active fare_config row found';
  end if;

  if p_distance_km <= cfg.base_km then
    base_fare_per_seat := cfg.base_fare;
  else
    base_fare_per_seat := cfg.base_fare + ceil(p_distance_km - cfg.base_km) * cfg.rate_per_km;
  end if;

  total_fare := base_fare_per_seat * p_seats;

  if p_passenger_id is not null then
    select exists(
      select 1 from public.passenger_discounts
      where passenger_id = p_passenger_id
        and status = 'approved'
        and (expires_at is null or expires_at > now())
    ) into is_eligible;

    if is_eligible then
      -- Subtract one seat's worth of discount only — the verified
      -- requester's own portion, not the whole group's fare.
      total_fare := total_fare - (base_fare_per_seat * cfg.discount_rate_percent / 100);
    end if;
  end if;

  return round(total_fare, 2);
end $$;
