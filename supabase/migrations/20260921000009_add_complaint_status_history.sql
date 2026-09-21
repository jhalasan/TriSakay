-- UAT A16 follow-up (2026-09-21): complaint status-change history had no
-- tracking anywhere in the schema. Scoped to status transitions only (not a
-- full row-diff of every column) per the panelist's literal ask. A trigger
-- on public.complaints catches every write path that changes status
-- (currently record_complaint_resolution and schedule_complaint_mediation,
-- both security definer RPCs) rather than instrumenting each RPC
-- individually, so any future status-changing RPC is covered automatically.

create table public.complaint_status_history (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  old_status complaint_status not null,
  new_status complaint_status not null,
  changed_by uuid references public.users(id),
  changed_at timestamptz not null default now()
);

comment on table public.complaint_status_history is
  'UAT A16 — append-only log of complaints.status transitions, written only by trg_log_complaint_status_change. Not user-writable directly.';

alter table public.complaint_status_history enable row level security;

create policy complaint_status_history_pso_read on public.complaint_status_history
  for select using (public.is_pso());

create or replace function public.log_complaint_status_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status is distinct from old.status then
    insert into public.complaint_status_history (complaint_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_complaint_status_change on public.complaints;
create trigger trg_log_complaint_status_change
after update on public.complaints
for each row
execute function public.log_complaint_status_change();
