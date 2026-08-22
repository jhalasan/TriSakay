import '../lib/supabase.ts';
import { create } from 'zustand';
import * as authService from '@trisakay/services';
import type { PublicUser } from '@trisakay/services';
import type { User } from '../types/user';
import { REQUEST_TIMEOUT_MS, withTimeout } from '../utils/withTimeout.ts';

type AuthSession = Awaited<ReturnType<typeof authService.getSession>>;

function toAppUser(profile: PublicUser): User {
  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    phone: profile.contact_no ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    accountStatus: profile.status,
  };
}

interface AuthState {
  user: User | null;
  sessionUserId: string | null;
  isAuthenticated: boolean;
  isHydrating: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    phone: string,
    password: string
  ) => Promise<{ outcome: 'signed_in' | 'check_email' | 'error'; userId: string | null }>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => {
  let authEpoch = 0;

  function applyAuthEvent(session: AuthSession): void {
    const epoch = ++authEpoch;

    if (!session) {
      set({ user: null, sessionUserId: null, isAuthenticated: false, isHydrating: false });
      return;
    }

    set({ sessionUserId: session.user.id });

    withTimeout(authService.getCurrentUserProfile(), REQUEST_TIMEOUT_MS, 'Profile fetch timed out')
      .catch(() => null)
      .then((profile) => {
        if (epoch !== authEpoch) return;
        set({ user: profile ? toAppUser(profile) : null, isAuthenticated: true, isHydrating: false });
      });
  }

  authService.onAuthStateChange(applyAuthEvent);

  authService
    .getSession()
    .catch(() => null)
    .then(applyAuthEvent);

  return {
    user: null,
    sessionUserId: null,
    isAuthenticated: false,
    isHydrating: true,
    error: null,

    login: async (email, password) => {
      set({ error: null });
      const { error } = await authService.signIn({ email, password });
      if (error) set({ error });
    },

    register: async (name, email, phone, password) => {
      set({ error: null });
      const { session, error } = await authService.signUp({
        fullName: name,
        email,
        phone,
        password,
        role: 'driver',
      });
      if (error) {
        set({ error });
        return { outcome: 'error', userId: null };
      }
      return session
        ? { outcome: 'signed_in', userId: session.user.id }
        : { outcome: 'check_email', userId: null };
    },

    logout: async () => {
      await authService.signOut();
    },

    clearError: () => set({ error: null }),

    refreshProfile: async () => {
      const profile = await authService.getCurrentUserProfile().catch(() => null);
      if (profile) set({ user: toAppUser(profile) });
    },
  };
});
