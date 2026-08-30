-- NOT APPLIED. Written for later review/application with the user's explicit sign-off.
-- See .superpowers/sdd/2026-08-28-trisakay-home-redesign/task-8-brief.md (Step 2).

alter table public.ride_requests
  add column expires_at timestamptz generated always as (requested_at + interval '18 seconds') stored;

comment on column public.ride_requests.expires_at is
  'Client-facing dispatch deadline for the driver-facing countdown UI (18s from requested_at). Not a hard reassignment trigger — the request stays visible to other eligible drivers in the shared pending pool regardless of this value; the client just treats it as stale past this point.';
