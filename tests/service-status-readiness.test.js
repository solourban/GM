const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const statusScript = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-service-status.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function fail(message) {
  console.error(`Service status readiness guard failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function requireIncludes(content, needle, label) {
  assert(content.includes(needle), `${label} is missing.`);
}

[
  "const HEALTH_ENDPOINT = '/api/health'",
  "const CONFIG_ENDPOINT = '/api/config'",
  "const VERSION_ENDPOINT = '/api/version'",
  "const DATA_SOURCES_ENDPOINT = '/api/data-sources'",
  'const FEATURE_LABELS',
  "bulkLookup: '여러 사건 일괄조회'",
  "onbid: '온비드 공매'",
  'function featureEntries(version)',
  'function disabledFeatures(version)',
  'function renderFeatureFlags(version)',
  'function renderVersionInfo(version)',
  'function renderDataSources(dataSources)',
  'const updatePolicy = remoteConfig.updatePolicy || {}',
  "const releaseChannel = clean(remoteConfig.releaseChannel || '-')",
  "info('배포 빌드', esc(clean(version?.buildId || '-')))",
  "info('릴리스 채널', esc(releaseChannel))",
  "info('업데이트 모드', esc(clean(updatePolicy.mode || '-')))",
  "info('최소 클라이언트', esc(clean(updatePolicy.minimumClientVersion || '-')))",
  'sourceCount(dataSources)',
  '/api/data-sources 원문 보기',
  'getJson(VERSION_ENDPOINT)',
  'getJson(DATA_SOURCES_ENDPOINT)',
  '원격 기능 설정',
  '데이터 출처 상태',
].forEach((needle) => requireIncludes(statusScript, needle, `status script ${needle}`));

[
  'process.env',
  'kakaoRestKey',
  'kakaoMapKey',
  'molitKey',
  'onbidKey',
  'serviceKey',
].forEach((needle) => {
  assert(!statusScript.includes(needle), `public status script must not read or expose ${needle}.`);
});

requireIncludes(
  packageJson.scripts['test:public'],
  'node --check public/app-v2-service-status.js',
  'public syntax test service status check',
);
requireIncludes(
  packageJson.scripts.test,
  'npm run test:service-status-readiness',
  'main test chain service status readiness check',
);

console.log('Service status readiness guard passed.');
