import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ToastProvider } from './components/Toast';
import { useSessionStore } from './store/useSessionStore';
import { isAdmin } from './lib/rbac';

// P2 (2026-09-15 launch audit): the whole app was one 1.38 MB chunk — slow
// first paint on the weak connections this pilot targets. Route-level
// lazy-loading splits each screen into its own chunk, downloaded only when
// navigated to.
const Login = lazy(() => import('./routes/Login').then((m) => ({ default: m.Login })));
const ForgotPassword = lazy(() => import('./routes/ForgotPassword').then((m) => ({ default: m.ForgotPassword })));
const Dashboard = lazy(() => import('./routes/Dashboard').then((m) => ({ default: m.Dashboard })));
const Drivers = lazy(() => import('./routes/Drivers').then((m) => ({ default: m.Drivers })));
const Tricycles = lazy(() => import('./routes/Tricycles').then((m) => ({ default: m.Tricycles })));
const DriverVerification = lazy(() => import('./routes/DriverVerification').then((m) => ({ default: m.DriverVerification })));
const Passengers = lazy(() => import('./routes/Passengers').then((m) => ({ default: m.Passengers })));
const RideMonitoring = lazy(() => import('./routes/RideMonitoring').then((m) => ({ default: m.RideMonitoring })));
const Complaints = lazy(() => import('./routes/Complaints').then((m) => ({ default: m.Complaints })));
const Reports = lazy(() => import('./routes/Reports').then((m) => ({ default: m.Reports })));
const RatingOversight = lazy(() => import('./routes/RatingOversight').then((m) => ({ default: m.RatingOversight })));
const AuditLog = lazy(() => import('./routes/AuditLog').then((m) => ({ default: m.AuditLog })));
const DiscountReview = lazy(() => import('./routes/DiscountReview').then((m) => ({ default: m.DiscountReview })));
const EmergencyAlerts = lazy(() => import('./routes/EmergencyAlerts').then((m) => ({ default: m.EmergencyAlerts })));
const PsoUsers = lazy(() => import('./routes/PsoUsers').then((m) => ({ default: m.PsoUsers })));
const Barangays = lazy(() => import('./routes/Barangays').then((m) => ({ default: m.Barangays })));
const SystemSettings = lazy(() => import('./routes/SystemSettings').then((m) => ({ default: m.SystemSettings })));
const ForcePasswordChange = lazy(() => import('./routes/ForcePasswordChange').then((m) => ({ default: m.ForcePasswordChange })));
const NotFound = lazy(() => import('./routes/NotFound').then((m) => ({ default: m.NotFound })));

/** Real Supabase session check — a page load/refresh must not flash-redirect to /login while the session is still being restored. */
function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const isHydrating = useSessionStore((state) => state.isHydrating);
  if (isHydrating) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** An admin-created account still on its temp password must set its own before reaching any other route. */
function RequirePasswordSet({ children }: { children: ReactNode }) {
  const mustChangePassword = useSessionStore((state) => state.user?.mustChangePassword);
  if (mustChangePassword) return <Navigate to="/force-password-change" replace />;
  return <>{children}</>;
}

/** The mirror image of RequirePasswordSet — once the password is set, this screen has nothing left to do. */
function RequireForcedPasswordChange({ children }: { children: ReactNode }) {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const isHydrating = useSessionStore((state) => state.isHydrating);
  const mustChangePassword = useSessionStore((state) => state.user?.mustChangePassword);
  if (isHydrating) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!mustChangePassword) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Signed-in PSO users hitting /login directly (e.g. a stale bookmark) go straight to the dashboard instead of re-authenticating. */
function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const isHydrating = useSessionStore((state) => state.isHydrating);
  if (isHydrating) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** FR-6.3 / FR-8.1 — PSO User Management and System Settings are Administrator only. */
function RequireAdmin({ children }: { children: ReactNode }) {
  const role = useSessionStore((state) => state.user?.role);
  if (!role || !isAdmin(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="page">Loading…</div>}>
          <Routes>
            <Route
              path="/login"
              element={
                <RedirectIfAuthed>
                  <Login />
                </RedirectIfAuthed>
              }
            />

            <Route
              path="/forgot-password"
              element={
                <RedirectIfAuthed>
                  <ForgotPassword />
                </RedirectIfAuthed>
              }
            />

            <Route
              path="/force-password-change"
              element={
                <RequireForcedPasswordChange>
                  <ForcePasswordChange />
                </RequireForcedPasswordChange>
              }
            />

            <Route
              element={
                <RequireAuth>
                  <RequirePasswordSet>
                    <AppShell />
                  </RequirePasswordSet>
                </RequireAuth>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="drivers" element={<Drivers />} />
              <Route path="tricycles" element={<Tricycles />} />
              <Route path="verification" element={<DriverVerification />} />
              <Route path="passengers" element={<Passengers />} />
              <Route path="monitoring" element={<RideMonitoring />} />
              <Route path="complaints" element={<Complaints />} />
              <Route path="reports" element={<Reports />} />
              <Route path="audit-log" element={<AuditLog />} />
              <Route path="rating-oversight" element={<RatingOversight />} />
              <Route path="discounts" element={<DiscountReview />} />
              <Route path="emergency-alerts" element={<EmergencyAlerts />} />
              <Route
                path="pso-users"
                element={
                  <RequireAdmin>
                    <PsoUsers />
                  </RequireAdmin>
                }
              />
              <Route
                path="barangays"
                element={
                  <RequireAdmin>
                    <Barangays />
                  </RequireAdmin>
                }
              />
              <Route
                path="settings"
                element={
                  <RequireAdmin>
                    <SystemSettings />
                  </RequireAdmin>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}
