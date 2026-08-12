// Project-level React Native CLI config.
//
// In this pnpm monorepo, expo's own `react-native.config.js` disables its
// Android package override because `expo-modules-autolinking`'s
// `findProjectRootSync()` cannot locate `apps/vyzorMobile/android/settings.gradle`
// from the pnpm virtual store. When that override is missing, the autolinking
// resolver derives the import path from the Android `namespace` (`expo.core`)
// instead of the class's real package, producing the invalid
// `import expo.core.ExpoModulesPackage;` in the generated `PackageList.java`.
//
// Pinning the override here ensures the generated import is
// `import expo.modules.ExpoModulesPackage;` (the class's actual package).
module.exports = {
  dependencies: {
    expo: {
      platforms: {
        android: {
          packageImportPath: 'import expo.modules.ExpoModulesPackage;',
          packageInstance: 'new ExpoModulesPackage()',
        },
      },
    },
  },
};
