#!/usr/bin/env node
// TEMP (UAT build, 2026-09-28): works around a Windows-only React Native
// Gradle Plugin bug where entry-file/bundle-output paths get relativized
// against the wrong base directory in this npm-workspaces monorepo,
// making Expo CLI's `export:embed` fail to resolve expo-router/entry.js
// (see apps/passenger/android/app/build.gradle `react { }` block).
//
// Instead of invoking Metro at all, this copies the already-correct JS
// bundle + assets (produced by a manual `npx expo export:embed` run from
// apps/passenger, where the same paths resolve fine) from
// .release-bundle-backup/ into wherever Gradle asks for them.
//
// Revert once the upstream RNGP/Expo CLI path bug is fixed: remove this
// file, remove the cliFile/bundleCommand override in build.gradle, and
// remove .release-bundle-backup/.

const fs = require('fs');
const path = require('path');

function argVal(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const backupDir = path.resolve(__dirname, '..', '.release-bundle-backup');

const bundleOutput = argVal('--bundle-output');
const assetsDest = argVal('--assets-dest');
const sourcemapOutput = argVal('--sourcemap-output');

if (!bundleOutput) {
  console.error('fake-metro-bundle: missing --bundle-output');
  process.exit(1);
}

fs.mkdirSync(path.dirname(bundleOutput), { recursive: true });
fs.copyFileSync(path.join(backupDir, 'index.android.bundle'), bundleOutput);
console.log(`fake-metro-bundle: wrote ${bundleOutput}`);

if (sourcemapOutput) {
  const srcMap = path.join(backupDir, 'index.android.bundle.packager.map');
  if (fs.existsSync(srcMap)) {
    fs.mkdirSync(path.dirname(sourcemapOutput), { recursive: true });
    fs.copyFileSync(srcMap, sourcemapOutput);
    console.log(`fake-metro-bundle: wrote ${sourcemapOutput}`);
  }
}

if (assetsDest) {
  copyDir(path.join(backupDir, 'assets'), assetsDest);
  console.log(`fake-metro-bundle: wrote assets to ${assetsDest}`);
}
