-- Already applied live via MCP apply_migration on 2026-09-10. Recorded here
-- for repo history; this project has no local CLI-managed migration chain
-- (see the header on 20260910070133_add_id_transcription_fields_to_passenger_discounts.sql).

-- Barangays reference-data screen (wireframe screen 11, README §11) needs a
-- "Last amended <date> by <name>" audit line for the table as a whole. The
-- barangays table only tracked created_at -- add the same
-- updated_at/updated_by pair fare_config already has, stamped by the
-- existing create/update service calls (no trigger needed since every
-- write already goes through those two functions).

alter table public.barangays
  add column updated_at timestamptz,
  add column updated_by uuid references public.users(id) on delete set null;

comment on column public.barangays.updated_at is
  'Stamped by createBarangayForAdmin()/updateBarangayForAdmin() on every write. Null for a row nobody has touched since this column was added.';
comment on column public.barangays.updated_by is
  'The PSO Administrator who created or last edited this row. Null for a row nobody has touched since this column was added, or if that account was later deleted.';
