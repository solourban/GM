const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'src', 'server.js'), 'utf8');

function fail(message) {
  console.error(`API contract hardening guard failed: ${message}`);
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

requireIncludes('function publicDateRecommendationResult', 'public date recommendation sanitizer');
requireIncludes('const { debug, ...publicResult } = result', 'date recommendation debug stripping');
requireIncludes('res.json({ ok: true, result, report: result, requestId: req.requestId })', 'analyze report alias');
requireIncludes("'해당 유형 실거래가 조회 중 오류가 발생했습니다.'", 'safe MOLIT partial failure message');

const dateRoute = sectionBetween("app.get('/api/recommendations/by-date'", 'function xmlText', '/api/recommendations/by-date route');
if (/\{\s*\.\.\.result\s*,\s*requestId/.test(dateRoute)) fail('date recommendation route must not spread raw result with debug.');

const molitRoute = sectionBetween("app.get('/api/molit/trades'", "const ONBID_LIST_BASE_URL", '/api/molit/trades route');
if (/error:\s*e\.message/.test(molitRoute)) fail('MOLIT partial failures must not expose e.message.');

console.log('API contract hardening guard passed.');
