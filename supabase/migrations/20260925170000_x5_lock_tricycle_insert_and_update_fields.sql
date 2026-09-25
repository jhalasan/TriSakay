-- X5: tricycles_insert has no forcing at all — a driver could INSERT a new
-- tricycle directly with verification_status='approved', verified_by=self,
-- verified_at=now() (instant self-approval, any plate/cluster/seats), then
-- deactivate their real approved unit to satisfy tricycles_one_active_per_driver.
-- Separately, tricycles_update (P1-3, 20260915000002) already locks
-- verification_status/cluster/mtop_no/mtop_expiry_date/verified_by/verified_at
-- but not is_active/seat_capacity/plate_no, so even an already-approved
-- tricycle's seat_capacity could be raised past what PSO actually verified.
--
-- INSERT only needs the verification fields forced — plate_no/seat_capacity
-- are legitimately driver-supplied at registration (submit_driver_documents
-- relies on this) and stay harmless while verification_status is unsubmitted,
-- since enforce_driver_verified_before_available() already requires an
-- approved tricycle before a driver can go available.

create or replace function public.enforce_tricycle_insert_fields()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.verification_status := 'unsubmitted';
  new.verified_by := null;
  new.verified_at := null;
  return new;
end;
$function$;

create trigger trg_tricycles_insert_fields
before insert on public.tricycles
for each row execute function enforce_tricycle_insert_fields();

revoke execute on function public.enforce_tricycle_insert_fields() from public;
revoke execute on function public.enforce_tricycle_insert_fields() from anon, authenticated;

-- Extends the existing P1-3 WITH CHECK pattern (correlated subquery re-reading
-- the row) with the three additional columns the doc calls out, rather than
-- introducing a second, inconsistent locking mechanism for the same table.
drop policy tricycles_update on public.tricycles;
create policy tricycles_update on public.tricycles for update
  using ((driver_id = auth.uid()) or is_supervisor())
  with check (
    is_supervisor() or (
      driver_id = auth.uid()
      and not (verification_status is distinct from (select t.verification_status from tricycles t where t.id = tricycles.id))
      and not (cluster is distinct from (select t.cluster from tricycles t where t.id = tricycles.id))
      and not (mtop_no is distinct from (select t.mtop_no from tricycles t where t.id = tricycles.id))
      and not (mtop_expiry_date is distinct from (select t.mtop_expiry_date from tricycles t where t.id = tricycles.id))
      and not (verified_by is distinct from (select t.verified_by from tricycles t where t.id = tricycles.id))
      and not (verified_at is distinct from (select t.verified_at from tricycles t where t.id = tricycles.id))
      and not (is_active is distinct from (select t.is_active from tricycles t where t.id = tricycles.id))
      and not (seat_capacity is distinct from (select t.seat_capacity from tricycles t where t.id = tricycles.id))
      and not (plate_no is distinct from (select t.plate_no from tricycles t where t.id = tricycles.id))
    )
  );
