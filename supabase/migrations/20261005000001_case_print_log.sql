-- Printable case reports (docs/superpowers/plans/2026-10-04-printable-case-reports.md, Task 1).
--
-- Every PDF of a complaint or an SOS alert is recorded before it is made. record_case_print() checks
-- that the caller may print that case, writes the audit row, and hands back the document number, the
-- server time and the printer's name and role, so the PDF footer cannot be filled in by the browser.

create table if not exists public.case_print_log (
  id uuid not null default gen_random_uuid() primary key,
  case_kind text not null check (case_kind in ('complaint', 'sos_alert')),
  case_id uuid not null,
  doc_no text not null unique,
  printed_by uuid not null references public.users(id) on delete cascade,
  printed_at timestamptz not null default now(),
  include_chat boolean not null default false,
  reason text,
  check (not include_chat or length(btrim(coalesce(reason, ''))) > 0)
);

create index if not exists idx_case_print_log_case on public.case_print_log (case_kind, case_id, printed_at desc);
create index if not exists idx_case_print_log_time on public.case_print_log (printed_at desc);

alter table public.case_print_log enable row level security;

-- Supervisors and admins read the trail. Nobody writes it directly: the only writer is the
-- SECURITY DEFINER function below.
drop policy if exists case_print_log_read_supervisor on public.case_print_log;
create policy case_print_log_read_supervisor on public.case_print_log for select
  using (is_supervisor());

revoke all on public.case_print_log from public, anon;
grant select on public.case_print_log to authenticated;

-- Running number per kind and Manila year.
create table if not exists public.case_print_counters (
  case_kind text not null,
  year integer not null,
  last_number integer not null default 0,
  primary key (case_kind, year)
);

alter table public.case_print_counters enable row level security;
revoke all on public.case_print_counters from public, anon, authenticated;

create or replace function public.record_case_print(
  p_kind text,
  p_case_id uuid,
  p_include_chat boolean default false,
  p_reason text default null
)
returns table (doc_no text, printed_at timestamptz, printed_by_name text, printed_by_role text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_name text;
  v_year integer := extract(year from (now() at time zone 'Asia/Manila'))::integer;
  v_number integer;
  v_doc_no text;
  v_printed_at timestamptz := now();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_uid is null or not coalesce(public.is_pso(), false) then
    raise exception 'Not allowed.';
  end if;

  if p_kind not in ('complaint', 'sos_alert') then
    raise exception 'Unknown case type.';
  end if;

  select u.role::text, u.full_name into v_role, v_name from public.users u where u.id = v_uid;

  if p_kind = 'complaint' then
    if not exists (select 1 from public.complaints c where c.id = p_case_id) then
      raise exception 'Complaint not found.';
    end if;
    -- PSO Staff may print only a complaint they own and have accepted (the same rule that lets them act on it).
    if v_role = 'pso_staff' and not exists (
      select 1 from public.complaints c
      where c.id = p_case_id and c.assigned_to = v_uid and c.assignment_accepted_at is not null
    ) then
      raise exception 'Claim this complaint (or accept it once assigned) before printing it.';
    end if;
  else
    if not exists (select 1 from public.emergency_alerts a where a.id = p_case_id) then
      raise exception 'Emergency alert not found.';
    end if;
    if not coalesce(public.is_supervisor(), false) then
      raise exception 'Only a PSO Supervisor or Admin may print an emergency alert.';
    end if;
  end if;

  if p_include_chat then
    if not coalesce(public.is_supervisor(), false) then
      raise exception 'Only a PSO Supervisor or Admin may include a chat thread.';
    end if;
    if v_reason is null then
      raise exception 'A reason is required to include a chat thread.';
    end if;
  end if;

  insert into public.case_print_counters as c (case_kind, year, last_number)
  values (p_kind, v_year, 1)
  on conflict (case_kind, year) do update set last_number = c.last_number + 1
  returning c.last_number into v_number;

  v_doc_no := 'PSO-' || case when p_kind = 'complaint' then 'CMP' else 'SOS' end
              || '-' || v_year || '-' || lpad(v_number::text, 6, '0');

  insert into public.case_print_log (case_kind, case_id, doc_no, printed_by, printed_at, include_chat, reason)
  values (p_kind, p_case_id, v_doc_no, v_uid, v_printed_at, coalesce(p_include_chat, false), v_reason);

  return query select v_doc_no, v_printed_at, v_name, v_role;
end;
$$;

revoke execute on function public.record_case_print(text, uuid, boolean, text) from public, anon;
grant execute on function public.record_case_print(text, uuid, boolean, text) to authenticated;
