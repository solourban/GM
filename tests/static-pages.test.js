const assert = require('assert');
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
  { href: '/', label: '홈' },
  { href: '/about.html', label: '서비스 소개' },
  { href: '/guide.html', label: '경매 가이드' },
  { href: '/privacy.html', label: '개인정보처리방침' },
  { href: '/disclaimer.html', label: '면책 고지' },
  { href: '/contact.html', label: '문의하기' },
];

function readPublic(fileName) {
  return fs.readFileSync(path.join(PUBLIC_DIR, fileName), 'utf8');
}

function assertIncludes(content, needle, message) {
  assert(content.includes(needle), message);
}

function assertNoAdCode(fileName, content) {
  assert(!/adsbygoogle|googlesyndication/i.test(content), `${fileName} should not include AdSense ad code yet`);
}

for (const page of staticPages) {
  const filePath = path.join(PUBLIC_DIR, page);
  assert(fs.existsSync(filePath), `${page} should exist`);

  const html = readPublic(page);
  assert(html.trimStart().startsWith('<!DOCTYPE html>'), `${page} should start with <!DOCTYPE html>`);
  assertIncludes(html, '</html>', `${page} should close </html>`);
  assertIncludes(html, '<header class="site-header">', `${page} should include a header`);
  assertIncludes(html, '<main class="static-page">', `${page} should include a main static page area`);
  assertIncludes(html, '<footer class="site-footer">', `${page} should include a footer`);
  assertNoAdCode(page, html);

  for (const link of requiredLinks) {
    assertIncludes(html, `href="${link.href}"`, `${page} should link to ${link.href}`);
    assertIncludes(html, link.label, `${page} should include ${link.label}`);
  }
}

const indexHtml = readPublic('index.html');
for (const link of requiredLinks.slice(1)) {
  assertIncludes(indexHtml, `href="${link.href}"`, `index.html should link to ${link.href}`);
}
assertNoAdCode('index.html', indexHtml);

const guideHtml = readPublic('guide.html');
assert.strictEqual(
  (guideHtml.match(/class="guide-item"/g) || []).length,
  5,
  'guide.html should render exactly five guide cards'
);

const privacyHtml = readPublic('privacy.html');
assert(
  /localStorage|sessionStorage/.test(privacyHtml),
  'privacy.html should mention localStorage or sessionStorage'
);

const disclaimerHtml = readPublic('disclaimer.html');
for (const phrase of ['참고용', '법률 자문이 아닙니다', '금융·세무 자문이 아닙니다']) {
  assertIncludes(disclaimerHtml, phrase, `disclaimer.html should include ${phrase}`);
}

console.log('Static pages guard passed.');
