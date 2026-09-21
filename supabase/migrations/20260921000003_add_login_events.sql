-- UAT A1: AuditLog.tsx (account_actions + verification/discount decisions)
-- had no record of sign-in/sign-out activity at all. Self-reported by each
-- admin-portal client at the moment of an explicit signIn()/signOut() call
-- (useSessionStore) — not a server-verified session log (a client could in
-- principle omit its own logout row), but the insert RLS below means it can
-- never write an event for anyone else, which is enough for the
-- accountability purpose this audit trail serves alongside the existing
-- account_actions log (same insert-only, append-only shape).
create table public.login_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  event_type text not null check (event_type in ('login', 'logout')),
  created_at timestamptz not null default now()
);

comment on table public.login_events is
  'Self-reported sign-in/sign-out events (UAT A1). Insert-only, self-scoped — see login_events_insert_self.';

create index idx_login_events_user    on public.login_events (user_id);
create index idx_login_events_created on public.login_events (created_at desc);

alter table public.login_events enable row level security;

create policy login_events_insert_self on public.login_events
  for insert with check (user_id = auth.uid());

create policy login_events_read_pso on public.login_events
  for select using (public.is_pso());
