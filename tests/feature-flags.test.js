const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const index = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
const featureFlags = fs.readFileSync(path.join(PUBLIC_DIR, 'app-v2-feature-flags.js'), 'utf8');
const versionGuard = fs.readFileSync(path.join(PUBLIC_DIR, 'app-v2-version-guard.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function fail(message) {
  console.error(`Feature flags guard failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function requireIncludes(content, needle, label) {
  assert(content.includes(needle), `${label} is missing.`);
}

requireIncludes(index, '<script src="/app-v2-feature-flags.js"></script>', 'index feature flags script tag');
assert(index.indexOf('/app-v2-core.js') < index.indexOf('/app-v2-feature-flags.js'), 'feature flags must load after app-v2-core.js.');
assert(index.indexOf('/app-v2-feature-flags.js') < index.indexOf('/app-v2-deeplink.js'), 'feature flags must load before app-v2-deeplink.js.');
requireIncludes(packageJson.scripts['test:public'], 'node --check public/app-v2-feature-flags.js', 'test:public feature flags syntax check');

[
  "const CONFIG_GLOBAL = '__NAKCHALNOTE_REMOTE_CONFIG'",
  "const CONFIG_EVENT = 'nakchalnote:remote-config'",
  'const TAB_FLAGS',
  "search: 'search'",
  "bulk: 'bulkLookup'",
  "date: 'dateRecommendations'",
  "saved: 'savedCandidates'",
  "onbid: 'onbid'",
  'function isFeatureEnabled',
  "flags()[key] !== false",
  'v2-tab-feature-disabled',
  'v2-tab-status',
  '점검중',
  '운영 설정으로 일시 중지된 기능입니다.',
  'function showNotice',
  'v2-feature-flag-notice',
  '운영 설정으로 비활성화된 기능입니다.',
  'function enforceActiveTab',
  'moveToSearch()',
  "document.querySelector('.v2-tab[data-tab=\"search\"]')",
  'MutationObserver',
  "document.addEventListener(CONFIG_EVENT, applyFeatureFlags)",
  'window.__nakchalnoteFeatureFlags',
].forEach((needle) => requireIncludes(featureFlags, needle, `feature flags ${needle}`));

[
  "const CONFIG_EVENT = 'nakchalnote:remote-config'",
  'document.dispatchEvent(new CustomEvent(CONFIG_EVENT',
  'detail: window[CONFIG_GLOBAL]',
].forEach((needle) => requireIncludes(versionGuard, needle, `version guard remote config event ${needle}`));

assert(!/process\.env|KAKAO_|MOLIT_|ONBID_API_KEY/.test(featureFlags), 'feature flags script must not read server secrets.');

console.log('Feature flags guard passed.');
