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
--
-- THIS FILE IS A REFERENCE DOCUMENT, NOT THE APPLIED PATH. The live
-- database is advanced via Supabase MCP migrations (apply_migration),
-- not by re-running this file. Before trusting anything below, check
-- list_tables / list_migrations against the live project — this doc has
-- drifted from (and briefly regressed against) the applied schema before.
-- Last reconciled against the live project: 2026-08-06 (applied migration
-- provision_driver_profile_on_signup — the driver_profiles auto-creation
-- in handle_new_auth_user() below was written into this file on 2026-08-05
-- but not actually applied live until the next day).
--
-- Auth leaked-password protection (HaveIBeenPwned check) is a PROJECT
-- AUTH SETTING, not something this schema file can express or enforce —
-- it must be enabled directly in the Supabase Auth dashboard/config.
-- Tracked here only so it isn't forgotten: as of last check it was OFF.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
-- PostGIS is deliberately NOT installed. No geometry column exists
-- anywhere in this schema — every location is a plain numeric(9,6)
-- lat/lng pair, and the matching heuristic uses trigonometry inside the
-- match-ride-request Edge Function, not PostGIS operators. Installing it
-- was tried once and reverted: it self-installs into the public schema
-- and drags in public.spatial_ref_sys (a PostGIS system table) with RLS
-- disabled, tripping a CRITICAL security advisory for zero functional
-- benefit. If radius/geo queries are ever genuinely needed, install
-- PostGIS into its own dedicated schema (not public) rather than here.


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

create type discount_category as enum (
  'senior_citizen',
  'pwd',
  'student'
);

create type tricycle_cluster as enum (
  'red',
  'white',
  'apple_green',
  'melting_pot'
);
-- Per Ordinance No. 37, Series of 2018, Section 119: the city is divided
-- into 4 clusters. Red/White/Apple Green units may also enter the Melting
-- Pot (CBD) cluster, but not each other's exclusive zones. Melting Pot
-- units are confined to the Melting Pot cluster only.

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
-- 'gcash' is collected via the PayMongo gateway, kept in Test Mode only —
-- no Live Mode activation for this prototype (see transactions table).

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
  'mediation_scheduled',  -- MTFRB meeting set (PSO-MTPS-PR-03)
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
  'payment_status',
  'discount_status',    -- FR-3.10-3.15 / UC48 fare-discount review outcome
  'franchise_expiring'  -- FR-1.7/FR-7.5 MTOP franchise-expiry notification job
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
  cluster             tricycle_cluster,   -- red/white/apple_green/melting_pot (Ord. 37 s.2018, Sec. 119)
  seat_capacity       smallint not null default 6,
  verification_status verification_status not null default 'unsubmitted',
  verified_by         uuid references public.users(id) on delete set null,
  verified_at         timestamptz,

  -- MTOP franchise record (Ord. 21 s.2024). PSO Supervisor transcribes
  -- these from the uploaded Franchise/Permit document during verification
  -- review — the app does not OCR the permit (FR-1.4a). Independent of
  -- verification_status: a unit can be app-verified yet hold an
  -- expiring/expired franchise, which is exactly what these fields exist
  -- to catch (Sec. 11-12: 3-year term, renewal 30 days before expiry).
  mtop_no             text unique,
  mtop_expiry_date    date,

  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint tricycle_seat_range check (seat_capacity between 1 and 6)
);

comment on column public.tricycles.mtop_expiry_date is
  'Feeds public.v_expiring_franchises and the notify_expiring_franchises() job (Sec. 4.8). NULL until PSO enters it during verification.';

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


-- 2.4b passenger_discounts ----------------------------------------------
-- Fare discount eligibility (Senior Citizen / PWD / Student), per FR-3.10-15.
-- Verified via ID photo review, mirroring the driver_documents pattern
-- rather than inventing a separate workflow.
create table public.passenger_discounts (
  id            uuid primary key default gen_random_uuid(),
  passenger_id  uuid not null references public.users(id) on delete cascade,
  category      discount_category not null,
  id_photo_front_path text not null,    -- Supabase Storage object path (front of ID)
  id_photo_back_path  text not null,    -- Supabase Storage object path (back of ID)
  status        verification_status not null default 'pending',
  reviewed_by   uuid references public.users(id) on delete set null,
  reviewed_at   timestamptz,
  remarks       text,
  submitted_at  timestamptz not null default now()
);

-- A passenger may only have one pending-or-approved discount claim at a time.
create unique index passenger_discounts_one_live_claim
  on public.passenger_discounts (passenger_id)
  where status in ('pending', 'approved');


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


-- 2.5b barangays --------------------------------------------------------
-- Cluster reference per Ordinance No. 37, Series of 2018, Section 119.
-- Enables cluster-authorization checks so the matching heuristic (FR-2.5)
-- generalizes beyond the Barangay Dadiangas West pilot to any barangay,
-- per the project's confirmed scope (the app is not architecturally
-- limited to the pilot locale, even though testing is).
create table public.barangays (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  cluster     tricycle_cluster,   -- NULL where the ordinance splits the
                                  -- barangay by portion (see is_split)
  is_split    boolean not null default false,
  notes       text,               -- e.g. which portion belongs to which cluster
  created_at  timestamptz not null default now()
);

comment on column public.barangays.cluster is
  'NULL for barangays the ordinance divides by portion (e.g. northwest/southeast of the national highway) — sub-barangay geofencing is out of scope for this prototype; see notes.';

-- Seed: barangays explicitly named in Ordinance No. 37, s.2018, Sec. 119.
-- Whole (unsplit) barangays get a confident cluster assignment.
insert into public.barangays (name, cluster) values
  ('Calumpang', 'red'), ('Fatima/Uhaw', 'red'), ('Apopong', 'red'),
  ('Tambler', 'red'), ('Bawing', 'red'), ('San Jose', 'red'), ('Sinawal', 'red'),
  ('City Heights', 'white'), ('San Isidro', 'white'), ('Mabuhay', 'white'),
  ('Conel', 'white'), ('Olympog', 'white'), ('Upper Labay', 'white'),
  ('Bula', 'apple_green'), ('Buayan', 'apple_green'), ('Baluan', 'apple_green'),
  ('Ligaya', 'apple_green'),
  ('Dadiangas East', 'melting_pot'), ('Dadiangas West', 'melting_pot'),
  ('Dadiangas South', 'melting_pot'), ('Dadiangas North', 'melting_pot');

-- Split barangays: the ordinance divides these by portion (e.g. northwest
-- vs. southeast of the national highway). Cluster left NULL pending
-- sub-barangay resolution — noted as a documented limitation, not silently
-- guessed at.
insert into public.barangays (name, cluster, is_split, notes) values
  ('Labangal', null, true, 'West of Makar traffic signal = Red; East = Melting Pot'),
  ('Lagao', null, true, 'Northwest of national highway = White; Southeast = Melting Pot'),
  ('Katangawan', null, true, 'Northwest of national highway = White; Southeast = Apple Green'),
  ('Tinagacan', null, true, 'Northwest of national highway = White; Southeast = Apple Green'),
  ('Batomelong', null, true, 'Northwest of national highway = White; Southeast = Apple Green');


-- 2.6 ride_requests ---------------------------------------------------
-- One passenger's booking. Attaches to a trip when a driver takes it.
create table public.ride_requests (
  id                uuid primary key default gen_random_uuid(),
  passenger_id      uuid not null references public.users(id) on delete restrict,
  trip_id           uuid references public.trips(id) on delete set null,

  pickup_lat        numeric(9,6) not null,
  pickup_lng        numeric(9,6) not null,
  pickup_label      text,
  pickup_barangay_id uuid references public.barangays(id) on delete set null,
  dest_lat          numeric(9,6) not null,
  dest_lng          numeric(9,6) not null,
  dest_label        text,

  seats_requested   smallint not null default 1,
  distance_km       numeric(6,2),
  estimated_fare    numeric(8,2),
  final_fare        numeric(8,2),
  discount_applied  boolean not null default false,
  discount_percent  numeric(4,2),        -- snapshot of rate at time of ride (FR-3.13)

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

  -- GCash-via-PayMongo path: set by the paymongo-webhook Edge Function
  -- only, after verifying the webhook signature. PayMongo account stays
  -- in Test Mode only — no Live Mode activation for this prototype.
  paymongo_session_id text unique,
  paymongo_payload    jsonb,

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
  -- GCash cannot be marked paid without a PayMongo checkout session id.
  -- The unique constraint above also gives webhook-retry idempotency.
  constraint txn_paymongo_needs_reference check (
    method <> 'gcash' or status <> 'paid' or paymongo_session_id is not null
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
-- Scope: complaints tied to an app-registered user (submitted_by is
-- not null) — i.e. complaints arising from TriSakay-mediated rides.
-- PSO's other real-world intake channels (social media, letters, phone/
-- Facebook, the Google feedback form — PSO-MTPS-PR-03 Sec. E) are NOT
-- represented here; those stay on PSO's existing separate process. This
-- table is not a general-purpose, any-channel complaint system.
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

  -- Department Head directive (PSO-MTPS-PR-03, Activity 3): DH reviews
  -- the triaged complaint and instructs staff on next steps (typically
  -- "contact both parties"). Distinct from triage and from the eventual
  -- mediation outcome — this is the audit record of the DH's own step
  -- (FR-4.3a).
  dh_reviewed_by    uuid references public.users(id) on delete set null,
  dh_reviewed_at    timestamptz,
  dh_directive      text,

  -- MTFRB mediation meeting (PSO-MTPS-PR-03, Activity 4-5): both parties
  -- are contacted and attend a mediation meeting before final resolution.
  mediation_scheduled_by  uuid references public.users(id) on delete set null,
  mediation_scheduled_at  timestamptz,
  mediation_meeting_at    timestamptz,   -- date/time the MTFRB meeting is set for
  mediation_location      text,          -- typically the PSO office

  resolved_by       uuid references public.users(id) on delete set null,
  resolved_at       timestamptz,
  resolution_notes  text,                -- mediation outcome / settlement details

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint complaint_not_self check (
    against_user_id is null or against_user_id <> submitted_by
  ),
  -- A mediation meeting time can't be set before it was scheduled.
  constraint complaint_mediation_order check (
    mediation_meeting_at is null or mediation_scheduled_at is null
    or mediation_meeting_at >= mediation_scheduled_at
  )
);


-- 3.1b complaint_attachments --------------------------------------------
-- FR-4.7: complaint records AND any submitted evidence are handled per
-- RA 10173. Evidence (photos, screenshots, etc.) had nowhere to live —
-- this table fills that gap, mirroring the driver_documents /
-- passenger_discounts storage_path pattern rather than inventing a new one.
create table public.complaint_attachments (
  id            uuid primary key default gen_random_uuid(),
  complaint_id  uuid not null references public.complaints(id) on delete cascade,
  storage_path  text not null,          -- Supabase Storage object path
  uploaded_by   uuid not null references public.users(id) on delete restrict,
  created_at    timestamptz not null default now()
);

create index idx_complaint_attachments_complaint on public.complaint_attachments (complaint_id);


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
  discount_rate_percent numeric(4,2) not null default 20.00,  -- RA 9994 / RA 10754 (FR-3.12)
  ordinance_ref text,                    -- 'City Ordinance No. 08, s. 2023'
  effective_from timestamptz not null default now(),
  is_active     boolean not null default true,
  updated_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),

  constraint fare_values_positive check (
    base_fare >= 0 and base_km > 0 and rate_per_km >= 0
  ),
  constraint fare_discount_range check (discount_rate_percent between 0 and 100)
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


-- 3.6 user_consents -----------------------------------------------------
-- Auditable record of Terms of Service / Privacy Policy acceptance (FR-11.3).
-- One row per acceptance event — never updated, only inserted, so the
-- history of what a user agreed to (and when) is never lost.
create table public.user_consents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  policy_type    text not null,       -- 'terms_of_service' | 'privacy_policy'
  policy_version text not null,       -- e.g. 'v1.0', 'v1.1'
  accepted_at    timestamptz not null default now(),

  constraint consent_policy_type_check check (
    policy_type in ('terms_of_service', 'privacy_policy')
  )
);

create index idx_consents_user on public.user_consents (user_id, policy_type);

comment on table public.user_consents is
  'Append-only. A new row per (re-)acceptance — supports proving consent to a specific policy version at a specific time.';


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
-- LOAD-BEARING: contact_no MUST be inserted here from raw_user_meta_data.
-- apps/passenger/app/(auth)/register.tsx sends phone as signup metadata
-- via packages/services/src/auth/index.ts; dropping this column silently
-- breaks passenger registration. (Regressed once already, 2026-07-30 ->
-- 2026-07-31 — do not remove it again.)
-- A driver additionally gets a driver_profiles row (verification_status
-- defaults to 'unsubmitted') so the app can gate entry on PSO approval
-- (FR-1.5-1.6) from the moment they sign up, not after some later step.
-- There is deliberately no equivalent client-side insert: driver_profiles
-- has no RLS insert policy (see 7.2), so this trigger is the only path
-- that can create the row.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_role public.user_role;
begin
  new_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'passenger');

  insert into public.users (id, full_name, email, role, contact_no)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Unnamed User'),
    new.email,
    new_role,
    new.raw_user_meta_data->>'phone'
  );

  if new_role = 'driver' then
    insert into public.driver_profiles (user_id) values (new.id);
  end if;

  return new;
end $$;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();


-- 4.3 fare computation (Ordinance No. 08, s. 2023) --------------------
-- P15 for the first 4 km, +P1 per succeeding km, per passenger seat.
-- If p_passenger_id has an approved passenger_discounts row (senior/PWD/
-- student), the active discount_rate_percent is applied (FR-3.10-3.13).
create or replace function public.compute_fare(
  p_distance_km  numeric,
  p_seats        smallint default 1,
  p_passenger_id uuid default null
) returns numeric language plpgsql stable as $$
declare
  cfg  public.fare_config%rowtype;
  per_passenger numeric;
  is_eligible boolean;
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

  per_passenger := per_passenger * p_seats;

  if p_passenger_id is not null then
    select exists(
      select 1 from public.passenger_discounts
      where passenger_id = p_passenger_id and status = 'approved'
    ) into is_eligible;

    if is_eligible then
      per_passenger := per_passenger * (1 - cfg.discount_rate_percent / 100);
    end if;
  end if;

  return round(per_passenger, 2);
end $$;


-- 4.3b cluster authorization (Ordinance No. 37, s.2018, Sec. 119) -------
-- Hard pre-filter run BEFORE the bearing/detour heuristic (FR-2.5): a
-- tricycle may only be matched to a pickup in its authorized cluster.
-- Melting Pot barangays accept all three colored clusters; colored
-- clusters otherwise only serve their own. NULL cluster (unresolved split
-- barangay, or tricycle not yet assigned a cluster) is treated as
-- unauthorized rather than silently allowed — safer default.
create or replace function public.is_cluster_authorized(
  p_tricycle_cluster tricycle_cluster,
  p_barangay_cluster tricycle_cluster
) returns boolean language sql immutable set search_path = public as $$
  select
    p_tricycle_cluster is not null
    and p_barangay_cluster is not null
    and (
      p_tricycle_cluster = p_barangay_cluster
      or (p_barangay_cluster = 'melting_pot' and p_tricycle_cluster <> 'melting_pot')
    );
$$;

comment on function public.is_cluster_authorized is
  'Within the single-barangay Dadiangas West pilot (Melting Pot cluster), this always returns true for any colored tricycle — the constraint only binds once the system extends to other barangays, per confirmed scope. Called by the match-ride-request Edge Function as the hard pre-filter (FR-2.5) — it is not wired to any DB constraint or trigger, so it will show as unused if you grep for callers inside this file.';


-- 4.3c trip driver info (passenger-visible) -----------------------------
-- Passengers have no direct SELECT on trips/driver_profiles/tricycles/other
-- users' users rows (see §7.1-7.4) — this security-definer function is the
-- only path to a matched driver's public info, self-authorized via
-- passenger_id = auth.uid() rather than broadening those tables' RLS.
create or replace function public.get_trip_driver_info(p_ride_request_id uuid)
returns table (
  driver_id    uuid,
  driver_name  text,
  avatar_url   text,
  plate_no     text,
  rating_avg   numeric,
  rating_count int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
begin
  select trip_id into v_trip_id
  from public.ride_requests
  where id = p_ride_request_id
    and passenger_id = auth.uid();

  if v_trip_id is null then
    return;
  end if;

  return query
  select u.id, u.full_name, u.avatar_url, t.plate_no, dp.rating_avg, dp.rating_count
  from public.trips tr
  join public.users u on u.id = tr.driver_id
  join public.driver_profiles dp on dp.user_id = tr.driver_id
  left join public.tricycles t on t.id = tr.tricycle_id
  where tr.id = v_trip_id;
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


-- 4.4b trip max_seats may not exceed the assigned tricycle's capacity ---
-- enforce_trip_seat_capacity() only checks live ride_requests against
-- trips.max_seats; nothing previously stopped max_seats itself from
-- exceeding the unit's actual seat_capacity (e.g. claiming 6 seats on a
-- 3-seat tricycle).
create or replace function public.enforce_trip_seats_within_tricycle()
returns trigger language plpgsql as $$
declare
  cap smallint;
begin
  select seat_capacity into cap from public.tricycles where id = new.tricycle_id;

  if cap is not null and new.max_seats > cap then
    raise exception 'Trip max_seats (%) exceeds tricycle % seat_capacity (%)',
      new.max_seats, new.tricycle_id, cap;
  end if;

  return new;
end $$;

create trigger trg_trips_seats_within_tricycle
  before insert or update on public.trips
  for each row execute function public.enforce_trip_seats_within_tricycle();


-- 4.4c driver may not go available until verified (FR-1.6) ---------------
-- "Driver barred from ride-matching until verified" was stated in
-- CONTEXT.MD but nothing enforced it. Requires the driver's own
-- verification AND an active, verified tricycle assigned to them.
create or replace function public.enforce_driver_verified_before_available()
returns trigger language plpgsql as $$
declare
  has_verified_active_unit boolean;
begin
  if new.is_available and not old.is_available then
    if new.verification_status <> 'approved' then
      raise exception 'Driver % cannot go available: driver verification is not approved', new.user_id;
    end if;

    select exists(
      select 1 from public.tricycles
      where driver_id = new.user_id
        and is_active
        and verification_status = 'approved'
    ) into has_verified_active_unit;

    if not has_verified_active_unit then
      raise exception 'Driver % cannot go available: no active, verified tricycle assigned', new.user_id;
    end if;
  end if;

  return new;
end $$;

create trigger trg_driver_verified_before_available
  before update on public.driver_profiles
  for each row execute function public.enforce_driver_verified_before_available();


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


-- 4.6 rating may only be submitted for one's own completed ride,
-- and must name the driver who actually drove that trip -----------------
create or replace function public.validate_rating()
returns trigger language plpgsql as $$
declare
  rr public.ride_requests%rowtype;
  trip_driver uuid;
begin
  select * into rr from public.ride_requests where id = new.ride_request_id;

  if rr.passenger_id <> new.passenger_id then
    raise exception 'Rating must be submitted by the ride''s own passenger';
  end if;
  if rr.status <> 'completed' then
    raise exception 'Cannot rate a ride that is not completed';
  end if;

  select driver_id into trip_driver from public.trips where id = rr.trip_id;
  if trip_driver is null or trip_driver <> new.driver_id then
    raise exception 'Rating must name the driver who actually drove this trip';
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


-- 4.8 franchise-expiry notification job ---------------------------------
-- Daily job: notifies each driver whose MTOP franchise (Ord. 21 s.2024,
-- Sec. 11-12) is within 30 days of expiry or already expired. Reads from
-- v_expiring_franchises (Section 6.3). One notification per driver per
-- day (checked via today's existing rows) so re-running it doesn't spam.
--
-- Implemented as a scheduled Postgres function via pg_cron, NOT a new
-- Edge Function — keeps the Edge Function count at 2 (match-ride-request,
-- paymongo-webhook) per the "kept minimal" architecture principle.
-- security definer so it can insert notifications for drivers other than
-- whichever role runs the cron job.
--
-- Enable pg_cron via Supabase Dashboard -> Database -> Extensions, then:
--   select cron.schedule(
--     'notify-expiring-franchises', '0 8 * * *',
--     'select public.notify_expiring_franchises();'
--   );
create or replace function public.notify_expiring_franchises()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, message)
  select
    v.driver_id,
    'franchise_expiring'::notification_type,
    'Franchise expiring soon',
    case
      when v.days_until_expiry < 0 then
        format('Your MTOP franchise (plate %s) expired on %s. Renew with PSO to keep receiving ride requests.',
               v.plate_no, v.mtop_expiry_date)
      else
        format('Your MTOP franchise (plate %s) expires in %s day(s), on %s. File your renewal with PSO at least 30 days before expiry.',
               v.plate_no, v.days_until_expiry, v.mtop_expiry_date)
    end
  from public.v_expiring_franchises v
  where not exists (
    select 1 from public.notifications n
    where n.user_id = v.driver_id
      and n.type = 'franchise_expiring'
      and n.created_at::date = current_date
  );
end;
$$;

comment on function public.notify_expiring_franchises is
  'Scheduled via pg_cron (see comment above). Reads v_expiring_franchises, writes to notifications (FR-7.5).';

-- SECURITY DEFINER functions are, by default, callable by anon/authenticated
-- over PostgREST (/rest/v1/rpc/...) since Postgres grants EXECUTE to PUBLIC
-- on new functions. This one is cron-only — it writes notifications for
-- arbitrary drivers on behalf of whatever role runs the cron job — so it
-- must NOT be reachable from the client. Revoked from all client-facing
-- roles; only the role running pg_cron (which bypasses these grants) can
-- invoke it.
revoke execute on function public.notify_expiring_franchises() from public;
revoke execute on function public.notify_expiring_franchises() from anon;
revoke execute on function public.notify_expiring_franchises() from authenticated;


-- 4.9 business-day counter (for the complaint SLA) ----------------------
-- Approximate: counts Mon-Fri only, no Philippine public holiday
-- calendar. Good enough to flag SLA risk; not a legal countdown.
create or replace function public.business_days_since(p_start timestamptz)
returns integer
language sql stable
set search_path = public
as $$
  select count(*)::int
  from generate_series(p_start::date + 1, current_date, interval '1 day') d
  where extract(isodow from d) < 6   -- Mon=1 .. Fri=5, Sat=6, Sun=7
$$;

comment on function public.business_days_since is
  'Used by v_overdue_complaints for the 3-business-day ARTA target (PSO-MTPS-PR-03 Sec. C, FR-4.8). Known simplification: no holiday calendar.';


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
create index idx_tricycles_mtop_expiry     on public.tricycles (mtop_expiry_date)
  where is_active and mtop_expiry_date is not null;
create index idx_documents_driver          on public.driver_documents (driver_id);
create index idx_documents_status          on public.driver_documents (status)
  where status = 'pending';

create index idx_discounts_passenger       on public.passenger_discounts (passenger_id);
create index idx_discounts_pending         on public.passenger_discounts (status)
  where status = 'pending';

create index idx_trips_driver              on public.trips (driver_id);
create index idx_trips_status              on public.trips (status) where status = 'active';

create index idx_rr_passenger              on public.ride_requests (passenger_id);
create index idx_rr_barangay               on public.ride_requests (pickup_barangay_id);
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
-- security_invoker = true: without it, views default to running as their
-- OWNER (definer semantics), silently bypassing the caller's RLS policies
-- — flagged as a security-advisor ERROR. With it, the view respects
-- whatever RLS the querying role is actually subject to.
create view public.v_driver_earnings
with (security_invoker = true) as
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
create view public.v_flagged_low_ratings
with (security_invoker = true) as
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


-- 6.3 tricycles within 30 days of MTOP expiry, or already expired -------
-- Feeds notify_expiring_franchises() (Section 4.8) and the PSO oversight
-- dashboard (FR-5). security_invoker so a direct query from a driver's
-- own session still only returns their own tricycle (via tricycles' RLS);
-- the notification job sees everyone because it runs security definer.
create or replace view public.v_expiring_franchises
with (security_invoker = true) as
select
  t.id                                as tricycle_id,
  t.driver_id,
  t.plate_no,
  t.mtop_no,
  t.mtop_expiry_date,
  (t.mtop_expiry_date - current_date) as days_until_expiry
from public.tricycles t
where t.is_active = true
  and t.mtop_expiry_date is not null
  and t.mtop_expiry_date <= (current_date + interval '30 days');

comment on view public.v_expiring_franchises is
  'Ord. 21 s.2024 Sec. 12: renewal must be filed 30 days before expiry. Negative days_until_expiry = already expired.';


-- 6.4 complaints past the 3-business-day ARTA target ---------------------
-- PSO-MTPS-PR-03 Sec. C: "Required No. of Days per ARTA: 3 days" for
-- this Simple Transaction. Measured from submission to the point a
-- mediation meeting gets scheduled (Activity 1-4) — not to the MTFRB
-- meeting itself, since that date depends on MTFRB's own calendar and
-- isn't something PSO controls per-complaint. Replaces the SOP's manual
-- daily checklist/logbook tracking (Section H) with a live query.
create or replace view public.v_overdue_complaints
with (security_invoker = true) as
select
  c.id,
  c.submitted_by,
  c.against_user_id,
  c.category,
  c.status,
  c.created_at,
  public.business_days_since(c.created_at) as business_days_elapsed
from public.complaints c
where c.status in ('open', 'under_review')
  and public.business_days_since(c.created_at) > 3;

comment on view public.v_overdue_complaints is
  'Feeds the PSO oversight dashboard (FR-5.5). security_invoker so a driver/passenger querying it directly only ever sees their own complaints, via complaints RLS.';


-- ---------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
-- RLS is the real enforcement layer for RBAC. UI button-hiding is UX only.

-- Named app_current_role(), not current_role() — the latter shadows the
-- Postgres built-in of the same name, forcing quoted/qualified calls
-- everywhere and inviting resolution bugs. (Security advisor also flags
-- unpinned search_path on SECURITY DEFINER functions; pinned below.)
create or replace function public.app_current_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_pso()
returns boolean language sql stable set search_path = public as $$
  select public.app_current_role() in ('pso_staff','pso_supervisor','admin');
$$;

create or replace function public.is_supervisor()
returns boolean language sql stable set search_path = public as $$
  select public.app_current_role() in ('pso_supervisor','admin');
$$;

create or replace function public.is_admin()
returns boolean language sql stable set search_path = public as $$
  select public.app_current_role() = 'admin';
$$;

alter table public.users            enable row level security;
alter table public.driver_profiles  enable row level security;
alter table public.tricycles        enable row level security;
alter table public.barangays        enable row level security;
alter table public.driver_documents enable row level security;
alter table public.passenger_discounts enable row level security;
alter table public.trips            enable row level security;
alter table public.ride_requests    enable row level security;
alter table public.transactions     enable row level security;
alter table public.ratings          enable row level security;
alter table public.complaints       enable row level security;
alter table public.complaint_attachments enable row level security;
alter table public.account_actions  enable row level security;
alter table public.fare_config      enable row level security;
alter table public.system_settings  enable row level security;
alter table public.notifications    enable row level security;
alter table public.user_consents    enable row level security;

-- 7.1 users -----------------------------------------------------------
create policy users_select_self on public.users
  for select using (id = auth.uid() or public.is_pso());

create policy users_update_self on public.users
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = public.app_current_role());  -- cannot self-promote

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

-- 7.2b barangays --------------------------------------------------------
-- Reference/lookup data: any authenticated user may read; only Admin
-- maintains it (e.g. if the MTFRB amends cluster boundaries).
create policy barangays_read_all on public.barangays
  for select using (auth.uid() is not null);

create policy barangays_write_admin on public.barangays
  for all using (public.is_admin()) with check (public.is_admin());

create policy documents_owner_rw on public.driver_documents
  for all using (driver_id = auth.uid() or public.is_pso())
  with check (driver_id = auth.uid() or public.is_supervisor());

-- 7.3b passenger_discounts ----------------------------------------------
-- Passenger submits their own claim (insert only, cannot self-approve);
-- only PSO Supervisor/Admin may approve/reject (mirrors driver verification).
create policy discounts_submit_own on public.passenger_discounts
  for insert with check (passenger_id = auth.uid());

create policy discounts_read on public.passenger_discounts
  for select using (passenger_id = auth.uid() or public.is_pso());

create policy discounts_review_supervisor on public.passenger_discounts
  for update using (public.is_supervisor()) with check (public.is_supervisor());

-- 7.4 trips -----------------------------------------------------------
create policy trips_driver_rw on public.trips
  for all using (driver_id = auth.uid() or public.is_pso())
  with check (driver_id = auth.uid());

-- 7.5 ride_requests ---------------------------------------------------
-- Passenger sees own; driver sees pending (request board) + own trip's;
-- PSO sees all.
--
-- Split (not `for all`): a blanket passenger UPDATE would let a passenger
-- write their own final_fare, status, or discount_percent directly,
-- defeating FR-3.3 ("final fare locked at trip completion"). Passengers
-- may only insert/select their own rows, and may only update a still-
-- pending request of their own to cancel it — every other status
-- transition and every fare/discount field is driver- or system-owned.
create policy rr_passenger_insert on public.ride_requests
  for insert with check (passenger_id = auth.uid());

create policy rr_passenger_select on public.ride_requests
  for select using (passenger_id = auth.uid());

create policy rr_passenger_cancel on public.ride_requests
  for update using (passenger_id = auth.uid() and status = 'pending')
  with check (
    passenger_id = auth.uid()
    and status = 'cancelled'
  );

create policy rr_driver_read on public.ride_requests
  for select using (
    public.app_current_role() = 'driver'
    and (
      status = 'pending'
      or trip_id in (select id from public.trips where driver_id = auth.uid())
    )
  );

create policy rr_driver_update on public.ride_requests
  for update using (
    trip_id in (select id from public.trips where driver_id = auth.uid())
    or (status = 'pending' and public.app_current_role() = 'driver')
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
-- NOTE: GCash transactions are written ONLY by the paymongo-webhook Edge
-- Function using the service_role key, which bypasses RLS, after verifying
-- the PayMongo webhook signature. No client-side policy grants insert/
-- update on gcash rows by design (FR-9.2). PayMongo account is kept in
-- Test Mode only for this prototype.

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

-- 7.8b complaint_attachments --------------------------------------------
-- Mirrors complaints_read: whoever can see the complaint can see its
-- evidence. Only the complaint's own submitted_by may attach evidence
-- (not against_user_id — the accused shouldn't be able to plant evidence
-- under the complainant's complaint).
create policy complaint_attachments_insert on public.complaint_attachments
  for insert with check (
    uploaded_by = auth.uid()
    and complaint_id in (select id from public.complaints where submitted_by = auth.uid())
  );

create policy complaint_attachments_read on public.complaint_attachments
  for select using (
    complaint_id in (
      select id from public.complaints
      where submitted_by = auth.uid() or against_user_id = auth.uid()
    )
    or public.is_pso()
  );

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

-- 7.12 user_consents ---------------------------------------------------
-- Insert-only from the user's own side; PSO/Admin may read for audit
-- purposes but nobody may update or delete a consent record.
create policy consents_insert_own on public.user_consents
  for insert with check (user_id = auth.uid());

create policy consents_read on public.user_consents
  for select using (user_id = auth.uid() or public.is_pso());


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
-- Needed for the passenger app's GCash payment-status subscription
-- (subscribeToTransactionStatus) to receive paid/failed updates.
alter publication supabase_realtime add table public.transactions;

-- =====================================================================
-- END OF SCHEMA
-- =====================================================================
