-- FR-1.6a's in-app half: a driver is never notified (in-app or otherwise)
-- when PSO approves/rejects their verification — driver_profiles.verification_status
-- flips for real, but nothing ever surfaces that to the driver beyond them
-- happening to reopen verification-pending.tsx. Email stays out of scope
-- (no email-sending infrastructure exists anywhere in this repo).
create or replace function public.perform_verification_decision(
  p_driver_id uuid,
  p_decision verification_status,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not coalesce(public.is_supervisor(), false) then
    raise exception 'Only a PSO Supervisor or Admin may approve or reject a verification case';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  update public.driver_profiles
  set verification_status = p_decision,
      verified_by = auth.uid(),
      verified_at = now()
  where user_id = p_driver_id;

  update public.tricycles
  set verification_status = p_decision,
      verified_by = auth.uid(),
      verified_at = now()
  where driver_id = p_driver_id
    and is_active;

  update public.driver_documents
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      remarks = coalesce(p_notes, remarks)
  where driver_id = p_driver_id;

  insert into public.notifications (user_id, type, title, message)
  values (
    p_driver_id,
    'verification_status'::notification_type,
    case when p_decision = 'approved' then 'Verification approved' else 'Verification rejected' end,
    case
      when p_decision = 'approved' then 'Your driver verification has been approved. You can now go online and accept ride requests.'
      when p_notes is not null then format('Your driver verification was rejected. Reason: %s', p_notes)
      else 'Your driver verification was rejected. Check verification status for details.'
    end
  );
end;
$$;
