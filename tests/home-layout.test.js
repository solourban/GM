const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const core = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-core.js'), 'utf8');
const style = fs.readFileSync(path.join(ROOT, 'public', 'style.css'), 'utf8');

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

requireIncludes('.hero { min-height:clamp(300px,36vh,420px); padding:34px 0 30px; display:flex; align-items:center; background:linear-gradient(180deg,#074332 0%,#063727 100%); max-width:100%; overflow:hidden; }', 'compact desktop hero sizing');
requireIncludes('#v2HomePanels { width:100%; min-width:0; max-width:100%; min-height:0; }', 'home panel should not reserve extra empty height');
requireIncludes('.results-section:empty { min-height:0; padding-top:0; padding-bottom:0; }', 'empty search results should collapse');
requireIncludes('.hero{min-height:auto; padding:28px 0 30px;}', 'compact tablet hero sizing');
requireIncludes('.v2-panel { display:none; width:100%; min-width:0; max-width:var(--v2-card-width); margin:0 auto; }', 'home panels should shrink inside the viewport');
requireIncludes('.v2-card, .v2-result-card { width:100%; min-width:0; max-width:100%; background:#fff; color:var(--ink); border:1px solid var(--line); border-radius:22px; padding:22px; box-shadow:0 18px 48px rgba(0,0,0,.08); overflow-wrap:anywhere; }', 'cards should wrap long values instead of overflowing');
requireIncludes('.v2-form { width:100%; min-width:0; display:grid;', 'forms should not force wider than the card');
requireIncludes('.v2-field input, .v2-field select { width:100%; min-width:0; max-width:100%;', 'inputs should shrink within mobile cards');
requireIncludes('.v2-btn, .v2-secondary-btn, .v2-small-btn, .v2-danger-btn { min-width:0; max-width:100%; min-height:42px; border-radius:11px; padding:0 16px; font-weight:900; cursor:pointer; border:1px solid var(--line); white-space:normal; line-height:1.25; text-align:center; }', 'buttons should allow responsive wrapping');
requireIncludes('.v2-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%;min-width:0;max-width:100%;gap:7px;align-items:stretch}', 'mobile tabs should use two stable columns');
requireIncludes('.header-inner{width:100%;gap:9px;padding:0 14px;max-width:100%;min-width:0;overflow:hidden}', 'mobile header should not create horizontal overflow');
requireIncludes('.v2-tab{width:100%;min-width:0;min-height:40px;padding:8px 5px;font-size:12px;line-height:1.25;text-align:center;white-space:normal;overflow-wrap:anywhere;display:flex;align-items:center;justify-content:center}', 'mobile tabs should wrap long labels');

if (!style.includes('html, body { margin: 0; padding: 0; max-width: 100%; overflow-x: hidden; }')) {
  fail('page should prevent body-level horizontal overflow.');
}

if (!style.includes('.container { width: 100%; max-width: 1040px; margin: 0 auto; padding: 0 24px; }')) {
  fail('global containers should have an explicit responsive width.');
}

if (!style.includes('max-width: 100%;\n  overflow-x: hidden;')) {
  fail('footer should not create horizontal overflow.');
}

console.log('Home layout guard passed.');
