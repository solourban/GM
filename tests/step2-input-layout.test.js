const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const core = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-core.js'), 'utf8');
const style = fs.readFileSync(path.join(ROOT, 'public', 'style.css'), 'utf8');
const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');

function fail(message) {
  throw new Error(`Step 2 input layout guard failed: ${message}`);
}

function requireIncludes(source, needle, label) {
  if (!source.includes(needle)) fail(`${label} missing`);
}

function forbidIncludes(source, needle, label) {
  if (source.includes(needle)) fail(`${label} should not be present`);
}

[
  'function filledRows(rows, keys)',
  'function stepStatusPill(ready',
  'function renderStepGuideItem(label, title, note, ready)',
  'function renderStep2Guide()',
  'function renderStepSectionHead(title, note, ready, action = \'\')',
  'v2-step2-card',
  'v2-step2-guide',
  'v2-step2-required',
  'v2-step2-optional',
  'data-action="close-step2"',
  '등기부와 매각물건명세서에서 확인한 내용만 넣으세요.',
  '특수권리 문구가 없으면 비워둬도 됩니다.',
].forEach((needle) => requireIncludes(core, needle, `core ${needle}`));

[
  '<h4>1. 최선순위 권리</h4>',
  '<div class="v2-table-head"><h4>2. 임차인</h4>',
  '<div class="v2-table-head"><h4>3. 특수권리</h4>',
].forEach((needle) => forbidIncludes(core, needle, `old dense Step 2 layout ${needle}`));

[
  '.v2-step2-card {',
  '.v2-step2-guide {',
  '.v2-step2-card .v2-step-section {',
  '.v2-step-section-head {',
  '.v2-step2-required {',
  'body .v2-step2-guide {\n    grid-template-columns: 1fr;',
  'body .v2-step-section-head {\n    display: grid;',
].forEach((needle) => requireIncludes(style, needle, `style ${needle}`));

[
  'node tests/step2-input-layout.test.js',
  'npm run test:step2-input-layout',
].forEach((needle) => requireIncludes(pkg, needle, `package ${needle}`));

console.log('Step 2 input layout guard passed.');
