import { create } from 'zustand';
import * as authService from '@trisakay/services';
import type { PublicUser } from '@trisakay/services';
import type { User } from '../types/user';

function toAppUser(profile: PublicUser): User {
  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    phone: profile.contact_no ?? undefined,
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isHydrating: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password: string) => Promise<'signed_in' | 'check_email'>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()((set) => {
  authService.onAuthStateChange((session) => {
    if (!session) {
      set({ user: null, isAuthenticated: false });
      return;
    }
    authService.getCurrentUserProfile().then((profile) => {
      set({ user: profile ? toAppUser(profile) : null, isAuthenticated: true });
    });
  });

  authService.getSession().then((session) => {
    if (!session) {
      set({ isHydrating: false });
      return;
    }
    authService.getCurrentUserProfile().then((profile) => {
      set({ user: profile ? toAppUser(profile) : null, isAuthenticated: true, isHydrating: false });
    });
  });

  return {
    user: null,
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
      const { session, error } = await authService.signUp({ fullName: name, email, phone, password });
      if (error) {
        set({ error });
        return 'check_email';
      }
      return session ? 'signed_in' : 'check_email';
    },

    logout: async () => {
      await authService.signOut();
    },

    clearError: () => set({ error: null }),
  };
});
