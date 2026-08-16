import test from 'node:test';
import assert from 'node:assert/strict';

function makeMemoryStorage() {
  const mem = new Map<string, string>();
  return {
    getItem: (name: string) => (mem.has(name) ? (mem.get(name) as string) : null),
    setItem: (name: string, value: string) => {
      mem.set(name, value);
    },
    removeItem: (name: string) => {
      mem.delete(name);
    },
    __mem: mem,
  };
}

test('togglePushNotifications flips the flag', async () => {
  const { __setSettingsStorageForTests } = await import('../src/store/settingsStorage.ts');
  __setSettingsStorageForTests(makeMemoryStorage());
  const { useSettingsStore } = await import('../src/store/useSettingsStore.ts');

  const before = useSettingsStore.getState().pushNotificationsEnabled;
  useSettingsStore.getState().togglePushNotifications();
  assert.equal(useSettingsStore.getState().pushNotificationsEnabled, !before);
});

test('setLanguage updates language to the given code', async () => {
  const { __setSettingsStorageForTests } = await import('../src/store/settingsStorage.ts');
  __setSettingsStorageForTests(makeMemoryStorage());
  const { useSettingsStore } = await import('../src/store/useSettingsStore.ts');

  useSettingsStore.getState().setLanguage('fil');
  assert.equal(useSettingsStore.getState().language, 'fil');
  useSettingsStore.getState().setLanguage('en');
  assert.equal(useSettingsStore.getState().language, 'en');
});

test('toggling a setting persists the whole state (minus actions) to the injected storage', async () => {
  const { __setSettingsStorageForTests } = await import('../src/store/settingsStorage.ts');
  const storage = makeMemoryStorage();
  __setSettingsStorageForTests(storage);
  const { useSettingsStore } = await import('../src/store/useSettingsStore.ts');

  useSettingsStore.getState().toggleSmsReceipts();
  // persist() writes asynchronously — flush microtasks.
  await Promise.resolve();
  await Promise.resolve();

  const raw = storage.__mem.get('trisakay-passenger-settings');
  assert.ok(raw, 'expected the store to have written to storage');
  const parsed = JSON.parse(raw as string);
  assert.equal(typeof parsed.state.smsReceipts, 'boolean');
  assert.equal(parsed.state.togglePushNotifications, undefined, 'actions must not be persisted');
});
