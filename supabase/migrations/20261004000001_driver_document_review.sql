-- Driver document review: file rules, per document rejection with a reason,
-- and a way for the driver to replace only the rejected documents.
--
-- 1. driver-docs bucket: 5 MB and JPG, PNG or WebP only (same as the discount
--    ID and chat photo buckets). It had no limit and no type restriction.
-- 2. review_driver_document(): a supervisor approves or rejects ONE document;
--    rejecting needs a reason shown to the driver.
-- 3. perform_verification_decision(): when documents were individually marked
--    rejected, only those stay rejected (the others keep their own status) and
--    the notification lists each rejected document with its reason. Rejecting
--    with no document marked keeps the old behaviour (all documents rejected
--    with the reviewer's note). Approving is blocked while a document is still
--    marked rejected.
-- 4. resubmit_driver_documents(): the driver replaces only documents that are
--    currently rejected. Once none is left, the application goes back to
--    pending for review. It reuses the same resubmit bypass flag that
--    submit_driver_documents() uses with the document update lock.

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'driver-docs';

create or replace function public.driver_document_label(p_type document_type)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case p_type
    when 'drivers_license' then 'Driver''s license'
    when 'or_cr' then 'OR / CR'
    when 'franchise_permit' then 'Franchise / permit'
    when 'tricycle_photo' then 'Tricycle photo'
    else p_type::text
  end
$function$;

revoke execute on function public.driver_document_label(document_type) from public, anon, authenticated;

create or replace function public.review_driver_document(
  p_driver_id uuid,
  p_doc_type document_type,
  p_decision verification_status,
  p_remarks text default null
)
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
    raise exception 'Only a PSO Supervisor or Admin may review a document';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  if p_decision = 'rejected' and coalesce(btrim(p_remarks), '') = '' then
    raise exception 'A reason is required when rejecting a document';
  end if;

  update public.driver_documents
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      remarks = case when p_decision = 'rejected' then btrim(p_remarks) else null end
  where driver_id = p_driver_id
    and doc_type = p_doc_type;

  if not found then
    raise exception 'Document not found';
  end if;
end;
$function$;

revoke execute on function public.review_driver_document(uuid, document_type, verification_status, text) from public, anon;
grant execute on function public.review_driver_document(uuid, document_type, verification_status, text) to authenticated;

create or replace function public.perform_verification_decision(
  p_driver_id uuid,
  p_decision verification_status,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_has_rejected boolean;
  v_list text;
  v_message text;
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

  select exists (
    select 1 from public.driver_documents where driver_id = p_driver_id and status = 'rejected'
  ) into v_has_rejected;

  if p_decision = 'approved' and v_has_rejected then
    raise exception 'A document is still marked rejected. Approve it first, or reject the application.';
  end if;

  if p_decision = 'rejected' and not v_has_rejected and coalesce(btrim(p_notes), '') = '' then
    raise exception 'Mark at least one document as rejected, or give a reason.';
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

  if p_decision = 'approved' then
    update public.driver_documents
    set status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        remarks = p_notes
    where driver_id = p_driver_id;
  elsif not v_has_rejected then
    -- Nothing was marked one by one: the whole application is sent back.
    update public.driver_documents
    set status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        remarks = btrim(p_notes)
    where driver_id = p_driver_id;
  end if;

  if p_decision = 'approved' then
    v_message := 'Your driver verification has been approved. You can now go online and accept ride requests.';
  else
    select string_agg(public.driver_document_label(doc_type) || ': ' || remarks, E'\n' order by doc_type)
    into v_list
    from public.driver_documents
    where driver_id = p_driver_id and status = 'rejected' and remarks is not null;

    v_message := 'Your driver verification was rejected.'
      || case when v_list is not null then E'\nPlease replace:\n' || v_list else '' end
      || case when v_has_rejected and coalesce(btrim(p_notes), '') <> '' then E'\nNote: ' || btrim(p_notes) else '' end;
  end if;

  insert into public.notifications (user_id, type, title, message)
  values (
    p_driver_id,
    'verification_status'::notification_type,
    case when p_decision = 'approved' then 'Verification approved' else 'Verification rejected' end,
    v_message
  );
end;
$function$;

create or replace function public.resubmit_driver_documents(p_documents jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_driver_id uuid := auth.uid();
  v_doc jsonb;
  v_doc_type document_type;
  v_path text;
  v_remaining integer;
begin
  if v_driver_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.driver_profiles where user_id = v_driver_id and verification_status = 'rejected'
  ) then
    raise exception 'Your application is not waiting for corrections';
  end if;

  if p_documents is null or jsonb_typeof(p_documents) <> 'array' or jsonb_array_length(p_documents) = 0 then
    raise exception 'Send at least one document';
  end if;

  perform set_config('trisakay.allow_document_resubmit', 'on', true);

  for v_doc in select * from jsonb_array_elements(p_documents)
  loop
    v_doc_type := (v_doc->>'doc_type')::document_type;
    v_path := v_doc->>'storage_path';

    if v_path is null or split_part(v_path, '/', 1) <> v_driver_id::text then
      raise exception 'Invalid file path';
    end if;

    update public.driver_documents
    set storage_path = v_path,
        status = 'pending',
        reviewed_by = null,
        reviewed_at = null,
        remarks = null
    where driver_id = v_driver_id
      and doc_type = v_doc_type
      and status = 'rejected';

    if not found then
      raise exception 'That document is not waiting for a correction';
    end if;
  end loop;

  select count(*) into v_remaining
  from public.driver_documents
  where driver_id = v_driver_id and status = 'rejected';

  if v_remaining = 0 then
    update public.driver_profiles
    set verification_status = 'pending'
    where user_id = v_driver_id;

    update public.tricycles
    set verification_status = 'pending'
    where driver_id = v_driver_id and is_active;
  end if;

  return v_remaining;
end;
$function$;

revoke execute on function public.resubmit_driver_documents(jsonb) from public, anon;
grant execute on function public.resubmit_driver_documents(jsonb) to authenticated;
