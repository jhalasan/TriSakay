-- P2 (2026-09-15 launch audit): 25 SECURITY DEFINER functions were callable
-- via /rest/v1/rpc/<name> by a fully anonymous caller (no JWT at all).
-- Every real RPC among them already does its own internal auth check and
-- fails closed (verified individually during this audit), so this was
-- defense-in-depth rather than an active hole — but revoking the class
-- removes it outright rather than relying on each function's own logic
-- staying correct forever.
--
-- Getting the REVOKE right needed two passes, both folded into this single
-- file (verified live via pg_proc.proacl / has_function_privilege after
-- each): a plain `REVOKE ... FROM anon` or `FROM PUBLIC` had NO effect on
-- several of these — Supabase grants EXECUTE directly to anon/authenticated/
-- service_role on every function in the exposed public schema by default
-- (a per-role grant in the function's ACL, not an inherited PUBLIC grant),
-- so the role actually holding the grant must be named explicitly.
--
-- Two categories:
--   1. Real RPCs a signed-in user legitimately calls (get_active_trip_for_driver,
--      perform_account_action, update_fare_config, etc.) — revoke from anon
--      only, keep authenticated.
--   2. Pure trigger functions (RETURNS trigger) with no legitimate direct
--      caller at all — Postgres itself refuses a bare call to a
--      trigger-returning function ("trigger functions can only be called
--      as triggers"), and trigger *invocation* is not gated by EXECUTE at
--      all, so revoking both anon and authenticated here is pure hygiene
--      with zero functional effect on real signups/inserts (verified live:
--      a rolled-back emergency_alerts insert still fanned out notifications
--      to all 3 PSO accounts after this revoke).

-- Category 1: real RPCs — anon only.
revoke execute on function public.app_current_role() from anon;
revoke execute on function public.cancel_ride_leg(uuid, uuid, text) from anon;
revoke execute on function public.complete_ride_leg(uuid, uuid) from anon;
revoke execute on function public.end_trip(uuid) from anon;
revoke execute on function public.get_active_trip_for_driver() from anon;
revoke execute on function public.get_active_trip_passengers(uuid) from anon;
revoke execute on function public.get_driver_accept_rate() from anon;
revoke execute on function public.get_driver_trip_history(integer) from anon;
revoke execute on function public.get_passenger_trip_history(integer) from anon;
revoke execute on function public.get_trip_driver_info(uuid) from anon;
revoke execute on function public.get_trip_passenger_info(uuid) from anon;
revoke execute on function public.perform_account_action(uuid, account_action_type, text, uuid) from anon;
revoke execute on function public.perform_verification_decision(uuid, verification_status, text) from anon;
revoke execute on function public.record_complaint_resolution(uuid, complaint_status, text) from anon;
revoke execute on function public.schedule_complaint_mediation(uuid, timestamptz, text) from anon;
revoke execute on function public.start_ride_leg(uuid, uuid) from anon;
revoke execute on function public.submit_driver_documents(text, jsonb) from anon;
revoke execute on function public.update_fare_config(numeric, numeric, numeric, numeric, text) from anon;

-- Category 2: pure trigger functions — anon and authenticated.
revoke execute on function public.handle_new_auth_user() from anon, authenticated;
revoke execute on function public.notify_pso_on_emergency() from anon, authenticated;
revoke execute on function public.notify_pso_on_settlement() from anon, authenticated;
revoke execute on function public.provision_cash_transaction_on_assignment() from anon, authenticated;
revoke execute on function public.sync_driver_location() from anon, authenticated;
revoke execute on function public.validate_rating() from anon, authenticated;
revoke execute on function public.touch_updated_at() from anon, authenticated;
revoke execute on function public.clear_location_when_offline() from anon, authenticated;
revoke execute on function public.enforce_driver_verified_before_available() from anon, authenticated;
revoke execute on function public.enforce_trip_seat_capacity() from anon, authenticated;
revoke execute on function public.enforce_trip_seats_within_tricycle() from anon, authenticated;
revoke execute on function public.refresh_driver_rating() from anon, authenticated;
-- Added this session (P1-12), called only via pg_net from a trigger
-- (postgres role) — never via RPC by any client.
revoke execute on function public.trigger_notify_drivers_new_request() from anon, authenticated;
