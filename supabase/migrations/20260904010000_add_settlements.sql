-- Real backend for the driver Earnings screen's "Notify PSO for settlement"
-- button, which previously only appended to an in-memory array (no write,
-- wiped on reload, PSO never actually saw it). Mirrors emergency_alerts'
-- shape: a self-scoped audit-log table + a trigger that fans out a
-- notifications row to every PSO Staff+ account, same as
-- notify_pso_on_emergency().

alter type public.notification_type add value if not exists 'settlement_notice';

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_profiles(user_id) on delete restrict,
  amount numeric(8, 2) not null,
  notified_at timestamptz not null default now()
);

alter table public.settlements enable row level security;

create policy settlements_driver_insert on public.settlements
  for insert to authenticated
  with check (driver_id = auth.uid());

create policy settlements_driver_read on public.settlements
  for select to authenticated
  using (driver_id = auth.uid());

create policy settlements_pso_read on public.settlements
  for select to authenticated
  using (public.is_pso());

create or replace function public.notify_pso_on_settlement()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_driver_name text;
begin
  select full_name into v_driver_name from public.users where id = new.driver_id;

  insert into public.notifications (user_id, type, title, message, ref_id)
  select
    u.id,
    'settlement_notice'::notification_type,
    'Driver settlement notice',
    format('%s notified PSO of a ₱%s settlement.', coalesce(v_driver_name, 'A driver'), new.amount),
    new.id
  from public.users u
  where u.role in ('pso_staff', 'pso_supervisor', 'admin');

  return new;
end;
$$;

create trigger trg_notify_pso_on_settlement
  after insert on public.settlements
  for each row execute function public.notify_pso_on_settlement();
