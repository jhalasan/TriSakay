# Printable Case Reports (Complaint and SOS Alert) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A PSO user can open one complaint or one SOS alert in the admin portal and download a formal, branded A4 PDF of that case, with every download recorded in an audit trail.

**Architecture:** The PDF is built in the browser from the data the screen already loads, using `pdfmake` (loaded only when the button is pressed). A builder turns a case into a plain "document definition" object, so the content and layout can be unit tested without drawing a PDF. A small database function records every print and returns a server-made document number and time, which the PDF shows in its footer. Nothing is stored on the server except the log row.

**Tech Stack:** React 19 + Vite admin app, `pdfmake` (new), Supabase RPC (`record_case_print`), node `--test` for tests.

**Written for:** the TriSakay team (and the panel, as the design of the "generation of transportation reports" objective). The office name wording in Section 3 is a placeholder the team has accepted for now.

## 1. What gets printed

Two documents, one shared look. Later summary reports (rides and revenue, franchise status) can reuse the same layout, but they are **not** in this plan.

### 1.1 Complaint Case Report

| Section | Content | Where it comes from today |
|---|---|---|
| Header block | Document title, Document No., case reference (`#A1B2`), status, date filed, date printed | `complaints`, `getReferenceCode`, `record_case_print` |
| Parties | Complainant and respondent: name and role. Phone and email **only for Supervisor and Admin** | `listComplaintsForAdmin`, `admin_*_directory` masking |
| Linked ride | Ride reference, date, pickup, drop-off, fare, driver name and plate number. "No linked ride" if none | `ride_requests`, `trips`, `tricycles` |
| Complaint | Category, subject, full message as filed | `complaints` |
| Case handling | Current owner, then a table of steps: Filed, Triaged, Department Head directive, Mediation scheduled (date, place), Resolved or Dismissed. Each row has the person's name and the date and time | `triaged_*`, `dh_*`, `mediation_*`, `resolved_*`, `complaint_status_history` |
| Assignment history | Claimed, assigned, accepted, declined, released, with names, times and notes | `complaint_assignments` |
| Resolution | Outcome text and notes | `resolution_notes` |
| Evidence | A list of attachments by file name. Small images printed on a last page | `complaint_attachments` + signed URLs |
| Sign-off | Prepared by (the printing user's name and role), Noted by (blank line), Received by (blank line) | session user |

### 1.2 SOS Alert Incident Report

| Section | Content | Where it comes from today |
|---|---|---|
| Header block | Title, Document No., alert reference, status, time triggered, date printed | `emergency_alerts`, `record_case_print` |
| People | Who triggered it and their role, the counterpart, the driver's name and plate number | `listEmergencyAlertsForAdmin` |
| Location | Coordinates (5 decimals), a "Google Maps" link written out and as a QR code. No map picture in version 1 | `lat`, `lng` |
| Ride summary | Ride reference, pickup, drop-off, ride status, time of the ride | `ride_requests` |
| Review record | Reviewed by and time, the review note, closed by and time | `reviewed_*`, `closed_*`, `notes` |
| Chat thread | **Left out by default.** Printed only when the user turns on "Include chat thread", gives a reason, and the existing `admin_view_ride_messages` logging runs | `admin_view_ride_messages` |
| Sign-off | Prepared by, Noted by, Received by | session user |

### 1.3 Left out on purpose
- Driver and passenger phone numbers and emails for PSO Staff (Supervisor and Admin only, same rule as the screens).
- Passwords, tokens, internal user IDs and raw storage paths. The ride and case references are the only identifiers shown.
- Editable output: the PDF is a flat file with the document number on every page.

## 2. Who may print

| Document | PSO Staff | Supervisor | Admin |
|---|---|---|---|
| Complaint report | Yes, only for a complaint they own and have accepted (the same rule that lets them act on it) | Yes | Yes |
| SOS report | No (staff cannot review alerts either) | Yes | Yes |
| Chat thread inside either report | No | Yes, with a reason | Yes, with a reason |

The database enforces this in `record_case_print`; the screen only hides the button.

## 3. Format specification

- **Page:** A4 portrait, margins 20 mm left and right, 18 mm top, 20 mm bottom. Body text 10 pt, section headings 11 pt bold, small print 8 pt. Font: Roboto (bundled with pdfmake). Check that the ₱ sign draws; if not, write "PHP".
- **Letterhead (every page):**
  - Left: the TriSakay mark from `apps/admin/public/brand/trisakay-mark.png`.
  - Centre, three lines: the republic or city line, the office name, and the system line. **Placeholder wording, to be confirmed by the team:** "City Government of General Santos", "Public Safety Office (PSO)", "TriSakay Tricycle Ride-Hailing System".
  - A thin rule under the block.
- **Title band:** the document title in capitals, with the Document No. and status on the right.
- **Body:** each section is a heading with a light grey bar, then a two-column "label: value" table for facts, or a bordered table for timelines.
- **Footer (every page):** "Document No. PSO-CMP-2026-000123 · Printed by (name), (role) on (date and time, Manila) · Page X of Y". A second line: "Official copy generated from TriSakay. Alteration makes this copy invalid."
- **Watermark:** none on the official copy. If the case is still open, a light diagonal "OPEN CASE" is shown, so a copy printed mid-process is not mistaken for a final record.
- **Dates:** "4 October 2026, 3:15 PM" in Manila time. Money as ₱0.00.
- **Language:** English. Names and quotes exactly as stored.

## 4. Audit trail

New table `case_print_log`: `id`, `case_kind` (`complaint` or `sos_alert`), `case_id`, `printed_by`, `printed_at` (server time), `doc_no` (text, unique), `include_chat` (boolean), `reason` (text, required when chat is included).

New function `record_case_print(p_kind text, p_case_id uuid, p_include_chat boolean, p_reason text)`:
1. Checks `is_pso()` and the role table in Section 2, and that the case exists.
2. Inserts the log row with `printed_at = now()` and a document number `PSO-CMP-<year>-<6 digit sequence>` or `PSO-SOS-<year>-<6 digit sequence>`.
3. Returns `doc_no`, `printed_at`, and the printer's name and role (read in the database, not taken from the browser).

The table is readable by Supervisor and Admin only. A new "Case prints" tab in the Audit Log lists who printed what and when.

## 5. Global constraints

- No new service-role code and no new edge function. The PDF is made in the browser.
- `pdfmake` is loaded with a dynamic `import()` on the button press, so the normal admin bundle does not grow.
- Content rules live in one place (`buildComplaintReport`, `buildSosReport`), not in the screens.
- Text in the PDF is escaped by pdfmake (it is data, not HTML). No user text is ever used as a style or a link target.
- Evidence images are fetched with the same signed-URL call the screen uses, resized to at most 1200 px, and skipped (with a note "image could not be loaded") if they fail.
- Every task ends with `npx tsc --noEmit -p apps/admin` clean and the admin tests green.

## 6. Review focus (what the tests must pin)

1. A complaint with no linked ride, no respondent, no evidence, or no steps taken still prints, with "None" lines instead of empty gaps.
2. A very long complaint message (several pages) flows onto extra pages without cutting off, and every page keeps the letterhead and footer.
3. PSO Staff never gets a PDF containing phone numbers or emails, even if the screen data happens to include them.
4. A user who may not print (staff on an SOS alert, staff on a complaint they do not own) gets an error and **no** log row and no document number.
5. Names with accents, Filipino characters and the ₱ sign print correctly.

## 7. Tasks

### Task 1: Audit table and `record_case_print` (database)

**Files:**
- Create: `supabase/migrations/20261004000009_case_print_log.sql`
- Modify: `packages/services/src/supabase/database.types.ts` (new table and function types)

**Interfaces:**
- Produces: RPC `record_case_print(p_kind text, p_case_id uuid, p_include_chat boolean, p_reason text)` returning one row `{ doc_no text, printed_at timestamptz, printed_by_name text, printed_by_role text }`.

- [ ] **Step 1:** Write the migration: table with RLS (Supervisor and Admin may select, nobody may insert or update directly), a sequence per kind, and the function (security definer, `set search_path to 'public'`, `revoke ... from public, anon`, `grant ... to authenticated`).
- [ ] **Step 2:** The migration must be applied by the user in the Supabase SQL editor (the tool has been declined for migrations). Wait for confirmation.
- [ ] **Step 3:** Test in a transaction that rolls back, as the admin session: complaint print works and returns a document number; second print gives a new number; a staff session on an unowned complaint is refused and adds no row; an SOS print as staff is refused; including chat without a reason is refused.
- [ ] **Step 4:** Commit.

### Task 2: Service wrapper

**Files:**
- Create: `packages/services/src/admin/casePrints.ts`, `packages/services/tests/admin-case-prints.test.ts`
- Modify: `packages/services/src/index.ts` (export)

**Interfaces:**
- Produces: `recordCasePrint({ kind, caseId, includeChat, reason }): Promise<{ data: { docNo: string; printedAt: string; printedByName: string; printedByRole: string } | null; error: string | null }>` and `listCasePrints(sinceIso)` for the audit tab.

- [ ] **Step 1:** Write failing tests with a fake `rpc` (success maps the row; a database error is passed through; blank reason with chat is refused before calling).
- [ ] **Step 2:** Run them and see them fail. Implement. Run them green.
- [ ] **Step 3:** Commit.

### Task 3: Report content builders (pure, no PDF yet)

**Files:**
- Create: `apps/admin/src/lib/reports/complaintReport.ts`, `apps/admin/src/lib/reports/sosReport.ts`, `apps/admin/src/lib/reports/types.ts`
- Test: `apps/admin/tests/complaintReport.test.ts`, `apps/admin/tests/sosReport.test.ts`

**Interfaces:**
- Produces: `buildComplaintReport(input: ComplaintReportInput): ReportModel` and `buildSosReport(input: SosReportInput): ReportModel`, where `ReportModel` is `{ docKind, title, sections: { heading: string; rows?: [label, value][]; table?: { columns: string[]; rows: string[][] }; paragraph?: string }[] }`. Contact details are included only when `input.canSeeContacts` is true.

- [ ] **Step 1:** Write failing tests for the five review-focus items (empty case, long message, contacts hidden, accents and ₱, open-case flag).
- [ ] **Step 2:** Implement the two builders until green.
- [ ] **Step 3:** Commit.

### Task 4: PDF layout (letterhead, bands, footer)

**Files:**
- Create: `apps/admin/src/lib/reports/pdfLayout.ts`, `apps/admin/src/lib/reports/renderPdf.ts`
- Test: `apps/admin/tests/pdfLayout.test.ts`
- Modify: `apps/admin/package.json` (add `pdfmake`)

**Interfaces:**
- Consumes: `ReportModel` (Task 3), `{ docNo, printedAt, printedByName, printedByRole }` (Task 2).
- Produces: `toDocDefinition(model, meta): TDocumentDefinitions` (pure, tested) and `downloadReportPdf(model, meta, filename): Promise<void>` (dynamic import of pdfmake, embeds the logo, calls `createPdf(...).download(...)`).

- [ ] **Step 1:** Failing tests on the document definition: every page has the letterhead and footer, the footer carries the document number and "Page X of Y", margins and fonts match Section 3, an open case adds the watermark.
- [ ] **Step 2:** Implement `toDocDefinition`; add the dependency; implement `downloadReportPdf`.
- [ ] **Step 3:** Manual check: generate a sample PDF and look at it (letterhead, ₱ sign, long text over two pages).
- [ ] **Step 4:** Commit.

### Task 5: Print buttons and the flow

**Files:**
- Modify: `apps/admin/src/routes/Complaints.tsx`, `apps/admin/src/routes/EmergencyAlerts.tsx`
- Create: `apps/admin/src/components/PrintCaseButton/PrintCaseButton.tsx` (+ css, index)

**Interfaces:**
- Consumes: Tasks 2 to 4.

- [ ] **Step 1:** `PrintCaseButton` shows "Print case report" only when the role table allows it. On press: call `recordCasePrint`, build the model, call `downloadReportPdf`, toast "Case report downloaded (PSO-CMP-2026-000123)". Errors show in the existing error banner and nothing is downloaded.
- [ ] **Step 2:** SOS only: a checkbox "Include chat thread" with a required reason field; when on, load the thread through `admin_view_ride_messages` (already logged) and add a chat section.
- [ ] **Step 3:** Typecheck and run the admin tests.
- [ ] **Step 4:** Commit.

### Task 6: Audit Log tab

**Files:**
- Modify: `apps/admin/src/routes/AuditLog.tsx`

- [ ] **Step 1:** Add a "Case prints" tab (document number, kind, case reference, printed by, time, chat included) for Supervisor and Admin, with the same date filter and 2,000 row cap as the other tabs.
- [ ] **Step 2:** Typecheck, tests, commit.

### Task 7: Final check

- [ ] Print three real cases (an open complaint, a resolved complaint with evidence, a reviewed SOS alert) and compare each PDF with Section 1.
- [ ] Open a PDF as PSO Staff and confirm there are no phone numbers or emails.
- [ ] Confirm each print added exactly one row in the audit tab.
- [ ] Save sample PDFs and screenshots to `uat_shots/` for the paper.

## 8. Decisions (settled 2026-10-05)

1. **Letterhead:** keep the placeholder wording: "City Government of General Santos", "Public Safety Office (PSO)", "TriSakay Tricycle Ride-Hailing System", with the TriSakay mark. The wording lives in one constant so it can be changed later. An official city seal is not used.
2. **Sign-off:** "Prepared by / Noted by / Received by". Prepared by is the printing user; the other two are blank lines.
3. **Document number:** `PSO-CMP-2026-000123` for a complaint, `PSO-SOS-2026-000123` for an SOS alert (year in Manila time, running number per kind and year).
4. **SOS map:** coordinates, a map link and a QR code. No printed map picture in version 1.
5. **Filipino version:** not planned.

## 9. Not in this plan

Summary reports (rides and revenue, franchise status, complaints statistics, driver roster) and bulk printing. They can reuse the layout from Task 4 later.
