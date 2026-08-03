const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const workspaceRoot = path.resolve(__dirname, '../..');

config.watchFolders = [...new Set([...(config.watchFolders ?? []), workspaceRoot])];

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

module.exports = config;
