import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve as pathResolve, dirname } from 'node:path';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react-native') {
    return {
      url: new URL('./react-native-mock.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }

  // For relative imports without extension, try with .ts first
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.endsWith('.ts') && !specifier.endsWith('.js') && !specifier.endsWith('.mjs')) {
    try {
      const importerPath = fileURLToPath(context.referrer);
      const importerDir = dirname(importerPath);
      const potentialPath = pathResolve(importerDir, specifier + '.ts');

      if (existsSync(potentialPath)) {
        return {
          url: pathToFileURL(potentialPath).href,
          shortCircuit: true,
        };
      }
    } catch (e) {
      // Fall through to default resolver
    }
  }

  // Fall back to default resolver
  return nextResolve(specifier);
}
