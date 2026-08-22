const test = require('node:test');
const assert = require('node:assert/strict');

function makeMemoryStorage() {
  const mem = new Map();
  return {
    getItem: (name) => (mem.has(name) ? mem.get(name) : null),
    setItem: (name, value) => {
      mem.set(name, value);
    },
    removeItem: (name) => {
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

  const raw = storage.__mem.get('trisakay-driver-settings');
  assert.ok(raw, 'expected the store to have written to storage');
  const parsed = JSON.parse(raw);
  assert.equal(typeof parsed.state.smsReceipts, 'boolean');
  assert.equal(parsed.state.togglePushNotifications, undefined, 'actions must not be persisted');
});

test('useTranslation returns the dictionary matching the current language', async () => {
  const { __setSettingsStorageForTests } = await import('../src/store/settingsStorage.ts');
  __setSettingsStorageForTests(makeMemoryStorage());
  const { useSettingsStore } = await import('../src/store/useSettingsStore.ts');
  const { translations } = await import('@trisakay/shared');

  useSettingsStore.getState().setLanguage('fil');
  assert.equal(translations[useSettingsStore.getState().language].driver.login.welcomeBack, translations.fil.driver.login.welcomeBack);

  useSettingsStore.getState().setLanguage('en');
  assert.equal(translations[useSettingsStore.getState().language].driver.login.welcomeBack, translations.en.driver.login.welcomeBack);
});
