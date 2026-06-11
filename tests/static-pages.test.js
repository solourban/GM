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

function fail(message) {
  console.error(`Static page guard failed: ${message}`);
  process.exit(1);
}

function readPublic(fileName) {
  const filePath = path.join(PUBLIC_DIR, fileName);
  if (!fs.existsSync(filePath)) fail(`${fileName} does not exist.`);
  return fs.readFileSync(filePath, 'utf8');
}

function requireIncludes(content, needle, label) {
  if (!content.includes(needle)) fail(`${label} is missing ${needle}.`);
}

function requirePattern(content, pattern, label) {
  if (!pattern.test(content)) fail(`${label} is missing.`);
}

function publicFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return publicFiles(fullPath);
    if (!entry.isFile()) return [];
    return /\.(html|js|css)$/i.test(entry.name) ? [fullPath] : [];
  });
}

const pageContents = new Map(staticPages.map((fileName) => [fileName, readPublic(fileName)]));

for (const [fileName, html] of pageContents) {
  requireIncludes(html, '<!DOCTYPE html>', fileName);
  requireIncludes(html, '</html>', fileName);
  requireIncludes(html, '<header class="site-header">', fileName);
  requireIncludes(html, '<main class="static-page">', fileName);
  requireIncludes(html, '<footer class="site-footer">', fileName);
  requiredLinks.forEach((href) => requireIncludes(html, `href="${href}"`, fileName));
}

const indexHtml = readPublic('index.html');
requiredLinks.slice(1).forEach((href) => requireIncludes(indexHtml, `href="${href}"`, 'index.html'));

const guideHtml = pageContents.get('guide.html');
const guideCardCount = (guideHtml.match(/<article class="guide-item">/g) || []).length;
if (guideCardCount < 5) fail(`guide.html should render at least 5 guide cards, found ${guideCardCount}.`);
['서비스 소개', '개인정보처리방침', '면책 고지', '문의하기'].forEach((label) => {
  requireIncludes(guideHtml, label, 'guide.html');
});

const privacyHtml = pageContents.get('privacy.html');
requirePattern(privacyHtml, /localStorage|sessionStorage/, 'privacy.html browser storage disclosure');

const disclaimerHtml = pageContents.get('disclaimer.html');
['참고용', '법률 자문 아님', '금융·세무 자문 아님'].forEach((phrase) => {
  requireIncludes(disclaimerHtml, phrase, 'disclaimer.html');
});

const forbiddenAdCode = /adsbygoogle|googlesyndication/i;
const adCodeHits = publicFiles(PUBLIC_DIR)
  .filter((filePath) => forbiddenAdCode.test(fs.readFileSync(filePath, 'utf8')))
  .map((filePath) => path.relative(ROOT, filePath).replace(/\\/g, '/'));
if (adCodeHits.length) fail(`ad code is present before approval: ${adCodeHits.join(', ')}`);

console.log(`Static page guard passed. Checked ${staticPages.length} static pages.`);
