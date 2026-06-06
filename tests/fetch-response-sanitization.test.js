const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'src', 'server.js'), 'utf8');

function fail(message) {
  console.error(`Fetch response sanitization guard failed: ${message}`);
  process.exit(1);
}

function requireIncludes(needle, label) {
  if (!server.includes(needle)) fail(`${label} is missing.`);
}

function sectionBetween(startNeedle, endNeedle, label) {
  const start = server.indexOf(startNeedle);
  if (start === -1) fail(`${label} start marker is missing.`);
  const end = server.indexOf(endNeedle, start + startNeedle.length);
  if (end === -1) fail(`${label} end marker is missing.`);
  return server.slice(start, end);
}

requireIncludes('function sanitizeFetchCaseResult(result)', 'fetch case response sanitizer');
requireIncludes("!['rawApis', 'debug', '_internalCsNo'].includes(key)", 'internal crawler field stripping');
requireIncludes('sanitizeFetchCaseResult(await fetchCase', '/api/fetch sanitizer usage');

const fetchRoute = sectionBetween("app.post('/api/fetch'", "app.post('/api/analyze'", '/api/fetch route');

if (/rawApis/.test(fetchRoute)) fail('/api/fetch route must not return rawApis directly.');
if (/debug/.test(fetchRoute)) fail('/api/fetch route must not return debug directly.');
if (/e\.message\s*\|\|/.test(fetchRoute)) fail('/api/fetch catch must not expose e.message.');
if (!fetchRoute.includes('사건 조회 중 오류가 발생했습니다.')) fail('/api/fetch catch must use a safe generic message.');

console.log('Fetch response sanitization guard passed.');
