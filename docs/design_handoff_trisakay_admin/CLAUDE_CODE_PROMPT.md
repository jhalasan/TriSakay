# Claude Code prompt — TriSakay admin (PSO) portal redesign

Copy the block below into Claude Code from the repo root, with this handoff folder available (e.g. `design_handoff_trisakay_admin/` inside the repo, or pass its path).

Each phase is one session. Do not start a phase until the previous one is committed and runs in the browser.

This app is independent of the passenger and driver redesigns — it can run before, after, or alongside them.

---

## The prompt

> You are implementing a completed, locked high-fidelity redesign of the TriSakay **admin (PSO) portal** — `apps/admin`, a Vite + React 18 + React Router + CSS Modules + Zustand web app in this monorepo.
>
> **Read first, before writing any code:**
>
> - `design_handoff_trisakay_admin/README.md` — the full spec: the four system rules, shell anatomy, component vocabulary, per-screen specs, the feedback migration in §4a, and the list of intentional repo changes in §3.
> - `design_handoff_trisakay_admin/screenshots/` — one wide PNG per screen group (12 groups, all 15 routes), 1440×900 per frame.
> - `design_handoff_trisakay_admin/TriSakay Admin Redesign.dc.html` — the source prototype. Open it in a browser whenever a measurement is ambiguous; every frame is labelled with `data-screen-label`. It renders at 1440×900, which is the design width.
> - `design_handoff_trisakay_admin/TriSakay Admin Screens.dc.html` — the pre-redesign recreation. Reference only, to see what changed.
> - `apps/admin/src/styles/tokens.css` and `globals.css` — every colour, radius, shadow, space and type size you may use.
> - `apps/admin/src/lib/{navigation,rbac,format}.ts`, `apps/admin/src/App.tsx`, `apps/admin/src/store/useSessionStore.ts` — the routing, nav and role model you must preserve.
> - The existing components in `apps/admin/src/components/**`. Every screen in this redesign is built from them; you are restyling and recomposing, not starting a component library.
>
> **Hard rules for every phase:**
>
> 1. The HTML is a **reference, not code to port**. It is one flat prototype with utility classes; the real app is React + CSS Modules. Recreate each screen with this repo's patterns: one `*.module.css` per component or route, tokens via `var(--…)`, `NavLink`/`Outlet` routing, Zustand stores for state.
> 2. **No new colours.** Every hex in the mock already exists in `tokens.css`. If one doesn't, stop and report it. The only exception is the placeholder map greys on Ride Monitoring.
> 3. **The only new tokens allowed** are the two layout changes and one shadow in README §3: `--sidebar-w: 236px`, `--topbar-h: 62px`, `--shadow-panel: 0 3px 8px rgba(0,46,96,.10)`. Optionally `--r-panel: 14px`. Nothing else.
> 3b. **The only new components allowed** are `Toast` + `ToastProvider`/`useToast` and the `error` prop on the existing field components, both specified in README §4a. Everything else is recomposition of what exists.
> 4. **Restyle, don't rewrite logic.** Routes, guards (`RequireAuth`, `RequireAdmin`), services, stores, CSV export, auto-refresh, and every RBAC predicate stay exactly as they are. If a redesign seems to require a logic change, stop and ask.
> 5. **RBAC is presentation-only here:** privileged controls get the literal `S+` suffix in their label and are **hidden** for `pso_staff` via `RoleGate`, never disabled. `rbac.ts` is the source of truth for which controls those are.
> 6. Poppins for UI, `var(--mono)` for IDs, codes, timestamps, money and every uppercase eyebrow. Never fake a weight — load the Poppins weights the mock uses (400/500/600/700/800).
> 7. **Never put the brand mark or lockup straight onto a navy surface.** Both PNGs are navy + green on transparent and vanish against `--primary`. The rail mark sits on a white 7px-radius tile; Login's lockup sits on a white 16px-radius plate. See README §3 item 8.
> 8. The shell is identical on every screen. If a screen needs a variant top bar or rail, that's a bug in your implementation, not the design.
> 9. Don't touch `apps/passenger`, `apps/driver`, or `packages/*`. `packages/ui` is React Native and cannot be imported here.
>
> **Work phase by phase. One phase per session.** At the end of each phase: run typecheck, lint and the existing tests in `apps/admin/tests`, compare the screen against its screenshot at a 1440px viewport, list what you changed and anything that didn't match the spec, then stop and wait for me. Do not begin the next phase on your own.
>
> ### Phase 0 — Foundation (no screens)
> Add the three tokens from README §3 to `tokens.css`. Confirm every other value the README references already exists, and report any gap. Then read `AppShell`, `Sidebar`, `TopBar`, `DataTable`, `TableToolbar`, `Badge`, `Button`, `StatTile`, `Pagination`, `RatingSquares`, `Toggle`, `TextField`, `Textarea`, `Select`, `PlaceholderBox`, `ConfirmModal` and write into a scratch file the exact recipes you will reuse for: the navy rail item (active fill + 3px left marker + count chip), the white panel (radius 14, 1px `--line`, `--shadow-panel`, 18px padding), the eyebrow, the metric, the table row, the status badge set, and the S+ action row. Change no screens.
>
> ### Phase 1 — Shell
> `components/{AppShell,Sidebar,TopBar}` and `lib/navigation.ts`. Rail at 236px with the brand row (mark on its white tile), the **five regrouped nav groups from README §1** (captions, grouping and order change; `to`/`label`/`title`/`min` do not), 16px stroked icons, the active marker, count chips (`rgba(255,255,255,.16)`, and solid `--danger` for Emergency Alerts), and the footer user row. Top bar at 62px with the title from `ROUTE_TITLES`, the jump-to search wired to the existing `matchNavItems`, role badge from `ROLE_LABELS`, bell with dot, initials avatar. Keep the Administration group's `RoleGate`. Wire the chip counts to the dashboard service if the numbers are already available; if not, leave the prop optional and report it. Screenshot: any frame in `02`.
>
> ### Phase 2 — Login & first sign-in
> `routes/Login.tsx` + `Login.module.css`. Split 5fr/6fr, `--gradient-hero` brand pane with the dotted route motif as inline SVG (three dashed beziers, two nodes), the 150px lockup on its white plate, and the single 368px field column on the right — 46px fields, radius 12, password reveal, 48px primary, and the restricted-access line under the button. Keep the existing Supabase sign-in call and `RedirectIfAuthed` behaviour, but move the error out of the page-top banner into the form-level block above the submit button (README §4a). Then `routes/ForcePasswordChange.tsx` + its module CSS: the lockup-only header with `Cancel and sign out`, the 560px column, the account head band, the two password fields, the strength bar and the **live requirements checklist** — the checklist is derived from the same predicates the submit handler already uses, so a rule can never be shown as met and then rejected. Screenshots: `01`, `02`.
>
> ### Phase 3 — Dashboard, log out & profile menu
> `routes/Dashboard.tsx`. Build the four bands in order: *Needs attention today* (three accent-edged panels with deadline badges and forward links), the four-cell volume strip, the two charts (`RidesOverTimeChart`, `RideStatusChart` — restyle `chartTheme.ts`, don't rewrite the charts), and the 5-row recent-activity table. The log-out `ConfirmModal` gets the 420px/radius-16 card treatment. The dashboard must not reintroduce equal-weight stat tiles at the top. Then the **profile menu** in `TopBar`: the labelled avatar trigger, the 332px popover, the two settled rows, and inline-edit-in-place for Name and Password (only one open at a time). Password editing calls the same update path as Phase 2 — do not write a second validator. Screenshots: `03`, `04`.
>
> ### Phase 4 — Directory
> `routes/{Drivers,Passengers}.tsx` plus `DataTable`, `TableToolbar`, `Pagination`. Both screens get the status-strip-as-filter (navy underline on the selected cell), one toolbar, one table with the columns in README §03, and **inline right-aligned actions** with `S+` on the privileged ones. Ratings render as `RatingSquares`. Footer shows the `Showing 1–7 of 248` line beside the pager. Screenshot: `05`.
>
> ### Phase 5 — Review queues
> `routes/{DriverVerification,DiscountReview}.tsx` + their module CSS, with `DocumentPanel`, `DocumentImage`, `PlaceholderBox`. Three panes at 1fr/1.35fr/1fr, each scrolling independently, no page scroll. Selected queue row is `--primary-soft` with a navy left edge. Per-document state chips and the `n of 4 documents verified` badge. Decision column holds the transcription fields, the notes textarea, `Approve S+` and `Reject S+` — and Reject stays disabled until notes are non-empty, which is already the rule in the store; surface it, don't reimplement it. Screenshot: `06`.
>
> ### Phase 6 — Live operations
> `routes/{RideMonitoring,EmergencyAlerts}.tsx` + `LiveMap`. The map renders **coarse counted cells, never per-passenger pins**, and the privacy caption sits under it as body copy, not a tooltip. Keep `useAutoRefresh` and the `Live · n on trip` badge. Emergency alerts is a 60/40 split — log table left, selected-alert detail right with `Mark reviewed S+`. Red appears only on the `Logged` badge and the alert accent. Screenshot: `07`.
>
> ### Phase 7 — Casework & insight
> `routes/{Complaints,RatingOversight,Reports}.tsx`. Complaints: SLA strip, then 55/45 queue-and-case split — the directive form and mediation sub-panel live in the right column and never below the table. Rating oversight stays read-only with the *How this list is built* panel and one ghost link to driver management. Reports: range control, four metrics, two charts, transactions table, existing `Export CSV` untouched. Screenshot: `08`.
>
> ### Phase 8 — Administration
> `routes/{PsoUsers,SystemSettings}.tsx`. PSO users: inline invite form above the roster and the one-time temporary-password callout (navy border, mono value, Copy/Done, explicit "won't be shown again" copy). System settings: two columns — toggle list + `Read-only` matching-heuristic block left, fare matrix with the worked example, `Affects live fares` badge and the audit line right. Both keep `RequireAdmin`. Screenshot: `09`.
>
> ### Phase 9 — Audit log & Barangays
> `routes/AuditLog.tsx` and `routes/Barangays.tsx`, plus the two new nav entries (`Audit Log` under INSIGHT, `Barangays` under ADMINISTRATION inside the existing `RoleGate`) in `NAV_GROUPS` and `ROUTE_TITLES`. Audit log is **read-only for all three roles** and is **two tables, not one merged feed** — account actions with the filter strip and `Export CSV` scoped to it, review decisions below with no filter. Barangays is Administrator-only: ordinance header, inline add/edit panel above the list (Edit loads the row into that panel — no modal), six-row cap with `Showing 6 of 26`, and the standard destructive confirm on Delete. Screenshots: `10`, `11`.
>
> ### Phase 10 — Feedback system
> Implement README §4a across every route. Build `Toast` + `ToastProvider`/`useToast` (bottom-right, 4s, close button, optional action link) and add the `error` prop to `TextField`/`Select`/`Textarea`. Then walk every route: field-owned messages go to their field, submission-wide messages to a form-level block inside the form above the submit, failed loads to the page-level retry region, and every success to a toast. Add the empty states and skeleton rows from screenshot `12` — skeletons must hold the real column widths. Submit buttons get their in-progress verb. `ErrorBanner` must no longer be mounted at the top of any route. Screenshot: `12`.
>
> ### Phase 11 — Polish
> Diff every screen against its screenshot at 1440×900, then at 1280px (the layout should compress, not break). Confirm: no hex outside `tokens.css`, no stray radius values, one identical shell everywhere, every `S+` control hidden for `pso_staff` and visible for supervisor/admin, focus rings on every interactive element, tables reachable by keyboard, and typecheck/lint/tests clean.
>
> Start with Phase 0 and stop when it's done.

---

## Notes for you (not part of the prompt)

- Phase 1 is the gate: every later phase assumes the 236px rail and the regrouped nav. Land it first.
- Phase 5 is the riskiest — the verification and discount stores already carry decision logic that must survive a full layout change.
- The nav count chips are the one place the redesign asks for data that may not exist yet. If the dashboard service doesn't already return those four numbers, ship Phase 1 with the chips off and add them later rather than inventing an endpoint.
- Phase 10 is the only phase that changes behaviour rather than styling. If the backend is about to start returning field keys with its errors, do Phase 10 after that lands — the message → field map in §4a becomes unnecessary.
- Open items Claude Code cannot resolve alone are listed in README §4 — chip counts, the SLA rule, the rating threshold source, the privacy cell size, and whether the temp password may be re-shown.
