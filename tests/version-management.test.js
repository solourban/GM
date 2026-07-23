const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'src', 'server.js'), 'utf8');
const index = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const guard = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-version-guard.js'), 'utf8');
const style = fs.readFileSync(path.join(ROOT, 'public', 'style.css'), 'utf8');

function fail(message) {
  console.error(`Version management guard failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function requireIncludes(content, needle, label) {
  assert(content.includes(needle), `${label} is missing.`);
}

const versionRouteStart = server.indexOf("app.get('/api/version'");
const readinessStart = server.indexOf('function readinessCheck', versionRouteStart);
assert(versionRouteStart !== -1, '/api/version route is missing.');
assert(readinessStart !== -1, 'readiness marker after /api/version is missing.');
const versionRoute = server.slice(versionRouteStart, readinessStart);

[
  'function publicBuildId',
  'RAILWAY_GIT_COMMIT_SHA',
  'function injectIndexRuntimeMarkers',
  "app.get(['/', '/index.html'], serveIndex)",
  'function publicRuntimeConfig',
  'minimumClientVersion',
  'checkIntervalSeconds',
  'releaseChannel',
  'FEATURE_ONBID',
  "app.get('/api/version'",
].forEach((needle) => requireIncludes(server, needle, `server ${needle}`));

[
  'version: SERVICE_VERSION',
  'buildId: publicBuildId()',
  'remoteConfig: publicRuntimeConfig(keys)',
  'requestId: req.requestId',
].forEach((needle) => requireIncludes(versionRoute, needle, `/api/version ${needle}`));

[
  'kakaoRestKey',
  'kakaoMapKey',
  'molitKey',
  'onbidKey',
  'process.env',
  'serviceKey',
].forEach((needle) => {
  assert(!versionRoute.includes(needle), `/api/version route must not expose ${needle}.`);
});

requireIncludes(index, 'data-app-version="2.0.0"', 'index app version marker');
requireIncludes(index, 'data-app-build="static"', 'index app build marker');
requireIncludes(index, '<script src="/app-v2-version-guard.js"></script>', 'version guard script tag');

[
  "const VERSION_ENDPOINT = '/api/version'",
  'const CLIENT_VERSION',
  'const CLIENT_BUILD_ID',
  'window[CONFIG_GLOBAL] = payload.remoteConfig || {}',
  "const CONFIG_EVENT = 'nakchalnote:remote-config'",
  'document.dispatchEvent(new CustomEvent(CONFIG_EVENT',
  'function compareVersion',
  'function renderUpdateBanner',
  'v2VersionBanner',
  '필수 업데이트가 있습니다.',
  '새 버전이 준비됐습니다.',
  'window.location.reload()',
  'setInterval(checkVersion',
  'updatePolicy?.checkIntervalSeconds',
].forEach((needle) => requireIncludes(guard, needle, `version guard ${needle}`));

[
  '.v2-version-banner',
  '.v2-version-actions',
  '.v2-version-refresh',
  '.v2-version-dismiss',
  'body .v2-version-banner',
].forEach((needle) => requireIncludes(style, needle, `version banner style ${needle}`));

console.log('Version management guard passed.');
