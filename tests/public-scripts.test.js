const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const INDEX_PATH = path.join(PUBLIC_DIR, 'index.html');
const PACKAGE_PATH = path.join(ROOT, 'package.json');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function fail(message) {
  console.error(`Public script order guard failed: ${message}`);
  process.exit(1);
}

function scriptSources(html) {
  return [...html.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi)]
    .map((match) => match[1])
    .filter((src) => src.startsWith('/'));
}

function checkedPublicScripts(packageJson) {
  const script = packageJson.scripts?.['test:public'] || '';
  return [...script.matchAll(/node --check\s+(public\/[^\s]+)/g)].map((match) => `/${match[1].replace(/^public\//, '')}`);
}

function assertExists(src) {
  const filePath = path.join(PUBLIC_DIR, src.replace(/^\//, ''));
  if (!fs.existsSync(filePath)) fail(`${src} is referenced in index.html but file does not exist.`);
}

function assertIncludes(list, item, context) {
  if (!list.includes(item)) fail(`${context} is missing ${item}.`);
}

function assertOrder(list, before, after) {
  const beforeIndex = list.indexOf(before);
  const afterIndex = list.indexOf(after);
  if (beforeIndex === -1 || afterIndex === -1) fail(`Cannot check order: ${before} or ${after} is missing.`);
  if (beforeIndex >= afterIndex) fail(`${before} must be loaded before ${after}.`);
}

const html = read(INDEX_PATH);
const packageJson = JSON.parse(read(PACKAGE_PATH));
const indexScripts = scriptSources(html);
const checkedScripts = checkedPublicScripts(packageJson);

if (!indexScripts.length) fail('No public scripts found in index.html.');

indexScripts.forEach(assertExists);
checkedScripts.forEach((src) => assertIncludes(indexScripts, src, 'index.html'));
indexScripts
  .filter((src) => src.startsWith('/app-v2-'))
  .forEach((src) => assertIncludes(checkedScripts, src, 'package.json test:public'));

assertOrder(indexScripts, '/app-v2-request-id-bridge.js', '/app-v2-core.js');
assertOrder(indexScripts, '/app-v2-request-id-bridge.js', '/app-v2-spec-extractor-parser.js');
assertOrder(indexScripts, '/app-v2-spec-extractor-parser.js', '/app-v2-core.js');
assertOrder(indexScripts, '/app-v2-core.js', '/app-v2-service-status.js');
assertOrder(indexScripts, '/app-v2-core.js', '/app-v2-case-reset.js');
assertOrder(indexScripts, '/app-v2-location.js', '/app-v2-molit-trades.js');
assertOrder(indexScripts, '/app-v2-molit-trades.js', '/app-v2-final-judgment.js');
assertOrder(indexScripts, '/app-v2-final-judgment.js', '/app-v2-confidence.js');
assertOrder(indexScripts, '/app-v2-confidence.js', '/app-v2-case-sync-status.js');
assertOrder(indexScripts, '/app-v2-final-judgment.js', '/app-v2-final-copy-bridge.js');
assertOrder(indexScripts, '/app-v2-map-provider-guard.js', '/app-v2-result-order.js');

console.log(`Public script order guard passed. Checked ${indexScripts.length} scripts.`);
