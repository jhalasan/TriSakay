-- X0 reconciliation baseline.
--
-- Captures schema that exists live but was never saved into supabase/migrations/
-- (the ~50 pre-2026-08-30 migrations that predate this repo's migration history,
-- plus a handful of objects added directly via dashboard/raw SQL later). This file
-- was assembled by hand from live pg_catalog/information_schema introspection
-- (Supabase CLI's db pull/db dump both require Docker, unavailable in this
-- environment) and is marked as already-applied in the CLI's bookkeeping —
-- it documents existing schema, it does not change it.
--
-- See docs/UAT_PANELIST_REVIEW_ADRALES.md, item X0, for full context.
--
-- NOTE on fresh-environment replay: this file is dated after every current local
-- migration (required — timestamps must be monotonically increasing and the CLI's
-- bookkeeping now expects that order), but the objects it defines are foundational
-- (user_role, is_pso(), is_admin(), etc.) and predate ALL of them chronologically.
-- Several earlier local migrations (e.g. 20260921000010_add_passenger_directory_masking_view.sql,
-- which calls is_supervisor()) already implicitly depend on this pre-history content
-- existing first. That dependency problem exists independently of this file and isn't
-- introduced by it — it means `supabase db reset` / a from-scratch replay of only the
-- local migration files will not work correctly yet. Fixing that would require
-- renumbering existing local files, which is exactly the kind of migration-history
-- rewrite the team already chose to defer (see the git-history-purge decision). Against
-- the LIVE database — the only environment this file is applied to — none of this
-- matters: the objects already exist in the right order, and this file is marked
-- "applied" (bookkeeping only), never actually re-executed there.

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists pg_stat_statements;
create extension if not exists supabase_vault;
-- pg_cron and pg_net are already captured by 20260909101014_schedule_notify_expiring_franchises.sql
-- and later migrations that schedule cron jobs; included here defensively (idempotent).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================
-- rating_tag is already created by 20260921000004_add_rating_tags.sql.

create type public.account_action_type as enum ('flag', 'unflag', 'suspend', 'reactivate', 'deactivate');
create type public.account_status as enum ('active', 'flagged', 'suspended', 'deactivated');
create type public.assignment_event_type as enum ('accepted', 'cancelled_by_passenger', 'cancelled_by_driver', 'cancelled_by_system', 'completed', 'offered_declined');
create type public.complaint_category as enum ('fare', 'conduct', 'safety', 'low_rating', 'vehicle_condition', 'other');
create type public.complaint_status as enum ('open', 'under_review', 'escalated', 'mediation_scheduled', 'resolved', 'dismissed');
create type public.discount_category as enum ('senior_citizen', 'pwd', 'student');
create type public.document_type as enum ('drivers_license', 'or_cr', 'franchise_permit', 'tricycle_photo');
create type public.emergency_role as enum ('passenger', 'driver');
create type public.emergency_status as enum ('logged', 'reviewed', 'closed');
create type public.notification_type as enum ('ride_status', 'verification_status', 'complaint_status', 'payment_status', 'discount_status', 'franchise_expiring', 'emergency_alert', 'settlement_notice');
create type public.payment_method as enum ('cash', 'gcash');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.ride_status as enum ('pending', 'assigned', 'ongoing', 'completed', 'cancelled');
create type public.tricycle_cluster as enum ('red', 'white', 'apple_green', 'melting_pot');
create type public.trip_status as enum ('forming', 'active', 'completed', 'cancelled');
create type public.user_role as enum ('passenger', 'driver', 'pso_staff', 'pso_supervisor', 'admin');
create type public.verification_status as enum ('unsubmitted', 'pending', 'approved', 'rejected');

-- ============================================================================
-- TABLES
-- ============================================================================

create table public.users (
  id uuid not null,
  contact_no text,
  email text not null,
  role user_role not null default 'passenger'::user_role,
  status account_status not null default 'active'::account_status,
  avatar_url text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  push_token text,
  must_change_password boolean not null default false,
  first_name text not null,
  last_name text not null,
  full_name text default TRIM(BOTH ' '::text FROM ((first_name || ' '::text) || last_name))
);

create table public.barangays (
  id uuid not null default gen_random_uuid(),
  name text not null,
  cluster tricycle_cluster,
  is_split boolean not null default false,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone,
  updated_by uuid
);

create table public.driver_profiles (
  user_id uuid not null,
  license_no text,
  verification_status verification_status not null default 'unsubmitted'::verification_status,
  verified_by uuid,
  verified_at timestamp with time zone,
  is_available boolean not null default false,
  current_lat numeric(9,6),
  current_lng numeric(9,6),
  declared_dest_lat numeric(9,6),
  declared_dest_lng numeric(9,6),
  location_updated_at timestamp with time zone,
  rating_avg numeric(3,2) not null default 0.00,
  rating_count integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.tricycles (
  id uuid not null default gen_random_uuid(),
  driver_id uuid not null,
  plate_no text not null,
  body_no text,
  seat_capacity smallint not null default 6,
  verification_status verification_status not null default 'unsubmitted'::verification_status,
  verified_by uuid,
  verified_at timestamp with time zone,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  cluster tricycle_cluster,
  mtop_no text,
  mtop_expiry_date date
);

create table public.trips (
  id uuid not null default gen_random_uuid(),
  driver_id uuid not null,
  tricycle_id uuid not null,
  status trip_status not null default 'forming'::trip_status,
  origin_lat numeric(9,6),
  origin_lng numeric(9,6),
  declared_dest_lat numeric(9,6),
  declared_dest_lng numeric(9,6),
  max_seats smallint not null default 6,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.ride_requests (
  id uuid not null default gen_random_uuid(),
  passenger_id uuid not null,
  trip_id uuid,
  pickup_lat numeric(9,6) not null,
  pickup_lng numeric(9,6) not null,
  pickup_label text,
  dest_lat numeric(9,6) not null,
  dest_lng numeric(9,6) not null,
  dest_label text,
  seats_requested smallint not null default 1,
  distance_km numeric(6,2),
  estimated_fare numeric(8,2),
  final_fare numeric(8,2),
  status ride_status not null default 'pending'::ride_status,
  preferred_method payment_method not null default 'cash'::payment_method,
  requested_at timestamp with time zone not null default now(),
  assigned_at timestamp with time zone,
  picked_up_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  cancel_reason text,
  pickup_barangay_id uuid,
  discount_applied boolean not null default false,
  discount_percent numeric(4,2),
  expires_at timestamp with time zone not null default (now() + '00:00:18'::interval)
);

create table public.driver_documents (
  id uuid not null default gen_random_uuid(),
  driver_id uuid not null,
  tricycle_id uuid,
  doc_type document_type not null,
  storage_path text not null,
  status verification_status not null default 'pending'::verification_status,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  remarks text,
  created_at timestamp with time zone not null default now(),
  expiry_date date,
  expiry_notified_at timestamp with time zone
);

create table public.transactions (
  id uuid not null default gen_random_uuid(),
  ride_request_id uuid not null,
  amount numeric(8,2) not null,
  method payment_method not null,
  status payment_status not null default 'pending'::payment_status,
  paymongo_session_id text,
  paymongo_payload jsonb,
  cash_confirmed_by uuid,
  cash_confirmed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.ratings (
  id uuid not null default gen_random_uuid(),
  ride_request_id uuid not null,
  passenger_id uuid not null,
  driver_id uuid not null,
  stars smallint not null,
  comment text,
  created_at timestamp with time zone not null default now(),
  tags rating_tag[] not null default '{}'::rating_tag[]
);

create table public.complaints (
  id uuid not null default gen_random_uuid(),
  submitted_by uuid not null,
  against_user_id uuid,
  ride_request_id uuid,
  category complaint_category not null default 'other'::complaint_category,
  subject text not null,
  message text not null,
  status complaint_status not null default 'open'::complaint_status,
  triaged_by uuid,
  triaged_at timestamp with time zone,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  resolution_notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  mediation_scheduled_by uuid,
  mediation_scheduled_at timestamp with time zone,
  mediation_meeting_at timestamp with time zone,
  mediation_location text,
  dh_reviewed_by uuid,
  dh_reviewed_at timestamp with time zone,
  dh_directive text
);

create table public.complaint_attachments (
  id uuid not null default gen_random_uuid(),
  complaint_id uuid not null,
  storage_path text not null,
  uploaded_by uuid not null,
  created_at timestamp with time zone not null default now()
);

create table public.account_actions (
  id uuid not null default gen_random_uuid(),
  target_user_id uuid not null,
  action_type account_action_type not null,
  performed_by uuid not null,
  reason text not null,
  complaint_id uuid,
  created_at timestamp with time zone not null default now()
);

create table public.notifications (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  type notification_type not null,
  title text not null,
  message text not null,
  ref_id uuid,
  is_read boolean not null default false,
  created_at timestamp with time zone not null default now()
);

create table public.passenger_discounts (
  id uuid not null default gen_random_uuid(),
  passenger_id uuid not null,
  category discount_category not null,
  id_photo_front_path text not null,
  status verification_status not null default 'pending'::verification_status,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  remarks text,
  submitted_at timestamp with time zone not null default now(),
  id_photo_back_path text not null,
  id_number text,
  date_of_birth date,
  issuing_office text,
  expires_at timestamp with time zone
);

create table public.emergency_alerts (
  id uuid not null default gen_random_uuid(),
  ride_request_id uuid,
  triggered_by uuid not null,
  triggered_role emergency_role not null,
  counterpart_id uuid,
  lat double precision not null,
  lng double precision not null,
  status emergency_status not null default 'logged'::emergency_status,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone not null default now()
);

create table public.saved_places (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  label text not null,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamp with time zone not null default now(),
  icon text not null default 'location-outline'::text
);

create table public.system_settings (
  id uuid not null default gen_random_uuid(),
  bearing_tolerance_deg numeric(5,2) not null default 40.00,
  detour_ratio_max numeric(4,2) not null default 1.25,
  search_radius_km numeric(5,2) not null default 3.00,
  low_rating_threshold numeric(3,2) not null default 3.00,
  is_active boolean not null default true,
  updated_by uuid,
  updated_at timestamp with time zone not null default now(),
  gcash_enabled boolean not null default true,
  cash_enabled boolean not null default true,
  franchise_expiry_notifications boolean not null default true
);

create table public.fare_config (
  id uuid not null default gen_random_uuid(),
  base_fare numeric(6,2) not null,
  base_km numeric(4,2) not null,
  rate_per_km numeric(6,2) not null,
  ordinance_ref text,
  effective_from timestamp with time zone not null default now(),
  is_active boolean not null default true,
  updated_by uuid,
  created_at timestamp with time zone not null default now(),
  discount_rate_percent numeric(4,2) not null default 20.00
);

create table public.ride_assignment_events (
  id uuid not null default gen_random_uuid(),
  ride_request_id uuid not null,
  trip_id uuid,
  driver_id uuid,
  event_type assignment_event_type not null,
  actor_id uuid,
  from_status ride_status,
  to_status ride_status,
  reason text,
  created_at timestamp with time zone not null default now()
);

create table public.user_consents (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  policy_type text not null,
  policy_version text not null,
  accepted_at timestamp with time zone not null default now()
);

-- ============================================================================
-- PRIMARY KEYS, UNIQUE, CHECK, FOREIGN KEY CONSTRAINTS
-- ============================================================================

alter table public.users add constraint users_pkey primary key (id);
alter table public.users add constraint users_id_fkey foreign key (id) references auth.users(id) on delete cascade;
alter table public.users add constraint users_contact_no_unique unique (contact_no);
alter table public.users add constraint users_contact_format check (((contact_no is null) or (contact_no ~ '^[0-9+()\-\s]{7,20}$'::text)));

alter table public.barangays add constraint barangays_pkey primary key (id);
alter table public.barangays add constraint barangays_name_key unique (name);
alter table public.barangays add constraint barangays_updated_by_fkey foreign key (updated_by) references users(id) on delete set null;

alter table public.driver_profiles add constraint driver_profiles_pkey primary key (user_id);
alter table public.driver_profiles add constraint driver_profiles_license_no_key unique (license_no);
alter table public.driver_profiles add constraint driver_profiles_user_id_fkey foreign key (user_id) references users(id) on delete cascade;
alter table public.driver_profiles add constraint driver_profiles_verified_by_fkey foreign key (verified_by) references users(id) on delete set null;
alter table public.driver_profiles add constraint driver_lat_range check (((current_lat is null) or ((current_lat >= ('-90'::integer)::numeric) and (current_lat <= (90)::numeric))));
alter table public.driver_profiles add constraint driver_lng_range check (((current_lng is null) or ((current_lng >= ('-180'::integer)::numeric) and (current_lng <= (180)::numeric))));
alter table public.driver_profiles add constraint driver_rating_range check (((rating_avg >= (0)::numeric) and (rating_avg <= (5)::numeric)));

alter table public.tricycles add constraint tricycles_pkey primary key (id);
alter table public.tricycles add constraint tricycles_plate_no_key unique (plate_no);
alter table public.tricycles add constraint tricycles_mtop_no_key unique (mtop_no);
alter table public.tricycles add constraint tricycles_driver_id_fkey foreign key (driver_id) references driver_profiles(user_id) on delete cascade;
alter table public.tricycles add constraint tricycles_verified_by_fkey foreign key (verified_by) references users(id) on delete set null;
alter table public.tricycles add constraint tricycle_seat_range check (((seat_capacity >= 1) and (seat_capacity <= 6)));

alter table public.trips add constraint trips_pkey primary key (id);
alter table public.trips add constraint trips_driver_id_fkey foreign key (driver_id) references driver_profiles(user_id) on delete restrict;
alter table public.trips add constraint trips_tricycle_id_fkey foreign key (tricycle_id) references tricycles(id) on delete restrict;
alter table public.trips add constraint trip_max_seats_range check (((max_seats >= 1) and (max_seats <= 6)));
alter table public.trips add constraint trip_timestamps_order check (((completed_at is null) or (started_at is null) or (completed_at >= started_at)));

alter table public.ride_requests add constraint ride_requests_pkey primary key (id);
alter table public.ride_requests add constraint ride_requests_passenger_id_fkey foreign key (passenger_id) references users(id) on delete restrict;
alter table public.ride_requests add constraint ride_requests_trip_id_fkey foreign key (trip_id) references trips(id) on delete set null;
alter table public.ride_requests add constraint ride_requests_pickup_barangay_id_fkey foreign key (pickup_barangay_id) references barangays(id) on delete set null;
alter table public.ride_requests add constraint rr_seats_range check (((seats_requested >= 1) and (seats_requested <= 6)));
alter table public.ride_requests add constraint rr_fare_nonneg check ((((estimated_fare is null) or (estimated_fare >= (0)::numeric)) and ((final_fare is null) or (final_fare >= (0)::numeric))));
alter table public.ride_requests add constraint rr_trip_required check (((status = any (array['pending'::ride_status, 'cancelled'::ride_status])) or (trip_id is not null)));

alter table public.driver_documents add constraint driver_documents_pkey primary key (id);
alter table public.driver_documents add constraint driver_documents_driver_id_fkey foreign key (driver_id) references driver_profiles(user_id) on delete cascade;
alter table public.driver_documents add constraint driver_documents_tricycle_id_fkey foreign key (tricycle_id) references tricycles(id) on delete cascade;
alter table public.driver_documents add constraint driver_documents_reviewed_by_fkey foreign key (reviewed_by) references users(id) on delete set null;
alter table public.driver_documents add constraint doc_target_consistency check ((((doc_type = 'drivers_license'::document_type) and (tricycle_id is null)) or ((doc_type <> 'drivers_license'::document_type) and (tricycle_id is not null))));

alter table public.transactions add constraint transactions_pkey primary key (id);
alter table public.transactions add constraint transactions_ride_request_id_key unique (ride_request_id);
alter table public.transactions add constraint transactions_gcash_reference_key unique (paymongo_session_id);
alter table public.transactions add constraint transactions_ride_request_id_fkey foreign key (ride_request_id) references ride_requests(id) on delete restrict;
alter table public.transactions add constraint transactions_cash_confirmed_by_fkey foreign key (cash_confirmed_by) references users(id) on delete set null;
alter table public.transactions add constraint txn_amount_nonneg check ((amount >= (0)::numeric));
alter table public.transactions add constraint txn_cash_needs_confirmation check (((method <> 'cash'::payment_method) or (status <> 'paid'::payment_status) or (cash_confirmed_by is not null)));
alter table public.transactions add constraint txn_paymongo_needs_reference check (((method <> 'gcash'::payment_method) or (status <> 'paid'::payment_status) or (paymongo_session_id is not null)));

alter table public.ratings add constraint ratings_pkey primary key (id);
alter table public.ratings add constraint ratings_ride_request_id_key unique (ride_request_id);
alter table public.ratings add constraint ratings_ride_request_id_fkey foreign key (ride_request_id) references ride_requests(id) on delete cascade;
alter table public.ratings add constraint ratings_passenger_id_fkey foreign key (passenger_id) references users(id) on delete cascade;
alter table public.ratings add constraint ratings_driver_id_fkey foreign key (driver_id) references driver_profiles(user_id) on delete cascade;
alter table public.ratings add constraint rating_stars_range check (((stars >= 1) and (stars <= 5)));

alter table public.complaints add constraint complaints_pkey primary key (id);
alter table public.complaints add constraint complaints_submitted_by_fkey foreign key (submitted_by) references users(id) on delete cascade;
alter table public.complaints add constraint complaints_against_user_id_fkey foreign key (against_user_id) references users(id) on delete set null;
alter table public.complaints add constraint complaints_ride_request_id_fkey foreign key (ride_request_id) references ride_requests(id) on delete set null;
alter table public.complaints add constraint complaints_triaged_by_fkey foreign key (triaged_by) references users(id) on delete set null;
alter table public.complaints add constraint complaints_resolved_by_fkey foreign key (resolved_by) references users(id) on delete set null;
alter table public.complaints add constraint complaints_mediation_scheduled_by_fkey foreign key (mediation_scheduled_by) references users(id) on delete set null;
alter table public.complaints add constraint complaints_dh_reviewed_by_fkey foreign key (dh_reviewed_by) references users(id) on delete set null;
alter table public.complaints add constraint complaint_not_self check (((against_user_id is null) or (against_user_id <> submitted_by)));
alter table public.complaints add constraint complaint_mediation_order check (((mediation_meeting_at is null) or (mediation_scheduled_at is null) or (mediation_meeting_at >= mediation_scheduled_at)));

alter table public.complaint_attachments add constraint complaint_attachments_pkey primary key (id);
alter table public.complaint_attachments add constraint complaint_attachments_complaint_id_fkey foreign key (complaint_id) references complaints(id) on delete cascade;
alter table public.complaint_attachments add constraint complaint_attachments_uploaded_by_fkey foreign key (uploaded_by) references users(id) on delete restrict;

alter table public.account_actions add constraint account_actions_pkey primary key (id);
alter table public.account_actions add constraint account_actions_target_user_id_fkey foreign key (target_user_id) references users(id) on delete cascade;
alter table public.account_actions add constraint account_actions_performed_by_fkey foreign key (performed_by) references users(id) on delete restrict;
alter table public.account_actions add constraint account_actions_complaint_id_fkey foreign key (complaint_id) references complaints(id) on delete set null;

alter table public.notifications add constraint notifications_pkey primary key (id);
alter table public.notifications add constraint notifications_user_id_fkey foreign key (user_id) references users(id) on delete cascade;

alter table public.passenger_discounts add constraint passenger_discounts_pkey primary key (id);
alter table public.passenger_discounts add constraint passenger_discounts_passenger_id_fkey foreign key (passenger_id) references users(id) on delete cascade;
alter table public.passenger_discounts add constraint passenger_discounts_reviewed_by_fkey foreign key (reviewed_by) references users(id) on delete set null;

alter table public.emergency_alerts add constraint emergency_alerts_pkey primary key (id);
alter table public.emergency_alerts add constraint emergency_alerts_ride_request_id_fkey foreign key (ride_request_id) references ride_requests(id) on delete set null;
alter table public.emergency_alerts add constraint emergency_alerts_triggered_by_fkey foreign key (triggered_by) references users(id) on delete cascade;
alter table public.emergency_alerts add constraint emergency_alerts_counterpart_id_fkey foreign key (counterpart_id) references users(id) on delete set null;
alter table public.emergency_alerts add constraint emergency_alerts_reviewed_by_fkey foreign key (reviewed_by) references users(id) on delete set null;

alter table public.saved_places add constraint saved_places_pkey primary key (id);
alter table public.saved_places add constraint saved_places_user_id_fkey foreign key (user_id) references users(id) on delete cascade;
alter table public.saved_places add constraint saved_places_icon_check check ((icon = any (array['home-outline'::text, 'briefcase-outline'::text, 'school-outline'::text, 'cart-outline'::text, 'restaurant-outline'::text, 'medkit-outline'::text, 'people-outline'::text, 'location-outline'::text])));

alter table public.system_settings add constraint system_settings_pkey primary key (id);
alter table public.system_settings add constraint system_settings_updated_by_fkey foreign key (updated_by) references users(id) on delete set null;
alter table public.system_settings add constraint settings_bearing_range check (((bearing_tolerance_deg >= (0)::numeric) and (bearing_tolerance_deg <= (180)::numeric)));
alter table public.system_settings add constraint settings_detour_range check ((detour_ratio_max >= (1)::numeric));
alter table public.system_settings add constraint settings_rating_range check (((low_rating_threshold >= (1)::numeric) and (low_rating_threshold <= (5)::numeric)));

alter table public.fare_config add constraint fare_config_pkey primary key (id);
alter table public.fare_config add constraint fare_config_updated_by_fkey foreign key (updated_by) references users(id) on delete set null;
alter table public.fare_config add constraint fare_values_positive check (((base_fare >= (0)::numeric) and (base_km > (0)::numeric) and (rate_per_km >= (0)::numeric)));
alter table public.fare_config add constraint fare_discount_range check (((discount_rate_percent >= (0)::numeric) and (discount_rate_percent <= (100)::numeric)));

alter table public.ride_assignment_events add constraint ride_assignment_events_pkey primary key (id);
alter table public.ride_assignment_events add constraint ride_assignment_events_ride_request_id_fkey foreign key (ride_request_id) references ride_requests(id) on delete cascade;
alter table public.ride_assignment_events add constraint ride_assignment_events_trip_id_fkey foreign key (trip_id) references trips(id) on delete set null;
alter table public.ride_assignment_events add constraint ride_assignment_events_driver_id_fkey foreign key (driver_id) references driver_profiles(user_id) on delete set null;
alter table public.ride_assignment_events add constraint ride_assignment_events_actor_id_fkey foreign key (actor_id) references users(id) on delete set null;

alter table public.user_consents add constraint user_consents_pkey primary key (id);
alter table public.user_consents add constraint user_consents_user_id_fkey foreign key (user_id) references users(id) on delete cascade;
alter table public.user_consents add constraint consent_policy_type_check check ((policy_type = any (array['terms_of_service'::text, 'privacy_policy'::text])));

-- ============================================================================
-- INDEXES
-- ============================================================================

create index idx_users_role on public.users using btree (role);
create index idx_users_status on public.users using btree (status);

create index idx_driver_available on public.driver_profiles using btree (is_available) where is_available;
create index idx_driver_location on public.driver_profiles using btree (current_lat, current_lng) where is_available;
create index idx_driver_verification on public.driver_profiles using btree (verification_status);

create index idx_tricycles_driver on public.tricycles using btree (driver_id);
create index idx_tricycles_mtop_expiry on public.tricycles using btree (mtop_expiry_date) where (is_active and (mtop_expiry_date is not null));
create unique index tricycles_one_active_per_driver on public.tricycles using btree (driver_id) where is_active;

create index idx_trips_driver on public.trips using btree (driver_id);
create index idx_trips_status on public.trips using btree (status) where (status = 'active'::trip_status);
create unique index trips_one_active_per_driver on public.trips using btree (driver_id) where (status = 'active'::trip_status);

create index idx_rr_passenger on public.ride_requests using btree (passenger_id);
create index idx_rr_trip on public.ride_requests using btree (trip_id);
create index idx_rr_barangay on public.ride_requests using btree (pickup_barangay_id);
create index idx_rr_pending on public.ride_requests using btree (status) where (status = 'pending'::ride_status);
create index idx_rr_requested_at on public.ride_requests using btree (requested_at desc);

create unique index driver_documents_unique_current on public.driver_documents using btree (driver_id, COALESCE(tricycle_id, '00000000-0000-0000-0000-000000000000'::uuid), doc_type);
create index idx_documents_driver on public.driver_documents using btree (driver_id);
create index idx_documents_status on public.driver_documents using btree (status) where (status = 'pending'::verification_status);

create index idx_txn_status on public.transactions using btree (status);

create index idx_ratings_driver on public.ratings using btree (driver_id);

create index idx_complaints_against on public.complaints using btree (against_user_id);
create index idx_complaints_status on public.complaints using btree (status);

create index idx_complaint_attachments_complaint on public.complaint_attachments using btree (complaint_id);

create index idx_actions_target on public.account_actions using btree (target_user_id);

create index idx_notifications_unread on public.notifications using btree (user_id, is_read) where (not is_read);

create index idx_discounts_passenger on public.passenger_discounts using btree (passenger_id);
create index idx_discounts_pending on public.passenger_discounts using btree (status) where (status = 'pending'::verification_status);
create unique index passenger_discounts_one_live_claim on public.passenger_discounts using btree (passenger_id) where (status = any (array['pending'::verification_status, 'approved'::verification_status]));

create index idx_emergency_status on public.emergency_alerts using btree (status);
create index idx_emergency_triggered_by on public.emergency_alerts using btree (triggered_by);

create index idx_saved_places_user on public.saved_places using btree (user_id, created_at desc);

create unique index system_settings_one_active on public.system_settings using btree (is_active) where is_active;

create unique index fare_config_one_active on public.fare_config using btree (is_active) where is_active;

create index idx_assignment_events_rr on public.ride_assignment_events using btree (ride_request_id, created_at);
create index idx_assignment_events_driver on public.ride_assignment_events using btree (driver_id, created_at);

create index idx_consents_user on public.user_consents using btree (user_id, policy_type);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================
-- Placed before RLS/policies/triggers because several policies below call
-- is_pso()/is_admin()/is_supervisor()/is_account_active()/app_current_role()
-- directly in their USING/WITH CHECK clauses, which Postgres resolves at
-- CREATE POLICY time (unlike plpgsql function bodies, which resolve at call
-- time) — those functions must already exist.
--
-- handle_new_auth_user has been modified several times locally (most recently by
-- 20260915000000_restrict_signup_role_reapply_after_name_split.sql); included here
-- with its current live body so this file alone is a complete, self-consistent
-- baseline, and because the trigger that attaches it to auth.users (below) was
-- never itself captured locally.

create or replace function public.handle_new_auth_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  new_role public.user_role;
begin
  -- Self-service signup may only ever grant 'passenger' or 'driver'.
  -- raw_user_meta_data is fully client-controlled (any caller of the public
  -- signup API can put arbitrary JSON in it), so pso_staff/pso_supervisor/
  -- admin must never be reachable through it, regardless of what the value
  -- claims to be.
  new_role := case
    when requested_role = 'driver' then 'driver'::public.user_role
    else 'passenger'::public.user_role
  end;

  insert into public.users (id, first_name, last_name, email, role, contact_no)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', 'Unnamed'),
    coalesce(new.raw_user_meta_data->>'last_name', 'User'),
    new.email,
    new_role,
    new.raw_user_meta_data->>'phone'
  );

  if new_role = 'driver' then
    insert into public.driver_profiles (user_id) values (new.id);
  end if;

  return new;
end;
$function$;

create or replace function public.app_current_role()
 returns user_role
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select role from public.users where id = auth.uid();
$function$;

create or replace function public.is_account_active()
 returns boolean
 language sql
 stable
 set search_path to 'public'
as $function$
  -- 'flagged' is a soft PSO Staff-level marker, not a restriction (Flag has
  -- no S+ gate, matching that it doesn't block anything). Only
  -- suspended/deactivated (S+ actions) count as blocked.
  select coalesce((select status in ('active', 'flagged') from public.users where id = auth.uid()), false);
$function$;

create or replace function public.is_admin()
 returns boolean
 language sql
 stable
 set search_path to 'public'
as $function$
  select public.app_current_role() = 'admin';
$function$;

create or replace function public.is_pso()
 returns boolean
 language sql
 stable
 set search_path to 'public'
as $function$
  select public.app_current_role() in ('pso_staff','pso_supervisor','admin');
$function$;

create or replace function public.is_supervisor()
 returns boolean
 language sql
 stable
 set search_path to 'public'
as $function$
  select public.app_current_role() in ('pso_supervisor','admin');
$function$;

create or replace function public.is_cluster_authorized(p_tricycle_cluster tricycle_cluster, p_barangay_cluster tricycle_cluster)
 returns boolean
 language sql
 immutable
 set search_path to 'public'
as $function$
  select
    p_tricycle_cluster is not null
    and p_barangay_cluster is not null
    and (
      p_tricycle_cluster = p_barangay_cluster
      or (p_barangay_cluster = 'melting_pot' and p_tricycle_cluster <> 'melting_pot')
    );
$function$;

create or replace function public.touch_updated_at()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  return new;
end $function$;

create or replace function public.business_days_since(p_start timestamp with time zone)
 returns integer
 language sql
 stable
 set search_path to 'public'
as $function$
  select count(*)::int
  from generate_series(p_start::date + 1, current_date, interval '1 day') d
  where extract(isodow from d) < 6
$function$;

create or replace function public.clear_location_when_offline()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if new.is_available = false then
    new.current_lat := null;
    new.current_lng := null;
    new.declared_dest_lat := null;
    new.declared_dest_lng := null;
    new.location_updated_at := null;
  end if;
  return new;
end $function$;

create or replace function public.enforce_driver_fare_columns_locked()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if coalesce(current_setting('trisakay.allow_fare_write', true), '') = 'on' then
    return new;
  end if;

  if public.app_current_role() = 'driver' and (
    new.final_fare is distinct from old.final_fare
    or new.estimated_fare is distinct from old.estimated_fare
    or new.discount_percent is distinct from old.discount_percent
  ) then
    raise exception 'Drivers cannot modify fare or discount fields directly';
  end if;

  return new;
end;
$function$;

create or replace function public.enforce_driver_verified_before_available()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
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
end $function$;

create or replace function public.enforce_trip_seat_capacity()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
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
end $function$;

create or replace function public.enforce_trip_seats_within_tricycle()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
declare
  cap smallint;
begin
  select seat_capacity into cap from public.tricycles where id = new.tricycle_id;

  if cap is not null and new.max_seats > cap then
    raise exception 'Trip max_seats (%) exceeds tricycle % seat_capacity (%)',
      new.max_seats, new.tricycle_id, cap;
  end if;

  return new;
end $function$;

create or replace function public.log_ride_assignment_event()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_event assignment_event_type;
  v_driver uuid;
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'ongoing' then
    return new;
  end if;

  v_driver := (select driver_id from public.trips where id = coalesce(new.trip_id, old.trip_id));

  v_event := case
    when new.status = 'assigned' then 'accepted'
    when new.status = 'completed' then 'completed'
    when new.status = 'cancelled' and auth.uid() is null then 'cancelled_by_system'
    when new.status = 'cancelled' and public.app_current_role() = 'passenger' then 'cancelled_by_passenger'
    when new.status = 'cancelled' and public.app_current_role() = 'driver' then 'cancelled_by_driver'
    when new.status = 'cancelled' then 'cancelled_by_system'
    else null
  end;

  if v_event is null then
    return new;
  end if;

  insert into public.ride_assignment_events
    (ride_request_id, trip_id, driver_id, event_type, actor_id, from_status, to_status, reason)
  values
    (new.id, new.trip_id, v_driver, v_event, auth.uid(), old.status, new.status, new.cancel_reason);

  return new;
end;
$function$;

create or replace function public.log_ride_decline_event()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.ride_assignment_events
    (ride_request_id, driver_id, event_type, actor_id, from_status, to_status, reason)
  values
    (new.ride_request_id, new.driver_id, 'offered_declined', new.driver_id, null, null, null);
  return new;
end;
$function$;

create or replace function public.cancel_ride_leg(p_trip_id uuid, p_ride_request_id uuid, p_reason text)
 returns table(ride_request_id uuid)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_now timestamptz := now();
begin
  if not exists (
    select 1 from public.trips
    where id = p_trip_id and driver_id = auth.uid() and status = 'active'
  ) then
    raise exception 'No active trip found for this driver to cancel';
  end if;

  update public.ride_requests
  set status = 'cancelled', cancelled_at = v_now, cancel_reason = p_reason
  where id = p_ride_request_id
    and trip_id = p_trip_id
    and status in ('assigned', 'ongoing');

  if not found then
    raise exception 'Ride request not found for this trip';
  end if;

  return query select p_ride_request_id;
end;
$function$;

create or replace function public.cancel_ride_request_as_passenger(p_ride_request_id uuid, p_reason text default null::text)
 returns table(ride_request_id uuid)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update public.ride_requests
  set status = 'cancelled',
      cancelled_at = now(),
      cancel_reason = coalesce(p_reason, cancel_reason)
  where id = p_ride_request_id
    and passenger_id = auth.uid()
    and status in ('pending', 'assigned');

  if not found then
    raise exception 'Could not cancel — this ride may already be picked up, completed, or no longer active.';
  end if;

  return query select p_ride_request_id;
end;
$function$;

create or replace function public.end_trip(p_trip_id uuid)
 returns table(trip_id uuid)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_now timestamptz := now();
  v_active_count int;
begin
  if not exists (
    select 1 from public.trips
    where id = p_trip_id and driver_id = auth.uid() and status = 'active'
  ) then
    raise exception 'No active trip found for this driver to end';
  end if;

  select count(*) into v_active_count
  from public.ride_requests rr
  where rr.trip_id = p_trip_id
    and rr.status in ('assigned', 'ongoing');

  if v_active_count > 0 then
    raise exception 'Cannot end trip -- % passenger(s) still active', v_active_count;
  end if;

  update public.trips
  set status = 'completed', completed_at = v_now
  where id = p_trip_id;

  return query select p_trip_id;
end;
$function$;

create or replace function public.get_active_trip_for_driver()
 returns table(trip_id uuid, started_at timestamp with time zone)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  return query
  select t.id, t.started_at
  from public.trips t
  where t.driver_id = auth.uid()
    and t.status = 'active';
end;
$function$;

create or replace function public.get_trip_driver_info(p_ride_request_id uuid)
 returns table(driver_id uuid, driver_name text, avatar_url text, plate_no text, rating_avg numeric, rating_count integer)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
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
end $function$;

create or replace function public.get_trip_passenger_info(p_ride_request_id uuid)
 returns table(passenger_id uuid, passenger_name text, avatar_url text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_driver_id uuid;
begin
  -- Only the driver actually assigned to this ride request's trip may see
  -- the passenger's info — mirrors get_trip_driver_info's passenger-side
  -- symmetry check, just reversed.
  select tr.driver_id into v_driver_id
  from public.ride_requests rr
  join public.trips tr on tr.id = rr.trip_id
  where rr.id = p_ride_request_id;

  if v_driver_id is null or v_driver_id <> auth.uid() then
    return;
  end if;

  return query
  select u.id, u.full_name, u.avatar_url
  from public.ride_requests rr
  join public.users u on u.id = rr.passenger_id
  where rr.id = p_ride_request_id;
end;
$function$;

create or replace function public.notify_expiring_franchises()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
$function$;

create or replace function public.perform_account_action(p_target_user_id uuid, p_action_type account_action_type, p_reason text, p_complaint_id uuid default null::uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_new_status account_status;
  v_rows_updated int;
begin
  if auth.uid() is null then
    raise exception 'Not authorized to perform this action.';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required for this action.';
  end if;

  if p_action_type in ('flag', 'unflag') then
    if not coalesce(is_pso(), false) then
      raise exception 'Not authorized to perform this action.';
    end if;
  elsif p_action_type in ('suspend', 'reactivate', 'deactivate') then
    if not coalesce(is_supervisor(), false) then
      raise exception 'Not authorized to perform this action.';
    end if;
  else
    raise exception 'Unsupported action type: %', p_action_type;
  end if;

  v_new_status := case p_action_type
    when 'flag' then 'flagged'::account_status
    when 'unflag' then 'active'::account_status
    when 'suspend' then 'suspended'::account_status
    when 'reactivate' then 'active'::account_status
    when 'deactivate' then 'deactivated'::account_status
  end;

  insert into public.account_actions (target_user_id, action_type, performed_by, reason, complaint_id)
  values (p_target_user_id, p_action_type, auth.uid(), p_reason, p_complaint_id);

  update public.users
  set status = v_new_status, updated_at = now()
  where id = p_target_user_id;

  get diagnostics v_rows_updated = row_count;
  if v_rows_updated = 0 then
    raise exception 'Target user not found.';
  end if;
end;
$function$;

create or replace function public.provision_cash_transaction_on_assignment()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.status = 'assigned' and new.preferred_method = 'cash'
     and (old.status is distinct from 'assigned')
  then
    insert into public.transactions (ride_request_id, method, amount, status)
    values (new.id, 'cash', coalesce(new.estimated_fare, 0), 'pending')
    on conflict (ride_request_id) do nothing;
  end if;
  return new;
end;
$function$;

create or replace function public.schedule_complaint_mediation(p_complaint_id uuid, p_meeting_at timestamp with time zone, p_location text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not coalesce(public.is_supervisor(), false) then
    raise exception 'Only a PSO Supervisor or Admin may schedule mediation';
  end if;

  if p_meeting_at is null then
    raise exception 'Meeting date/time is required';
  end if;

  update public.complaints
  set mediation_scheduled_by = auth.uid(),
      mediation_scheduled_at = now(),
      mediation_meeting_at = p_meeting_at,
      mediation_location = p_location,
      status = 'mediation_scheduled'
  where id = p_complaint_id;

  if not found then
    raise exception 'Complaint not found';
  end if;
end;
$function$;

create or replace function public.submit_driver_documents(p_plate_no text, p_documents jsonb)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_driver_id uuid := auth.uid();
  v_tricycle_id uuid;
  v_doc jsonb;
  v_doc_type document_type;
begin
  if v_driver_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.driver_profiles where user_id = v_driver_id) then
    raise exception 'No driver profile found for this account';
  end if;

  if p_documents is null or jsonb_array_length(p_documents) <> 4 then
    raise exception 'All four documents are required';
  end if;

  insert into public.tricycles (driver_id, plate_no)
  values (v_driver_id, p_plate_no)
  on conflict (driver_id) where is_active
  do update set plate_no = excluded.plate_no
  returning id into v_tricycle_id;

  for v_doc in select * from jsonb_array_elements(p_documents)
  loop
    v_doc_type := (v_doc->>'doc_type')::document_type;

    insert into public.driver_documents (driver_id, tricycle_id, doc_type, storage_path)
    values (
      v_driver_id,
      case when v_doc_type = 'drivers_license' then null else v_tricycle_id end,
      v_doc_type,
      v_doc->>'storage_path'
    )
    on conflict (driver_id, coalesce(tricycle_id, '00000000-0000-0000-0000-000000000000'::uuid), doc_type)
    do update set
      storage_path = excluded.storage_path,
      status = 'pending',
      reviewed_by = null,
      reviewed_at = null,
      remarks = null;
  end loop;

  update public.driver_profiles
  set verification_status = 'pending'
  where user_id = v_driver_id;

  update public.tricycles
  set verification_status = 'pending'
  where id = v_tricycle_id;

  return v_tricycle_id;
end;
$function$;

create or replace function public.update_fare_config(p_base_fare numeric, p_base_km numeric, p_rate_per_km numeric, p_discount_rate_percent numeric, p_ordinance_ref text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_new_id uuid;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'Only an Administrator may update fare configuration';
  end if;

  update public.fare_config set is_active = false where is_active;

  insert into public.fare_config (base_fare, base_km, rate_per_km, discount_rate_percent, ordinance_ref, updated_by, is_active)
  values (p_base_fare, p_base_km, p_rate_per_km, p_discount_rate_percent, p_ordinance_ref, auth.uid(), true)
  returning id into v_new_id;

  return v_new_id;
end;
$function$;

create or replace function public.refresh_driver_rating()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
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
end $function$;

create or replace function public.validate_rating()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
end $function$;

create or replace function public.validate_ride_status_transition()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if new.status = old.status then
    return new;
  end if;

  if (old.status, new.status) not in (
    ('pending', 'assigned'),
    ('pending', 'cancelled'),
    ('assigned', 'ongoing'),
    ('assigned', 'cancelled'),
    ('ongoing', 'cancelled'),
    ('ongoing', 'completed')
  ) then
    raise exception 'Invalid ride_requests status transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$function$;

-- ============================================================================
-- VIEWS
-- ============================================================================
-- v_flagged_low_ratings and admin_passenger_directory are already captured by
-- 20260913120000_split_users_full_name.sql and 20260921000010_add_passenger_directory_masking_view.sql.

create view public.v_driver_earnings as
select
  t.driver_id,
  date_trunc('day', rr.completed_at) as earning_date,
  count(distinct rr.id) as rides_completed,
  sum(txn.amount) as total_collected
from trips t
join ride_requests rr on (rr.trip_id = t.id and rr.status = 'completed'::ride_status)
join transactions txn on (txn.ride_request_id = rr.id and txn.status = 'paid'::payment_status)
group by t.driver_id, date_trunc('day', rr.completed_at);

create view public.v_expiring_franchises as
select
  id as tricycle_id,
  driver_id,
  plate_no,
  mtop_no,
  mtop_expiry_date,
  (mtop_expiry_date - current_date) as days_until_expiry
from tricycles t
where is_active = true and mtop_expiry_date is not null and mtop_expiry_date <= (current_date + '30 days'::interval);

-- ============================================================================
-- ROW LEVEL SECURITY + POLICIES
-- ============================================================================

alter table public.users enable row level security;
alter table public.barangays enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.tricycles enable row level security;
alter table public.trips enable row level security;
alter table public.ride_requests enable row level security;
alter table public.driver_documents enable row level security;
alter table public.transactions enable row level security;
alter table public.ratings enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_attachments enable row level security;
alter table public.account_actions enable row level security;
alter table public.notifications enable row level security;
alter table public.passenger_discounts enable row level security;
alter table public.emergency_alerts enable row level security;
alter table public.saved_places enable row level security;
alter table public.system_settings enable row level security;
alter table public.fare_config enable row level security;
alter table public.ride_assignment_events enable row level security;
alter table public.user_consents enable row level security;

create policy users_select_self on public.users for select using (((id = auth.uid()) or is_pso()));
create policy users_update_self on public.users for update using ((id = auth.uid())) with check (((id = auth.uid()) and (role = app_current_role())));
create policy users_admin_manage on public.users for all using (is_admin()) with check (is_admin());

create policy barangays_read_all on public.barangays for select using ((auth.uid() is not null));
create policy barangays_write_admin on public.barangays for all using (is_admin()) with check (is_admin());

create policy driver_select on public.driver_profiles for select using (((user_id = auth.uid()) or is_pso()));
create policy driver_update_self on public.driver_profiles for update
  using ((user_id = auth.uid()))
  with check (((user_id = auth.uid()) and (verification_status = ( select driver_profiles_1.verification_status from driver_profiles driver_profiles_1 where (driver_profiles_1.user_id = auth.uid()))) and ((is_available = false) or is_account_active())));
create policy driver_verify_supervisor on public.driver_profiles for update using (is_supervisor()) with check (is_supervisor());

create policy tricycles_select on public.tricycles for select using (((driver_id = auth.uid()) or is_pso()));
create policy tricycles_insert on public.tricycles for insert with check ((driver_id = auth.uid()));
create policy tricycles_update on public.tricycles for update
  using (((driver_id = auth.uid()) or is_supervisor()))
  with check ((is_supervisor() or ((driver_id = auth.uid())
    and (not (verification_status is distinct from ( select t.verification_status from tricycles t where (t.id = tricycles.id))))
    and (not (cluster is distinct from ( select t.cluster from tricycles t where (t.id = tricycles.id))))
    and (not (mtop_no is distinct from ( select t.mtop_no from tricycles t where (t.id = tricycles.id))))
    and (not (mtop_expiry_date is distinct from ( select t.mtop_expiry_date from tricycles t where (t.id = tricycles.id))))
    and (not (verified_by is distinct from ( select t.verified_by from tricycles t where (t.id = tricycles.id))))
    and (not (verified_at is distinct from ( select t.verified_at from tricycles t where (t.id = tricycles.id)))))));

create policy trips_select on public.trips for select using (((driver_id = auth.uid()) or is_pso()));
create policy trips_insert on public.trips for insert with check ((driver_id = auth.uid()));
create policy trips_update on public.trips for update using ((driver_id = auth.uid())) with check ((driver_id = auth.uid()));

create policy rr_passenger_select on public.ride_requests for select using ((passenger_id = auth.uid()));
create policy rr_passenger_insert on public.ride_requests for insert with check (((passenger_id = auth.uid()) and is_account_active()));
create policy rr_passenger_cancel on public.ride_requests for update
  using (((passenger_id = auth.uid()) and (status = 'pending'::ride_status)))
  with check (((passenger_id = auth.uid()) and (status = 'cancelled'::ride_status)));
create policy rr_driver_read on public.ride_requests for select
  using ((((app_current_role() = 'driver'::user_role) and (status = 'pending'::ride_status) and is_account_active()
    and (exists (select 1 from driver_profiles dp where ((dp.user_id = auth.uid()) and (dp.verification_status = 'approved'::verification_status)))))
    or (trip_id in ( select trips.id from trips where (trips.driver_id = auth.uid())))));
create policy rr_driver_update on public.ride_requests for update
  using (((status = 'pending'::ride_status) and (app_current_role() = 'driver'::user_role) and is_account_active()))
  with check (((status = 'assigned'::ride_status) and (trip_id in ( select trips.id from trips where (trips.driver_id = auth.uid())))));
create policy rr_pso_read on public.ride_requests for select using (is_pso());

create policy documents_select on public.driver_documents for select using (((driver_id = auth.uid()) or is_pso()));
create policy documents_insert on public.driver_documents for insert with check (((driver_id = auth.uid()) or is_supervisor()));
create policy documents_update on public.driver_documents for update
  using (((driver_id = auth.uid()) or is_pso()))
  with check (((driver_id = auth.uid()) or is_supervisor()));

create policy txn_own_read on public.transactions for select
  using (((ride_request_id in ( select ride_requests.id from ride_requests where (ride_requests.passenger_id = auth.uid())))
    or (ride_request_id in ( select rr.id from (ride_requests rr join trips t on ((t.id = rr.trip_id))) where (t.driver_id = auth.uid())))
    or is_pso()));
create policy txn_driver_confirm_cash on public.transactions for update
  using (((method = 'cash'::payment_method) and (ride_request_id in ( select rr.id from (ride_requests rr join trips t on ((t.id = rr.trip_id))) where (t.driver_id = auth.uid())))))
  with check (((method = 'cash'::payment_method) and (status = 'paid'::payment_status) and (cash_confirmed_by = auth.uid())));

create policy ratings_read on public.ratings for select using (((passenger_id = auth.uid()) or (driver_id = auth.uid()) or is_pso()));
create policy ratings_passenger_insert on public.ratings for insert with check ((passenger_id = auth.uid()));

create policy complaints_read on public.complaints for select using (((submitted_by = auth.uid()) or (against_user_id = auth.uid()) or is_pso()));
create policy complaints_submit on public.complaints for insert with check ((submitted_by = auth.uid()));
create policy complaints_triage_staff on public.complaints for update using (is_pso()) with check (is_pso());

create policy complaint_attachments_read on public.complaint_attachments for select
  using (((complaint_id in ( select complaints.id from complaints where ((complaints.submitted_by = auth.uid()) or (complaints.against_user_id = auth.uid())))) or is_pso()));
create policy complaint_attachments_insert on public.complaint_attachments for insert
  with check (((uploaded_by = auth.uid()) and (complaint_id in ( select complaints.id from complaints where (complaints.submitted_by = auth.uid())))));

create policy actions_read_pso on public.account_actions for select using (is_pso());
create policy actions_flag_staff on public.account_actions for insert
  with check (((performed_by = auth.uid())
    and (((action_type = any (array['flag'::account_action_type, 'unflag'::account_action_type])) and is_pso())
      or ((action_type = any (array['suspend'::account_action_type, 'reactivate'::account_action_type, 'deactivate'::account_action_type])) and is_supervisor()))));

create policy notif_select_own on public.notifications for select using ((user_id = auth.uid()));
create policy notif_update_own on public.notifications for update using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

create policy discounts_read on public.passenger_discounts for select using (((passenger_id = auth.uid()) or is_pso()));
create policy discounts_submit_own on public.passenger_discounts for insert with check ((passenger_id = auth.uid()));
create policy discounts_review_supervisor on public.passenger_discounts for update using (is_supervisor()) with check ((is_supervisor() and (reviewed_by = auth.uid())));

create policy emergency_read on public.emergency_alerts for select using (((triggered_by = auth.uid()) or is_pso()));
create policy emergency_insert_own on public.emergency_alerts for insert with check ((triggered_by = auth.uid()));
create policy emergency_review_supervisor on public.emergency_alerts for update using (is_supervisor()) with check (is_supervisor());

create policy saved_places_own on public.saved_places for all using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

create policy settings_read_pso on public.system_settings for select using (is_pso());
create policy settings_write_admin on public.system_settings for all using (is_admin()) with check (is_admin());

create policy fare_read_all on public.fare_config for select using ((auth.uid() is not null));
create policy fare_write_admin on public.fare_config for all using (is_admin()) with check (is_admin());

create policy assignment_events_read on public.ride_assignment_events for select
  using (((ride_request_id in ( select ride_requests.id from ride_requests where (ride_requests.passenger_id = auth.uid()))) or (driver_id = auth.uid()) or is_pso()));

create policy consents_read on public.user_consents for select using (((user_id = auth.uid()) or is_pso()));
create policy consents_insert_own on public.user_consents for insert with check ((user_id = auth.uid()));

-- ============================================================================
-- TRIGGERS
-- ============================================================================

create trigger trg_users_touch before update on public.users for each row execute function touch_updated_at();

create trigger trg_driver_clear_location before update on public.driver_profiles for each row execute function clear_location_when_offline();
create trigger trg_driver_profiles_sync_location after insert or update on public.driver_profiles for each row execute function sync_driver_location();
create trigger trg_driver_touch before update on public.driver_profiles for each row execute function touch_updated_at();
create trigger trg_driver_verified_before_available before update on public.driver_profiles for each row execute function enforce_driver_verified_before_available();

create trigger trg_tricycles_touch before update on public.tricycles for each row execute function touch_updated_at();

create trigger trg_trips_seats_within_tricycle before insert or update on public.trips for each row execute function enforce_trip_seats_within_tricycle();
create trigger trg_trips_touch before update on public.trips for each row execute function touch_updated_at();

create trigger trg_driver_claim_columns_locked before update on public.ride_requests for each row execute function enforce_driver_claim_columns_locked();
create trigger trg_enforce_driver_fare_columns_locked before update on public.ride_requests for each row execute function enforce_driver_fare_columns_locked();
create trigger trg_log_ride_assignment_event after update on public.ride_requests for each row execute function log_ride_assignment_event();
create trigger trg_notify_drivers_new_request after insert on public.ride_requests for each row when (new.status = 'pending'::ride_status) execute function trigger_notify_drivers_new_request();
create trigger trg_provision_cash_transaction after update on public.ride_requests for each row execute function provision_cash_transaction_on_assignment();
create trigger trg_ride_requests_fare_integrity before insert on public.ride_requests for each row execute function enforce_ride_request_fare_integrity();
create trigger trg_ride_requests_one_active_per_passenger before insert on public.ride_requests for each row execute function enforce_one_active_ride_request_per_passenger();
create trigger trg_ride_requests_seat_cap before insert or update on public.ride_requests for each row execute function enforce_trip_seat_capacity();
create trigger trg_validate_ride_status_transition before update on public.ride_requests for each row execute function validate_ride_status_transition();

create trigger trg_transactions_touch before update on public.transactions for each row execute function touch_updated_at();
create trigger trg_driver_transaction_columns_locked before update on public.transactions for each row execute function enforce_driver_transaction_columns_locked();

create trigger trg_ratings_refresh after insert or delete or update on public.ratings for each row execute function refresh_driver_rating();
create trigger trg_ratings_validate before insert on public.ratings for each row execute function validate_rating();

create trigger trg_complaints_submission_cooldown before insert on public.complaints for each row execute function enforce_complaint_submission_cooldown();
create trigger trg_complaints_supervisor_columns_locked before update on public.complaints for each row execute function enforce_complaint_supervisor_columns_locked();
create trigger trg_complaints_touch before update on public.complaints for each row execute function touch_updated_at();
create trigger trg_log_complaint_status_change after update on public.complaints for each row execute function log_complaint_status_change();

create trigger trg_notification_columns_locked before update on public.notifications for each row execute function enforce_notification_columns_locked();

create trigger trg_emergency_notify_pso after insert on public.emergency_alerts for each row execute function notify_pso_on_emergency();

-- Never captured locally: the trigger attaching handle_new_auth_user to auth.users.
-- Its function body has been redefined by several local migrations, but nothing
-- created the trigger itself, so replaying local migrations from scratch would
-- leave new Supabase Auth signups without a matching public.users row.
create trigger trg_auth_user_created after insert on auth.users for each row execute function handle_new_auth_user();

-- ============================================================================
-- STORAGE: buckets and RLS policies
-- ============================================================================
-- Never captured locally except for a single policy drop+recreate in
-- 20260915000006_restrict_approved_driver_docs_delete.sql.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('complaint-evidence', 'complaint-evidence', false, null, null),
  ('discount-ids', 'discount-ids', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('driver-docs', 'driver-docs', false, null, null)
on conflict (id) do nothing;

create policy avatars_public_read on storage.objects for select using ((bucket_id = 'avatars'::text));
create policy avatars_owner_write on storage.objects for insert with check (((bucket_id = 'avatars'::text) and ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy avatars_owner_update on storage.objects for update using (((bucket_id = 'avatars'::text) and ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy avatars_owner_delete on storage.objects for delete using (((bucket_id = 'avatars'::text) and ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy complaint_evidence_read on storage.objects for select
  using (((bucket_id = 'complaint-evidence'::text) and (((storage.foldername(name))[1] in ( select (complaints.id)::text from complaints where ((complaints.submitted_by = auth.uid()) or (complaints.against_user_id = auth.uid())))) or is_pso())));
create policy complaint_evidence_insert on storage.objects for insert
  with check (((bucket_id = 'complaint-evidence'::text) and ((storage.foldername(name))[1] in ( select (complaints.id)::text from complaints where (complaints.submitted_by = auth.uid())))));
create policy complaint_evidence_owner_delete on storage.objects for delete
  using (((bucket_id = 'complaint-evidence'::text) and ((storage.foldername(name))[1] in ( select (complaints.id)::text from complaints where (complaints.submitted_by = auth.uid())))));

create policy discount_ids_read on storage.objects for select using (((bucket_id = 'discount-ids'::text) and (((storage.foldername(name))[1] = (auth.uid())::text) or is_pso())));
create policy discount_ids_owner_insert on storage.objects for insert with check (((bucket_id = 'discount-ids'::text) and ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy discount_ids_owner_delete on storage.objects for delete using (((bucket_id = 'discount-ids'::text) and ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy driver_docs_read on storage.objects for select using (((bucket_id = 'driver-docs'::text) and (((storage.foldername(name))[1] = (auth.uid())::text) or is_pso())));
create policy driver_docs_owner_insert on storage.objects for insert with check (((bucket_id = 'driver-docs'::text) and ((storage.foldername(name))[1] = (auth.uid())::text)));
-- driver_docs_owner_delete: superseded by 20260915000006_restrict_approved_driver_docs_delete.sql
-- (that migration drops and recreates this exact policy with an added "not approved" check),
-- so it is intentionally omitted here to avoid a duplicate CREATE POLICY.
