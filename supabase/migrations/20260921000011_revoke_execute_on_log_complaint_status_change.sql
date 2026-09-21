-- UAT A16 hygiene follow-up: log_complaint_status_change() is a trigger
-- function (returns trigger, called only via trg_log_complaint_status_change),
-- never meant to be invoked directly — Postgres already blocks calling a
-- trigger function outside trigger context, but the advisor still flags it
-- as PostgREST-exposed to anon/authenticated. Revoke EXECUTE explicitly,
-- same hygiene as 20260915000008_revoke_anon_execute_on_definer_functions.sql.
revoke execute on function public.log_complaint_status_change() from anon, authenticated;
