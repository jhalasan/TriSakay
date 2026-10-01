-- Assertions for complaint ownership. Run in ONE execute_sql call AFTER (or, before the migration is applied,
-- right after pasting) 20261001000004_complaint_ownership.sql. Borrows existing users, flips their roles INSIDE
-- this transaction, creates a throwaway complaint, and ends with ROLLBACK, so nothing persists.
-- A failed assertion raises 'FAIL n: ...'.

begin;

create temp table _fx as
select
  (select id from public.users where role = 'admin' and status = 'active' order by created_at limit 1) as admin_id,
  (select id from public.users where role = 'passenger' and status = 'active' order by created_at limit 1) as staff_a,
  (select id from public.users where role = 'driver' and status = 'active' order by created_at limit 1) as staff_b,
  (select id from public.users where role = 'passenger' and status = 'active' order by created_at limit 1 offset 1) as filer_id;

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;

-- Fixtures (service level): two staff accounts and one complaint.
do $$
declare fx record; v_filer uuid;
begin
  select * into fx from _fx;
  if fx.admin_id is null or fx.staff_a is null or fx.staff_b is null then
    raise exception 'FAIL 0: need an admin, two passengers and a driver to borrow';
  end if;
  update public.users set role = 'pso_staff' where id in (fx.staff_a, fx.staff_b);
  v_filer := coalesce(fx.filer_id, fx.admin_id);
  insert into public.complaints (id, submitted_by, category, subject, message)
  values ('00000000-0000-0000-0000-0000000000c1', v_filer, 'fare', 'T', 'M');
end $$;

-- 1: a plain staff member cannot act on an unowned complaint.
do $$
declare fx record;
begin
  select * into fx from _fx;
  perform pg_temp.as_user(fx.staff_a);
  begin
    update public.complaints set status = 'under_review' where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'FAIL 1: staff changed status of an unowned complaint';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- 2: claim works once; a second claim fails; history row written.
do $$
declare fx record; n int;
begin
  select * into fx from _fx;
  perform pg_temp.as_user(fx.staff_a);
  perform public.claim_complaint('00000000-0000-0000-0000-0000000000c1');
  perform pg_temp.as_user(fx.staff_b);
  begin
    perform public.claim_complaint('00000000-0000-0000-0000-0000000000c1');
    raise exception 'FAIL 2: second claim succeeded';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform pg_temp.as_service();
  select count(*) into n from public.complaint_assignments where complaint_id = '00000000-0000-0000-0000-0000000000c1' and kind = 'claimed';
  if n <> 1 then raise exception 'FAIL 2b: expected 1 claimed row, got %', n; end if;
end $$;

-- 3: the owner can now triage; the other staff member cannot.
do $$
declare fx record;
begin
  select * into fx from _fx;
  perform pg_temp.as_user(fx.staff_a);
  update public.complaints set status = 'under_review', triaged_by = fx.staff_a, triaged_at = now()
  where id = '00000000-0000-0000-0000-0000000000c1';
  perform pg_temp.as_user(fx.staff_b);
  begin
    update public.complaints set status = 'escalated' where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'FAIL 3: a non-owner changed the status';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- 4: owner column cannot be edited directly, even by an admin.
do $$
declare fx record;
begin
  select * into fx from _fx;
  perform pg_temp.as_user(fx.admin_id);
  begin
    update public.complaints set assigned_to = fx.admin_id where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'FAIL 4: assigned_to edited directly';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- 5: staff cannot assign; admin needs a note; admin assign puts it awaiting acceptance and staff can't act meanwhile.
do $$
declare fx record; v_accepted timestamptz;
begin
  select * into fx from _fx;
  perform pg_temp.as_user(fx.staff_a);
  begin
    perform public.assign_complaint('00000000-0000-0000-0000-0000000000c1', fx.staff_b, 'please take');
    raise exception 'FAIL 5a: staff assigned a complaint';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  perform pg_temp.as_user(fx.admin_id);
  begin
    perform public.assign_complaint('00000000-0000-0000-0000-0000000000c1', fx.staff_b, '  ');
    raise exception 'FAIL 5b: assigned with a blank note';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform public.assign_complaint('00000000-0000-0000-0000-0000000000c1', fx.staff_b, 'Please contact both parties');

  perform pg_temp.as_service();
  select assignment_accepted_at into v_accepted from public.complaints where id = '00000000-0000-0000-0000-0000000000c1';
  if v_accepted is not null then raise exception 'FAIL 5c: assignment was auto-accepted'; end if;

  perform pg_temp.as_user(fx.staff_b);
  begin
    update public.complaints set status = 'escalated' where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'FAIL 5d: staff acted before accepting';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- 6: only the new owner can accept; after accepting they can act.
do $$
declare fx record;
begin
  select * into fx from _fx;
  perform pg_temp.as_user(fx.staff_a);
  begin
    perform public.accept_complaint('00000000-0000-0000-0000-0000000000c1');
    raise exception 'FAIL 6a: the wrong person accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform pg_temp.as_user(fx.staff_b);
  perform public.accept_complaint('00000000-0000-0000-0000-0000000000c1');
  update public.complaints set status = 'escalated', triaged_by = fx.staff_b, triaged_at = now()
  where id = '00000000-0000-0000-0000-0000000000c1';
end $$;

-- 7: decline needs a note and returns the complaint to Unassigned (after a fresh assignment).
do $$
declare fx record; v_owner uuid;
begin
  select * into fx from _fx;
  perform pg_temp.as_user(fx.admin_id);
  perform public.assign_complaint('00000000-0000-0000-0000-0000000000c1', fx.staff_a, 'Over to you');
  perform pg_temp.as_user(fx.staff_a);
  begin
    perform public.decline_complaint('00000000-0000-0000-0000-0000000000c1', '');
    raise exception 'FAIL 7a: declined without a note';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform public.decline_complaint('00000000-0000-0000-0000-0000000000c1', 'On leave');
  perform pg_temp.as_service();
  select assigned_to into v_owner from public.complaints where id = '00000000-0000-0000-0000-0000000000c1';
  if v_owner is not null then raise exception 'FAIL 7b: declined complaint still has an owner'; end if;
end $$;

-- 8: release: only the owner or S+; needs a note.
do $$
declare fx record;
begin
  select * into fx from _fx;
  perform pg_temp.as_user(fx.staff_a);
  perform public.claim_complaint('00000000-0000-0000-0000-0000000000c1');
  perform pg_temp.as_user(fx.staff_b);
  begin
    perform public.release_complaint('00000000-0000-0000-0000-0000000000c1', 'taking it');
    raise exception 'FAIL 8a: a non-owner staff member released it';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform pg_temp.as_user(fx.admin_id);
  perform public.release_complaint('00000000-0000-0000-0000-0000000000c1', 'Owner away');
end $$;

-- 9: the history cannot be edited or deleted by a staff session; it can be read by staff.
do $$
declare fx record; n int;
begin
  select * into fx from _fx;
  perform pg_temp.as_user(fx.admin_id);
  select count(*) into n from public.complaint_assignments where complaint_id = '00000000-0000-0000-0000-0000000000c1';
  if n < 5 then raise exception 'FAIL 9a: expected at least 5 history rows, got %', n; end if;
  begin
    delete from public.complaint_assignments where complaint_id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'FAIL 9b: history deleted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    update public.complaint_assignments set note = 'x' where complaint_id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'FAIL 9c: history edited';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- 10: mediation is blocked until a directive is on record.
do $$
declare fx record;
begin
  select * into fx from _fx;
  perform pg_temp.as_user(fx.admin_id);
  begin
    perform public.schedule_complaint_mediation('00000000-0000-0000-0000-0000000000c1', now() + interval '2 day', 'PSO');
    raise exception 'FAIL 10a: mediation scheduled without a directive';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  update public.complaints set dh_directive = 'Invite both parties', dh_reviewed_by = fx.admin_id, dh_reviewed_at = now()
  where id = '00000000-0000-0000-0000-0000000000c1';
  perform public.schedule_complaint_mediation('00000000-0000-0000-0000-0000000000c1', now() + interval '2 day', 'PSO');
end $$;

-- 11: a closed complaint cannot be claimed or reassigned; a passenger cannot list staff.
do $$
declare fx record;
begin
  select * into fx from _fx;
  perform pg_temp.as_service();
  update public.complaints set status = 'resolved' where id = '00000000-0000-0000-0000-0000000000c1';
  perform pg_temp.as_user(fx.admin_id);
  begin
    perform public.assign_complaint('00000000-0000-0000-0000-0000000000c1', fx.staff_a, 'late');
    raise exception 'FAIL 11a: closed complaint reassigned';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform pg_temp.as_service();
  update public.users set role = 'passenger' where id = fx.staff_a;
  perform pg_temp.as_user(fx.staff_a);
  begin
    perform * from public.list_pso_staff();
    raise exception 'FAIL 11b: a passenger listed staff';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

rollback;
select 'complaint_ownership: all assertions passed' as result;
