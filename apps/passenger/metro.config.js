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
  '@trisakay/shared': path.resolve(workspaceRoot, 'packages/shared/src'),
  '@trisakay/ui': path.resolve(workspaceRoot, 'packages/ui/src'),
  '@trisakay/utils': path.resolve(workspaceRoot, 'packages/utils/src'),
};

module.exports = config;
