#!/usr/bin/env node
/**
 * Bump version across all packages in the monorepo.
 * Usage: node scripts/bump-version.cjs 1.0.0
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const packages = [
  'packages/api-client/package.json',
  'packages/config/package.json',
  'packages/eslint/package.json',
  'packages/tailwind/package.json',
  'packages/tamagui/package.json',
  'packages/ui-radix/package.json',
  'packages/ui/package.json',
];

const cargoToml = 'rust/Cargo.toml';
const apiClientConfig = 'packages/api-client/src/config.ts';

function updatePackageJson(filePath, version) {
  const fullPath = path.join(ROOT, filePath);
  const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Updated ${filePath} -> ${version}`);
}

function updateCargoToml(filePath, version) {
  const fullPath = path.join(ROOT, filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  content = content.replace(/^version = "[\d.]+"$/m, `version = "${version}"`);
  fs.writeFileSync(fullPath, content);
  console.log(`Updated ${filePath} -> ${version}`);
}

function updateApiClientConfig(filePath, version) {
  const fullPath = path.join(ROOT, filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  content = content.replace(/^export const APP_VERSION = "[\d.]+";$/m, `export const APP_VERSION = "${version}";`);
  fs.writeFileSync(fullPath, content);
  console.log(`Updated ${filePath} -> ${version}`);
}

const version = process.argv[2];

if (!version) {
  console.error('Usage: node scripts/bump-version.cjs <version>');
  console.error('Example: node scripts/bump-version.cjs 1.0.0');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Version must be in semver format: X.Y.Z');
  process.exit(1);
}

console.log(`Bumping version to ${version}\n`);

// Update packages
for (const pkg of packages) {
  updatePackageJson(pkg, version);
}

// Update Cargo.toml
updateCargoToml(cargoToml, version);

// Update api-client config.ts
updateApiClientConfig(apiClientConfig, version);

console.log('\nDone. Remember to commit and tag your release.');
