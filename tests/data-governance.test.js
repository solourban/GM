const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'src', 'server.js'), 'utf8');
const privacy = fs.readFileSync(path.join(ROOT, 'public', 'privacy.html'), 'utf8');
const disclaimer = fs.readFileSync(path.join(ROOT, 'public', 'disclaimer.html'), 'utf8');
const { listPublicDataSources, dataGovernanceSummary } = require('../src/dataGovernance');

function fail(message) {
  console.error(`Data governance guard failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

const sources = listPublicDataSources();
const summary = dataGovernanceSummary();

assert(Array.isArray(sources) && sources.length >= 5, 'at least five public data source records are required.');
assert(summary.sources === sources.length, 'summary source count must match public source list.');
assert(summary.trainingUse.includes('No user input'), 'summary must state training-use exclusion.');

const requiredIds = ['court-auction', 'kakao-local-map', 'molit-trades', 'onbid', 'user-input'];
requiredIds.forEach((id) => assert(sources.some((source) => source.id === id), `${id} source record is missing.`));

sources.forEach((source) => {
  ['id', 'label', 'provider', 'classification', 'collectionMethod', 'retention', 'trainingUse', 'userNotice'].forEach((key) => {
    assert(typeof source[key] === 'string' && source[key].trim(), `${source.id || 'unknown'} is missing ${key}.`);
  });
  assert(Array.isArray(source.routes) && source.routes.length, `${source.id} must include public route references.`);
  assert(Array.isArray(source.dataTypes) && source.dataTypes.length, `${source.id} must include data type labels.`);
  assert(source.trainingUse.includes('사용하지 않습니다'), `${source.id} must clearly state non-training use.`);
});

const serializedSources = JSON.stringify(sources);
[
  'KAKAO_REST_API_KEY',
  'KAKAO_JS_KEY',
  'MOLIT_API_KEY',
  'ONBID_API_KEY',
  'DATA_GO_KR_KEY',
  'serviceKey',
  'Authorization',
].forEach((needle) => {
  assert(!serializedSources.includes(needle), `public data source payload must not expose ${needle}.`);
});

assert(server.includes("const { listPublicDataSources, dataGovernanceSummary } = require('./dataGovernance')"), 'server must import data governance registry.');
assert(server.includes("app.get('/api/data-sources'"), 'server must expose /api/data-sources.');
assert(server.includes("readinessCheck('dataGovernance'"), 'readiness must include data governance check.');

['AI 모델 학습', '재판매용 데이터셋', '/api/data-sources', 'Kakao Developers', '온비드'].forEach((text) => {
  assert(privacy.includes(text), `privacy.html is missing "${text}".`);
});
['출처와 자동화 한계', 'AI 모델 학습', '/api/data-sources', '원문 공고'].forEach((text) => {
  assert(disclaimer.includes(text), `disclaimer.html is missing "${text}".`);
});

console.log('Data governance guard passed.');
