-- Already applied live via MCP apply_migration on 2026-09-10. Recorded here
-- for repo history; this project has no local CLI-managed migration chain
-- (see the note on the neighboring 20260830_add_ride_requests_expires_at.sql).
--
-- Fare Discount Review's redesign (docs/design_handoff_trisakay_admin
-- README.md §06) transcribes the submitted ID's own number, the holder's
-- date of birth, and the issuing office while a PSO Supervisor/Admin
-- reviews the photo — same manual-transcription pattern as tricycles'
-- mtop_no/mtop_expiry_date for driver verification (FR-1.4a). Nullable:
-- not filled in until a reviewer transcribes them, and existing rows have
-- no value.
alter table public.passenger_discounts
  add column id_number text,
  add column date_of_birth date,
  add column issuing_office text;
