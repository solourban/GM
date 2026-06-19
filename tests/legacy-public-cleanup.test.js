const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const INDEX_PATH = path.join(PUBLIC_DIR, 'index.html');
const LEGACY_DIR = path.join(ROOT, 'legacy', 'public-js');

function fail(message) {
  console.error(`Legacy public cleanup guard failed: ${message}`);
  process.exit(1);
}

function scriptSources(html) {
  return [...html.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi)]
    .map((match) => path.basename(match[1].split('?')[0]))
    .filter(Boolean);
}

const indexScripts = new Set(scriptSources(fs.readFileSync(INDEX_PATH, 'utf8')));
const publicJs = fs.readdirSync(PUBLIC_DIR).filter((name) => name.endsWith('.js')).sort();
const unreferencedPublicJs = publicJs.filter((name) => !indexScripts.has(name));

if (unreferencedPublicJs.length) {
  fail(`public/ contains JS files not loaded by index.html: ${unreferencedPublicJs.join(', ')}`);
}

if (!fs.existsSync(LEGACY_DIR)) fail('legacy/public-js archive directory is missing.');

const archivedJs = fs.readdirSync(LEGACY_DIR).filter((name) => name.endsWith('.js')).sort();
if (!archivedJs.length) fail('legacy/public-js archive is empty.');

const archivedPatchFiles = archivedJs.filter((name) => name.endsWith('-patch.js'));
if (!archivedPatchFiles.length) fail('legacy/public-js archive is missing historical patch files.');

console.log(`Legacy public cleanup guard passed. Public JS: ${publicJs.length}, archived legacy JS: ${archivedJs.length}.`);

