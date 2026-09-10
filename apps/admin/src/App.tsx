import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ToastProvider } from './components/Toast';
import { Login } from './routes/Login';
import { Dashboard } from './routes/Dashboard';
import { Drivers } from './routes/Drivers';
import { DriverVerification } from './routes/DriverVerification';
import { Passengers } from './routes/Passengers';
import { RideMonitoring } from './routes/RideMonitoring';
import { Complaints } from './routes/Complaints';
import { Reports } from './routes/Reports';
import { RatingOversight } from './routes/RatingOversight';
import { AuditLog } from './routes/AuditLog';
import { DiscountReview } from './routes/DiscountReview';
import { EmergencyAlerts } from './routes/EmergencyAlerts';
import { PsoUsers } from './routes/PsoUsers';
import { Barangays } from './routes/Barangays';
import { SystemSettings } from './routes/SystemSettings';
import { ForcePasswordChange } from './routes/ForcePasswordChange';
import { useSessionStore } from './store/useSessionStore';
import { isAdmin } from './lib/rbac';

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
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
