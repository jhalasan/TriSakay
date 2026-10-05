-- Printable summary reports (rides and revenue, franchise status, complaints statistics, driver roster).
--
-- They reuse the case print audit trail (20261005000001): every PDF is recorded before it is made and gets a
-- document number. A summary report is not about one case, so case_id becomes optional for the report kinds
-- and the period it covers is kept as text ("Last 30 days: 6 September to 5 October 2026").
--
-- Only Supervisor and Admin may print a summary report: they hold names, fares and revenue for the whole
-- city, the same people who may already export the same data as CSV.

alter table public.case_print_log drop constraint if exists case_print_log_case_kind_check;
alter table public.case_print_log
  add constraint case_print_log_case_kind_check
  check (case_kind in ('complaint', 'sos_alert', 'report_rides', 'report_franchise', 'report_complaints', 'report_drivers'));

alter table public.case_print_log alter column case_id drop not null;
alter table public.case_print_log add column if not exists period text;

alter table public.case_print_log drop constraint if exists case_print_log_case_id_required;
alter table public.case_print_log
  add constraint case_print_log_case_id_required
  check (case_id is not null or case_kind like 'report\_%');

create or replace function public.record_report_print(p_kind text, p_period text default null)
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
  v_period text := nullif(btrim(coalesce(p_period, '')), '');
  v_code text;
begin
  if v_uid is null or not coalesce(public.is_supervisor(), false) then
    raise exception 'Only a PSO Supervisor or Admin may print a summary report.';
  end if;

  v_code := case p_kind
    when 'report_rides' then 'RVN'
    when 'report_franchise' then 'FRN'
    when 'report_complaints' then 'CST'
    when 'report_drivers' then 'DRV'
    else null
  end;
  if v_code is null then
    raise exception 'Unknown report type.';
  end if;

  select u.role::text, u.full_name into v_role, v_name from public.users u where u.id = v_uid;

  insert into public.case_print_counters as c (case_kind, year, last_number)
  values (p_kind, v_year, 1)
  on conflict (case_kind, year) do update set last_number = c.last_number + 1
  returning c.last_number into v_number;

  v_doc_no := 'PSO-' || v_code || '-' || v_year || '-' || lpad(v_number::text, 6, '0');

  insert into public.case_print_log (case_kind, case_id, doc_no, printed_by, printed_at, include_chat, reason, period)
  values (p_kind, null, v_doc_no, v_uid, v_printed_at, false, null, v_period);

  return query select v_doc_no, v_printed_at, v_name, v_role;
end;
$$;

revoke execute on function public.record_report_print(text, text) from public, anon;
grant execute on function public.record_report_print(text, text) to authenticated;
