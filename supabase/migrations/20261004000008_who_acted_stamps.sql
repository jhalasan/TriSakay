-- Who acted on a case, recorded by the database (audit 2026-10-04).
--
-- Review and decision screens used to send their own user id and clock time ("reviewed_by", "triaged_at",
-- "updated_by" ...), so anyone with API access could put another person's name or a different time on a
-- record. These triggers overwrite those fields with auth.uid() and now() whenever a signed-in user changes
-- them. Maintenance work done with the service role (auth.uid() is null) is left alone.
--
-- Emergency alerts also get "closed by / closed at", and a note is required before an alert can be marked
-- reviewed.

-- ---------------------------------------------------------------- emergency alerts

alter table public.emergency_alerts
  add column if not exists closed_by uuid references public.users(id),
  add column if not exists closed_at timestamptz;

create or replace function public.enforce_emergency_review_stamps()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  -- No status change: the record of who reviewed/closed it and what they noted cannot be edited.
  if new.status is not distinct from old.status then
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    new.closed_by := old.closed_by;
    new.closed_at := old.closed_at;
    new.notes := old.notes;
    return new;
  end if;

  if old.status = 'logged' and new.status = 'reviewed' then
    if btrim(coalesce(new.notes, '')) = '' then
      raise exception 'Add a note describing what was done before marking this alert reviewed.';
    end if;
    new.notes := btrim(new.notes);
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
    new.closed_by := null;
    new.closed_at := null;
  elsif old.status = 'reviewed' and new.status = 'closed' then
    new.notes := old.notes;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    new.closed_by := auth.uid();
    new.closed_at := now();
  else
    raise exception 'An alert cannot move from % to %.', old.status, new.status;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_emergency_review_stamps() from public, anon, authenticated;

drop trigger if exists trg_emergency_review_stamps on public.emergency_alerts;
create trigger trg_emergency_review_stamps
before update on public.emergency_alerts
for each row execute function public.enforce_emergency_review_stamps();

-- ---------------------------------------------------------------- discount decisions

create or replace function public.stamp_discount_review()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if auth.uid() is not null and new.status is distinct from old.status then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.stamp_discount_review() from public, anon, authenticated;

-- Named so it runs before trg_discounts_set_expiry_on_approval, which works out expires_at from reviewed_at.
drop trigger if exists trg_discounts_review_stamp on public.passenger_discounts;
create trigger trg_discounts_review_stamp
before update on public.passenger_discounts
for each row execute function public.stamp_discount_review();

-- ---------------------------------------------------------------- complaint triage and department head review

create or replace function public.stamp_complaint_actors()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.triaged_by is distinct from old.triaged_by or new.triaged_at is distinct from old.triaged_at then
    new.triaged_by := auth.uid();
    new.triaged_at := now();
  end if;

  if new.dh_reviewed_by is distinct from old.dh_reviewed_by or new.dh_reviewed_at is distinct from old.dh_reviewed_at then
    new.dh_reviewed_by := auth.uid();
    new.dh_reviewed_at := now();
  end if;

  return new;
end;
$$;

revoke execute on function public.stamp_complaint_actors() from public, anon, authenticated;

drop trigger if exists trg_complaints_stamp_actors on public.complaints;
create trigger trg_complaints_stamp_actors
before update on public.complaints
for each row execute function public.stamp_complaint_actors();

-- ---------------------------------------------------------------- barangay amendments

create or replace function public.stamp_barangay_amendment()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.stamp_barangay_amendment() from public, anon, authenticated;

drop trigger if exists trg_barangays_stamp_amendment on public.barangays;
create trigger trg_barangays_stamp_amendment
before insert or update on public.barangays
for each row execute function public.stamp_barangay_amendment();
