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
requireIncludes('function handleDateRecommendations', 'shared date recommendation handler');
requireIncludes("app.get('/api/date/recommendations'", 'date recommendations compatibility route');
requireIncludes("handleDateRecommendations(req, res, 'date/recommendations')", 'compatibility route uses shared handler');
requireIncludes('const { debug, ...publicResult } = result', 'date recommendation debug stripping');
requireIncludes('res.json({ ok: true, result, report: result, requestId: req.requestId })', 'analyze report alias');
requireIncludes('async function handleMolitTrades', 'shared MOLIT trades handler');
requireIncludes("app.get('/api/molit/apt-trades'", 'MOLIT apartment compatibility route');
requireIncludes("handleMolitTrades(req, res, { scope: 'molit/apt-trades', fixedTradeType: 'apt' })", 'MOLIT apartment route fixes trade type');
requireIncludes("'해당 유형 실거래가 조회 중 오류가 발생했습니다.'", 'safe MOLIT partial failure message');
requireIncludes('const MOLIT_FETCH_TIMEOUT_MS', 'MOLIT fetch timeout constant');

const dateRoute = sectionBetween("app.get('/api/recommendations/by-date'", 'function xmlText', '/api/recommendations/by-date route');
if (/\{\s*\.\.\.result\s*,\s*requestId/.test(dateRoute)) fail('date recommendation route must not spread raw result with debug.');

const molitFetch = sectionBetween('async function fetchMolitType', "app.get('/api/molit/trades'", 'MOLIT type fetch helper');
if (!/controller\.abort\(\)/.test(molitFetch)) fail('MOLIT fetch helper must abort slow upstream requests.');
if (!/AbortError/.test(molitFetch)) fail('MOLIT fetch helper must translate AbortError safely.');

const molitHandler = sectionBetween('async function handleMolitTrades', "const ONBID_LIST_BASE_URL", 'MOLIT shared route handler');
if (/error:\s*e\.message/.test(molitHandler)) fail('MOLIT partial failures must not expose e.message.');

console.log('API contract hardening guard passed.');
