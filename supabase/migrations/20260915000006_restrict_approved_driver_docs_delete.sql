-- P2 (2026-09-15 launch audit): a driver could delete their own driver-docs
-- storage objects even after PSO approval, removing the evidence behind an
-- approved verification while the driver_documents row (and its
-- verification_status) stayed untouched. Still allowed: deleting a
-- pending/unreviewed/rejected document (so a driver can replace a bad
-- photo before or after a rejection) — only an approved one is locked.
--
-- Verified live 2026-09-15: the policy's own condition evaluates to false
-- for a real approved document and true for a non-approved/unknown one.
-- (A direct raw-SQL DELETE test wasn't possible — Supabase blocks
-- unmediated writes to storage.objects with its own
-- storage.protect_delete() trigger regardless of RLS, a second barrier
-- on top of this policy; real deletes only ever go through the Storage
-- API, which does enforce this policy.)
drop policy if exists driver_docs_owner_delete on storage.objects;
create policy driver_docs_owner_delete on storage.objects
  for delete
  using (
    bucket_id = 'driver-docs'
    and (storage.foldername(name))[1] = (auth.uid())::text
    and not exists (
      select 1 from public.driver_documents dd
      where dd.storage_path = objects.name and dd.status = 'approved'
    )
  );
