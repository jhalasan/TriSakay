const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const workspaceRoot = path.resolve(__dirname, '../..');

// Extend (never replace) Expo's default watchFolders so the monorepo root
// is watched in addition to expo-doctor's expected defaults.
config.watchFolders = [...new Set([...(config.watchFolders ?? []), workspaceRoot])];

// Local node_modules first so this app's own pinned native-module versions
// (e.g. react, matched to react-native's peer requirement) win over anything
// hoisted to the workspace root at a different version.
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  '@trisakay/services': path.resolve(workspaceRoot, 'packages/services/src'),
  '@trisakay/shared': path.resolve(workspaceRoot, 'packages/shared/src'),
  '@trisakay/ui': path.resolve(workspaceRoot, 'packages/ui/src'),
  '@trisakay/utils': path.resolve(workspaceRoot, 'packages/utils/src'),
};

// zustand/middleware's ESM build (zustand/esm/middleware.mjs, bundled with
// its `devtools` middleware) references `import.meta.env`, which throws
// "Cannot use 'import.meta' outside a module" the instant the web bundle
// runs — Metro serves it as a classic script, not an ES module. The CJS
// build (middleware.js) has no `import.meta` at all. Metro's default
// package-exports resolution prefers the ESM build for the web platform;
// disabling it falls back to `main`, which points at the CJS build.
// Only useSettingsStore.ts (persist/createJSONStorage) imports from
// zustand/middleware, so this is the only reason this app needs it.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
