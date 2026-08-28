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

  if (specifier === 'react-native-svg') {
    return {
      url: new URL('./react-native-svg-mock.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }

  if (specifier === '@expo/vector-icons') {
    return {
      url: new URL('./expo-vector-icons-mock.mjs', import.meta.url).href,
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

  // Some modules are authored as .tsx (they render JSX) but re-export plain
  // functions that tests want to import directly. Tests reference them with
  // an explicit '.ts' extension (matching the rest of the suite's
  // convention); if the default resolver can't find a literal .ts file,
  // retry against the .tsx sibling before giving up.
  if (specifier.endsWith('.ts')) {
    try {
      return await nextResolve(specifier);
    } catch (e) {
      if (e && e.code === 'ERR_MODULE_NOT_FOUND') {
        return nextResolve(`${specifier}x`);
      }
      throw e;
    }
  }

  // Fall back to default resolver
  return nextResolve(specifier);
}
