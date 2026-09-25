-- X8: is_account_active() already existed and already gated rr_passenger_insert,
-- rr_driver_read, rr_driver_update, driver_profiles.is_available (policy-level),
-- discounts_submit_own (X3), and cancel_ride_request_as_passenger (X9), but a
-- suspended user could still submit a complaint or rate a driver through the
-- API, and driver_profiles' go-online path only enforced the check at the RLS
-- policy layer, not inside the trigger that owns the same invariant.
-- emergency_insert_own is intentionally left open (per the doc: suspended
-- users can still raise a safety emergency), and the in-progress-trip driver
-- RPCs (start/complete/cancel a leg, end_trip) are left alone too, so a
-- driver suspended mid-trip can still safely conclude it instead of
-- stranding passengers.
--
-- Also: suspension was DB-only (public.users.status) — a suspended user's
-- existing Supabase Auth session/refresh token still worked, so nothing
-- server-side actually stopped them signing back in elsewhere. perform_account_action
-- now bans/unbans in Supabase Auth directly (auth.users.banned_until) so a
-- suspend also cuts off future sign-ins, not just app-level status.

drop policy complaints_submit on public.complaints;
create policy complaints_submit on public.complaints for insert
  with check (submitted_by = auth.uid() and is_account_active());

drop policy ratings_passenger_insert on public.ratings;
create policy ratings_passenger_insert on public.ratings for insert
  with check (passenger_id = auth.uid() and is_account_active());

create or replace function public.enforce_driver_verified_before_available()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  has_verified_active_unit boolean;
begin
  if new.is_available and not old.is_available then
    if not coalesce(is_account_active(), false) then
      raise exception 'Account is not active';
    end if;

    if new.verification_status <> 'approved' then
      raise exception 'Driver % cannot go available: driver verification is not approved', new.user_id;
    end if;

    select exists(
      select 1 from public.tricycles
      where driver_id = new.user_id
        and is_active
        and verification_status = 'approved'
    ) into has_verified_active_unit;

    if not has_verified_active_unit then
      raise exception 'Driver % cannot go available: no active, verified tricycle assigned', new.user_id;
    end if;
  end if;

  return new;
end $function$;

create or replace function public.perform_account_action(
  p_target_user_id uuid,
  p_action_type account_action_type,
  p_reason text,
  p_complaint_id uuid default null::uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_new_status account_status;
  v_rows_updated int;
begin
  if auth.uid() is null then
    raise exception 'Not authorized to perform this action.';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required for this action.';
  end if;

  if p_action_type in ('flag', 'unflag') then
    if not coalesce(is_pso(), false) then
      raise exception 'Not authorized to perform this action.';
    end if;
  elsif p_action_type in ('suspend', 'reactivate', 'deactivate') then
    if not coalesce(is_supervisor(), false) then
      raise exception 'Not authorized to perform this action.';
    end if;
  else
    raise exception 'Unsupported action type: %', p_action_type;
  end if;

  v_new_status := case p_action_type
    when 'flag' then 'flagged'::account_status
    when 'unflag' then 'active'::account_status
    when 'suspend' then 'suspended'::account_status
    when 'reactivate' then 'active'::account_status
    when 'deactivate' then 'deactivated'::account_status
  end;

  insert into public.account_actions (target_user_id, action_type, performed_by, reason, complaint_id)
  values (p_target_user_id, p_action_type, auth.uid(), p_reason, p_complaint_id);

  update public.users
  set status = v_new_status, updated_at = now()
  where id = p_target_user_id;

  get diagnostics v_rows_updated = row_count;
  if v_rows_updated = 0 then
    raise exception 'Target user not found.';
  end if;

  if p_action_type = 'suspend' then
    update auth.users set banned_until = now() + interval '100 years' where id = p_target_user_id;
  elsif p_action_type = 'reactivate' then
    update auth.users set banned_until = null where id = p_target_user_id;
  end if;
end;
$function$;
