const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const pages = [
  'index.html',
  'about.html',
  'guide.html',
  'privacy.html',
  'disclaimer.html',
  'contact.html',
];

function fail(message) {
  console.error(`Header logo guard failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

const logoPath = path.join(PUBLIC_DIR, 'assets', 'nakchalnote-logo.png');
assert(fs.existsSync(logoPath), 'public/assets/nakchalnote-logo.png must exist.');
assert(fs.statSync(logoPath).size > 1024, 'header logo asset should not be empty.');

for (const page of pages) {
  const html = fs.readFileSync(path.join(PUBLIC_DIR, page), 'utf8');
  assert(html.includes('class="brand brand-logo"'), `${page} must use the logo brand anchor.`);
  assert(html.includes('src="/assets/nakchalnote-logo.png"'), `${page} must reference the shared logo asset.`);
  assert(html.includes('alt="낙찰노트 로고"'), `${page} must keep accessible logo alt text.`);
}

const style = fs.readFileSync(path.join(PUBLIC_DIR, 'style.css'), 'utf8');
assert(style.includes('.brand-logo {'), 'style.css must include brand-logo wrapper styles.');
assert(style.includes('.brand-logo img {'), 'style.css must include brand-logo image styles.');
assert(style.includes('object-fit: contain;'), 'logo image must preserve its ratio.');
assert(/\.brand-logo img\s*\{[\s\S]*height:\s*44px;[\s\S]*max-width:\s*220px;/.test(style), 'desktop logo size contract is missing.');
assert(/@media \(max-width: 640px\)[\s\S]*\.brand-logo img\s*\{[\s\S]*height:\s*38px;[\s\S]*max-width:\s*180px;/.test(style), 'mobile logo size contract is missing.');
assert(/@media \(max-width: 720px\)[\s\S]*body \.brand-logo img\s*\{[\s\S]*height:\s*36px;[\s\S]*max-width:\s*160px;/.test(style), 'compact mobile logo override is missing.');
assert(/@media \(max-width: 360px\)[\s\S]*body \.brand-logo img\s*\{[\s\S]*height:\s*34px;[\s\S]*max-width:\s*150px;/.test(style), 'narrow mobile logo override is missing.');

console.log('Header logo guard passed.');
