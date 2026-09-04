-- Real backend for the driver Requests board's "decline" action, which
-- previously only mutated a module-level in-memory Set (apps/driver/src/
-- store/useRequestsStore.ts) — a decline never reached the backend and was
-- lost on app relaunch or even a fresh subscribe() call, so a declined
-- request could resurface.

create table public.ride_request_declines (
  ride_request_id uuid not null references public.ride_requests(id) on delete cascade,
  driver_id uuid not null references public.driver_profiles(user_id) on delete cascade,
  declined_at timestamptz not null default now(),
  primary key (ride_request_id, driver_id)
);

alter table public.ride_request_declines enable row level security;

create policy ride_request_declines_driver_insert on public.ride_request_declines
  for insert to authenticated
  with check (driver_id = auth.uid());

create policy ride_request_declines_driver_read on public.ride_request_declines
  for select to authenticated
  using (driver_id = auth.uid());
