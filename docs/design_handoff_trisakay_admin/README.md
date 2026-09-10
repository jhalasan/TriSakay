# TriSakay Admin (PSO) Portal — locked redesign spec

**Locked 2026-09-10.** Source of truth: `TriSakay Admin Redesign.dc.html` — twelve groups covering all 15 admin routes: 19 frames at 1440×900 (each labelled with `data-screen-label`) plus one component sheet for system states. The pre-redesign recreation is in `TriSakay Admin Screens.dc.html` — use it only to see what changed.

Target: `apps/admin` in `jhalasan/TriSakay` — Vite + React 18 + React Router + CSS Modules + Zustand. This is a **web** app; nothing in `packages/ui` (React Native) can be imported. Colour values are already mirrored into `apps/admin/src/styles/tokens.css`.

| Group | Screens | Repo route | Screenshot |
| --- | --- | --- | --- |
| 01 Sign in | Login | `Login.tsx` | `screenshots/01-sign-in.png` |
| 02 First sign-in | Set new password | `ForcePasswordChange.tsx` | `screenshots/02-first-signin.png` |
| 03 Dashboard | Dashboard, Log out modal | `Dashboard.tsx` | `screenshots/03-dashboard-logout.png` |
| 04 Profile menu | Identity popover (name, password, log out) | `TopBar`, `useSessionStore` | `screenshots/04-profile-menu.png` |
| 05 People | Drivers, Passengers | `Drivers.tsx`, `Passengers.tsx` | `screenshots/05-people.png` |
| 06 Review queues | Driver & tricycle verification, Fare discount review | `DriverVerification.tsx`, `DiscountReview.tsx` | `screenshots/06-review-queues.png` |
| 07 Live operations | Ride monitoring, Emergency alerts | `RideMonitoring.tsx`, `EmergencyAlerts.tsx` | `screenshots/07-live-operations.png` |
| 08 Casework & insight | Complaints, Rating oversight, Reports & analytics | `Complaints.tsx`, `RatingOversight.tsx`, `Reports.tsx` | `screenshots/08-casework-insight.png` |
| 09 Administration | PSO user management, System settings | `PsoUsers.tsx`, `SystemSettings.tsx` | `screenshots/09-administration.png` |
| 10 Audit log | Account actions, Review decisions | `AuditLog.tsx` | `screenshots/10-audit-log.png` |
| 11 Barangays | Cluster reference data, Delete confirm | `Barangays.tsx` | `screenshots/11-barangays.png` |
| 12 States | Validation, toasts, empty, loading, confirms | all routes | `screenshots/12-states.png` |

---

## 1. The system

Three ideas carry the whole portal. Everything below is an application of one of them.

1. **One shell, always identical.** Navy rail (236px) + white top bar (62px) + grey work canvas. The rail never changes between screens except which item is active; the top bar never changes except the page title. Verified across all 17 in-app frames.
2. **The page tells you what to do next.** Where the old build opened on undifferentiated stat tiles or a table, the redesign leads with the thing that has a deadline: the dashboard's *Needs attention today* band, the complaints SLA strip, the verification queue's case counts. Vanity metrics move to a secondary strip.
3. **Feedback resolves where it was caused.** Field errors live under their field, form errors above the submit button, page errors replace the empty region, and every success is a transient bottom-right toast. The page-top `ErrorBanner` is retired — see §4a.
4. **Review work is a workbench, never a scroll.** Any screen where a PSO officer decides something (verification, discounts, complaints, SOS) is a two- or three-pane layout: queue left (keeps its place), evidence centre, decision right. Nothing a decision depends on ever sits below the fold.

### Shell anatomy

**Rail** (`--rail-*` custom properties in the mock; navy `#002E60`)
- Brand row: `trisakay-mark.png` at 22px **on a white 4px-padded tile, radius 7** (the mark is navy + green with a transparent ground, so it disappears if placed straight onto the navy rail), `TriSakay` 14/18 w700, `PSO Portal` mono 10.5 uppercase at 62% white, 1px bottom rule `rgba(255,255,255,.10)`.
- Groups, in this order — **OPERATIONS** (Dashboard, Ride Monitoring, Emergency Alerts) · **PEOPLE** (Drivers, Passengers, Verification, Fare Discounts) · **CASEWORK** (Complaints, Rating Oversight) · **INSIGHT** (Reports & Analytics, Audit Log) · **ADMINISTRATION** (PSO Users, Barangays, System Settings). Group caption: mono 10.5/14, `.14em`, 62% white, padding `14px 11px 6px`.
- Item: 16px stroked icon + 13/18 w500 label at 74% white, padding `9px 11px`, radius 9. Active: `rgba(255,255,255,.13)` fill, white w600 label, and a **3px full-height left marker** (radius `0 3px 3px 0`, inset 9px top/bottom).
- Count chip, right-aligned: pill, mono 10px w700, `rgba(255,255,255,.16)`. **Emergency Alerts uses solid `#B3261E`** — the only red in the rail.
- Footer: 1px top rule, 30px initials avatar, name 12.5/17 w600, role mono 10.5 at 62% white, log-out glyph.

**Top bar** — 62px, white, 1px `#DCE2E6` bottom border. Page title 18/24 w700 (`ROUTE_TITLES` verbatim). Jump-to search: 36px, max 340px, radius 10, `#F6F7F9` fill, 1px `#DCE2E6`, placeholder *Search drivers, passengers, complaints…*. Right cluster: role badge (`ROLE_LABELS`), bell with 7px `#B3261E` dot, 32px initials avatar on `#E3EDF7`/`#002E60`.

**Canvas** — `#F6F7F9`, padding `22px 24px`, 16px gaps, single scroll region. Panels: white, radius 14, 1px `#DCE2E6`, shadow `0 3px 8px rgba(0,46,96,.10)`, padding 18.

### Component vocabulary

| Element | Spec |
| --- | --- |
| Eyebrow / field label | mono 10.5/14, `.12em`, uppercase, `#5A646B` |
| Panel title | 13.5/18 w600 `#14191D`; optional 11.5/16 `#666F75` subline |
| Metric | 26–34px w800, tabular; label above it as an eyebrow |
| Table header | mono 10.5 uppercase on `--fill`, 1px `#DCE2E6` bottom |
| Table cell | 13/18, padding `14px 16px`, 1px `#EBEFF2` row rule, last row none |
| Status badge | pill, mono 10.5, 1px border; neutral `#EDF1F4`/`#5A646B`, success `#E9F7E3`/`#3B602B`, warn `#fff6dc`/`#7a5b00`, danger `#FBEAE8`/`#B3261E`, info `#E3EDF7`/`#002E60` |
| Button | 32px, radius 9, 12px w600. Primary navy + `--shadow-button`; secondary white + 1px `#838B91`; danger solid `#B3261E`; danger-outline; ghost navy text. Small variant 28px/11.5px |
| Input | 38px, radius 10, 1px `#DCE2E6`; focus 1.5px `#002E60` + `0 4px 14px rgba(0,46,96,.10)`. Numeric and ID values are mono |
| Toggle | 40×22 pill, 16px knob, on = `#002E60` |
| Rating | five 9px squares, radius 2, filled navy — never stars |
| Privileged action | label carries a literal `S+` suffix; hidden (not disabled) for `pso_staff` |

**Type:** Poppins 400/500/600/700/800 for UI, `ui-monospace` for IDs, codes, timestamps, money, and all eyebrows. **Colour:** nothing outside `tokens.css` except the placeholder map greys.

---

## 2. Screen specs

### 01 Login
Split 5fr / 6fr. Left: `--gradient-hero` navy pane with the **dotted route motif** (three dashed bezier paths, `stroke-dasharray:1 14`, 8–14% white, two 4px nodes), the lockup at 150px **on a white plate** (radius 16, padding `18px 22px`, `0 8px 24px rgba(0,0,0,.22)`), `PSO Operations Portal` 32/38 w700, 14/24 support line at 80%, mono footer `TriSakay · PSO Portal` at 48%. Right: white, single 368px column — *Welcome back* 26/32 w700, Email and Password fields at 46px/radius 12 with a reveal eye, 48px navy `Log in`, and centred 11.5/16 `#666F75`: *Access is restricted to authorized PSO personnel.* No sign-up, no social, no marketing.

### 02 First sign-in (ForcePasswordChange)
Not the sign-in screen and not a modal: the portal ground, a lockup-only 62px header with the signed-in email and a ghost `Cancel and sign out`, and one 560px column. Navy-soft 52px icon tile, *Set your own password* 27/34 w700, and a card whose head band names the account being changed (34px initials, name, `PSO Staff · account created 8 Sep 2026 by R. Santillan`, `First sign-in` info badge). Body: read-only *Temporary password* field with its help line, a rule, then *New password* / *Confirm new password* side by side at 46px/radius 12 with reveal eyes, a 5px strength bar with its word label, and a **live requirements checklist** in a `#F1F4F7` box (2×2: at least 10 characters, upper and lower case, one number or symbol, not the temporary one) — met items are `#1E7A3C` with a check, unmet are grey with an empty ring. One 48px primary `Set password and continue`, and a footnote stating the temporary password stops working immediately and the change is written to the audit log. The checklist replaces post-submit error text; only mismatch and server refusals surface as errors (§4a).

### 03 Dashboard
1. **Needs attention today** — eyebrow + `Thursday, 8 September · 3 queues past target`. Three panels, each with a 3px left accent (`#B3261E` overdue complaints, `#e3b341` expiring franchises, `#B3261E` unreviewed SOS): eyebrow, count at 34px w800 in the accent colour, one clause of context, a text link with a forward arrow, and a right-aligned deadline badge (e.g. `ARTA 3d`, `≤ 30 days`).
2. **Volume strip** — one panel divided into four cells: Total drivers, Active rides, Pending verifications, Open complaints. Metric 26px w800, eyebrow above. No sparklines, no deltas.
3. **Charts** — *Rides over time* (7-point navy line, `Last 7 days` badge) beside *Ride status* (124px donut: completed `#477434`, active `#002E60`, forming `#e3b341`, cancelled `#B3261E`, count in the hole, legend right).
4. **Recent trip activity** — 5-row table (Driver · Passenger · Status · Fare · Updated) with a ghost `View all`.

**Log out** is a modal over the dimmed dashboard: `rgba(10,14,17,.58)` scrim, 420px white card radius 16, navy circle icon, title 18 w700, one-line body, `Cancel` + navy `Log out`.

### 04 Profile menu
The top-bar avatar becomes a labelled trigger — 30px avatar, name 12.5 w600, role 10.5, chevron, in a radius-999 white pill with a 1px `#DCE2E6` border. It opens a 332px popover (radius 14, `0 18px 44px rgba(0,46,96,.20)`, 10px below the trigger, right-aligned) that holds everything a signed-in user does about themselves: identity head (38px avatar, name 15 w700, account email), a full-width role badge on its own band, then two settled rows — **Name** with the current value and **Password** with `Changed 8 Sep 2026` — each with one quiet `Edit` / `Change` link. Clicking a link swaps that row into an inline field *in place* (field + `Save` + `Cancel`); the other row stays settled, so the menu never shows two open forms. Both expanded states are drawn on the states sheet (§12). Log out sits last, set apart as a full-width danger-outline button — the top bar itself carries no destructive action. Password editing reuses the first sign-in validation path verbatim.

### 05 Drivers / Passengers
Both roster screens are the same four-part shape:
1. **Status strip = the filter.** Four cells in one panel (Drivers: All drivers · Active · Flagged · Suspended. Passengers: All passengers · Active · Fare discount approved · Blocked). Selected cell gets a navy 2px underline and navy count.
2. **Toolbar** — search left, `All clusters`/status selects, `Export CSV` right.
3. **Table.** Drivers: Driver (avatar + name + email) · Tricycle (body no. + colour) · Rating (squares + numeral) · Trips · Status · Actions. Passengers: Passenger · Contact · Total rides · Fare discount (type · state badge) · Status · Actions.
4. **Actions stay inline**, right-aligned, in one row: `View` + `Flag` for staff; `Suspend S+` / `Reactivate S+` (drivers) and `Block S+` / `Unblock S+` (passengers) for supervisors. Footer: `Showing 1–7 of 248 drivers` + pager.

### 06 Verification / Fare discounts
Three panes, 1fr / 1.35fr / 1fr, each independently scrolling.
- **Queue (left)** — panel title + count badge; rows are name, subline, and a state badge (`Pending`, `Expired`, `Resubmitted`); selected row is `#E3EDF7` with a navy left edge. The discount screen adds a *Recently decided* list beneath.
- **Evidence (centre)** — striped placeholder tiles with mono captions for what belongs there (Driver's licence, OR / CR, Franchise / MTOP permit, Tricycle photo; ID — front, ID — back). Each tile has a per-document state chip (`Verified` / `Reviewing` / `Not reviewed`) and a progress badge `2 of 4 documents verified`.
- **Decision (right)** — transcription fields (MTOP number, MTOP expiry date, Cluster select; ID number, Date of birth, Issuing office), a notes textarea, then `Approve S+` (navy) and `Reject S+` (danger outline). **Reject stays disabled until notes exist** — that rule is already in the code; the button now shows it. Discounts state the outcome plainly: `20% statutory discount`.

### 07 Ride monitoring / Emergency alerts
- **Ride monitoring** — full-height map panel with `All clusters` select and `Refresh`; `Live · 31 on trip` badge. The map shows **coarse cells with counts, never individual pins**, and the caption under it says why (passenger location privacy). Right column: *Active tricycles* count and an *On the clock* list of drivers with `On trip` / `Idle` chips.
- **Emergency alerts** — 60/40 split. Left: alert log table (Triggered by · Role · Time · Linked ride · Status · Actions) with `Logged` / `Reviewed` / `Closed` badges and a navy `Open newest alert` above it. Right: detail panel for the selected alert — triggered-at, linked ride, counterpart, tricycle, coarse location, review notes, `Mark reviewed S+`. Red is used only for the `Logged` state and the alert accent.

### 08 Complaints / Rating oversight / Reports
- **Complaints** — the screen the old build lost people on. SLA strip (Overdue 4 · Open 8 · Under review 5 · Resolved 46) above a 55/45 split: queue table (Complaint · Category · Status · SLA · Actions, with `7d overdue` in danger) left, case column right — complainant, against, status, Department Head directive textarea, `Save directive`, and a *Schedule mediation* sub-panel (date/time, location, `Schedule mediation S+`). The form never appears below the table.
- **Rating oversight** — read-only by design. *Drivers below the rating threshold* table (Driver · Tricycle · Rating · Ratings · Trips · Account) with a `4 drivers` badge, plus a *How this list is built* panel stating threshold (2.5★), minimum ratings, and fleet average. The single action is a ghost `Open driver management` — enforcement lives on the roster.
- **Reports & analytics** — range segmented control (This week / This month / This quarter) + resolved date range + `Export CSV`. Four metrics (Total rides, Total revenue, Average fare, Peak hour), then *Rides & revenue* bars beside *Peak hours*, then a *Transactions* table (Passenger · Driver · Amount · Method · Status · Date) with `4,182 records`.

### 09 PSO users / System settings
- **PSO users** — inline invite form above the roster (Full name, Work email, Role select, `Add PSO user`). After creation, the one-time temporary password appears in a navy-bordered callout with a mono value, `Copy`, `Done`, and copy that says plainly it will not be shown again. Roster: Name · Email · Role · Last sign-in · Status · Actions, with `Disable` / `Enable`. Badge `7 accounts · 3 roles`. Administrator only.
- **System settings** — two columns. Left: *Payments & notifications* toggle list (GCash, Cash, MTOP franchise-expiry notices) marked `Administrator only`, and a `Read-only` *Matching heuristic* reference block (bearing tolerance, detour ratio, search radius, low-rating threshold). Right: *Fare matrix* — base fare, base distance, rate per succeeding km, a **worked example** in a `#F6F7F9` box that computes a 4.2 km trip, `Save changes`, and a last-changed audit line. The `Affects live fares` warn badge is required.

### 10 Audit log
Read-only for **all three tiers** — the point is transparency across ranks, not an Administrator's private ledger. Header states the read-only rule once so nobody hunts for an edit affordance. **Two tables, never one merged feed**, because the two sources don't share columns:
- **Account actions** (`account_actions`) — When · Action · Target · Reason · Linked complaint · By. Above it, a one-line filter strip: search, action select, role select, date range, a read-only chip stating the retention/scope rule, and `Export CSV` in the table header row.
- **Verification & discount decisions** — When · Decision · Subject · Category · Reviewer. Approve/Reject badges use the success/danger badge pair.

Every row already exists in the data; nothing here is new instrumentation. Filters scope the first table only, and that is stated in its header.

### 11 Barangays
Administrator-only reference data behind `RequireAdmin`, like PSO Users and System Settings. Header carries the ordinance line (**Ordinance No. 37 s.2018**) as the authority for the cluster assignment, since editing this table is amending a legal schedule. Layout: header, then an inline add/edit panel (Barangay name, Cluster select, `Add barangay` / `Save changes` + `Cancel`), then the filter strip, then the list. The table (Barangay · Cluster · Drivers · Actions) is capped at six rows with `Showing 6 of 26` in the footer — the list is reference data, not a work queue. `Edit` loads the row into the inline panel above rather than opening a modal; `Delete` opens the standard destructive confirm (§12) naming the barangay and stating that drivers assigned to it keep their cluster until reassigned.

### 12 States — the feedback system
A component sheet, not a route: nine cards defining the whole feedback vocabulary. Every string on it is one the code already produces.

| Card | Rule |
| --- | --- |
| Field-level validation | 1.5px `#B3261E` border + one 11.5px danger line with a 13px alert glyph beneath the field. Reserve the line's height so nothing shifts |
| Form-level error | `#FBEAE8` / 1px `#B3261E` / radius 11 block **inside the form, directly above the submit button** — never at the top of the page. Optional second line in `#8A1D17` at .85 |
| Page-level failure | Dashed `#DCE2E6` region replacing the content: danger icon tile, one heading, one sentence, and `Retry` in the message |
| Success toast | Bottom-right, white radius 10, `0 8px 22px rgba(0,0,0,.24)`, 22px status circle + one line + close, 4s auto-dismiss. Export toasts carry an `Open` link |
| Empty tables | Dashed region, icon tile, one line (+ optional support line). An empty queue reads as good news, not a dead end |
| Loading | Skeleton rows that **keep the real column widths and row height**; three rows fading `#EBEFF2` → `#F1F4F7` → `#F6F7F9`. Submit buttons state the verb in progress (`Setting password…`) with a 13px ring spinner |
| Profile menu expanded (×2) | The two inline-edit states from §04 |
| Destructive confirm | One shape for log out, suspend, block and delete: icon tile + title + consequence sentence, footer on `#F6F7F9` with `Cancel` and the danger button. Red is spent only on the confirm button |

---

## 3. What changes in the repo

These are deliberate design decisions, not drift. Apply them.

1. **`--sidebar-w: 176px → 236px`** and **`--topbar-h: 56px → 62px`**. The 176px rail could not hold icon + label + count chip.
2. **`NAV_GROUPS` is regrouped and reordered** to the five groups in §1 (was Overview / Live Operations / Directory / Review Queues / Insights / Administration). Labels, `to`, `title` and `min` values are unchanged — only captions, grouping and order move. `ROUTE_TITLES`, `visibleNavItems` and `matchNavItems` keep working untouched.
3. **Nav count chips are new.** They need live counts for Emergency Alerts, Verification, Fare Discounts and Complaints — same numbers the dashboard band uses.
4. **One new token:** `--shadow-panel: 0 3px 8px rgba(0,46,96,.10)` (panels sit flatter than `--shadow-card`). Table headers use the existing `--fill`; the mock's `#F1F4F7` is the same intent.
5. **Radius:** panels 14px, buttons 9px, inputs 10px, modal 16px. Add `--r-panel: 14px` if you don't want raw values; everything else maps to `--r-sm`/`--r-md`.
6. **Rating squares replace stars** everywhere (`RatingSquares` already exists).
7. **`S+` suffix** on privileged action labels, and privileged controls are **hidden** for `pso_staff`, not disabled — matches `rbac.ts`'s existing wireframe convention.
8. **The brand assets are never placed directly on navy.** `trisakay-mark.png` and `trisakay-lockup.png` are navy + green on a transparent ground; on any dark surface they sit on a white carrier (7px-radius tile in the rail, 16px-radius plate on Login). If a white-on-transparent lockup is ever produced, it may replace the carrier — until then the carrier is required.
9. **Nav gains two items:** `Audit Log` under INSIGHT and `Barangays` under ADMINISTRATION (the latter inside the existing `RoleGate`). Both routes already exist in `App.tsx`; only `NAV_GROUPS` and `ROUTE_TITLES` need the entries.
10. **Two new presentational components** (see §4a): `Toast` + a `ToastProvider`/`useToast` hook, and an `error` prop on `TextField` / `Select` / `Textarea` that renders the field-level message. `ErrorBanner` stays in the tree but is used only as the form-level block, moved inside the form.
11. Restyle only: no route, store, service, or RBAC logic changes anywhere in this handoff.

## 4a. The feedback migration (the one behavioural change)

Today `ErrorBanner` is mounted at the top of each route and receives whatever the store's `error` string holds; successes have nowhere to render. The redesign splits that one channel into four, with **no change to what the stores produce**:

| Store output | Where it renders now |
| --- | --- |
| A message naming a field (`Password must be at least 8 characters.`, `Full name is required.`) | field-level, via the field's new `error` prop |
| A submission-wide refusal (`Email and password are required.`, `This account is not authorized for the admin portal.`) | form-level block above the submit button |
| A failed initial load with no data to show | page-level failure region with `Retry` |
| Any success (`Name updated.`, `Password updated.`, export ready) | toast, bottom-right, 4s |

Mapping a store error to a field is the only judgement call. Do it in the route component with an explicit map from message → field name; do **not** add error codes to the services in this pass. If a message has no mapping, fall back to the form-level block — never drop it.

## 4. Open items for the team

- Live counts for the four rail chips — endpoint or derive from existing dashboard service?
- Complaints SLA clock: is "overdue" the ARTA 3-day business rule, or a per-category target?
- Rating threshold (2.5★) and minimum ratings count — confirm against `settings.ts` before hard-coding the *How this list is built* copy.
- Ride monitoring cell size for the privacy grid (mock uses a coarse ~500m cell).
- Whether the temporary-password callout may be re-shown to an Administrator, or is strictly one-time.
- **Confirm the §4a split against the backend validation flow** — specifically whether errors will keep arriving as prose strings (then the route-level message → field map stands) or can carry a field key, which would make the map unnecessary.
- Audit log retention/scope: the read-only chip in the filter strip states a rule that needs confirming.
- Whether deleting a barangay must be blocked while drivers are still assigned to it, or only warned about as drawn.
