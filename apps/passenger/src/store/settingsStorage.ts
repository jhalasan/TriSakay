import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

let backend: StateStorage = AsyncStorage;

/** Indirection so tests can swap the backend before persist() ever touches real AsyncStorage — see settingsStore.test.ts. */
export const settingsStorage: StateStorage = {
  getItem: (name) => backend.getItem(name),
  setItem: (name, value) => backend.setItem(name, value),
  removeItem: (name) => backend.removeItem(name),
};

export function __setSettingsStorageForTests(fake: StateStorage): void {
  backend = fake;
}
