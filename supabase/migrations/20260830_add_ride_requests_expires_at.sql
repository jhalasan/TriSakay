-- NOT APPLIED. Written for later review/application with the user's explicit sign-off.
-- See .superpowers/sdd/2026-08-28-trisakay-home-redesign/task-8-brief.md (Step 2).
--
-- FOLLOW-UP once applied: after running this migration and regenerating
-- packages/services/src/supabase/database.types.ts, apps/driver/src/store/
-- useRequestsStore.ts's toPendingRequest() also needs two fields added to the
-- object it returns — pickupDistanceMeters: row.distance_meters ?? null
-- (mapped from the distance_meters field the match-ride-request Edge
-- Function now exposes) and expiresAt: row.expires_at ?? null (mapped from
-- the expires_at column added below). See the matching
-- // TODO(migration): comment in toPendingRequest() itself.

alter table public.ride_requests
  add column expires_at timestamptz generated always as (requested_at + interval '18 seconds') stored;

comment on column public.ride_requests.expires_at is
  'Client-facing dispatch deadline for the driver-facing countdown UI (18s from requested_at). Not a hard reassignment trigger — the request stays visible to other eligible drivers in the shared pending pool regardless of this value; the client just treats it as stale past this point.';
