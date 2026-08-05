import { create } from 'zustand';
import type { AdminRole, AdminSessionUser } from '../types/role';

/**
 * Frontend-only mock session. Any non-empty Login submission signs in as
 * the PSO Supervisor persona (so S+ controls are visible by default); the
 * TopBar's dev-only role switcher (setRole) lets pso_staff / admin be
 * demonstrated without a second login. Wiring real Supabase Auth +
 * users.role, and deleting the role switcher, is docs/ADMIN_TODO.MD F1.
 */
const MOCK_USERS: Record<AdminRole, AdminSessionUser> = {
  pso_staff: {
    id: 'pso-002',
    fullName: 'Michael Torreon',
    email: 'm.torreon@pso.gensantos.gov.ph',
    role: 'pso_staff',
  },
  pso_supervisor: {
    id: 'pso-001',
    fullName: 'Engr. Wilhelmina Nazareno',
    email: 'w.nazareno@pso.gensantos.gov.ph',
    role: 'pso_supervisor',
  },
  admin: {
    id: 'pso-004',
    fullName: 'Rodel Fernandez',
    email: 'r.fernandez@pso.gensantos.gov.ph',
    role: 'admin',
  },
};

interface SessionState {
  user: AdminSessionUser | null;
  isAuthenticated: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  setRole: (role: AdminRole) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  user: null,
  isAuthenticated: false,
  error: null,

  signIn: async (email, password) => {
    if (!email.trim() || !password.trim()) {
      set({ error: 'Email and password are required.' });
      return;
    }
    set({ user: MOCK_USERS.pso_supervisor, isAuthenticated: true, error: null });
  },

  signOut: () => set({ user: null, isAuthenticated: false }),

  setRole: (role) => set({ user: MOCK_USERS[role] }),
}));
