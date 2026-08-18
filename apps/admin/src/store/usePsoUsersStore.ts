import { create } from 'zustand';
import { addPsoUser, disablePsoUser, enablePsoUser, listPsoUsers } from '../services/psoUsers';
import type { PsoUserRow } from '../types/psoUser';
import type { AdminRole } from '../types/role';

interface PsoUsersState {
  users: PsoUserRow[];
  loading: boolean;
  error: string | null;
  /** The most recently created account's one-time temp password, shown once by the UI then cleared via clearTempPassword(). */
  createdTempPassword: string | null;
  fetch: () => Promise<void>;
  addUser: (input: { fullName: string; email: string; role: AdminRole }) => Promise<boolean>;
  clearTempPassword: () => void;
  disable: (id: string, reason: string) => Promise<boolean>;
  enable: (id: string, reason: string) => Promise<boolean>;
}

export const usePsoUsersStore = create<PsoUsersState>()((set, get) => ({
  users: [],
  loading: false,
  error: null,
  createdTempPassword: null,

  fetch: async () => {
    set({ loading: true, error: null });
    const { data, error } = await listPsoUsers();
    set({ users: data, loading: false, error });
  },

  addUser: async (input) => {
    const { tempPassword, error } = await addPsoUser(input);
    if (error) {
      set({ error });
      return false;
    }
    set({ createdTempPassword: tempPassword });
    await get().fetch();
    return true;
  },

  clearTempPassword: () => set({ createdTempPassword: null }),

  disable: async (id, reason) => {
    const { error } = await disablePsoUser(id, reason);
    if (error) {
      set({ error });
      return false;
    }
    await get().fetch();
    return true;
  },

  enable: async (id, reason) => {
    const { error } = await enablePsoUser(id, reason);
    if (error) {
      set({ error });
      return false;
    }
    await get().fetch();
    return true;
  },
}));
