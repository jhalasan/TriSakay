# TriSakay — UAT Panel Prep: Technical Explanation & Q&A

Study guide for explaining TriSakay's functionality, backend, and algorithms in a face-to-face panel. Written to be explainable out loud, in plain language first, with the technical backup underneath. Every claim below is verified against the actual code (file:line references included) — nothing here is guessed or assumed.

---

## 1. What TriSakay is, in one paragraph

TriSakay is a tricycle ride-hailing system for General Santos City, built as three connected apps sharing one backend: a **passenger app** (book rides), a **driver app** (accept and complete rides), and an **admin/PSO web portal** (the city's Public Safety Office manages drivers, tricycles, complaints, and verification). All three talk to the same Supabase backend, so a ride, a driver's status, or a complaint is always the same data everywhere — there's no syncing between separate systems.

---

## 2. Project structure (monorepo)

Everything lives in one repository, organized as:

- **`apps/passenger`** — Expo/React Native mobile app for riders.
- **`apps/driver`** — Expo/React Native mobile app for drivers.
- **`apps/admin`** — a React + Vite **web** app (not mobile) for PSO staff/supervisors and system admins.
- **`packages/services`** — the shared backend-access layer. All three apps call into this instead of each writing their own database queries, so the actual table/RPC names exist in exactly one place.
- **`packages/shared`** — shared constants, translations (English/Filipino), and TypeScript types generated from the database schema.
- **`packages/ui`** — shared React Native components (buttons, cards, map overlays) so passenger and driver apps look/feel consistent.

**Why this matters for the panel:** this is a "one backend, three clients, shared code" pattern. A small team can keep three apps consistent without maintaining three codebases that quietly drift apart from each other.

---

## 3. The backend: Supabase — what it is and why it was chosen

**Supabase is a hosted platform that bundles five things a team would otherwise have to build and run separately:**

1. **A real PostgreSQL database** — standard relational SQL, not a proprietary format.
2. **Authentication** — account creation, login, password reset, session tokens (JWTs).
3. **Realtime** — the database can push change events (inserts/updates) live to any subscribed client over a WebSocket, without polling.
4. **Storage** — a file-storage service (like a simplified S3) for uploaded images (driver's license photos, ID photos, etc.).
5. **Edge Functions** — small serverless functions the team writes, for anything sensitive that can't be trusted to run on a user's phone.

**Why Supabase instead of building a custom Node/Express backend:**
- One managed service instead of five separate ones to provision and maintain.
- Auth is built-in and handled correctly by default (password hashing, token issuance) — not something a small student team has to get right from scratch.
- **Row Level Security (RLS)** — explained in detail below — moves access-control logic into the database itself, so "who can see what" doesn't depend on every screen in three different apps remembering to check permissions correctly.
- A generous free tier suits a capstone project with no budget.
- Mobile apps can often query the database directly (through Supabase's auto-generated REST layer) while RLS still enforces the rules — reducing how much custom backend code has to be written and maintained.

A deliberate technical decision worth mentioning: the team **tried PostGIS** (a common Postgres extension for geographic queries) and **removed it**, because it installs into the shared `public` schema and drags in a system table with row-level security disabled, which triggered a security warning for no real functional benefit at this app's scale. Instead, all distance/bearing math (see Section 6) is done with plain formulas in code. This is a good example of engineering judgment — choosing the simpler tool deliberately, not defaulting to the fancier one.

---

## 4. Database design

The database is **relational and normalized** — real foreign keys, no JSON blobs pretending to be tables. Core tables:

| Table | Purpose |
|---|---|
| `users` | One row per person (passenger / driver / pso_staff / pso_supervisor / admin) |
| `driver_profiles` | Extra data for driver accounts — verification status, **live** GPS position (overwritten, not logged) |
| `tricycles` | The physical vehicle — separate from the driver, since a driver can switch units; carries franchise number/expiry and a zoning "cluster" |
| `driver_documents` | Uploaded license/OR-CR/franchise/photo documents pending PSO review |
| `trips` | One tricycle journey — can carry **multiple** ride requests (TriSakay supports pooled/shared rides, not strictly 1 driver : 1 passenger) |
| `ride_requests` | One passenger's booking — pickup/destination, fare, status lifecycle |
| `transactions` | Fare **collection** record (cash or GCash) |
| `ratings` | Passenger rates driver (one-directional) |
| `complaints` | Full PSO complaint workflow — triage → review → resolution, modeled on the PSO's real paper process |
| `account_actions` | Immutable audit log of suspend/reactivate/flag actions |
| `fare_config` | The versioned fare formula (see Section 6) |
| `system_settings` | Tunable thresholds for the ride-matching heuristic |
| `notifications` | Per-user in-app notification inbox |
| `emergency_alerts` | SOS/panic-button log |

**A privacy-by-design detail worth citing:** a driver's live location is *overwritten, never logged* — there's no historical GPS trail stored anywhere, and a database trigger clears a driver's location the instant they go offline. This was a deliberate choice to avoid keeping unnecessary personal location history.

---

## 5. Row Level Security (RLS) — the real access-control layer

**Plain explanation:** normally, an app's *code* decides who can see what (e.g., "if you're a passenger, only show your own rides"). The problem is that check lives inside the phone app — someone who bypasses the app and talks to the database directly could ignore it. RLS moves the exact same rule **into the database itself**. Every table has policies, written in SQL, that Postgres checks on *every* query — no matter which app, or what tool, is asking. If a policy doesn't allow a row, that row simply doesn't exist for that query. The project's own schema doc states this directly: *"RLS is the real enforcement layer for RBAC. UI button-hiding is UX only."*

Concrete examples:
- A passenger can only see and cancel their **own** ride requests — and even then, only while it's still `pending`. They cannot set their own final fare or discount percentage; those fields are locked out of the passenger's update policy on purpose, so even a technically-savvy user calling the API directly can't tamper with a final fare.
- A user **cannot promote their own account to admin** through the API — the policy that lets you update your own `users` row explicitly requires your role to stay the same.
- GCash transactions can only ever be marked "paid" by one specific server-side function (the payment webhook) — no client-facing policy grants that permission at all, by design.
- An `emergency_alerts` row is deliberately **not** visible to the other person on the ride — so if a passenger files a safety alert against a driver mid-ride, the driver can't see it and potentially escalate the situation.

This is also **iterative**, not a one-shot design: there's a dedicated hardening pass in the codebase where RLS gaps found in an earlier review were found and fixed — good evidence of an actual security-review process.

---

## 6. Authentication & role enforcement

Handled by **Supabase Auth**, wrapped in one shared file (`packages/services/src/auth`) that every app's login/register screens call into.

- **Sign-up**: creates a Supabase Auth account, and a database trigger automatically creates the matching `users` profile row (and a `driver_profiles` row for drivers) in the *same transaction* — so a profile can never exist without its auth account, or vice versa.
- **Sign-in**: issues a signed session token (JWT). That token is what every RLS policy checks against on every subsequent request.
- **Role-based access**: a `role` column (`passenger | driver | pso_staff | pso_supervisor | admin`) drives every permission check, enforced at the database level — not just by hiding UI buttons.
- **Privilege-escalation guard**: the public sign-up form can only ever create `passenger` or `driver` accounts. PSO/admin accounts can only be created by a privileged server-side function, itself restricted to callers who are already admins.
- **Forced password change + session revocation**: newly created PSO/admin accounts get a one-time temp password and must change it before doing anything else. Admins can also forcibly terminate another user's active login session — important because just disabling an account doesn't invalidate an already-issued token.
- **Re-authentication for sensitive changes**: changing a phone number or password requires re-entering the current password first — added specifically to close an "unattended, unlocked device" risk flagged in an earlier UAT review.

---

## 7. Edge Functions — server-side-only logic

**Plain explanation:** an Edge Function is a small piece of code that runs in Supabase's cloud, not on the user's phone. It's used for anything that must never be trusted to client code: anything needing a secret key, anything needing to see across *all* users' data rather than just one person's own rows, or anything triggered by something other than a logged-in person (a database event, a schedule, an external service).

The seven Edge Functions in this project:

1. **`match-ride-request`** — the ride-matching logic (see Section 8).
2. **`notify-drivers-new-request`** — fires the instant a new ride request is created, pushing a notification to eligible drivers so a backgrounded app still wakes up.
3. **`notify-expiring-documents`** — a daily job warning drivers whose license/permit documents are close to expiring.
4. **`admin-create-pso-user`** — the only way to create a PSO/admin account, because that requires a maximally privileged key that must never reach a phone or browser.
5. **`paymongo-webhook`** — the only place a GCash payment is ever marked "paid." Verifies the payment provider's cryptographic signature and cross-checks the amount actually paid against what was billed, closing a "forgeable payment confirmation" gap found in an earlier security pass.
6. **`create-gcash-checkout`** — starts a GCash payment session.
7. **`nearby-driver-count`** — a small helper showing "N drivers nearby" to a passenger without exposing individual driver identities.

**Why this matters:** putting this logic in the phone app would mean either shipping secret keys inside the app (which can be extracted) or trusting the client to self-report things like "the payment succeeded" — exactly the kind of gap the payment webhook design avoids by verifying independently, server-side.

---

## 8. The matching "algorithm" — what actually happens when a ride is requested

This is likely the single most important technical section for the panel, since it's the closest thing to an "algorithm" in the traditional sense.

**Step 1 — Notification (broadcast to eligible drivers):** When a passenger requests a ride, a database trigger immediately fires a push notification to drivers who are: online, verified, have enough seats free, and are authorized for that barangay's zoning cluster (tricycles are legally zoned by ordinance into color-coded clusters — red/white/apple green/melting pot — and can only serve matching areas). This step does **not** filter by distance — it's a broadcast to everyone eligible in the right zone, meant only to wake up the driver's app.

**Step 2 — Ranking (once a driver opens the request board):** A second, separate function computes real geolocation math for each pending request:
- **Distance** using the **Haversine formula** (great-circle distance between two GPS coordinates — the standard way to compute distance on a sphere from latitude/longitude).
- **Bearing** (compass direction) from the driver's current position to the pickup point, compared against the driver's own direction of travel.
- **Detour ratio** — how much extra distance accepting this request would add to the driver's own route, compared to going straight there.

Requests are kept only if they're within a configurable search radius (default 3 km), within a bearing tolerance (default 40°), and don't add too much detour (default 1.25× max), then sorted by direction-match first, distance second. These thresholds live in a settings table so they can be tuned without a code change.

**Honest framing for "is this AI/machine learning?"**: No. It's rule-based geometry — Haversine distance + bearing + a detour-ratio cutoff — not a trained model, not demand prediction, not dynamic pricing. The code itself calls this a "heuristic," not an "algorithm" or "AI," and is explicitly documented as provisional, pending real usage data to tune the thresholds. Be upfront about this rather than overselling it — it's a legitimate, real piece of engineering, just not machine learning.

---

## 9. Fare calculation — a fixed formula, not a lookup table, not surge pricing

The fare is computed by a single server-side function, based directly on a real city ordinance (General Santos City Ordinance No. 08, s. 2023):

- **Base fare: ₱15.00** covers the first 4 km.
- **Beyond 4 km:** add ₱1.00 per additional full kilometer, rounded up (so 4.2 km and 4.9 km both cost the same as 5 km).
- **Multiplied by number of seats** requested (since fare is per passenger).
- **Senior/PWD/student discount** (20%, per RA 9994/RA 10754) applies only to the one seat belonging to the ID-verified passenger, not the whole booking — because only that one identity was actually verified.

**No surge pricing, no time-of-day multiplier, no demand-based pricing** exists anywhere in the app — this was checked directly in the code. If asked whether fare is "AI-optimized," the honest answer is no — it's a direct codification of a city tariff ordinance.

**A real anti-tampering safeguard worth mentioning:** the client never computes or submits the final fare — it only sends coordinates. The server independently recomputes the distance using its own Haversine formula and clamps any suspicious value (e.g., a distance far larger than physically plausible for those two points) before calculating the fare. This was tested live: a rigged request claiming a 50 km trip for ₱1 was automatically corrected to the real ~5.35 km distance and the correct ₱17 fare.

---

## 10. Real-time location tracking

The driver's location updates live on the passenger's map through **Supabase Realtime** — a live feed of database change events delivered over a WebSocket connection, not the app repeatedly polling the server.

- **Driver side:** location updates are throttled — sent at most once every 8 seconds or every 30 meters moved, whichever comes first (using the phone's GPS via `expo-location`). This is foreground-only by design; there's no background location tracking.
- **Passenger side:** subscribes to a live channel that gets pushed an update the instant the driver's row changes in the database — no polling loop on the passenger's end either.

This is genuinely real-time and event-driven, which is worth highlighting: most simple apps would poll ("ask the server every N seconds"), which wastes battery and bandwidth and is always slightly stale. This app instead reacts instantly to actual database changes.

---

## 11. Distance & ETA estimation

- **Straight-line distance/ETA** (used for live "how far is my driver" during an active trip): Haversine formula divided by an assumed average tricycle speed of 20 km/h. This is deliberately a simple estimate, not a routing-engine calculation — be upfront that this is an approximation if asked.
- **Route distance for booking/fare display**: uses a real road-network routing engine (OSRM) to get an actual driving-route distance and shape, falling back to the straight-line Haversine estimate if the routing service doesn't respond within 8 seconds.

So: the fare/route shown at booking time uses real road-network distance where possible; the live in-trip ETA is a simpler straight-line approximation. Both are honest, defensible choices — just be accurate about which is which if asked.

---

## 12. What happens if no driver accepts (timeout logic)

- The passenger sees a 60-second search window. If no driver has accepted by then, they're routed to a "no drivers nearby" screen — but the request itself stays open (not cancelled), so a driver could still accept it moments later and the passenger gets reconnected automatically.
- Each driver sees a shorter (18-second) visual countdown on a request card — this is just a UI indicator, not an actual expiration or reassignment trigger.
- A scheduled server-side job runs every 5 minutes and automatically cancels any request that's been pending for more than 15 minutes, so abandoned requests don't clutter the driver's board forever.
- There's no automatic retry/re-dispatch algorithm — if a passenger wants to try again, that's a manual action (adjusting pickup, or re-requesting).

---

## 13. Push notifications

Sent through Expo's push notification service (not a custom push server), triggered by:
1. A new ride request being created (see Section 8's Step 1).
2. A daily scheduled check for driver documents nearing expiry (license, franchise permit, etc.) — drivers get warned 30 days before expiry, once per expiry, not repeatedly.

Both are triggered from the database itself (a trigger, and a scheduled job), not from any user's phone being open — which is why they run as server-side Edge Functions rather than client code.

---

## 14. Automated/scheduled jobs (pg_cron)

Two recurring jobs run directly inside the database on a schedule:
1. **Daily at 8am** — checks for tricycles whose city franchise permit is expiring within 30 days and notifies the driver.
2. **Daily at midnight** — checks for any driver document (license, OR-CR, tricycle photo, etc.) expiring within 30 days and sends a push notification.

**Why server-side and scheduled, not client-triggered:** "30 days before expiry" isn't something that happens when a user does something — it becomes true purely from the passage of time. No individual phone session is a reliable place to check for that, since phones aren't always open, and this needs to happen exactly once per day system-wide, not once per user. A scheduled database job guarantees it runs reliably regardless of whether anyone has the app open.

---

## 15. Why important logic lives in the database (not just app code)

Several critical operations — approving a driver's verification, resolving a complaint, taking action against an account — are implemented as single Postgres functions the apps call, rather than as a sequence of separate app-side database writes. Reasons:

- **Atomicity.** Approving a driver's verification touches four different tables (their profile, their tricycle, their pending documents, and a notification). If this were four separate app-side update calls, a dropped connection partway through could leave the system in an inconsistent half-approved state. As one database function, it's one all-or-nothing transaction.
- **One source of truth.** The passenger, driver, and admin apps are three separate codebases. If "resolve a complaint" were reimplemented separately in each, the three copies could quietly diverge over time. Living in one database function, there's exactly one implementation all three apps share.
- **Unbypassable security.** These functions run with elevated database privileges internally, but only after their own explicit role checks (e.g., "is this caller a PSO supervisor?") — and the underlying tables' own row-level security wouldn't allow a plain client update to reach across other users' rows anyway. The function is deliberately the only door.
- **Built-in auditability.** Because status changes always flow through one function, a single database trigger reliably logs every change to an audit table — no future code path can forget to log something, because logging isn't optional or manual.

---

## 16. OTA Updates (EAS Update) — deployment infrastructure

Both mobile apps are wired for **Expo Application Services (EAS) Update**, which allows pushing new JavaScript code directly to installed apps without going through a new Play Store/App Store submission and review cycle. This is useful to mention as evidence of a real, non-trivial deployment pipeline — but be careful not to frame this as a "smart" *feature* of the app. It answers "how do you deploy fixes," not "what's intelligent about the app's behavior."

---

## 17. "What makes TriSakay smart?" — the honest, defensible answer

This is the single most important question to prepare for, because it was flagged in a prior internal review as the one genuinely open item, and there is **no AI/machine-learning claim anywhere in the code** — this was directly verified by searching the entire codebase for any such logic. Do not claim there is one.

**The honest and still legitimate answer:**

TriSakay's "smart" component is not artificial intelligence — it's a combination of:

1. **A real-time reactive architecture.** The app doesn't poll or refresh on a timer; it reacts instantly to actual database events (a new ride request, a driver's location changing, a status update) via Supabase Realtime. This is architecturally more sophisticated than a simple CRUD app that just refreshes periodically.
2. **A rule-based geolocation matching heuristic.** Ride requests are ranked for each driver using real geometry — Haversine distance, compass bearing alignment, and detour-ratio calculations — filtered through legally-mandated zoning rules (tricycle clusters), not a random or first-come-first-served list.
3. **Server-authoritative, tamper-resistant computation.** Fare and distance are never trusted from the client — they're independently recomputed and validated server-side, with automatic correction of implausible values.
4. **Automated lifecycle management.** Stale ride requests, expiring documents, and permit renewals are tracked and acted on automatically via scheduled jobs, without needing a human to notice and follow up manually.

**Suggested framing if directly asked "do you use AI?":** *"No — TriSakay's intelligence is in its real-time, rule-based architecture: it reacts instantly to events rather than polling, and it uses genuine geolocation math — Haversine distance, bearing, and detour-ratio calculations — combined with the city's actual zoning ordinance, to rank ride matches. It doesn't use machine learning or predictive AI, and we'd rather be upfront about that than overstate it."* This kind of direct, precise answer tends to land better with a technical panel than a vague or evasive one.

---

## 18. Base64 / password security (recap from a prior panel question)

If this comes up again: temporary passwords for PSO accounts use Base64 **only** to turn random bytes into a readable text string (so it can be typed/copied) — never as a security mechanism. That temp password is immediately handed to Supabase Auth, which hashes it with bcrypt before storing it, exactly like every other password in the system. Base64 never touches how a password is stored, verified, or transmitted as security. A repo-wide search confirmed there is no place where Base64 is used as encryption or as password protection.

---

## 19. Quick reference — anticipated Q&A

**Q: Why Supabase instead of building your own backend?**
A: It bundles a managed Postgres database, authentication, realtime updates, file storage, and serverless functions into one platform — letting a small team focus on the app's actual logic instead of building and securing five separate systems from scratch. Row Level Security in particular means access control is enforced by the database itself, not just by app code that could have a bug.

**Q: How do you prevent a passenger from editing their own fare or a user from making themselves an admin?**
A: Row Level Security policies at the database level explicitly disallow it — even a direct API call, bypassing the app entirely, would be rejected by Postgres itself.

**Q: What algorithm do you use to match a driver to a ride?**
A: A rule-based heuristic: Haversine distance, compass bearing alignment to the driver's direction of travel, and a detour-ratio cap, layered on top of a hard legal filter for tricycle zoning clusters. It's genuine geometry-based ranking, not machine learning.

**Q: Is your fare pricing dynamic/surge-based?**
A: No — it's a fixed formula directly from the city's tricycle fare ordinance (₱15 base for 4 km, +₱1/km after, ceiling-rounded), computed server-side so it can't be tampered with by the client.

**Q: How do you keep the driver's location updating live on the passenger's map?**
A: Supabase Realtime — a live, event-driven feed over a WebSocket connection. The passenger's app is notified the instant the driver's location changes in the database; it doesn't poll on a timer.

**Q: What happens if no driver accepts a ride?**
A: The passenger sees a "no drivers nearby" screen after 60 seconds, but the request stays open in case a driver accepts late. A scheduled job automatically cancels any request that's been pending more than 15 minutes so it doesn't clutter driver boards indefinitely.

**Q: What makes this app "smart"?**
A: See Section 17 above — real-time reactive architecture, geolocation-based ranking heuristics, and server-side tamper-resistant computation, explicitly *not* AI/ML. Be honest and precise about this rather than overstating it.

**Q: How do you push updates to the apps?**
A: EAS Update allows pushing JavaScript code changes directly to already-installed apps without an app-store resubmission — useful during iterative UAT testing cycles. This is a deployment-pipeline answer, not a "smart feature" answer.

**Q: Why do critical actions (verification approval, complaint resolution, account suspension) go through special database functions instead of normal app code?**
A: Atomicity (multiple related table updates succeed or fail together as one transaction), a single shared implementation across all three apps, and unbypassable security since these functions do their own internal permission checks and are the only path allowed to make those changes.
