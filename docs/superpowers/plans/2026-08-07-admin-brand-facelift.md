# Admin Web App Brand Facelift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `apps/admin`'s visual styling (corner radius, shadows, gradient, brand typography) in line with the driver/passenger mobile apps, and place the real TriSakay logo in the Sidebar, Login screen, and browser favicon.

**Architecture:** Pure CSS-token + markup change. No new dependencies, no component prop/behavior changes, no route changes. A new radius/shadow/gradient/font-brand token set is added to `apps/admin/src/styles/tokens.css`, then every CSS Module that currently uses the flat `var(--r)` token is migrated to the tier matching its `packages/ui` equivalent (`packages/ui/src/theme/radius.ts` and `elevation.ts`). Logo PNGs are copied from the repo-root `/assets/brand/` into `apps/admin/public/brand/` (Vite serves `public/` at the site root) and referenced by plain `<img src="/brand/...">` tags — no image-handling library needed.

**Tech Stack:** Vite 5 + React 19 + CSS Modules (existing). Poppins loaded via a Google Fonts `<link>` in `index.html` — no new npm package.

## Global Constraints

- No new npm dependencies (spec non-goal).
- No gradient or Poppins body text on data screens (Dashboard, Drivers, tables) — brand font and gradient are restricted to the exact elements named in each task below.
- Every `var(--r)` consumer must end up on one of `--r-sm` / `--r-md` / `--r-lg` / `--r-pill` — the bare `--r` token is deleted once migration is complete (Task 10), and after that no file may reference `var(--r)`.
- Existing admin tests (`apps/admin/tests/rbac.test.ts`, `apps/admin/tests/services.test.ts`) are logic-only and must keep passing unmodified — this plan makes no changes to `.ts` logic files, only `.tsx` markup, `.module.css`, `tokens.css`, `globals.css`, and `index.html`.
- Verify with `npm run build` (run from `apps/admin`) after every task — Vite/esbuild will fail the build on a malformed CSS Module import or broken JSX, which is the fastest signal something's wrong.

---

## Task 1: Design tokens — radius scale, shadows, gradient, brand font

**Files:**
- Modify: `apps/admin/src/styles/tokens.css`
- Modify: `apps/admin/index.html`

**Interfaces:**
- Produces (consumed by every later task): CSS custom properties `--r-sm`, `--r-md`, `--r-lg`, `--r-pill`, `--shadow-card`, `--shadow-button`, `--shadow-sheet`, `--gradient-hero`, `--font-brand`. The existing `--r` token stays in place for now (still consumed by 13 files) and is removed in Task 10 once all of them migrate.

- [ ] **Step 1: Add the new tokens to `tokens.css`**

In `apps/admin/src/styles/tokens.css`, insert the new blocks right after the existing `/* Layout — ported from the wireframe kit exactly */` block (which defines `--r`, `--sidebar-w`, `--topbar-h`) and before the `/* Spacing scale */` block:

```css
  /* Radius scale — mirrors packages/ui/src/theme/radius.ts. --r (above)
     is the old flat wireframe radius; it is removed once every consumer
     below has migrated to one of these tiers (see docs/superpowers/plans
     for the migration task list). */
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 20px;
  --r-pill: 999px;

  /* Elevation — navy-tinted shadows, mirrors packages/ui/src/theme/elevation.ts.
     Shadow color is the brand navy (#002E60) rather than near-black, same
     reasoning as the mobile app: a colored shadow reads as premium and ties
     every raised surface back to the brand mark. */
  --shadow-card: 0 3px 8px rgba(0, 46, 96, 0.10);
  --shadow-button: 0 4px 10px rgba(0, 46, 96, 0.22);
  --shadow-sheet: 0 -6px 24px rgba(0, 46, 96, 0.16);

  /* Hero gradient — Login page background only, mirrors the `hero` token
     in packages/ui/src/theme/gradients.ts. Never used on data screens. */
  --gradient-hero: linear-gradient(180deg, var(--primary) 0%, #001A38 100%);
```

Also update the `--mono`/`--sans` block at the bottom to add `--font-brand`:

```css
  --mono: ui-monospace, Menlo, Consolas, monospace;
  --sans: system-ui, "Segoe UI", Roboto, sans-serif;
  --font-brand: 'Poppins', var(--sans);
```

(This replaces the existing two-line `--mono`/`--sans` block with the same two lines plus the new third line — `--mono` and `--sans` are unchanged.)

- [ ] **Step 2: Load Poppins in `index.html`**

In `apps/admin/index.html`, add these lines inside `<head>`, after the `<meta name="viewport" ...>` line and before `<title>`:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&display=swap"
      rel="stylesheet"
    />
```

Only weights 600/700/800 are loaded — `--font-brand` is only ever applied to semibold/bold/extrabold-weight brand text (Sidebar wordmark, Login heading, TopBar title, StatTile value), never body copy, so 400 isn't needed.

- [ ] **Step 3: Verify the build**

Run: `cd apps/admin && npm run build`
Expected: build succeeds with no errors (the new tokens aren't consumed by anything yet, so this just confirms the CSS/HTML is syntactically valid).

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/styles/tokens.css apps/admin/index.html
git commit -m "admin: add radius/shadow/gradient/brand-font design tokens"
```

---

## Task 2: Logo assets and favicon

**Files:**
- Create: `apps/admin/public/brand/trisakay-mark.png` (copy of `assets/brand/trisakay-mark.png`, 553×661)
- Create: `apps/admin/public/brand/trisakay-lockup.png` (copy of `assets/brand/trisakay-lockup.png`, 3596×2004)
- Create: `apps/admin/public/favicon.png` (copy of `assets/favicon.png`, 512×512)
- Modify: `apps/admin/index.html`

**Interfaces:**
- Produces (consumed by Task 9 Sidebar, Task 11 Login): static files served at `/brand/trisakay-mark.png` and `/brand/trisakay-lockup.png` by Vite's dev server and production build (anything under `apps/admin/public/` is served from the site root, no import needed).

- [ ] **Step 1: Create the directory and copy the three files**

```bash
mkdir -p apps/admin/public/brand
cp assets/brand/trisakay-mark.png apps/admin/public/brand/trisakay-mark.png
cp assets/brand/trisakay-lockup.png apps/admin/public/brand/trisakay-lockup.png
cp assets/favicon.png apps/admin/public/favicon.png
```

- [ ] **Step 2: Link the favicon in `index.html`**

In `apps/admin/index.html`, add this line right after `<meta name="viewport" ...>` (before the Poppins `<link>` tags added in Task 1):

```html
    <link rel="icon" type="image/png" href="/favicon.png" />
```

- [ ] **Step 3: Verify the assets are served**

Run: `cd apps/admin && npm run dev` (in the background, or note the port) and open `http://localhost:5173/brand/trisakay-mark.png` and `http://localhost:5173/brand/trisakay-lockup.png` in a browser — both should render the logo image directly. Check the browser tab on `http://localhost:5173/` shows the TriSakay mark as the favicon instead of the default Vite icon.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/public/brand/trisakay-mark.png apps/admin/public/brand/trisakay-lockup.png apps/admin/public/favicon.png apps/admin/index.html
git commit -m "admin: add TriSakay logo assets and favicon"
```

---

## Task 3: Form control radius — TextField, Textarea, Select, TopBar search

**Files:**
- Modify: `apps/admin/src/components/TextField/TextField.module.css`
- Modify: `apps/admin/src/components/Select/Select.module.css`
- Modify: `apps/admin/src/components/Textarea/Textarea.module.css`
- Modify: `apps/admin/src/components/TopBar/TopBar.module.css`

**Interfaces:**
- Consumes: `--r-sm` from Task 1.

- [ ] **Step 1: TextField**

In `apps/admin/src/components/TextField/TextField.module.css`, in the `.input` rule, change:

```css
  border-radius: var(--r);
```

to:

```css
  border-radius: var(--r-sm);
```

- [ ] **Step 2: Select**

In `apps/admin/src/components/Select/Select.module.css`, in the `.select` rule, change:

```css
  border-radius: var(--r);
```

to:

```css
  border-radius: var(--r-sm);
```

- [ ] **Step 3: Textarea**

In `apps/admin/src/components/Textarea/Textarea.module.css`, in the `.textarea` rule, change:

```css
  border-radius: var(--r);
```

to:

```css
  border-radius: var(--r-sm);
```

- [ ] **Step 4: TopBar search input**

In `apps/admin/src/components/TopBar/TopBar.module.css`, in the `.search` rule, change:

```css
  border-radius: var(--r);
```

to:

```css
  border-radius: var(--r-sm);
```

- [ ] **Step 5: Verify the build**

Run: `cd apps/admin && npm run build`
Expected: succeeds. Then `npm run dev`, open the Login page and any route with a Select/Textarea (e.g. Complaints or DriverVerification), and visually confirm inputs now have an 8px rounded corner instead of the previous sharp 3px.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/components/TextField/TextField.module.css apps/admin/src/components/Select/Select.module.css apps/admin/src/components/Textarea/Textarea.module.css apps/admin/src/components/TopBar/TopBar.module.css
git commit -m "admin: migrate form control radius to --r-sm"
```

---

## Task 4: Button radius and solid-variant shadow

**Files:**
- Modify: `apps/admin/src/components/Button/Button.module.css`

**Interfaces:**
- Consumes: `--r-md`, `--shadow-button` from Task 1. Consumes existing `Button.tsx` class composition (`styles.base styles[variant] styles[tone] styles[size] ...` — confirmed the `variant` class, e.g. `solid`, is always present standalone, so a bare `.solid { ... }` rule applies regardless of `tone`).

- [ ] **Step 1: Migrate `.base` radius**

In `apps/admin/src/components/Button/Button.module.css`, in the `.base` rule, change:

```css
  border-radius: var(--r);
```

to:

```css
  border-radius: var(--r-md);
```

- [ ] **Step 2: Add the solid-variant shadow**

Add a new rule immediately after the `.fullWidth` rule and before the `/* solid */` comment:

```css
.solid {
  box-shadow: var(--shadow-button);
}
```

This applies to every `.solid.primary` / `.solid.neutral` / `.solid.danger` button (any solid button, regardless of tone) but never to `.outline` or `.ghost` buttons, keeping dense toolbars (which lean on outline/ghost buttons) free of shadow clutter.

- [ ] **Step 3: Verify the build**

Run: `cd apps/admin && npm run build`
Expected: succeeds. In the dev server, open the Login page ("Log in" is a solid primary button) and confirm it now has rounded corners and a soft navy shadow beneath it. Open a page with an outline button (e.g. TopBar "Log out") and confirm it has the new rounded corners but no shadow.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/components/Button/Button.module.css
git commit -m "admin: migrate Button to --r-md radius and add solid-variant shadow"
```

---

## Task 5: Card-tier components — StatTile, DataTable, EmptyState, panels, list rows

**Files:**
- Modify: `apps/admin/src/components/StatTile/StatTile.module.css`
- Modify: `apps/admin/src/components/DataTable/DataTable.module.css`
- Modify: `apps/admin/src/components/EmptyState/EmptyState.module.css`
- Modify: `apps/admin/src/styles/globals.css`
- Modify: `apps/admin/src/routes/RideMonitoring.module.css`
- Modify: `apps/admin/src/routes/DriverVerification.module.css`

**Interfaces:**
- Consumes: `--r-md`, `--shadow-card`, `--font-brand` from Task 1.

- [ ] **Step 1: StatTile — radius, shadow, and brand font on the value**

In `apps/admin/src/components/StatTile/StatTile.module.css`, change the `.tile` rule from:

```css
.tile {
  display: flex;
  flex-direction: column;
  gap: var(--sp-sm);
  padding: var(--sp-lg);
  border: 1px solid var(--line);
  border-radius: var(--r);
  background: var(--panel);
}
```

to:

```css
.tile {
  display: flex;
  flex-direction: column;
  gap: var(--sp-sm);
  padding: var(--sp-lg);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--panel);
  box-shadow: var(--shadow-card);
}
```

And change the `.value` rule from:

```css
.value {
  font-size: 26px;
  font-weight: 700;
  color: var(--ink);
}
```

to:

```css
.value {
  font-family: var(--font-brand);
  font-size: 26px;
  font-weight: 700;
  color: var(--ink);
}
```

- [ ] **Step 2: DataTable container**

In `apps/admin/src/components/DataTable/DataTable.module.css`, change the `.wrap` rule from:

```css
.wrap {
  border: 1px solid var(--line);
  border-radius: var(--r);
  background: var(--panel);
}
```

to:

```css
.wrap {
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--panel);
  box-shadow: var(--shadow-card);
}
```

- [ ] **Step 3: EmptyState — radius only, no shadow**

In `apps/admin/src/components/EmptyState/EmptyState.module.css`, change:

```css
  border-radius: var(--r);
```

to:

```css
  border-radius: var(--r-md);
```

Leave the shadow off here: `EmptyState` renders a dashed border ("nothing to show yet" placeholder), and `packages/ui/src/theme/elevation.ts`'s own rule is that only surfaces meant to read as *raised* get a shadow — a dashed empty-state box is deliberately the opposite of that.

- [ ] **Step 4: Shared `.panel` utility class in globals.css**

In `apps/admin/src/styles/globals.css`, change the `.panel` rule from:

```css
.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: var(--sp-lg);
}
```

to:

```css
.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  padding: var(--sp-lg);
  box-shadow: var(--shadow-card);
}
```

- [ ] **Step 5: RideMonitoring list row — radius only**

In `apps/admin/src/routes/RideMonitoring.module.css`, in the `.row` rule, change:

```css
  border-radius: var(--r);
```

to:

```css
  border-radius: var(--r-md);
```

No shadow: these rows sit inside a `.panel` that already carries `--shadow-card` from Step 4 — stacking a second shadow on every row inside it would be visual noise.

- [ ] **Step 6: DriverVerification case rows — radius only**

In `apps/admin/src/routes/DriverVerification.module.css`, in the shared `.case, .caseActive` rule, change:

```css
  border-radius: var(--r);
```

to:

```css
  border-radius: var(--r-md);
```

Same reasoning as Step 5 — no shadow, these rows already sit inside a panel.

- [ ] **Step 7: Verify the build**

Run: `cd apps/admin && npm run build`
Expected: succeeds. In the dev server, open the Dashboard (StatTile grid + panels), Drivers or Passengers (DataTable), RideMonitoring, and DriverVerification, and confirm all of them show the new 12px rounded corners, and that StatTiles/DataTable/panels show a soft navy shadow while the RideMonitoring/DriverVerification list rows do not.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/components/StatTile/StatTile.module.css apps/admin/src/components/DataTable/DataTable.module.css apps/admin/src/components/EmptyState/EmptyState.module.css apps/admin/src/styles/globals.css apps/admin/src/routes/RideMonitoring.module.css apps/admin/src/routes/DriverVerification.module.css
git commit -m "admin: migrate card-tier components to --r-md, add card shadow, brand font on StatTile value"
```

---

## Task 6: ConfirmModal radius and sheet shadow

**Files:**
- Modify: `apps/admin/src/components/ConfirmModal/ConfirmModal.module.css`

**Interfaces:**
- Consumes: `--r-lg`, `--shadow-sheet` from Task 1.

- [ ] **Step 1: Migrate radius and shadow**

In `apps/admin/src/components/ConfirmModal/ConfirmModal.module.css`, change the `.card` rule from:

```css
.card {
  width: 320px;
  background: var(--panel);
  border-radius: var(--r);
  padding: var(--sp-xl);
  display: flex;
  flex-direction: column;
  gap: var(--sp-md);
  box-shadow: 0 12px 32px rgba(10, 14, 17, 0.28);
}
```

to:

```css
.card {
  width: 320px;
  background: var(--panel);
  border-radius: var(--r-lg);
  padding: var(--sp-xl);
  display: flex;
  flex-direction: column;
  gap: var(--sp-md);
  box-shadow: var(--shadow-sheet);
}
```

- [ ] **Step 2: Verify the build**

Run: `cd apps/admin && npm run build`
Expected: succeeds. In the dev server, trigger the log-out confirm modal (TopBar → "Log out") and confirm the dialog now has a 20px rounded corner and the navy-tinted sheet shadow instead of the previous plain gray shadow.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/ConfirmModal/ConfirmModal.module.css
git commit -m "admin: migrate ConfirmModal to --r-lg radius and sheet shadow"
```

---

## Task 7: Badge pill radius

**Files:**
- Modify: `apps/admin/src/components/Badge/Badge.module.css`

**Interfaces:**
- Consumes: `--r-pill` from Task 1.

- [ ] **Step 1: Replace the hardcoded radius**

In `apps/admin/src/components/Badge/Badge.module.css`, in the `.badge` rule, change:

```css
  border-radius: 10px;
```

to:

```css
  border-radius: var(--r-pill);
```

- [ ] **Step 2: Verify the build**

Run: `cd apps/admin && npm run build`
Expected: succeeds. In the dev server, open the TopBar (has a "PSO" info badge) and confirm it renders as a fully rounded pill rather than a slightly-rounded rectangle.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/Badge/Badge.module.css
git commit -m "admin: migrate Badge to --r-pill token"
```

---

## Task 8: Sidebar — logo, brand wordmark, rounded nav rows

**Files:**
- Modify: `apps/admin/src/components/Sidebar/Sidebar.tsx`
- Modify: `apps/admin/src/components/Sidebar/Sidebar.module.css`

**Interfaces:**
- Consumes: `/brand/trisakay-mark.png` (Task 2), `--font-brand` (Task 1), `--r-sm` (Task 1).

- [ ] **Step 1: Update the brand row markup**

In `apps/admin/src/components/Sidebar/Sidebar.tsx`, change:

```tsx
      <div className={styles.brand}>TriSakay Admin</div>
```

to:

```tsx
      <div className={styles.brand}>
        <img src="/brand/trisakay-mark.png" alt="" className={styles.brandMark} />
        <span className={styles.brandWordmark}>TriSakay Admin</span>
      </div>
```

(`alt=""` because the row already has visible adjacent text "TriSakay Admin" — the mark is decorative here, not the only label.)

- [ ] **Step 2: Restyle the brand row**

In `apps/admin/src/components/Sidebar/Sidebar.module.css`, change the `.brand` rule from:

```css
.brand {
  padding: var(--sp-lg) var(--sp-md);
  font-weight: 700;
  font-size: 13px;
  color: var(--primary);
  border-bottom: 1px solid var(--line);
}
```

to:

```css
.brand {
  display: flex;
  align-items: center;
  gap: var(--sp-sm);
  padding: var(--sp-lg) var(--sp-md);
  border-bottom: 1px solid var(--line);
}

.brandMark {
  width: 24px;
  height: 29px;
  flex-shrink: 0;
}

.brandWordmark {
  font-family: var(--font-brand);
  font-weight: 600;
  font-size: 13px;
  color: var(--primary);
}
```

(`trisakay-mark.png` is 553×661px, a 0.836 aspect ratio — 24×29 preserves it closely enough that the browser's implicit scaling introduces no visible distortion.)

- [ ] **Step 3: Round the nav row corners**

In the same file, find the shared `.link, .active` rule:

```css
.link,
.active {
  display: block;
  padding: var(--sp-sm) var(--sp-md);
  font-size: 12px;
  text-decoration: none;
  color: var(--ink-soft);
  border-left: 3px solid transparent;
}
```

Change it to:

```css
.link,
.active {
  display: block;
  padding: var(--sp-sm) var(--sp-md);
  font-size: 12px;
  text-decoration: none;
  color: var(--ink-soft);
  border-left: 3px solid transparent;
  border-radius: 0 var(--r-sm) var(--r-sm) 0;
}
```

Only the right-hand corners round — the left edge stays square so it doesn't clip the `border-left` active-state accent bar.

- [ ] **Step 4: Verify the build**

Run: `cd apps/admin && npm run build`
Expected: succeeds. In the dev server, confirm the Sidebar shows the TriSakay mark next to "TriSakay Admin" in the Poppins semibold face, and that hovering/activating a nav item shows a subtle rounded corner on the right side of the row instead of a sharp edge.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/components/Sidebar/Sidebar.tsx apps/admin/src/components/Sidebar/Sidebar.module.css
git commit -m "admin: add logo and brand font to Sidebar, round nav row corners"
```

---

## Task 9: TopBar page title brand font

**Files:**
- Modify: `apps/admin/src/components/TopBar/TopBar.module.css`

**Interfaces:**
- Consumes: `--font-brand` from Task 1.

- [ ] **Step 1: Apply the brand font to the title**

In `apps/admin/src/components/TopBar/TopBar.module.css`, change the `.title` rule from:

```css
.title {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
}
```

to:

```css
.title {
  font-family: var(--font-brand);
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
}
```

- [ ] **Step 2: Verify the build**

Run: `cd apps/admin && npm run build`
Expected: succeeds. In the dev server, confirm every route's page title in the TopBar (e.g. "Dashboard", "Driver Management") now renders in Poppins bold instead of system-ui.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/TopBar/TopBar.module.css
git commit -m "admin: apply brand font to TopBar page title"
```

---

## Task 10: Remove the legacy flat radius token

**Files:**
- Modify: `apps/admin/src/styles/tokens.css`

**Interfaces:**
- Consumes: confirms Tasks 3–9 fully migrated every `var(--r)` consumer.

- [ ] **Step 1: Confirm no file still references the bare `--r` token**

Run: `grep -rn "var(--r)" apps/admin/src`
Expected: no output (empty). If anything is still listed, migrate that file to the correct tier (`--r-sm`/`--r-md`/`--r-lg`/`--r-pill`) per the mapping in Tasks 3–9 before continuing.

- [ ] **Step 2: Delete the `--r` declaration**

In `apps/admin/src/styles/tokens.css`, in the `/* Layout — ported from the wireframe kit exactly */` block, remove the line:

```css
  --r: 3px;
```

(`--sidebar-w` and `--topbar-h` in the same block are untouched.)

- [ ] **Step 3: Verify the build**

Run: `cd apps/admin && npm run build`
Expected: succeeds — if it fails with an "undefined custom property" style error or visibly square corners reappear anywhere, Step 1's grep missed a consumer; find it with the same grep command and migrate it.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/styles/tokens.css
git commit -m "admin: remove legacy flat --r radius token"
```

---

## Task 11: Login screen — gradient background, logo badge, card restructure

**Files:**
- Modify: `apps/admin/src/routes/Login.tsx`
- Modify: `apps/admin/src/routes/Login.module.css`

**Interfaces:**
- Consumes: `/brand/trisakay-lockup.png` (Task 2), `--gradient-hero`, `--r-lg`, `--shadow-card`, `--r-sm`, `--font-brand` (Task 1).

- [ ] **Step 1: Restructure the Login markup**

Replace the full contents of `apps/admin/src/routes/Login.tsx` with:

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { useSessionStore } from '../store/useSessionStore';
import styles from './Login.module.css';

/**
 * Wireframe screen 1 "Admin log in" — centered card, EMAIL/PASSWORD, Log in.
 * Frontend-only this pass: useSessionStore.signIn() accepts any non-empty
 * credentials and signs in as the PSO Supervisor persona. Real Supabase
 * Auth + users.role lookup is docs/ADMIN_TODO.MD F1.
 */
export function Login() {
  const navigate = useNavigate();
  const signIn = useSessionStore((state) => state.signIn);
  const error = useSessionStore((state) => state.error);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await signIn(email, password);
    setSubmitting(false);
    if (useSessionStore.getState().isAuthenticated) {
      navigate('/', { replace: true });
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.badge}>
        <img src="/brand/trisakay-lockup.png" alt="TriSakay" className={styles.logo} />
      </div>

      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.brandRow}>
          <div className={styles.brandTitle}>Log in</div>
          <div className={styles.brandSub}>PSO Staff / Supervisor / Administrator</div>
        </div>

        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <div className={styles.error}>{error}</div>}

        <Button type="submit" fullWidth loading={submitting}>
          Log in
        </Button>
      </form>
    </div>
  );
}
```

The `Avatar` import and the initials-avatar brand row are gone — the logo badge above the card now carries the brand, and the card's own heading text changes from a repeated "TriSakay Admin" to "Log in" (the subtitle line is unchanged).

- [ ] **Step 2: Replace `Login.module.css`**

Replace the full contents of `apps/admin/src/routes/Login.module.css` with:

```css
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--gradient-hero);
  padding: var(--sp-xl);
}

.badge {
  background: var(--white);
  border-radius: var(--r-lg);
  padding: var(--sp-lg) var(--sp-xl);
  box-shadow: var(--shadow-card);
  margin-bottom: var(--sp-xl);
}

.logo {
  display: block;
  width: 180px;
  height: auto;
}

.card {
  width: 340px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  padding: var(--sp-xl);
  display: flex;
  flex-direction: column;
  gap: var(--sp-md);
  box-shadow: var(--shadow-card);
}

.brandRow {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: var(--sp-sm);
}

.brandTitle {
  font-family: var(--font-brand);
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
}

.brandSub {
  font-size: 11px;
  color: var(--ink-soft);
}

.error {
  font-size: 11px;
  color: var(--danger);
  background: var(--danger-soft);
  border: 1px solid var(--danger);
  border-radius: var(--r-sm);
  padding: var(--sp-sm);
}
```

Notable changes from the previous version: `.page` background is now `--gradient-hero` instead of `--bg`, and `flex-direction: column` was added so the badge stacks above the card; `.card` moves to `--r-lg` / `--shadow-card` (replacing the old hardcoded `box-shadow: 0 12px 32px rgba(10, 14, 17, 0.12)`); `.brandRow`/`.brandTitle` no longer lay out an avatar next to text (`align-items: center` / `gap: var(--sp-md)` removed, replaced with a simple stacked column); `.error` moves off the now-deleted `--r` token onto `--r-sm`; and two new rules (`.badge`, `.logo`) support the logo badge above the card.

- [ ] **Step 3: Verify the build**

Run: `cd apps/admin && npm run build`
Expected: succeeds. In the dev server, open `/login` (log out first if already signed in, via TopBar → "Log out") and confirm: the full page background is the navy gradient, the TriSakay lockup logo sits on a white shadowed badge above the card, the card itself no longer shows an avatar circle, and the card heading reads "Log in" above the "PSO Staff / Supervisor / Administrator" subtitle. Submit valid-looking credentials and confirm sign-in still navigates to `/` (the auth logic itself is untouched).

- [ ] **Step 4: Run the full test suite**

Run: `cd apps/admin && npm test`
Expected: both `rbac.test.ts` and `services.test.ts` pass — this task touched no `.ts` logic files, so this is a regression check, not expected to reveal anything new.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/routes/Login.tsx apps/admin/src/routes/Login.module.css
git commit -m "admin: redesign Login screen with gradient hero background and logo badge"
```
