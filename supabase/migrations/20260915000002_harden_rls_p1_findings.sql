-- P1-1..P1-6 RLS hardening (2026-09-15 launch audit). Each change verified
-- against actual client call sites (packages/services/src) so no legitimate
-- write path is broken -- grepped every raw .update()/.insert() against the
-- affected tables before narrowing any policy. Every exploit path and every
-- legitimate flow was also re-verified live against ygdgbvxxqrkxlezpckif
-- using `set local role authenticated; set local request.jwt.claims = ...`
-- inside rolled-back transactions, for both the blocked exploit and the
-- still-working legitimate case, before this file was written.

-- ---------------------------------------------------------------------
-- P1-1: pso_staff could resolve/dismiss/schedule-mediate any complaint via
-- a raw PATCH, bypassing the is_supervisor()-gated
-- schedule_complaint_mediation()/record_complaint_resolution() RPCs the UI
-- uses. Those RPCs are SECURITY DEFINER and unaffected by this trigger (it
-- checks the calling user's role via auth.uid(), which is unchanged by
-- SECURITY DEFINER, so a real supervisor invoking the RPC still passes).
-- A plain pso_staff account attempting the same columns/status directly is
-- now blocked, mirroring the account_actions is_pso()/is_supervisor() split.
create or replace function public.enforce_complaint_supervisor_columns_locked()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if public.app_current_role() = 'pso_staff' and (
    new.status in ('resolved', 'dismissed', 'mediation_scheduled')
    or new.resolved_by is distinct from old.resolved_by
    or new.resolved_at is distinct from old.resolved_at
    or new.resolution_notes is distinct from old.resolution_notes
    or new.mediation_scheduled_by is distinct from old.mediation_scheduled_by
    or new.mediation_scheduled_at is distinct from old.mediation_scheduled_at
    or new.mediation_meeting_at is distinct from old.mediation_meeting_at
    or new.mediation_location is distinct from old.mediation_location
  ) then
    raise exception 'PSO Staff cannot schedule mediation or record a complaint resolution directly -- only a PSO Supervisor or Admin may';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_complaints_supervisor_columns_locked on public.complaints;
create trigger trg_complaints_supervisor_columns_locked
before update on public.complaints
for each row execute function public.enforce_complaint_supervisor_columns_locked();

-- ---------------------------------------------------------------------
-- P1-2: documents_owner_rw / tricycles_owner_rw / trips_driver_rw are all
-- `FOR ALL`, and DELETE is governed only by USING -- so is_pso() in USING
-- let any PSO Staff account permanently delete driver documents, tricycle
-- records and trip history. No client code deletes from any of these three
-- tables (verified by grep), so DELETE is dropped entirely rather than
-- re-scoped.
drop policy if exists documents_owner_rw on public.driver_documents;
create policy documents_select on public.driver_documents
  for select using (driver_id = auth.uid() or is_pso());
create policy documents_insert on public.driver_documents
  for insert with check (driver_id = auth.uid() or is_supervisor());
create policy documents_update on public.driver_documents
  for update using (driver_id = auth.uid() or is_pso())
  with check (driver_id = auth.uid() or is_supervisor());

drop policy if exists trips_driver_rw on public.trips;
create policy trips_select on public.trips
  for select using (driver_id = auth.uid() or is_pso());
create policy trips_insert on public.trips
  for insert with check (driver_id = auth.uid());
create policy trips_update on public.trips
  for update using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

-- tricycles_owner_rw is replaced below (P1-3) rather than here, since it
-- also needs its WITH CHECK narrowed, not just DELETE dropped.

-- ---------------------------------------------------------------------
-- P1-3: tricycles_owner_rw's WITH CHECK let a driver self-approve their own
-- tricycle and set its cluster/MTOP fields ((driver_id = auth.uid() OR
-- is_supervisor()) with no column pinning) -- unlike driver_update_self on
-- driver_profiles, which correctly pins verification_status. Pin the same
-- PSO-reviewer-only columns here, and drop DELETE (see P1-2 above; no
-- client code deletes tricycles).
drop policy if exists tricycles_owner_rw on public.tricycles;
create policy tricycles_select on public.tricycles
  for select using (driver_id = auth.uid() or is_pso());
create policy tricycles_insert on public.tricycles
  for insert with check (driver_id = auth.uid());
create policy tricycles_update on public.tricycles
  for update using (driver_id = auth.uid() or is_supervisor())
  with check (
    is_supervisor()
    or (
      driver_id = auth.uid()
      and verification_status is not distinct from (select t.verification_status from public.tricycles t where t.id = tricycles.id)
      and cluster is not distinct from (select t.cluster from public.tricycles t where t.id = tricycles.id)
      and mtop_no is not distinct from (select t.mtop_no from public.tricycles t where t.id = tricycles.id)
      and mtop_expiry_date is not distinct from (select t.mtop_expiry_date from public.tricycles t where t.id = tricycles.id)
      and verified_by is not distinct from (select t.verified_by from public.tricycles t where t.id = tricycles.id)
      and verified_at is not distinct from (select t.verified_at from public.tricycles t where t.id = tricycles.id)
    )
  );

-- ---------------------------------------------------------------------
-- P1-4: rr_driver_update had no WITH CHECK (Postgres reused USING), so any
-- online driver could update *any* pending ride_request's status,
-- coordinates, seats_requested, cancel_reason, etc. -- not just their own
-- claim. The only raw-table write a driver performs is the claim
-- (acceptRideRequest: trip_id + status='assigned' + assigned_at, filtered
-- to status='pending' -- verified in packages/services/src/booking/index.ts).
-- All trip-lifecycle progression (start/complete/cancel leg) goes through
-- SECURITY DEFINER RPCs, which are unaffected by this policy.
drop policy if exists rr_driver_update on public.ride_requests;
create policy rr_driver_update on public.ride_requests
  for update using (
    status = 'pending' and app_current_role() = 'driver' and is_account_active()
  )
  with check (
    status = 'assigned'
    and trip_id in (select id from public.trips where driver_id = auth.uid())
  );

-- Companion trigger: WITH CHECK alone can't compare new vs. old, so a
-- malicious claim call could still smuggle unrelated column changes
-- (pickup/destination, seats_requested, passenger_id, ...) into the same
-- UPDATE that satisfies the check above. Mirrors the existing
-- enforce_driver_fare_columns_locked pattern for fare columns.
create or replace function public.enforce_driver_claim_columns_locked()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if public.app_current_role() = 'driver' and (
    new.passenger_id is distinct from old.passenger_id
    or new.pickup_lat is distinct from old.pickup_lat
    or new.pickup_lng is distinct from old.pickup_lng
    or new.pickup_label is distinct from old.pickup_label
    or new.dest_lat is distinct from old.dest_lat
    or new.dest_lng is distinct from old.dest_lng
    or new.dest_label is distinct from old.dest_label
    or new.seats_requested is distinct from old.seats_requested
    or new.preferred_method is distinct from old.preferred_method
    or new.requested_at is distinct from old.requested_at
    or new.pickup_barangay_id is distinct from old.pickup_barangay_id
    or new.distance_km is distinct from old.distance_km
  ) then
    raise exception 'Drivers cannot modify ride request details -- only trip assignment and lifecycle fields';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_driver_claim_columns_locked on public.ride_requests;
create trigger trg_driver_claim_columns_locked
before update on public.ride_requests
for each row execute function public.enforce_driver_claim_columns_locked();

-- ---------------------------------------------------------------------
-- P1-5: txn_driver_confirm_cash had no WITH CHECK, so a driver confirming
-- cash could also set `amount` to any value while marking `paid`. The only
-- client call (confirmCashPayment) sends only status/cash_confirmed_by/
-- cash_confirmed_at -- pin those, and lock amount/ride_request_id/method
-- from driver-role changes for the same WITH-CHECK-can't-see-old reason
-- as P1-4.
drop policy if exists txn_driver_confirm_cash on public.transactions;
create policy txn_driver_confirm_cash on public.transactions
  for update using (
    method = 'cash'
    and ride_request_id in (
      select rr.id from public.ride_requests rr join public.trips t on t.id = rr.trip_id
      where t.driver_id = auth.uid()
    )
  )
  with check (
    method = 'cash'
    and status = 'paid'
    and cash_confirmed_by = auth.uid()
  );

create or replace function public.enforce_driver_transaction_columns_locked()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if public.app_current_role() = 'driver' and (
    new.amount is distinct from old.amount
    or new.ride_request_id is distinct from old.ride_request_id
    or new.method is distinct from old.method
  ) then
    raise exception 'Drivers cannot modify the transaction amount, ride, or method -- only confirm cash receipt';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_driver_transaction_columns_locked on public.transactions;
create trigger trg_driver_transaction_columns_locked
before update on public.transactions
for each row execute function public.enforce_driver_transaction_columns_locked();

-- ---------------------------------------------------------------------
-- P1-6: rr_driver_read let any account with role='driver' read every
-- pending ride_request's exact passenger_id + pickup/destination
-- coordinates, with no verification check -- driver_profiles.verification_
-- status defaults to 'unsubmitted' and was never consulted. An
-- unverified, self-registered "driver" got a live feed of every waiting
-- passenger's location. Require approved verification, matching the bar
-- enforce_driver_verified_before_available() already applies before a
-- driver can go online.
drop policy if exists rr_driver_read on public.ride_requests;
create policy rr_driver_read on public.ride_requests
  for select using (
    (
      app_current_role() = 'driver'
      and status = 'pending'
      and is_account_active()
      and exists (
        select 1 from public.driver_profiles dp
        where dp.user_id = auth.uid() and dp.verification_status = 'approved'
      )
    )
    or trip_id in (select id from public.trips where driver_id = auth.uid())
  );
