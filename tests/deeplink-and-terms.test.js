const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const index = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
const deeplink = fs.readFileSync(path.join(PUBLIC_DIR, 'app-v2-deeplink.js'), 'utf8');
const terms = fs.readFileSync(path.join(PUBLIC_DIR, 'terms.html'), 'utf8');
const sitemap = fs.readFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function fail(message) {
  console.error(`Deep link and terms guard failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function requireIncludes(content, needle, label) {
  assert(content.includes(needle), `${label} is missing.`);
}

requireIncludes(index, '<script src="/app-v2-deeplink.js"></script>', 'index deep link script tag');
assert(index.indexOf('/app-v2-core.js') < index.indexOf('/app-v2-deeplink.js'), 'deep link script should load after app-v2-core.js.');
assert(index.indexOf('/app-v2-deeplink.js') < index.indexOf('/app-v2-analyze-bridge.js'), 'deep link script should load before later bridge scripts.');
requireIncludes(packageJson.scripts['test:public'], 'node --check public/app-v2-deeplink.js', 'test:public deep link syntax check');

[
  'const TAB_ALIASES',
  "search: 'search'",
  "bulk: 'bulk'",
  "date: 'date'",
  "saved: 'saved'",
  "onbid: 'onbid'",
  'new URLSearchParams(window.location.search',
  'window.location.hash',
  "params.set('tab', hash)",
  "document.querySelector(`.v2-tab[data-tab=\"${tab}\"]`)",
  "setValue('jiwonNmV2'",
  "setValue('saYearV2'",
  "setValue('saSerV2'",
  "params.get('caseNo')",
  "params.get('saSer')",
  "params.get('auto')",
  "document.getElementById('btnFetchV2')?.click()",
  'window.__nakchalnoteDeepLink',
  "window.addEventListener('hashchange'",
  "window.addEventListener('popstate'",
].forEach((needle) => requireIncludes(deeplink, needle, `deeplink ${needle}`));

[
  '<title>이용약관 | 낙찰노트</title>',
  '<h2>이용약관</h2>',
  '서비스의 성격',
  '이용자의 책임',
  '데이터와 외부 연동',
  '서비스 변경과 중단',
  '광고와 제휴',
  '약관 변경',
  '법률·세무·금융 자문 또는 투자 권유를 제공하지 않습니다',
  'href="/privacy.html"',
  'href="/disclaimer.html"',
  'href="/contact.html"',
].forEach((needle) => requireIncludes(terms, needle, `terms ${needle}`));

[
  'index.html',
  'about.html',
  'guide.html',
  'privacy.html',
  'disclaimer.html',
  'contact.html',
  'terms.html',
].forEach((fileName) => {
  const html = fs.readFileSync(path.join(PUBLIC_DIR, fileName), 'utf8');
  requireIncludes(html, 'href="/terms.html"', `${fileName} terms link`);
});

requireIncludes(sitemap, '<loc>https://gm-production-0846.up.railway.app/terms.html</loc>', 'sitemap terms url');
assert(!/adsbygoogle|googlesyndication|google_ad_client/i.test(terms), 'terms.html must not include ad code before approval.');

console.log('Deep link and terms guard passed.');
