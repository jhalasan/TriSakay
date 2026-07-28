import { create } from 'zustand';
import type { User } from '../types/user';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string) => void;
  register: (name: string, email: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  login: (email) =>
    set({
      user: { id: 'u1', name: email.split('@')[0], email },
      isAuthenticated: true,
    }),
  register: (name, email) =>
    set({
      user: { id: 'u1', name, email },
      isAuthenticated: true,
    }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));
