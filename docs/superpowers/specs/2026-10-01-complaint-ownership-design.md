# Complaint ownership and handoff — design

Source: office procedure PSO-MTPS-PR-03 (Processing of Complaints Involving Tricycle Drivers) and the UAT survey finding that complaints are sometimes unsupervised, passed head → supervisor → staff, and sometimes lost.

**Scope:** complaints filed in the app only. Complaints arriving by letter, social media or the PSO number are out of scope (decided with the user).

## Goal
Every in-app complaint always has one named owner, every handoff is recorded and accepted, and nothing can act on a complaint it doesn't own. Overdue and unowned complaints are visible to supervisors.

## Roles (existing)
`pso_staff` (the in-charge), `supervisor`, `admin` (supervisor and admin = "S+", which covers the Department Head). No new roles.

## Data
- `complaints` gains: `assigned_to`, `assigned_by`, `assigned_at`, `assignment_accepted_at` (all nullable; null `assigned_to` = Unassigned).
- New append-only table `complaint_assignments`: `complaint_id`, `from_user`, `to_user`, `by_user`, `kind` (`claimed` | `assigned` | `accepted` | `declined` | `released`), `note`, `created_at`. No update or delete for anyone.
- Assignment columns change only through RPCs (same transaction-local flag pattern as `trisakay.allow_self_status`).

## RPCs (security definer, PSO only)
- `claim_complaint(id)` — staff takes an Unassigned complaint; auto-accepted.
- `assign_complaint(id, to_user, note)` — S+ only; note required; target must be an active PSO account. `assigned_to` changes at once and `assignment_accepted_at` stays null until the new owner accepts ("Awaiting acceptance"); until then only S+ accounts can act on it. If the new owner declines, it returns to Unassigned and supervisors see it flagged.
- `accept_complaint(id)` / `decline_complaint(id, note)` — new owner only.
- `release_complaint(id, note)` — owner or S+ returns it to Unassigned (e.g. owner is away).
- `list_pso_staff()` — id, full name, role of active PSO accounts, for the assign picker.

## Rules
- A `pso_staff` account may change status or record a triage only on a complaint assigned to them and accepted. S+ accounts may always act.
- Mediation cannot be scheduled until a Department Head directive is recorded.
- Complaints are never deleted. Evidence is add-only (existing).
- Every assignment change writes a `complaint_assignments` row (who, from, to, note, when).

## Admin UI
- List: "Owner" column (replaces "Handled by"; shows "Unassigned" or "Awaiting acceptance"), filters "My complaints" and "Unassigned", flag for Unassigned or Awaiting acceptance for more than 1 business day (the existing 3-day overdue flag stays).
- Panel: Owner section with the right button for the viewer (Claim / Assign / Accept / Decline / Release) and a Handoff history list. The existing "Handled by" step list stays.
- Dashboard: count of Unassigned and Awaiting-acceptance complaints for S+.

## Rulings
- No separate "alternate" field: the office's "designate alternates" control is met by supervisors being able to assign, release and see every unowned or stale complaint. Cost if wrong: add an alternate column later.
- Escalation is shown, not pushed: flags in the list and dashboard, no email or push, because email needs the domain. Cost if wrong: a stale complaint is only noticed when a supervisor looks.
- Existing complaints stay Unassigned after the migration; the first person to act claims them.

## Verification
- SQL tests (rolled back): staff can't act on a complaint they don't own; claim races (second claim fails); assign needs a note and S+; accept/decline only by the new owner; history can't be edited or deleted; mediation blocked without directive.
- Services unit tests for each RPC wrapper; admin store tests; typecheck.
- Live check of the migration on the real database only after approval.
