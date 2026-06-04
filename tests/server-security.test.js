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

function forbid(pattern, label, source = content) {
  if (pattern.test(source)) fail(`${label} is present.`);
}

function sectionBetween(startNeedle, endNeedle, label) {
  const start = content.indexOf(startNeedle);
  if (start === -1) fail(`${label} start marker is missing.`);
  const end = content.indexOf(endNeedle, start + startNeedle.length);
  if (end === -1) fail(`${label} end marker is missing.`);
  return content.slice(start, end);
}

const configRoute = sectionBetween("app.get('/api/config'", "app.get('/api/kakao/maps-sdk.js'", '/api/config route');
const kakaoSdkRoute = sectionBetween("app.get('/api/kakao/maps-sdk.js'", 'function validateAddressInput', '/api/kakao/maps-sdk.js route');
const geocodeRoute = sectionBetween("app.get('/api/location/geocode'", "app.get('/api/courts'", '/api/location/geocode route');

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
requireIncludes('safeKakaoDiagnostic', 'safe Kakao upstream diagnostic helper');
requireIncludes("app.get('/api/kakao/maps-sdk.js'", 'Kakao Maps SDK proxy route');
requireIncludes("url.searchParams.set('appkey', keys.kakaoMapKey)", 'server-side Kakao Maps SDK appkey usage');
requireIncludes('window.__kakaoMapsSdkLoader', 'Kakao browser SDK loader promise');
requireIncludes("document.createElement('script')", 'Kakao browser SDK script creation');
requireIncludes('script.src = ${sdkUrl}', 'Kakao browser SDK source assignment');
requireIncludes("res.type('application/javascript; charset=utf-8')", 'Kakao Maps SDK JavaScript content type');

forbid(/detail\s*:\s*String\(e\)/, 'direct String(e) detail exposure');
forbid(/json\([\s\S]{0,500}raw\.debug/, 'crawler debug exposure in JSON response');
forbid(/json\([\s\S]{0,500}e\.stack/, 'stack trace exposure in JSON response');
forbid(/detail\s*:\s*e\.message/, 'direct geocode e.message detail exposure', geocodeRoute);

forbid(/\bkakaoRestKey\s*:/, 'Kakao REST key value exposure in /api/config JSON response', configRoute);
forbid(/\bkakaoMapKey\s*:/, 'Kakao map key value exposure in /api/config JSON response', configRoute);
forbid(/\bkakaoJsKey\s*:/, 'Kakao JS key value exposure in /api/config JSON response', configRoute);
forbid(/\bmolitKey\s*:/, 'MOLIT key value exposure in /api/config JSON response', configRoute);
forbid(/KakaoAK\s*\$\{keys\.kakaoRestKey\}/, 'Kakao REST authorization header exposure in /api/config route', configRoute);
forbid(/req\.query/, 'client query forwarding in Kakao SDK proxy route', kakaoSdkRoute);
forbid(/await\s+fetch\(/, 'server-side Kakao SDK download that breaks browser appkey detection', kakaoSdkRoute);

console.log('Server security guard passed.');
