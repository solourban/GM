const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SERVER = fs.readFileSync(path.join(ROOT, 'src', 'server.js'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const SERVICE_STATUS = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-service-status.js'), 'utf8');
const MOLIT = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-molit-trades.js'), 'utf8');
const FINAL_JUDGMENT = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-final-judgment.js'), 'utf8');

function fail(message) {
  console.error(`Renewal regression guard failed: ${message}`);
  process.exit(1);
}

function requireIncludes(content, needle, label) {
  if (!content.includes(needle)) fail(`${label} is missing.`);
}

function requireExcludes(content, needle, label) {
  if (content.includes(needle)) fail(`${label} must not appear.`);
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
  ["app.get('/api/molit/apt-trades'", 'MOLIT apartment compatibility route'],
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
  '/app-v2-workflow-shell.js',
  '/app-v2-essential-documents.js',
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
requireBefore(INDEX, '/app-v2-date-courts.js', '/app-v2-workflow-shell.js', 'workflow shell must load after date court helpers');
requireBefore(INDEX, '/app-v2-workflow-shell.js', '/app-v2-essential-documents.js', 'essential document card must load after workflow shell');
requireBefore(INDEX, '/app-v2-essential-documents.js', '/app-v2-result-order.js', 'result order must load after essential document card');
requireBefore(INDEX, '/app-v2-map-provider-guard.js', '/app-v2-result-order.js', 'result order must load after result feature scripts');

requireIncludes(SERVER, 'Cache-Control', 'no-store cache control header');
requireIncludes(SERVER, 'X-Request-Id', 'request id response header');
requireIncludes(SERVICE_STATUS, "if (!config?.hasKakaoMap)", 'Kakao map missing-service checklist');
requireIncludes(SERVICE_STATUS, 'JavaScript SDK 도메인', 'Kakao JavaScript SDK domain setup guidance');

[
  [MOLIT, '실거래가 참고지표', 'MOLIT reference badge'],
  [MOLIT, '국토부 실거래가 참고지표', 'MOLIT reference title'],
  [MOLIT, '참고지표 성격', 'reference nature field'],
  [MOLIT, '수익 예측이나 적정가 확정값이 아닙니다.', 'no-profit/no-fair-price copy'],
  [MOLIT, '표본 해석', 'sample interpretation label'],
  [MOLIT, '가격 참고 메모', 'price reference memo label'],
  [MOLIT, '동일 단지 여부', 'same-complex uncertainty label'],
  [MOLIT, '면적 매칭 주의', 'area matching caution label'],
  [MOLIT, '표본 수', 'sample count label'],
  [MOLIT, '동일 단지 여부 미확인', 'same-complex unconfirmed copy'],
  [MOLIT, '전용면적 매칭 전까지', 'area matching warning copy'],
  [FINAL_JUDGMENT, '우선검토', 'softened positive decision label'],
  [FINAL_JUDGMENT, '실거래가 참고지표', 'final judgment reference wording'],
  [FINAL_JUDGMENT, '실거래가 표본 수', 'final judgment sample count label'],
  [FINAL_JUDGMENT, '가격 참고', 'final judgment price reference wording'],
  [FINAL_JUDGMENT, '수익 예측이나 적정가 확정값이 아니며', 'final no-profit/no-fair-price copy'],
].forEach(([content, needle, label]) => requireIncludes(content, needle, label));

[
  [MOLIT, '가격 비교 판단', 'MOLIT price judgment label'],
  [MOLIT, '거래 판단', 'MOLIT trade judgment label'],
  [MOLIT, '추가 검토할 만합니다', 'MOLIT recommendation-like copy'],
  [MOLIT, '가격 매력', 'MOLIT attractiveness copy'],
  [MOLIT, '실거래가·시세 확인', 'old MOLIT badge'],
  [FINAL_JUDGMENT, '적극검토', 'strong positive decision label'],
  [FINAL_JUDGMENT, '가격 매력', 'final attractiveness copy'],
].forEach(([content, needle, label]) => requireExcludes(content, needle, label));

console.log('Renewal regression guard passed.');
