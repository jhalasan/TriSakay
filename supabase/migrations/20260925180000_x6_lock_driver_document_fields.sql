-- X6: driver_documents insert/update have zero forcing/locking — a driver
-- could INSERT their own document as status='approved' directly, or UPDATE
-- an existing one to 'approved', or set an already-approved one back to
-- 'pending' and then swap storage_path (the earlier-approved file's content
-- effectively destroyed/replaced without re-review).
--
-- Two legitimate paths need explicit bypasses:
-- 1. submit_driver_documents() (SECURITY DEFINER) does its own
--    INSERT ... ON CONFLICT DO UPDATE SET storage_path=..., status='pending',
--    reviewed_by=null, reviewed_at=null, remarks=null as part of a driver's
--    legitimate re-submission — needs a bypass since it's driver-invoked
--    (is_supervisor() won't be true).
-- 2. perform_verification_decision() (SECURITY DEFINER, supervisor-only)
--    sets status/reviewed_by/reviewed_at/remarks together — covered by the
--    existing is_supervisor() check, since auth.uid() during that call is
--    still the calling supervisor's session.
--
-- expiry_notified_at is not driver-settable directly even though
-- updateDriverDocumentExpiry() (packages/services/src/driver-documents/index.ts)
-- sends it — the trigger derives it itself from whether expiry_date actually
-- changed, so the client's own value for it is ignored rather than trusted.

create or replace function public.enforce_document_insert_fields()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.status := 'pending';
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.remarks := null;
  new.expiry_notified_at := null;
  return new;
end;
$function$;

create trigger trg_documents_insert_fields
before insert on public.driver_documents
for each row execute function enforce_document_insert_fields();

revoke execute on function public.enforce_document_insert_fields() from public;
revoke execute on function public.enforce_document_insert_fields() from anon, authenticated;

create or replace function public.enforce_document_update_fields()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if is_supervisor() or coalesce(current_setting('trisakay.allow_document_resubmit', true), '') = 'on' then
    return new;
  end if;

  if new.status is distinct from old.status
    or new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
    or new.remarks is distinct from old.remarks
  then
    raise exception 'Cannot modify document status or review fields directly';
  end if;

  if new.storage_path is distinct from old.storage_path and old.status = 'approved' then
    raise exception 'Cannot replace the file on an already-approved document';
  end if;

  -- expiry_notified_at is derived, never trusted from the client: only
  -- resets when expiry_date actually changed, otherwise stays as-is.
  if new.expiry_date is distinct from old.expiry_date then
    new.expiry_notified_at := null;
  else
    new.expiry_notified_at := old.expiry_notified_at;
  end if;

  return new;
end;
$function$;

create trigger trg_documents_update_fields
before update on public.driver_documents
for each row execute function enforce_document_update_fields();

revoke execute on function public.enforce_document_update_fields() from public;
revoke execute on function public.enforce_document_update_fields() from anon, authenticated;

-- Bypass for submit_driver_documents()'s legitimate resubmission path.
create or replace function public.submit_driver_documents(p_plate_no text, p_documents jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_driver_id uuid := auth.uid();
  v_tricycle_id uuid;
  v_doc jsonb;
  v_doc_type document_type;
begin
  if v_driver_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.driver_profiles where user_id = v_driver_id) then
    raise exception 'No driver profile found for this account';
  end if;

  if p_documents is null or jsonb_array_length(p_documents) <> 4 then
    raise exception 'All four documents are required';
  end if;

  insert into public.tricycles (driver_id, plate_no)
  values (v_driver_id, p_plate_no)
  on conflict (driver_id) where is_active
  do update set plate_no = excluded.plate_no
  returning id into v_tricycle_id;

  perform set_config('trisakay.allow_document_resubmit', 'on', true);

  for v_doc in select * from jsonb_array_elements(p_documents)
  loop
    v_doc_type := (v_doc->>'doc_type')::document_type;

    insert into public.driver_documents (driver_id, tricycle_id, doc_type, storage_path)
    values (
      v_driver_id,
      case when v_doc_type = 'drivers_license' then null else v_tricycle_id end,
      v_doc_type,
      v_doc->>'storage_path'
    )
    on conflict (driver_id, coalesce(tricycle_id, '00000000-0000-0000-0000-000000000000'::uuid), doc_type)
    do update set
      storage_path = excluded.storage_path,
      status = 'pending',
      reviewed_by = null,
      reviewed_at = null,
      remarks = null;
  end loop;

  update public.driver_profiles
  set verification_status = 'pending'
  where user_id = v_driver_id;

  update public.tricycles
  set verification_status = 'pending'
  where id = v_tricycle_id;

  return v_tricycle_id;
end;
$function$;
