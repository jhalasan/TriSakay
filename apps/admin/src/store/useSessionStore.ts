import { create } from 'zustand';
import * as authService from '@trisakay/services';
import type { PublicUser } from '@trisakay/services';
import type { AdminRole, AdminSessionUser } from '../types/role';

// Unlike the driver/passenger apps' equivalent stores, this file deliberately
// does NOT `import '../lib/supabase'` for its init side effect — that file
// reads Vite-only `import.meta.env`, which doesn't exist under plain Node
// (this store's own tests run via `node --test`, not Vite). `main.tsx`
// performs the real initSupabase() call before the app renders instead;
// tests substitute a fake client via __setSupabaseClientForTests() before
// ever importing this module.

const ADMIN_ROLES: readonly AdminRole[] = ['pso_staff', 'pso_supervisor', 'admin'];

function isAdminRole(role: string): role is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

/** Passenger/driver accounts have no place in this portal — not an error, just not a match. */
function toSessionUser(profile: PublicUser): AdminSessionUser | null {
  if (!isAdminRole(profile.role)) return null;
  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role,
    avatarUrl: profile.avatar_url ?? undefined,
  };
}

interface SessionState {
  user: AdminSessionUser | null;
  isAuthenticated: boolean;
  /** True until the initial session check (page load / refresh) resolves — RequireAuth must not redirect while this is true. */
  isHydrating: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

export const useSessionStore = create<SessionState>()((set) => {
  let epoch = 0;
  // While signIn() owns an in-flight attempt, the onAuthStateChange listener
  // below must not also react to the SIGNED_IN event it triggers — both would
  // independently re-fetch the profile and set() the result, and whichever
  // resolves last wins. A transient failure in the redundant listener-side
  // fetch could then silently clobber a signIn() that had already succeeded.
  let signingIn = false;

  async function hydrateFromSession(hasSession: boolean) {
    if (signingIn) return;
    const claimed = ++epoch;
    if (!hasSession) {
      set({ user: null, isAuthenticated: false, isHydrating: false });
      return;
    }

    const profile = await authService.getCurrentUserProfile().catch(() => null);
    if (claimed !== epoch) return;

    const user = profile ? toSessionUser(profile) : null;
    set({ user, isAuthenticated: user !== null, isHydrating: false });
  }

  // supabase-js fires an INITIAL_SESSION event on subscribe, so this alone
  // covers page-load hydration — a separate explicit getSession() call here
  // would just be a second, redundant profile fetch for the same session.
  authService.onAuthStateChange((session) => {
    void hydrateFromSession(session !== null);
  });

  return {
    user: null,
    isAuthenticated: false,
    isHydrating: true,
    error: null,

    signIn: async (email, password) => {
      if (!email.trim() || !password.trim()) {
        set({ error: 'Email and password are required.' });
        return false;
      }

      set({ error: null });
      signingIn = true;

      try {
        const { error } = await authService.signIn({ email, password });
        if (error) {
          set({ error });
          return false;
        }

        const profile = await authService.getCurrentUserProfile().catch(() => null);
        const user = profile ? toSessionUser(profile) : null;
        if (!user) {
          await authService.signOut();
          set({ user: null, isAuthenticated: false, error: 'This account is not authorized for the admin portal.' });
          return false;
        }

        set({ user, isAuthenticated: true, error: null });
        return true;
      } finally {
        signingIn = false;
      }
    },

    signOut: async () => {
      await authService.signOut();
      set({ user: null, isAuthenticated: false });
    },
  };
});
