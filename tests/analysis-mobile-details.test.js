const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const core = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-core.js'), 'utf8');
const style = fs.readFileSync(path.join(ROOT, 'public', 'style.css'), 'utf8');
const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');

function fail(message) {
  throw new Error(`Analysis mobile details guard failed: ${message}`);
}

function requireIncludes(source, needle, label) {
  if (!source.includes(needle)) fail(`${label} missing`);
}

[
  'function analysisMobileField(label, value)',
  'function analysisMobileReason(reason)',
  'aria-label="임차인별 판단 카드"',
  'aria-label="권리별 판단 카드"',
  'v2-analysis-mobile-card',
  'v2-analysis-detail-table-wrap',
  "analysisMobileField('인수 가능액', won(tenantUnpaid(t)))",
  "analysisMobileField('말소기준', r.isMalso ? '해당' : '-')",
].forEach((needle) => requireIncludes(core, needle, `core ${needle}`));

[
  '.v2-analysis-mobile-list {',
  '.v2-analysis-mobile-card {',
  '.v2-analysis-mobile-grid {',
  'body .v2-analysis-mobile-list {\n    display: grid;',
  'body .v2-analysis-detail-table-wrap {\n    display: none;',
].forEach((needle) => requireIncludes(style, needle, `style ${needle}`));

[
  '.v2-date-card-list,.v2-mobile-card-list,.v2-analysis-mobile-list{display:grid',
  '.v2-date-table-wrap,.v2-bulk-table-wrap,.v2-saved-table-wrap,.v2-onbid-table-wrap,.v2-analysis-detail-table-wrap{display:none}',
].forEach((needle) => requireIncludes(core, needle, `core mobile CSS ${needle}`));

[
  'node tests/analysis-mobile-details.test.js',
  'npm run test:analysis-mobile-details',
].forEach((needle) => requireIncludes(pkg, needle, `package ${needle}`));

console.log('Analysis mobile details guard passed.');
