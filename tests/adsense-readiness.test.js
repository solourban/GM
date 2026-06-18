const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const server = fs.readFileSync(path.join(ROOT, 'src', 'server.js'), 'utf8');

function fail(message) {
  console.error(`AdSense readiness guard failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function readPublic(fileName) {
  return fs.readFileSync(path.join(PUBLIC_DIR, fileName), 'utf8');
}

assert(server.includes('function normalizeAdsensePublisherId'), 'server must validate the AdSense publisher id.');
assert(server.includes("app.get('/ads.txt'"), 'server must expose a dynamic /ads.txt route.');
assert(server.includes('process.env.ADSENSE_PUBLISHER_ID'), 'server must read ADSENSE_PUBLISHER_ID from environment.');
assert(server.includes('google.com, ${publisherId}, DIRECT, f08c47fec0942fa0'), 'ads.txt route must render the Google AdSense record.');
assert(server.includes("return /^pub-\\d{12,20}$/.test(id) ? id : '';"), 'publisher id must be constrained to pub- digits only.');

assert(!fs.existsSync(path.join(PUBLIC_DIR, 'ads.txt')), 'public/ads.txt must not contain a placeholder publisher id.');

const publicFiles = fs.readdirSync(PUBLIC_DIR).filter((name) => /\.(html|css|js)$/i.test(name));
for (const fileName of publicFiles) {
  const content = readPublic(fileName);
  assert(!/adsbygoogle|googlesyndication|google_ad_client/i.test(content), `${fileName} must not include ad code before publisher approval.`);
}

const indexHtml = readPublic('index.html');
['/about.html', '/guide.html', '/privacy.html', '/disclaimer.html', '/contact.html']
  .forEach((href) => assert(indexHtml.includes(`href="${href}"`), `index.html must link to ${href}.`));

const privacyHtml = readPublic('privacy.html');
assert(/광고|advertising/i.test(privacyHtml), 'privacy.html must mention future advertising/cookie handling.');

console.log('AdSense readiness guard passed.');
