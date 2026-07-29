-- =====================================================================
-- TriSakay — Database Schema (PostgreSQL / Supabase)
-- Capstone: App-Based Smart Fare, Ride-Matching & Monitoring System
-- Barangay Dadiangas West, General Santos City
--
-- Run order: extensions -> enums -> tables -> functions -> triggers
--            -> indexes -> views -> RLS policies -> seed
--
-- Notes:
--  * Relational, normalized (3NF). No JSON blobs used as pseudo-tables.
--  * Fare follows City Ordinance No. 08, s. 2023 (P15 first 4km + P1/km).
--  * Driver live location is OVERWRITTEN, never appended — no GPS trail
--    is persisted (NFR-2.5, privacy-by-design).
--  * No real money is disbursed. transactions record fare COLLECTION only.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "postgis";    -- optional: geographic ops
-- If PostGIS is unavailable, plain numeric lat/lng columns below still work.
-- The matching heuristic uses trigonometry in the Edge Function, so PostGIS
-- is a convenience for radius queries, not a hard requirement.


-- ---------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------
create type user_role as enum (
  'passenger',
  'driver',
  'pso_staff',
  'pso_supervisor',
  'admin'
);

create type account_status as enum (
  'active',
  'flagged',
  'suspended',
  'deactivated'
);

create type verification_status as enum (
  'unsubmitted',
  'pending',
  'approved',
  'rejected'
);

create type document_type as enum (
  'drivers_license',
  'or_cr',
  'franchise_permit',
  'tricycle_photo'
);

create type trip_status as enum (
  'forming',      -- driver selecting from request board, not yet departed
  'active',       -- trip in progress
  'completed',
  'cancelled'
);

create type ride_status as enum (
  'pending',      -- submitted, awaiting a driver
  'assigned',     -- driver selected it pre-trip (reserved seat)
  'ongoing',      -- trip started / passenger picked up
  'completed',
  'cancelled'
);

create type payment_method as enum ('cash', 'gcash');

create type payment_status as enum (
  'pending',
  'paid',
  'failed',
  'refunded'
);

create type complaint_category as enum (
  'fare',
  'conduct',
  'safety',
  'low_rating',
  'vehicle_condition',
  'other'
);

create type complaint_status as enum (
  'open',
  'under_review',
  'escalated',
  'resolved',
  'dismissed'
);

create type account_action_type as enum (
  'flag',
  'unflag',
  'suspend',
  'reactivate',
  'deactivate'
);

create type notification_type as enum (
  'ride_status',
  'verification_status',
  'complaint_status',
  'payment_status'
);


-- ---------------------------------------------------------------------
-- 2. CORE TABLES
-- ---------------------------------------------------------------------

-- 2.1 users -----------------------------------------------------------
-- Mirrors auth.users. Supabase Auth owns credentials; this holds profile
-- and role. Created via trigger on auth.users insert (see section 4).
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text        not null,
  contact_no    text,
  email         text        not null,
  role          user_role   not null default 'passenger',
  status        account_status not null default 'active',
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint users_contact_format check (
    contact_no is null or contact_no ~ '^[0-9+()\-\s]{7,20}$'
  )
);

comment on table  public.users is 'All system users across the three apps; role drives RBAC.';
comment on column public.users.status is 'Set by PSO Supervisor/Admin via account_actions.';


-- 2.2 driver_profiles -------------------------------------------------
-- 1:1 with users where role = 'driver'.
-- Live location fields are OVERWRITTEN on each update, never appended.
create table public.driver_profiles (
  user_id             uuid primary key references public.users(id) on delete cascade,
  license_no          text unique,
  verification_status verification_status not null default 'unsubmitted',
  verified_by         uuid references public.users(id) on delete set null,
  verified_at         timestamptz,

  -- Availability + transient location (privacy: overwritten, not logged)
  is_available        boolean not null default false,
  current_lat         numeric(9,6),
  current_lng         numeric(9,6),
  declared_dest_lat   numeric(9,6),
  declared_dest_lng   numeric(9,6),
  location_updated_at timestamptz,

  -- Denormalized rating aggregate (maintained by trigger, see section 4)
  rating_avg          numeric(3,2) not null default 0.00,
  rating_count        integer      not null default 0,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint driver_lat_range check (current_lat is null or current_lat between -90 and 90),
  constraint driver_lng_range check (current_lng is null or current_lng between -180 and 180),
  constraint driver_rating_range check (rating_avg between 0 and 5)
);

comment on column public.driver_profiles.current_lat is
  'Transient. Cleared when driver goes offline. No historical trail is kept (NFR-2.5).';


-- 2.3 tricycles -------------------------------------------------------
-- Separate from driver_profiles: PSO verifies driver AND unit separately
-- (FR-1.5), and a driver may change units over time.
create table public.tricycles (
  id                  uuid primary key default gen_random_uuid(),
  driver_id           uuid not null references public.driver_profiles(user_id) on delete cascade,
  plate_no            text not null unique,
  body_no             text,
  cluster_color       text,          -- white / apple green / red (Ord. 08 s.2023)
  seat_capacity       smallint not null default 6,
  verification_status verification_status not null default 'unsubmitted',
  verified_by         uuid references public.users(id) on delete set null,
  verified_at         timestamptz,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint tricycle_seat_range check (seat_capacity between 1 and 6)
);

-- A driver may only have ONE active unit at a time.
create unique index tricycles_one_active_per_driver
  on public.tricycles (driver_id)
  where is_active;


-- 2.4 driver_documents ------------------------------------------------
create table public.driver_documents (
  id            uuid primary key default gen_random_uuid(),
  driver_id     uuid not null references public.driver_profiles(user_id) on delete cascade,
  tricycle_id   uuid references public.tricycles(id) on delete cascade,
  doc_type      document_type not null,
  storage_path  text not null,          -- Supabase Storage object path
  status        verification_status not null default 'pending',
  reviewed_by   uuid references public.users(id) on delete set null,
  reviewed_at   timestamptz,
  remarks       text,
  created_at    timestamptz not null default now(),

  -- Vehicle docs must be tied to a unit; driver docs must not be.
  constraint doc_target_consistency check (
    (doc_type = 'drivers_license' and tricycle_id is null)
    or (doc_type <> 'drivers_license' and tricycle_id is not null)
  )
);

-- Only one live copy of each doc type per driver/unit.
create unique index driver_documents_unique_current
  on public.driver_documents (driver_id, coalesce(tricycle_id, '00000000-0000-0000-0000-000000000000'::uuid), doc_type);


-- 2.5 trips -----------------------------------------------------------
-- One tricycle journey. Holds MANY ride_requests (shared/pooled rides).
create table public.trips (
  id                uuid primary key default gen_random_uuid(),
  driver_id         uuid not null references public.driver_profiles(user_id) on delete restrict,
  tricycle_id       uuid not null references public.tricycles(id) on delete restrict,
  status            trip_status not null default 'forming',

  -- Direction locked at departure; used by the mid-trip matching heuristic.
  origin_lat        numeric(9,6),
  origin_lng        numeric(9,6),
  declared_dest_lat numeric(9,6),
  declared_dest_lng numeric(9,6),
  max_seats         smallint not null default 6,

  started_at        timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint trip_max_seats_range check (max_seats between 1 and 6),
  constraint trip_timestamps_order check (
    completed_at is null or started_at is null or completed_at >= started_at
  )
);


-- 2.6 ride_requests ---------------------------------------------------
-- One passenger's booking. Attaches to a trip when a driver takes it.
create table public.ride_requests (
  id                uuid primary key default gen_random_uuid(),
  passenger_id      uuid not null references public.users(id) on delete restrict,
  trip_id           uuid references public.trips(id) on delete set null,

  pickup_lat        numeric(9,6) not null,
  pickup_lng        numeric(9,6) not null,
  pickup_label      text,
  dest_lat          numeric(9,6) not null,
  dest_lng          numeric(9,6) not null,
  dest_label        text,

  seats_requested   smallint not null default 1,
  distance_km       numeric(6,2),
  estimated_fare    numeric(8,2),
  final_fare        numeric(8,2),

  status            ride_status not null default 'pending',
  preferred_method  payment_method not null default 'cash',

  requested_at      timestamptz not null default now(),
  assigned_at       timestamptz,
  picked_up_at      timestamptz,
  completed_at      timestamptz,
  cancelled_at      timestamptz,
  cancel_reason     text,

  constraint rr_seats_range check (seats_requested between 1 and 6),
  constraint rr_fare_nonneg  check (
    (estimated_fare is null or estimated_fare >= 0)
    and (final_fare is null or final_fare >= 0)
  ),
  -- Any non-pending, non-cancelled request must belong to a trip.
  constraint rr_trip_required check (
    status in ('pending','cancelled') or trip_id is not null
  )
);

comment on column public.ride_requests.final_fare is
  'Locked at trip completion (FR-3.3); estimated_fare is pre-ride only.';


-- 2.7 transactions ----------------------------------------------------
-- Fare COLLECTION only. No disbursement/payout of any kind (FR-9.6).
create table public.transactions (
  id                uuid primary key default gen_random_uuid(),
  ride_request_id   uuid not null unique references public.ride_requests(id) on delete restrict,
  amount            numeric(8,2) not null,
  method            payment_method not null,
  status            payment_status not null default 'pending',

  -- GCash path: set by the gcash-webhook Edge Function only.
  gcash_reference   text unique,
  gcash_payload     jsonb,

  -- Cash path: driver must confirm receipt (FR-9.9).
  cash_confirmed_by uuid references public.users(id) on delete set null,
  cash_confirmed_at timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint txn_amount_nonneg check (amount >= 0),
  -- Cash cannot be marked paid without an explicit driver confirmation.
  constraint txn_cash_needs_confirmation check (
    method <> 'cash' or status <> 'paid' or cash_confirmed_by is not null
  ),
  -- GCash cannot be marked paid without a gateway reference.
  constraint txn_gcash_needs_reference check (
    method <> 'gcash' or status <> 'paid' or gcash_reference is not null
  )
);


-- 2.8 ratings ---------------------------------------------------------
-- One-directional: passenger rates driver only (FR-10).
create table public.ratings (
  id              uuid primary key default gen_random_uuid(),
  ride_request_id uuid not null unique references public.ride_requests(id) on delete cascade,
  passenger_id    uuid not null references public.users(id) on delete cascade,
  driver_id       uuid not null references public.driver_profiles(user_id) on delete cascade,
  stars           smallint not null,
  comment         text,
  created_at      timestamptz not null default now(),

  constraint rating_stars_range check (stars between 1 and 5)
);


-- ---------------------------------------------------------------------
-- 3. SUPPORT TABLES
-- ---------------------------------------------------------------------

-- 3.1 complaints ------------------------------------------------------
create table public.complaints (
  id                uuid primary key default gen_random_uuid(),
  submitted_by      uuid not null references public.users(id) on delete cascade,
  against_user_id   uuid references public.users(id) on delete set null,
  ride_request_id   uuid references public.ride_requests(id) on delete set null,
  category          complaint_category not null default 'other',
  subject           text not null,
  message           text not null,
  status            complaint_status not null default 'open',

  triaged_by        uuid references public.users(id) on delete set null,
  triaged_at        timestamptz,
  resolved_by       uuid references public.users(id) on delete set null,
  resolved_at       timestamptz,
  resolution_notes  text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint complaint_not_self check (
    against_user_id is null or against_user_id <> submitted_by
  )
);


-- 3.2 account_actions -------------------------------------------------
-- Audit trail for UC36 (flag) and UC39 (suspend/deactivate).
-- Every status change on public.users must leave a row here.
create table public.account_actions (
  id             uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.users(id) on delete cascade,
  action_type    account_action_type not null,
  performed_by   uuid not null references public.users(id) on delete restrict,
  reason         text not null,
  complaint_id   uuid references public.complaints(id) on delete set null,
  created_at     timestamptz not null default now()
);

comment on table public.account_actions is
  'Immutable audit log. Never UPDATE or DELETE rows here — append a reversing action instead.';


-- 3.3 fare_config -----------------------------------------------------
-- Versioned so an ordinance amendment does not destroy historical basis.
create table public.fare_config (
  id            uuid primary key default gen_random_uuid(),
  base_fare     numeric(6,2) not null,   -- 15.00
  base_km       numeric(4,2) not null,   -- 4.00
  rate_per_km   numeric(6,2) not null,   -- 1.00
  ordinance_ref text,                    -- 'City Ordinance No. 08, s. 2023'
  effective_from timestamptz not null default now(),
  is_active     boolean not null default true,
  updated_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),

  constraint fare_values_positive check (
    base_fare >= 0 and base_km > 0 and rate_per_km >= 0
  )
);

create unique index fare_config_one_active on public.fare_config (is_active) where is_active;


-- 3.4 system_settings -------------------------------------------------
-- Matching heuristic thresholds (FR-2.5) — tunable after data gathering.
create table public.system_settings (
  id                    uuid primary key default gen_random_uuid(),
  bearing_tolerance_deg numeric(5,2) not null default 40.00,
  detour_ratio_max      numeric(4,2) not null default 1.25,
  search_radius_km      numeric(5,2) not null default 3.00,
  low_rating_threshold  numeric(3,2) not null default 3.00,
  is_active             boolean not null default true,
  updated_by            uuid references public.users(id) on delete set null,
  updated_at            timestamptz not null default now(),

  constraint settings_bearing_range check (bearing_tolerance_deg between 0 and 180),
  constraint settings_detour_range  check (detour_ratio_max >= 1),
  constraint settings_rating_range  check (low_rating_threshold between 1 and 5)
);

create unique index system_settings_one_active on public.system_settings (is_active) where is_active;

comment on column public.system_settings.bearing_tolerance_deg is
  'Provisional default. Final value pending PSO/driver data gathering.';


-- 3.5 notifications ---------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  type        notification_type not null,
  title       text not null,
  message     text not null,
  ref_id      uuid,                     -- ride_request / complaint / txn id
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 4. FUNCTIONS & TRIGGERS
-- ---------------------------------------------------------------------

-- 4.1 updated_at maintenance -----------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_users_touch          before update on public.users            for each row execute function public.touch_updated_at();
create trigger trg_driver_touch         before update on public.driver_profiles  for each row execute function public.touch_updated_at();
create trigger trg_tricycles_touch      before update on public.tricycles        for each row execute function public.touch_updated_at();
create trigger trg_trips_touch          before update on public.trips            for each row execute function public.touch_updated_at();
create trigger trg_transactions_touch   before update on public.transactions     for each row execute function public.touch_updated_at();
create trigger trg_complaints_touch     before update on public.complaints       for each row execute function public.touch_updated_at();


-- 4.2 auto-create public.users row on signup --------------------------
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Unnamed User'),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'passenger')
  );
  return new;
end $$;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();


-- 4.3 fare computation (Ordinance No. 08, s. 2023) --------------------
-- P15 for the first 4 km, +P1 per succeeding km, per passenger seat.
create or replace function public.compute_fare(
  p_distance_km numeric,
  p_seats       smallint default 1
) returns numeric language plpgsql stable as $$
declare
  cfg  public.fare_config%rowtype;
  per_passenger numeric;
begin
  select * into cfg from public.fare_config where is_active limit 1;
  if not found then
    raise exception 'No active fare_config row found';
  end if;

  if p_distance_km <= cfg.base_km then
    per_passenger := cfg.base_fare;
  else
    per_passenger := cfg.base_fare + ceil(p_distance_km - cfg.base_km) * cfg.rate_per_km;
  end if;

  return round(per_passenger * p_seats, 2);
end $$;


-- 4.4 seat capacity enforcement ---------------------------------------
-- Total seats across a trip's live requests must not exceed max_seats.
create or replace function public.enforce_trip_seat_capacity()
returns trigger language plpgsql as $$
declare
  taken   integer;
  allowed smallint;
begin
  if new.trip_id is null or new.status in ('pending','cancelled','completed') then
    return new;
  end if;

  select max_seats into allowed from public.trips where id = new.trip_id;

  select coalesce(sum(seats_requested), 0) into taken
  from public.ride_requests
  where trip_id = new.trip_id
    and status in ('assigned','ongoing')
    and id <> new.id;

  if taken + new.seats_requested > allowed then
    raise exception 'Seat capacity exceeded for trip % (% taken, % requested, % allowed)',
      new.trip_id, taken, new.seats_requested, allowed;
  end if;

  return new;
end $$;

create trigger trg_ride_requests_seat_cap
  before insert or update on public.ride_requests
  for each row execute function public.enforce_trip_seat_capacity();


-- 4.5 rating aggregate maintenance ------------------------------------
create or replace function public.refresh_driver_rating()
returns trigger language plpgsql as $$
declare
  target uuid := coalesce(new.driver_id, old.driver_id);
begin
  update public.driver_profiles dp
  set rating_avg = coalesce(sub.avg_stars, 0),
      rating_count = coalesce(sub.cnt, 0)
  from (
    select avg(stars)::numeric(3,2) as avg_stars, count(*) as cnt
    from public.ratings where driver_id = target
  ) sub
  where dp.user_id = target;

  return null;
end $$;

create trigger trg_ratings_refresh
  after insert or update or delete on public.ratings
  for each row execute function public.refresh_driver_rating();


-- 4.6 rating may only be submitted for one's own completed ride -------
create or replace function public.validate_rating()
returns trigger language plpgsql as $$
declare
  rr public.ride_requests%rowtype;
begin
  select * into rr from public.ride_requests where id = new.ride_request_id;

  if rr.passenger_id <> new.passenger_id then
    raise exception 'Rating must be submitted by the ride''s own passenger';
  end if;
  if rr.status <> 'completed' then
    raise exception 'Cannot rate a ride that is not completed';
  end if;

  return new;
end $$;

create trigger trg_ratings_validate
  before insert on public.ratings
  for each row execute function public.validate_rating();


-- 4.7 clear location when driver goes offline (privacy) ---------------
create or replace function public.clear_location_when_offline()
returns trigger language plpgsql as $$
begin
  if new.is_available = false then
    new.current_lat := null;
    new.current_lng := null;
    new.declared_dest_lat := null;
    new.declared_dest_lng := null;
    new.location_updated_at := null;
  end if;
  return new;
end $$;

create trigger trg_driver_clear_location
  before update on public.driver_profiles
  for each row execute function public.clear_location_when_offline();


-- ---------------------------------------------------------------------
-- 5. INDEXES
-- ---------------------------------------------------------------------
create index idx_users_role                on public.users (role);
create index idx_users_status              on public.users (status);

-- Hot path: matching queries only ever scan available, verified drivers.
create index idx_driver_available          on public.driver_profiles (is_available)
  where is_available;
create index idx_driver_verification       on public.driver_profiles (verification_status);
create index idx_driver_location           on public.driver_profiles (current_lat, current_lng)
  where is_available;

create index idx_tricycles_driver          on public.tricycles (driver_id);
create index idx_documents_driver          on public.driver_documents (driver_id);
create index idx_documents_status          on public.driver_documents (status)
  where status = 'pending';

create index idx_trips_driver              on public.trips (driver_id);
create index idx_trips_status              on public.trips (status) where status = 'active';

create index idx_rr_passenger              on public.ride_requests (passenger_id);
create index idx_rr_trip                   on public.ride_requests (trip_id);
create index idx_rr_pending                on public.ride_requests (status) where status = 'pending';
create index idx_rr_requested_at           on public.ride_requests (requested_at desc);

create index idx_txn_status                on public.transactions (status);
create index idx_ratings_driver            on public.ratings (driver_id);

create index idx_complaints_status         on public.complaints (status);
create index idx_complaints_against        on public.complaints (against_user_id);
create index idx_actions_target            on public.account_actions (target_user_id);

create index idx_notifications_unread      on public.notifications (user_id, is_read)
  where not is_read;


-- ---------------------------------------------------------------------
-- 6. VIEWS
-- ---------------------------------------------------------------------

-- 6.1 driver earnings — DERIVED, not stored.
-- Reinforces that no payout balance is held anywhere in the system.
create or replace view public.v_driver_earnings as
select
  t.driver_id,
  date_trunc('day', rr.completed_at) as earning_date,
  count(distinct rr.id)              as rides_completed,
  sum(txn.amount)                    as total_collected
from public.trips t
join public.ride_requests rr on rr.trip_id = t.id and rr.status = 'completed'
join public.transactions txn on txn.ride_request_id = rr.id and txn.status = 'paid'
group by t.driver_id, date_trunc('day', rr.completed_at);

comment on view public.v_driver_earnings is
  'Informational only. TriSakay never disburses funds (FR-9.6).';


-- 6.2 drivers whose rating fell below threshold (UC44) -----------------
create or replace view public.v_flagged_low_ratings as
select
  dp.user_id as driver_id,
  u.full_name,
  dp.rating_avg,
  dp.rating_count
from public.driver_profiles dp
join public.users u on u.id = dp.user_id
cross join lateral (select low_rating_threshold from public.system_settings where is_active limit 1) s
where dp.rating_count >= 5              -- avoid flagging on tiny samples
  and dp.rating_avg < s.low_rating_threshold;


-- ---------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
-- RLS is the real enforcement layer for RBAC. UI button-hiding is UX only.

create or replace function public.current_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_pso()
returns boolean language sql stable as $$
  select public.current_role() in ('pso_staff','pso_supervisor','admin');
$$;

create or replace function public.is_supervisor()
returns boolean language sql stable as $$
  select public.current_role() in ('pso_supervisor','admin');
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select public.current_role() = 'admin';
$$;

alter table public.users            enable row level security;
alter table public.driver_profiles  enable row level security;
alter table public.tricycles        enable row level security;
alter table public.driver_documents enable row level security;
alter table public.trips            enable row level security;
alter table public.ride_requests    enable row level security;
alter table public.transactions     enable row level security;
alter table public.ratings          enable row level security;
alter table public.complaints       enable row level security;
alter table public.account_actions  enable row level security;
alter table public.fare_config      enable row level security;
alter table public.system_settings  enable row level security;
alter table public.notifications    enable row level security;

-- 7.1 users -----------------------------------------------------------
create policy users_select_self on public.users
  for select using (id = auth.uid() or public.is_pso());

create policy users_update_self on public.users
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_role());  -- cannot self-promote

create policy users_admin_manage on public.users
  for all using (public.is_admin()) with check (public.is_admin());

-- 7.2 driver_profiles -------------------------------------------------
create policy driver_select on public.driver_profiles
  for select using (user_id = auth.uid() or public.is_pso());

create policy driver_update_self on public.driver_profiles
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    -- a driver can never approve their own verification
    and verification_status = (
      select verification_status from public.driver_profiles where user_id = auth.uid()
    )
  );

-- Only PSO Supervisor / Admin may change verification (FR-1.5).
create policy driver_verify_supervisor on public.driver_profiles
  for update using (public.is_supervisor()) with check (public.is_supervisor());

-- 7.3 tricycles / documents -------------------------------------------
create policy tricycles_owner_rw on public.tricycles
  for all using (driver_id = auth.uid() or public.is_pso())
  with check (driver_id = auth.uid() or public.is_supervisor());

create policy documents_owner_rw on public.driver_documents
  for all using (driver_id = auth.uid() or public.is_pso())
  with check (driver_id = auth.uid() or public.is_supervisor());

-- 7.4 trips -----------------------------------------------------------
create policy trips_driver_rw on public.trips
  for all using (driver_id = auth.uid() or public.is_pso())
  with check (driver_id = auth.uid());

-- 7.5 ride_requests ---------------------------------------------------
-- Passenger sees own; driver sees pending (request board) + own trip's;
-- PSO sees all.
create policy rr_passenger_rw on public.ride_requests
  for all using (passenger_id = auth.uid())
  with check (passenger_id = auth.uid());

create policy rr_driver_read on public.ride_requests
  for select using (
    public.current_role() = 'driver'
    and (
      status = 'pending'
      or trip_id in (select id from public.trips where driver_id = auth.uid())
    )
  );

create policy rr_driver_update on public.ride_requests
  for update using (
    trip_id in (select id from public.trips where driver_id = auth.uid())
    or (status = 'pending' and public.current_role() = 'driver')
  );

create policy rr_pso_read on public.ride_requests
  for select using (public.is_pso());

-- 7.6 transactions ----------------------------------------------------
create policy txn_own_read on public.transactions
  for select using (
    ride_request_id in (select id from public.ride_requests where passenger_id = auth.uid())
    or ride_request_id in (
      select rr.id from public.ride_requests rr
      join public.trips t on t.id = rr.trip_id
      where t.driver_id = auth.uid()
    )
    or public.is_pso()
  );

-- Cash confirmation: only the trip's own driver may confirm.
create policy txn_driver_confirm_cash on public.transactions
  for update using (
    method = 'cash'
    and ride_request_id in (
      select rr.id from public.ride_requests rr
      join public.trips t on t.id = rr.trip_id
      where t.driver_id = auth.uid()
    )
  );
-- NOTE: GCash transactions are written ONLY by the gcash-webhook Edge
-- Function using the service_role key, which bypasses RLS. No client-side
-- policy grants insert/update on gcash rows by design (FR-9.2).

-- 7.7 ratings ---------------------------------------------------------
create policy ratings_passenger_insert on public.ratings
  for insert with check (passenger_id = auth.uid());

create policy ratings_read on public.ratings
  for select using (
    passenger_id = auth.uid() or driver_id = auth.uid() or public.is_pso()
  );

-- 7.8 complaints ------------------------------------------------------
create policy complaints_submit on public.complaints
  for insert with check (submitted_by = auth.uid());

create policy complaints_read on public.complaints
  for select using (
    submitted_by = auth.uid() or against_user_id = auth.uid() or public.is_pso()
  );

create policy complaints_triage_staff on public.complaints
  for update using (public.is_pso()) with check (public.is_pso());

-- 7.9 account_actions -------------------------------------------------
-- Insert-only audit log. Staff may flag; only supervisors may suspend.
create policy actions_read_pso on public.account_actions
  for select using (public.is_pso());

create policy actions_flag_staff on public.account_actions
  for insert with check (
    performed_by = auth.uid()
    and (
      (action_type in ('flag','unflag') and public.is_pso())
      or (action_type in ('suspend','reactivate','deactivate') and public.is_supervisor())
    )
  );

-- 7.10 config tables --------------------------------------------------
create policy fare_read_all on public.fare_config
  for select using (auth.uid() is not null);
create policy fare_write_admin on public.fare_config
  for all using (public.is_admin()) with check (public.is_admin());

create policy settings_read_pso on public.system_settings
  for select using (public.is_pso());
create policy settings_write_admin on public.system_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- 7.11 notifications --------------------------------------------------
create policy notif_own on public.notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- 8. SEED DATA
-- ---------------------------------------------------------------------

-- Fare per City Ordinance No. 08, s. 2023
insert into public.fare_config (base_fare, base_km, rate_per_km, ordinance_ref)
values (15.00, 4.00, 1.00, 'General Santos City Ordinance No. 08, s. 2023');

-- Matching heuristic defaults — PROVISIONAL, pending data gathering.
insert into public.system_settings
  (bearing_tolerance_deg, detour_ratio_max, search_radius_km, low_rating_threshold)
values (40.00, 1.25, 3.00, 3.00);


-- ---------------------------------------------------------------------
-- 9. REALTIME PUBLICATION
-- ---------------------------------------------------------------------
-- Drives request board, ride status, and the PSO monitoring dashboard.
alter publication supabase_realtime add table public.ride_requests;
alter publication supabase_realtime add table public.trips;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.driver_profiles;

-- =====================================================================
-- END OF SCHEMA
-- =====================================================================