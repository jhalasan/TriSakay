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
    firstName: profile.first_name,
    lastName: profile.last_name,
    fullName: profile.full_name!,
    email: profile.email,
    role: profile.role,
    avatarUrl: profile.avatar_url ?? undefined,
    mustChangePassword: profile.must_change_password,
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
  /** Sets the new password on the current session, then clears must_change_password so RequireForcedPasswordChange lets the user through. */
  completePasswordChange: (newPassword: string) => Promise<string | null>;
  /**
   * Voluntary password change from the ProfileMenu — unlike
   * completePasswordChange (used only right after a fresh sign-in, on the
   * forced first-login screen), this can be invoked from an
   * already-long-open session, so it re-verifies the CURRENT password
   * first (P1-10, 2026-09-15 launch audit) before calling through to the
   * same update.
   */
  changeOwnPassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
  /** Forgot-password completion: exchanges the emailed 6-digit code for a session, sets the new password, then signs the user straight in. */
  confirmPasswordReset: (email: string, token: string, newPassword: string) => Promise<string | null>;
  /** Renames the signed-in user's own account, from the ProfileMenu. */
  updateName: (firstName: string, lastName: string) => Promise<string | null>;
}

export const useSessionStore = create<SessionState>()((set, get) => {
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
    if (!user) {
      // Mirrors signIn()'s handling of the same "no usable profile" case
      // (fetch failed, or the account isn't an admin-portal role) — without
      // this, a session that hydration rejects stays alive in Supabase's own
      // storage even though the UI has already moved on to showing signed-out.
      await authService.signOut().catch(() => {});
      if (claimed !== epoch) return;
      set({ user: null, isAuthenticated: false, isHydrating: false });
      return;
    }

    set({ user, isAuthenticated: true, isHydrating: false });
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

    completePasswordChange: async (newPassword) => {
      const { error: updateError } = await authService.updatePassword(newPassword);
      if (updateError) return updateError;

      const { error: clearError } = await authService.clearMustChangePassword();
      if (clearError) return clearError;

      const current = get().user;
      if (current) set({ user: { ...current, mustChangePassword: false } });
      return null;
    },

    changeOwnPassword: async (currentPassword, newPassword) => {
      const current = get().user;
      if (!current) return 'Not signed in.';

      const { error: verifyError } = await authService.verifyCurrentPassword(current.email, currentPassword);
      if (verifyError) return verifyError;

      const { error: updateError } = await authService.updatePassword(newPassword);
      if (updateError) return updateError;

      return null;
    },

    confirmPasswordReset: async (email, token, newPassword) => {
      set({ error: null });
      signingIn = true;

      try {
        const { error: verifyError } = await authService.verifyPasswordReset({ email, token });
        if (verifyError) {
          set({ error: verifyError });
          return verifyError;
        }

        const { error: updateError } = await authService.updatePassword(newPassword);
        if (updateError) {
          set({ error: updateError });
          return updateError;
        }

        const profile = await authService.getCurrentUserProfile().catch(() => null);
        const user = profile ? toSessionUser(profile) : null;
        if (!user) {
          await authService.signOut();
          const message = 'This account is not authorized for the admin portal.';
          set({ user: null, isAuthenticated: false, error: message });
          return message;
        }

        set({ user, isAuthenticated: true, error: null });
        return null;
      } finally {
        signingIn = false;
      }
    },

    updateName: async (firstName, lastName) => {
      const trimmedFirst = firstName.trim();
      const trimmedLast = lastName.trim();
      if (!trimmedFirst) return 'First name is required.';
      if (!trimmedLast) return 'Last name is required.';

      const { error } = await authService.updateProfile({ firstName: trimmedFirst, lastName: trimmedLast });
      if (error) return error;

      const current = get().user;
      if (current) {
        set({
          user: { ...current, firstName: trimmedFirst, lastName: trimmedLast, fullName: `${trimmedFirst} ${trimmedLast}`.trim() },
        });
      }
      return null;
    },
  };
});
