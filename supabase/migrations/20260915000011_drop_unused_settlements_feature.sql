-- P2 (2026-09-15 launch audit): the settlement-notice feature was removed
-- from the driver app UI on 2026-09-12 (see docs/CONTEXT.MD Section 11
-- item 2), but the settlements table, its trigger, and the trigger function
-- were left behind, unused. Confirmed dead: no client code references
-- `settlements` anywhere in apps/ or packages/. Dropped on the user's
-- explicit go-ahead (previously an open decision, now resolved).
drop trigger if exists trg_notify_pso_on_settlement on public.settlements;
drop function if exists public.notify_pso_on_settlement();
drop table if exists public.settlements;
