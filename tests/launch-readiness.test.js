const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const server = fs.readFileSync(path.join(ROOT, 'src', 'server.js'), 'utf8');
const index = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
const robots = fs.readFileSync(path.join(PUBLIC_DIR, 'robots.txt'), 'utf8');
const sitemap = fs.readFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), 'utf8');

function fail(message) {
  console.error(`Launch readiness guard failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function requireIncludes(content, needle, label) {
  assert(content.includes(needle), `${label} is missing.`);
}

[
  '<meta name="description"',
  '<meta name="robots" content="index,follow">',
  '<meta name="theme-color" content="#074332">',
  '<link rel="canonical" href="https://gm-production-0846.up.railway.app/">',
  '<meta property="og:type" content="website">',
  '<meta property="og:site_name" content="낙찰노트">',
  '<meta property="og:title" content="낙찰노트 | 경매 입찰 검토 도구">',
  '<meta property="og:description"',
  '<meta property="og:url" content="https://gm-production-0846.up.railway.app/">',
  '<meta property="og:image" content="https://gm-production-0846.up.railway.app/assets/nakchalnote-logo.png">',
  '<meta property="og:image:alt" content="낙찰노트 로고">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:title" content="낙찰노트 | 경매 입찰 검토 도구">',
  '<meta name="twitter:description"',
  '<meta name="twitter:image" content="https://gm-production-0846.up.railway.app/assets/nakchalnote-logo.png">',
].forEach((needle) => requireIncludes(index, needle, `index ${needle}`));

assert(/content="[^"]{60,160}"/.test(index.match(/<meta name="description"[^>]+>/)?.[0] || ''), 'index description should be concise.');

[
  "res.setHeader('X-Content-Type-Options', 'nosniff')",
  "res.setHeader('X-Frame-Options', 'DENY')",
  "res.setHeader('Referrer-Policy', 'same-origin')",
  "res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')",
  "res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')",
  "req.headers['x-forwarded-proto'] === 'https'",
].forEach((needle) => requireIncludes(server, needle, `server security header ${needle}`));

requireIncludes(robots, 'User-agent: *', 'robots user-agent');
requireIncludes(robots, 'Allow: /', 'robots allow');
requireIncludes(robots, 'Sitemap: https://gm-production-0846.up.railway.app/sitemap.xml', 'robots sitemap');

[
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  '<loc>https://gm-production-0846.up.railway.app/</loc>',
  '<loc>https://gm-production-0846.up.railway.app/about.html</loc>',
  '<loc>https://gm-production-0846.up.railway.app/guide.html</loc>',
  '<loc>https://gm-production-0846.up.railway.app/privacy.html</loc>',
  '<loc>https://gm-production-0846.up.railway.app/disclaimer.html</loc>',
  '<loc>https://gm-production-0846.up.railway.app/contact.html</loc>',
].forEach((needle) => requireIncludes(sitemap, needle, `sitemap ${needle}`));

assert(!/adsbygoogle|googlesyndication|google_ad_client/i.test(index), 'index must not include ad code before approval.');

console.log('Launch readiness guard passed.');
