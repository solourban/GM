const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SERVER_PATH = path.join(ROOT, 'src', 'server.js');
const content = fs.readFileSync(SERVER_PATH, 'utf8');

function fail(message) {
  console.error(`Server security guard failed: ${message}`);
  process.exit(1);
}

function requireIncludes(needle, label) {
  if (!content.includes(needle)) fail(`${label} is missing.`);
}

function forbid(pattern, label) {
  if (pattern.test(content)) fail(`${label} is present.`);
}

requireIncludes("res.setHeader('X-Request-Id'", 'X-Request-Id response header');
requireIncludes("res.setHeader('X-Content-Type-Options', 'nosniff')", 'X-Content-Type-Options nosniff header');
requireIncludes("res.setHeader('Referrer-Policy', 'same-origin')", 'Referrer-Policy header');
requireIncludes("res.setHeader('Cache-Control', 'no-store')", 'Cache-Control no-store header');
requireIncludes('function errorBody(req, message', 'centralized errorBody helper');
requireIncludes('function logException(scope, req, error', 'centralized logException helper');
requireIncludes('requestId: req.requestId', 'requestId response payload field');
requireIncludes('hasKakaoRest: Boolean(keys.kakaoRestKey)', 'Kakao REST boolean config response');
requireIncludes('hasKakaoMap: Boolean(keys.kakaoMapKey)', 'Kakao map boolean config response');
requireIncludes('hasMolit: Boolean(keys.molitKey)', 'MOLIT boolean config response');

forbid(/detail\s*:\s*e\.message/, 'direct e.message detail exposure');
forbid(/detail\s*:\s*String\(e\)/, 'direct String(e) detail exposure');
forbid(/res\.json\([\s\S]{0,800}kakaoRestKey\s*:/, 'Kakao REST key value exposure in JSON response');
forbid(/res\.json\([\s\S]{0,800}kakaoMapKey\s*:/, 'Kakao map key value exposure in JSON response');
forbid(/res\.json\([\s\S]{0,800}molitKey\s*:/, 'MOLIT key value exposure in JSON response');
forbid(/json\([\s\S]{0,500}raw\.debug/, 'crawler debug exposure in JSON response');
forbid(/json\([\s\S]{0,500}e\.stack/, 'stack trace exposure in JSON response');

console.log('Server security guard passed.');
