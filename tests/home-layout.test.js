const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const core = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-core.js'), 'utf8');

function fail(message) {
  console.error(`Home layout guard failed: ${message}`);
  process.exit(1);
}

function requireIncludes(needle, label) {
  if (!core.includes(needle)) fail(`${label} is missing.`);
}

if (/\.hero\s*\{\s*min-height:660px/.test(core)) {
  fail('desktop hero must not keep the old 660px empty first-screen height.');
}

if (/max-width:900px[\s\S]*\.hero\{min-height:560px/.test(core)) {
  fail('tablet hero must not keep the old 560px empty first-screen height.');
}

requireIncludes('.hero { min-height:clamp(360px,45vh,480px); padding:48px 0 42px;', 'compact desktop hero sizing');
requireIncludes('#v2HomePanels { min-height:0; }', 'home panel should not reserve extra empty height');
requireIncludes('.results-section:empty { min-height:0; padding-top:0; padding-bottom:0; }', 'empty search results should collapse');
requireIncludes('.hero{min-height:auto; padding:34px 0 38px;}', 'compact tablet hero sizing');

console.log('Home layout guard passed.');
