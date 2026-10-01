-- Complaint ownership and handoff (docs/superpowers/specs/2026-10-01-complaint-ownership-design.md).
-- Every complaint gets one named owner; claim/assign/accept/decline/release are the only ways to change it, each
-- writes an append-only history row, and a PSO Staff account may only act on a complaint it owns and has accepted.

alter table public.complaints
  add column assigned_to uuid references public.users(id) on delete set null,
  add column assigned_by uuid references public.users(id) on delete set null,
  add column assigned_at timestamptz,
  add column assignment_accepted_at timestamptz;

create index idx_complaints_assigned_to on public.complaints (assigned_to);

create table public.complaint_assignments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  from_user uuid references public.users(id) on delete set null,
  to_user uuid references public.users(id) on delete set null,
  by_user uuid references public.users(id) on delete set null,
  kind text not null check (kind in ('claimed', 'assigned', 'accepted', 'declined', 'released')),
  note text,
  created_at timestamptz not null default now()
);

create index idx_complaint_assignments_complaint on public.complaint_assignments (complaint_id, created_at);

alter table public.complaint_assignments enable row level security;
create policy complaint_assignments_read on public.complaint_assignments for select using (public.is_pso());
-- No insert/update/delete policy and no table grant: rows are written only by the RPCs below, and never changed.
revoke all on public.complaint_assignments from public, anon, authenticated;
grant select on public.complaint_assignments to authenticated;

-- Assignment columns change only inside the RPCs (they set this transaction-local flag); and PSO Staff may only
-- change a complaint's status/triage while they own it and have accepted it.
create or replace function public.enforce_complaint_ownership()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if (
    new.assigned_to is distinct from old.assigned_to
    or new.assigned_by is distinct from old.assigned_by
    or new.assigned_at is distinct from old.assigned_at
    or new.assignment_accepted_at is distinct from old.assignment_accepted_at
  ) and coalesce(current_setting('trisakay.allow_complaint_assignment', true), '') <> 'on' then
    raise exception 'A complaint''s owner can only be changed by claiming, assigning, accepting, declining or releasing it';
  end if;

  if auth.uid() is not null
     and public.app_current_role() = 'pso_staff'
     and (
       new.status is distinct from old.status
       or new.triaged_by is distinct from old.triaged_by
       or new.triaged_at is distinct from old.triaged_at
     )
     and not (old.assigned_to = auth.uid() and old.assignment_accepted_at is not null) then
    raise exception 'Claim this complaint (or have it assigned to you and accept it) before acting on it';
  end if;

  return new;
end;
$function$;

create trigger trg_complaints_ownership before update on public.complaints
  for each row execute function public.enforce_complaint_ownership();
revoke execute on function public.enforce_complaint_ownership() from public, anon, authenticated;

create or replace function public.claim_complaint(p_complaint_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_status complaint_status;
begin
  if auth.uid() is null or not coalesce(public.is_pso(), false) or not coalesce(public.is_account_active(), false) then
    raise exception 'Only active PSO staff can claim a complaint';
  end if;

  select status into v_status from public.complaints where id = p_complaint_id for update;
  if not found then raise exception 'Complaint not found'; end if;
  if v_status in ('resolved', 'dismissed') then raise exception 'This complaint is closed'; end if;

  perform set_config('trisakay.allow_complaint_assignment', 'on', true);
  update public.complaints
  set assigned_to = auth.uid(), assigned_by = auth.uid(), assigned_at = now(), assignment_accepted_at = now()
  where id = p_complaint_id and assigned_to is null;

  if not found then raise exception 'This complaint already has an owner'; end if;

  insert into public.complaint_assignments (complaint_id, from_user, to_user, by_user, kind)
  values (p_complaint_id, null, auth.uid(), auth.uid(), 'claimed');
  perform set_config('trisakay.allow_complaint_assignment', 'off', true);
end;
$function$;

create or replace function public.assign_complaint(p_complaint_id uuid, p_to_user uuid, p_note text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_status complaint_status;
  v_owner uuid;
begin
  if auth.uid() is null or not coalesce(public.is_supervisor(), false) then
    raise exception 'Only a PSO Supervisor or Admin may assign a complaint';
  end if;
  if p_note is null or btrim(p_note) = '' then raise exception 'A note is required when assigning a complaint'; end if;
  if not exists (
    select 1 from public.users
    where id = p_to_user and role in ('pso_staff', 'pso_supervisor', 'admin') and status in ('active', 'flagged')
  ) then
    raise exception 'That person cannot be assigned complaints';
  end if;

  select status, assigned_to into v_status, v_owner from public.complaints where id = p_complaint_id for update;
  if not found then raise exception 'Complaint not found'; end if;
  if v_status in ('resolved', 'dismissed') then raise exception 'This complaint is closed'; end if;
  if v_owner is not distinct from p_to_user then raise exception 'That person already owns this complaint'; end if;

  perform set_config('trisakay.allow_complaint_assignment', 'on', true);
  update public.complaints
  set assigned_to = p_to_user, assigned_by = auth.uid(), assigned_at = now(),
      -- Assigning it to yourself needs no second confirmation.
      assignment_accepted_at = case when p_to_user = auth.uid() then now() else null end
  where id = p_complaint_id;

  insert into public.complaint_assignments (complaint_id, from_user, to_user, by_user, kind, note)
  values (p_complaint_id, v_owner, p_to_user, auth.uid(), 'assigned', btrim(p_note));
  perform set_config('trisakay.allow_complaint_assignment', 'off', true);
end;
$function$;

create or replace function public.accept_complaint(p_complaint_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null or not coalesce(public.is_pso(), false) then
    raise exception 'Only PSO staff can accept a complaint';
  end if;

  perform set_config('trisakay.allow_complaint_assignment', 'on', true);
  update public.complaints set assignment_accepted_at = now()
  where id = p_complaint_id and assigned_to = auth.uid() and assignment_accepted_at is null;

  if not found then raise exception 'This complaint is not waiting for your acceptance'; end if;

  insert into public.complaint_assignments (complaint_id, from_user, to_user, by_user, kind)
  values (p_complaint_id, auth.uid(), auth.uid(), auth.uid(), 'accepted');
  perform set_config('trisakay.allow_complaint_assignment', 'off', true);
end;
$function$;

create or replace function public.decline_complaint(p_complaint_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null or not coalesce(public.is_pso(), false) then
    raise exception 'Only PSO staff can decline a complaint';
  end if;
  if p_note is null or btrim(p_note) = '' then raise exception 'A note is required when declining a complaint'; end if;

  perform set_config('trisakay.allow_complaint_assignment', 'on', true);
  update public.complaints
  set assigned_to = null, assigned_by = null, assigned_at = null, assignment_accepted_at = null
  where id = p_complaint_id and assigned_to = auth.uid() and assignment_accepted_at is null;

  if not found then raise exception 'This complaint is not waiting for your acceptance'; end if;

  insert into public.complaint_assignments (complaint_id, from_user, to_user, by_user, kind, note)
  values (p_complaint_id, auth.uid(), null, auth.uid(), 'declined', btrim(p_note));
  perform set_config('trisakay.allow_complaint_assignment', 'off', true);
end;
$function$;

create or replace function public.release_complaint(p_complaint_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_status complaint_status;
  v_owner uuid;
begin
  if auth.uid() is null or not coalesce(public.is_pso(), false) then
    raise exception 'Only PSO staff can release a complaint';
  end if;
  if p_note is null or btrim(p_note) = '' then raise exception 'A note is required when releasing a complaint'; end if;

  select status, assigned_to into v_status, v_owner from public.complaints where id = p_complaint_id for update;
  if not found then raise exception 'Complaint not found'; end if;
  if v_status in ('resolved', 'dismissed') then raise exception 'This complaint is closed'; end if;
  if v_owner is null then raise exception 'This complaint has no owner to release'; end if;
  if v_owner <> auth.uid() and not coalesce(public.is_supervisor(), false) then
    raise exception 'Only the owner or a PSO Supervisor or Admin may release this complaint';
  end if;

  perform set_config('trisakay.allow_complaint_assignment', 'on', true);
  update public.complaints
  set assigned_to = null, assigned_by = null, assigned_at = null, assignment_accepted_at = null
  where id = p_complaint_id;

  insert into public.complaint_assignments (complaint_id, from_user, to_user, by_user, kind, note)
  values (p_complaint_id, v_owner, null, auth.uid(), 'released', btrim(p_note));
  perform set_config('trisakay.allow_complaint_assignment', 'off', true);
end;
$function$;

create or replace function public.list_pso_staff()
returns table (id uuid, full_name text, role user_role)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null or not coalesce(public.is_pso(), false) then
    raise exception 'Only PSO staff can list staff';
  end if;
  return query
    select u.id, u.full_name, u.role
    from public.users u
    where u.role in ('pso_staff', 'pso_supervisor', 'admin') and u.status in ('active', 'flagged')
    order by u.full_name;
end;
$function$;

-- The Department Head directive (office procedure step 3) must be on record before mediation is scheduled.
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

  if not exists (select 1 from public.complaints where id = p_complaint_id) then
    raise exception 'Complaint not found';
  end if;

  if not exists (
    select 1 from public.complaints where id = p_complaint_id and dh_directive is not null and btrim(dh_directive) <> ''
  ) then
    raise exception 'Record the Department Head directive before scheduling mediation';
  end if;

  update public.complaints
  set mediation_scheduled_by = auth.uid(),
      mediation_scheduled_at = now(),
      mediation_meeting_at = p_meeting_at,
      mediation_location = p_location,
      status = 'mediation_scheduled'
  where id = p_complaint_id;
end;
$function$;

revoke execute on function public.claim_complaint(uuid) from public, anon;
revoke execute on function public.assign_complaint(uuid, uuid, text) from public, anon;
revoke execute on function public.accept_complaint(uuid) from public, anon;
revoke execute on function public.decline_complaint(uuid, text) from public, anon;
revoke execute on function public.release_complaint(uuid, text) from public, anon;
revoke execute on function public.list_pso_staff() from public, anon;
grant execute on function public.claim_complaint(uuid) to authenticated;
grant execute on function public.assign_complaint(uuid, uuid, text) to authenticated;
grant execute on function public.accept_complaint(uuid) to authenticated;
grant execute on function public.decline_complaint(uuid, text) to authenticated;
grant execute on function public.release_complaint(uuid, text) to authenticated;
grant execute on function public.list_pso_staff() to authenticated;
