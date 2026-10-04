import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ADAPTIVE_LABEL_PROPS } from '../src/theme/adaptiveLabel.ts';

const repoRoot = resolve(import.meta.dirname, '..', '..', '..');

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'android' || name === 'ios' || name === '.expo') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, found);
    else if (path.endsWith('.tsx')) found.push(path);
  }
  return found;
}

test('adaptive label wraps to two lines before it shrinks, and only shrinks a little', () => {
  assert.ok(ADAPTIVE_LABEL_PROPS.numberOfLines >= 2);
  assert.ok(ADAPTIVE_LABEL_PROPS.minimumFontScale >= 0.9);
  assert.equal(ADAPTIVE_LABEL_PROPS.adjustsFontSizeToFit, true);
});

test('no button, link or chip label shrinks below 85 percent of its size', () => {
  const offenders: string[] = [];
  const roots = [join(repoRoot, 'apps', 'driver'), join(repoRoot, 'apps', 'passenger'), join(repoRoot, 'packages', 'ui', 'src')];
  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      // The connection banner is a one line status strip, not a button.
      if (file.endsWith('ConnectionBanner.tsx')) continue;
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/minimumFontScale=\{([0-9.]+)\}/g)) {
        if (Number(match[1]) < 0.85) offenders.push(`${file}: ${match[0]}`);
      }
      // adjustsFontSizeToFit with no minimumFontScale shrinks all the way down on iOS.
      for (const match of text.matchAll(/<Text\b[^>]*adjustsFontSizeToFit[^>]*>/g)) {
        if (!match[0].includes('minimumFontScale') && !match[0].includes('ADAPTIVE_LABEL_PROPS')) offenders.push(`${file}: adjustsFontSizeToFit without a floor`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});
