import test from 'node:test';
import assert from 'node:assert/strict';
import { translations } from '../src/i18n/index.ts';

function collectKeyPaths(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    collectKeyPaths(value, prefix ? `${prefix}.${key}` : key),
  );
}

test('en and fil dictionaries have identical key structures', () => {
  const enKeys = collectKeyPaths(translations.en).sort();
  const filKeys = collectKeyPaths(translations.fil).sort();
  assert.deepEqual(filKeys, enKeys);
});

test('every string value is non-empty in both dictionaries', () => {
  for (const lang of ['en', 'fil'] as const) {
    for (const path of collectKeyPaths(translations[lang])) {
      const value = path.split('.').reduce<unknown>((acc, key) => (acc as Record<string, unknown>)[key], translations[lang]);
      assert.equal(typeof value, 'string', `${lang}.${path} should be a string`);
      assert.ok((value as string).length > 0, `${lang}.${path} should not be empty`);
    }
  }
});
