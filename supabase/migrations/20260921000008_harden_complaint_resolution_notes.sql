-- UAT A13 follow-up (2026-09-21): record_complaint_resolution had no
-- server-side check that p_notes is non-empty — Complaints.tsx's "Save
-- Outcome" button already disables until the textarea is non-blank
-- (client-side fix from the first A13 pass), but a direct RPC call could
-- still bypass that. Read the live function body via execute_sql before
-- writing this (untracked, dashboard-only origin, same as submit_driver_documents)
-- to make sure this CREATE OR REPLACE reproduces its exact existing
-- behavior otherwise.

create or replace function public.record_complaint_resolution(p_complaint_id uuid, p_status complaint_status, p_notes text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not coalesce(public.is_supervisor(), false) then
    raise exception 'Only a PSO Supervisor or Admin may record a complaint resolution';
  end if;

  if p_status not in ('resolved', 'dismissed') then
    raise exception 'Resolution status must be resolved or dismissed';
  end if;

  if p_notes is null or length(trim(p_notes)) = 0 then
    raise exception 'A resolution note is required';
  end if;

  update public.complaints
  set resolved_by = auth.uid(),
      resolved_at = now(),
      resolution_notes = p_notes,
      status = p_status
  where id = p_complaint_id;

  if not found then
    raise exception 'Complaint not found';
  end if;
end;
$function$
;
