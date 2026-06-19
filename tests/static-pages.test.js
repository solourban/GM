const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const staticPages = [
  'about.html',
  'guide.html',
  'privacy.html',
  'disclaimer.html',
  'contact.html',
];

const requiredLinks = [
  '/',
  '/about.html',
  '/guide.html',
  '/privacy.html',
  '/disclaimer.html',
  '/contact.html',
];
const stylesheetHref = '/style.css?v=20260619-logo-tab-fix';

function fail(message) {
  console.error(`Static page guard failed: ${message}`);
  process.exit(1);
}

function readPublic(fileName) {
  return fs.readFileSync(path.join(PUBLIC_DIR, fileName), 'utf8');
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertHtmlEnvelope(fileName, html) {
  assert(/^\s*<!DOCTYPE html>/i.test(html), `${fileName} is missing <!DOCTYPE html>.`);
  assert(/<\/html>\s*$/i.test(html), `${fileName} is missing closing </html>.`);
  assert(/<header[\s>]/i.test(html), `${fileName} is missing header.`);
  assert(/<main[\s>]/i.test(html), `${fileName} is missing main.`);
  assert(/<footer[\s>]/i.test(html), `${fileName} is missing footer.`);
}

function assertContainsLink(fileName, html, href) {
  const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<a\\s+[^>]*href=["']${escapedHref}["']`, 'i');
  assert(pattern.test(html), `${fileName} is missing link to ${href}.`);
}

function assertNoAdCode(fileName, html) {
  assert(!/adsbygoogle|googlesyndication/i.test(html), `${fileName} contains AdSense ad code.`);
}

function assertStylesheet(fileName, html) {
  assert(html.includes(`href="${stylesheetHref}"`), `${fileName} must load the cache-busted stylesheet.`);
}

for (const fileName of staticPages) {
  const filePath = path.join(PUBLIC_DIR, fileName);
  assert(fs.existsSync(filePath), `${fileName} does not exist.`);

  const html = readPublic(fileName);
  assertHtmlEnvelope(fileName, html);
  assertStylesheet(fileName, html);
  requiredLinks.forEach((href) => assertContainsLink(fileName, html, href));
  assertNoAdCode(fileName, html);
}

const indexHtml = readPublic('index.html');
assertStylesheet('index.html', indexHtml);
['/about.html', '/guide.html', '/privacy.html', '/disclaimer.html', '/contact.html']
  .forEach((href) => assertContainsLink('index.html', indexHtml, href));
assertNoAdCode('index.html', indexHtml);

const privacyHtml = readPublic('privacy.html');
assert(/localStorage|sessionStorage/.test(privacyHtml), 'privacy.html must mention localStorage or sessionStorage.');

const disclaimerHtml = readPublic('disclaimer.html');
['참고용', '법률 자문이 아닙니다', '금융·세무 자문이 아닙니다']
  .forEach((text) => assert(disclaimerHtml.includes(text), `disclaimer.html is missing "${text}".`));

const guideHtml = readPublic('guide.html');
const guideItemCount = (guideHtml.match(/class=["']guide-item["']/g) || []).length;
assert(guideItemCount === 5, `guide.html should contain 5 guide cards, found ${guideItemCount}.`);

console.log(`Static page guard passed. Checked ${staticPages.length} static pages.`);
