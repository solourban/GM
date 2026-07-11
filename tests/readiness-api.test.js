const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'src', 'server.js'), 'utf8');

function fail(message) {
  console.error(`Readiness API guard failed: ${message}`);
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

requireIncludes("app.get('/api/readiness'", 'readiness route');
requireIncludes('function buildReadiness', 'readiness builder');
requireIncludes("stage = score >= 95 ? 'release-candidate' : score >= 80 ? 'public-beta' : 'internal-beta'", 'readiness launch stage thresholds');
requireIncludes('courtCount: courts.length', 'court coverage summary');
requireIncludes('requiredExternalServicesReady', 'external service coverage summary');
requireIncludes('Legal and bidding decisions still require original court documents and field verification.', 'legal caveat');
requireIncludes('Per-court single-case coverage depends on valid case-number samples.', 'case sample caveat');

const readinessRoute = sectionBetween("app.get('/api/readiness'", "app.get('/api/kakao/maps-sdk.js'", '/api/readiness route');
if (/kakaoRestKey\s*:|kakaoMapKey\s*:|molitKey\s*:|onbidKey\s*:/.test(readinessRoute)) {
  fail('readiness route must not expose raw API key fields.');
}

console.log('Readiness API guard passed.');
