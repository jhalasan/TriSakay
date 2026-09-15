-- Applied 2026-09-15 (launch audit, P1-13) with explicit user sign-off, per
-- this file's own original header. Originally written 2026-08-30 as
-- generated always as (requested_at + interval '18 seconds') stored, but
-- that failed on first real application: error 42P17, "generation
-- expression is not immutable" — timestamptz + interval isn't classified
-- immutable by Postgres, so it can't back a generated column. This had
-- never actually been run before, only reviewed.
--
-- requested_at is never client-set (verified: no INSERT into ride_requests
-- sets it, in packages/services/src/booking/index.ts), always taking its
-- own `default now()`. A plain `default (now() + interval '18 seconds')`
-- column evaluates within the same statement/transaction as requested_at's
-- own now() default, so the two stay equal in practice (confirmed live:
-- a test insert produced expires_at - requested_at = exactly 00:00:18)
-- while being a valid, ordinary DEFAULT rather than a GENERATED column.
--
-- FOLLOW-UP done in the same pass: packages/services/src/supabase/database.types.ts
-- regenerated, and apps/driver/src/store/useRequestsStore.ts's
-- toPendingRequest() now maps pickupDistanceMeters: row.distance_meters ?? null
-- and expiresAt: row.expires_at ?? null (RideRequestRow widened in
-- packages/services/src/booking/index.ts to carry distance_meters as an
-- optional field, since it's added ad-hoc by the match-ride-request Edge
-- Function rather than being a real ride_requests column).

alter table public.ride_requests
  add column expires_at timestamptz not null default (now() + interval '18 seconds');

comment on column public.ride_requests.expires_at is
  'Client-facing dispatch deadline for the driver-facing countdown UI (18s from requested_at). Not a hard reassignment trigger — the request stays visible to other eligible drivers in the shared pending pool regardless of this value; the client just treats it as stale past this point. A plain DEFAULT (not GENERATED, which requires an immutable expression) — both this and requested_at default to now() within the same insert statement, so they stay in lockstep in practice.';
