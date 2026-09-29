-- Advisor flagged trigger_notify_new_message as directly RPC-callable by
-- anon/authenticated (SECURITY DEFINER with no execute revoke) — unlike
-- this migration's other two trigger functions, which already revoke it.
-- A trigger function never needs EXECUTE granted to be fired by its
-- trigger event; this closes the same direct-call surface as
-- trigger_notify_drivers_new_request should have (pre-existing, out of
-- scope here) but wasn't retroactively fixed for.
revoke execute on function public.trigger_notify_new_message() from public;
revoke execute on function public.trigger_notify_new_message() from anon, authenticated;
