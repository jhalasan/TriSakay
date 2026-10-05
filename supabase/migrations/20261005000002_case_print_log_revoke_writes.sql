-- Tidy-up for 20261005000001: new tables in this project grant insert/update/delete to the signed-in
-- role by default. Row security already blocks every direct write (tested), but the audit table should
-- not even offer the privilege. Only record_case_print() writes to it.
revoke insert, update, delete, truncate, references, trigger on public.case_print_log from authenticated;
