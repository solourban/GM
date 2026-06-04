const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SERVER = fs.readFileSync(path.join(ROOT, 'src', 'server.js'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const SERVICE_STATUS = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-service-status.js'), 'utf8');

function fail(message) {
  console.error(`Renewal regression guard failed: ${message}`);
  process.exit(1);
}

function requireIncludes(content, needle, label) {
  if (!content.includes(needle)) fail(`${label} is missing.`);
}

function requireBefore(content, first, second, label) {
  const firstIndex = content.indexOf(first);
  const secondIndex = content.indexOf(second);
  if (firstIndex === -1) fail(`${label}: first script missing.`);
  if (secondIndex === -1) fail(`${label}: second script missing.`);
  if (firstIndex > secondIndex) fail(`${label}: script order is wrong.`);
}

const requiredServerRoutes = [
  ["app.get('/api/health'", 'health route'],
  ["app.get('/api/config'", 'config route'],
  ["app.post('/api/fetch'", 'court auction fetch route'],
  ["app.post('/api/analyze'", 'analysis route'],
  ["app.get('/api/courts'", 'court list route'],
  ["app.get('/api/location/geocode'", 'Kakao geocode proxy route'],
  ["app.get('/api/molit/trades'", 'MOLIT trades proxy route'],
  ["app.get('/api/onbid/items'", 'Onbid list proxy route'],
  ["app.get('/api/onbid/detail'", 'Onbid detail proxy route'],
];

requiredServerRoutes.forEach(([needle, label]) => requireIncludes(SERVER, needle, label));

const requiredConfigFlags = [
  ['hasKakaoRest', 'Kakao REST status flag'],
  ['hasKakaoMap', 'Kakao map status flag'],
  ['hasMolit', 'MOLIT status flag'],
  ['hasOnbid', 'Onbid status flag'],
  ['KAKAO_REST_API_KEY', 'Kakao REST env name'],
  ['MOLIT_API_KEY', 'MOLIT env name'],
  ['ONBID_API_KEY', 'Onbid env name'],
];

requiredConfigFlags.forEach(([needle, label]) => requireIncludes(SERVER, needle, label));

const requiredScripts = [
  '/app-v2-request-id-bridge.js',
  '/app-v2-spec-extractor-parser.js',
  '/app-v2-spec-extractor.js',
  '/app-v2-core.js',
  '/app-v2-onbid-entry.js',
  '/app-v2-service-status.js',
  '/app-v2-property-types.js',
  '/app-v2-date-source.js',
  '/app-v2-candidate-stack.js',
  '/app-v2-saved-tab.js',
  '/app-v2-bulk-tab.js',
  '/app-v2-location.js',
  '/app-v2-molit-trades.js',
  '/app-v2-final-judgment.js',
  '/app-v2-confidence.js',
  '/app-v2-final-copy-bridge.js',
  '/app-v2-result-order.js',
];

requiredScripts.forEach((script) => requireIncludes(INDEX, script, `${script} load tag`));
requireBefore(INDEX, '/app-v2-request-id-bridge.js', '/app-v2-core.js', 'request id bridge must load before core');
requireBefore(INDEX, '/app-v2-request-id-bridge.js', '/app-v2-spec-extractor-parser.js', 'specification parser must load after request id bridge');
requireBefore(INDEX, '/app-v2-spec-extractor-parser.js', '/app-v2-core.js', 'specification parser must load before core');
requireBefore(INDEX, '/app-v2-core.js', '/app-v2-spec-extractor.js', 'specification review UI must load after core');
requireBefore(INDEX, '/app-v2-case-reset.js', '/app-v2-spec-extractor.js', 'specification review UI must load after case scope');
requireBefore(INDEX, '/app-v2-core.js', '/app-v2-onbid-entry.js', 'Onbid entry must load after core');
requireBefore(INDEX, '/app-v2-core.js', '/app-v2-service-status.js', 'service status must load after core');
requireBefore(INDEX, '/app-v2-property-types.js', '/app-v2-date.js', 'property type helper must load before date screen');
requireBefore(INDEX, '/app-v2-date-source.js', '/app-v2-candidate-stack.js', 'candidate stack must load after date source');
requireBefore(INDEX, '/app-v2-candidate-stack.js', '/app-v2-saved-tab.js', 'saved tab must load after candidate stack');
requireBefore(INDEX, '/app-v2-saved-tab.js', '/app-v2-bulk-tab.js', 'bulk tab must load after saved tab');
requireBefore(INDEX, '/app-v2-bulk-tab.js', '/app-v2-location.js', 'location must load after renewed tab runtimes');
requireBefore(INDEX, '/app-v2-location.js', '/app-v2-molit-trades.js', 'MOLIT must load after location');
requireBefore(INDEX, '/app-v2-molit-trades.js', '/app-v2-final-judgment.js', 'final judgment must load after MOLIT');
requireBefore(INDEX, '/app-v2-final-judgment.js', '/app-v2-confidence.js', 'confidence must load after final judgment');
requireBefore(INDEX, '/app-v2-confidence.js', '/app-v2-final-copy-bridge.js', 'final copy bridge must load after confidence');
requireBefore(INDEX, '/app-v2-map-provider-guard.js', '/app-v2-result-order.js', 'result order must load after result feature scripts');

requireIncludes(SERVER, 'Cache-Control', 'no-store cache control header');
requireIncludes(SERVER, 'X-Request-Id', 'request id response header');
requireIncludes(SERVICE_STATUS, "if (!config?.hasKakaoMap)", 'Kakao map missing-service checklist');
requireIncludes(SERVICE_STATUS, 'JavaScript SDK 도메인', 'Kakao JavaScript SDK domain setup guidance');

console.log('Renewal regression guard passed.');
