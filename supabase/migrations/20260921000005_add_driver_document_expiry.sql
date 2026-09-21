-- UAT D13: driver_documents had no way to record a document's own
-- validity/expiration (only the tricycle's MTOP franchise expiry was
-- tracked, on a separate table). Self-reported by the driver, not
-- PSO-entered at review time — the RPC that writes these rows
-- (submit_driver_documents) is an untracked, dashboard-only function whose
-- body isn't safe to extend blind, so this is a separate nullable column the
-- driver can set/edit directly. No RLS change needed: documents_owner_rw
-- already grants a driver update rights on their own rows
-- (`driver_id = auth.uid()` satisfies both USING and WITH CHECK), same as
-- every other column on this table.
alter table public.driver_documents add column expiry_date date;

comment on column public.driver_documents.expiry_date is
  'Self-reported by the driver (UAT D13) — not verified against the document image beyond PSO''s normal review of the upload itself.';
