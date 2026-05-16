const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));

const EXPECTED_DEPENDENCIES = {
  express: '^4.19.2',
  cors: '^2.8.5',
};

function fail(message) {
  console.error(`Dependency guard failed: ${message}`);
  process.exit(1);
}

function sortedKeys(value) {
  return Object.keys(value || {}).sort();
}

const actualDependencyNames = sortedKeys(packageJson.dependencies);
const expectedDependencyNames = sortedKeys(EXPECTED_DEPENDENCIES);

if (JSON.stringify(actualDependencyNames) !== JSON.stringify(expectedDependencyNames)) {
  fail(`dependencies changed. expected ${expectedDependencyNames.join(', ')}, got ${actualDependencyNames.join(', ') || '(none)'}`);
}

for (const [name, version] of Object.entries(EXPECTED_DEPENDENCIES)) {
  if (packageJson.dependencies[name] !== version) {
    fail(`${name} version changed. expected ${version}, got ${packageJson.dependencies[name] || '(missing)'}`);
  }
}

if (packageJson.devDependencies && Object.keys(packageJson.devDependencies).length) {
  fail(`unexpected devDependencies found: ${Object.keys(packageJson.devDependencies).join(', ')}`);
}

console.log('Dependency guard passed.');
