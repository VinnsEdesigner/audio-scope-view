const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

let config = getDefaultConfig(projectRoot);

// Force Metro to track all workspace files in the root monorepo directory,
// including the C++ `sdk/` so the Android externalNativeBuild CMake step can
// see native sources through the bundler's file watcher.
config.watchFolders = [workspaceRoot, path.resolve(workspaceRoot, 'sdk')];

// Force module lookup to correctly fall back to root node_modules paths for
// pnpm symlinks.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Block nested symbolic lookups from throwing duplication exceptions.
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, {
  // Reuse the web app's shared Tailwind preset (design tokens) so mobile and
  // web render the same palette. The config path is resolved relative to the
  // workspace root.
  config: path.resolve(workspaceRoot, 'apps/vyzorMobile/tailwind.config.ts'),
});

