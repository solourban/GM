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

function requireStyleIncludes(needle, label) {
  if (!style.includes(needle)) fail(`${label} is missing.`);
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
requireIncludes('.v2-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%;min-width:0;max-width:100%;gap:7px;align-items:stretch;overflow:visible}', 'mobile tabs should use two stable columns without clipping');
if (core.includes('.header-inner{width:100%;gap:9px;padding:0 14px;max-width:100%;min-width:0;overflow:hidden}')) {
  fail('mobile header must not hide overflowing tabs by clipping them.');
}

requireIncludes('.site-header { position: sticky; top: 0; z-index: 100; background: rgba(246,245,241,.96); backdrop-filter: blur(10px); border-bottom:1px solid var(--line); max-width:100%; overflow:visible; }', 'site header should not clip responsive tab rows');
requireIncludes('.header-inner{width:100%;gap:9px;padding:0 14px;max-width:100%;min-width:0;overflow:visible;align-items:stretch}', 'mobile header should let tab rows fit instead of clipping');
requireIncludes('.v2-tab{width:100%;min-width:0;max-width:100%;min-height:40px;padding:8px 5px;font-size:12px;line-height:1.25;text-align:center;white-space:normal;overflow-wrap:anywhere;display:flex;align-items:center;justify-content:center}', 'mobile tabs should wrap long labels');
if (!style.includes('body .v2-tabs {\n    grid-template-columns: repeat(2,minmax(0,1fr));')) {
  fail('mobile visual override should keep header tabs in two columns.');
}

if (!style.includes('body .v2-tab {\n    min-height: 34px;')) {
  fail('mobile visual override should reduce tab height.');
}

if (!style.includes('body .hero {\n    padding: 18px 0 22px;\n    align-items: flex-start;')) {
  fail('mobile visual override should reduce the green input area weight.');
}

if (!style.includes('.hero-copy { display: none; }')) {
  fail('static CSS should hide the pre-boot marketing hero copy.');
}

if (!style.includes('body .v2-card,\n  body .v2-result-card {\n    border-radius: 16px;\n    padding: 14px;')) {
  fail('mobile visual override should compact input/result cards.');
}

if (!style.includes('body .v2-grid.compact {\n    grid-template-columns: repeat(2,minmax(0,1fr));')) {
  fail('mobile visual override should compact information grids.');
}

if (!style.includes('body .v2-info {\n    border-radius: 10px;\n    padding: 9px;')) {
  fail('mobile visual override should reduce information card padding.');
}

if (!style.includes('body .v2-step-section {\n    margin-top: 12px;\n    padding-top: 12px;')) {
  fail('mobile visual override should reduce secondary step spacing.');
}

if (!style.includes('body #v2ServiceStatusToggle {\n    margin-top: 8px !important;')) {
  fail('mobile visual override should pull the service status button closer.');
}

if (!style.includes('#v2ServiceStatusCard {\n  max-width: var(--v2-card-width, 920px);\n  margin: 16px auto 0;')) {
  fail('service status card should align with the main search card instead of looking overlapped.');
}

if (!style.includes('body #v2ServiceStatusCard {\n    margin-top: 10px;')) {
  fail('mobile service status card should keep a visible gap from the search card.');
}

requireIncludes('function renderFlowItem(label, status, note, tone = \'\')', 'next-step flow item renderer');
requireIncludes('function hasManualInput() {', 'manual input evidence helper');
requireIncludes("return hasManualInput();", 'analysis gate should ignore default select-only values');
requireIncludes('v2-next-step-card', 'next-step workflow card');
requireIncludes('v2-next-flow', 'next-step workflow list');
requireIncludes('data-action="scroll-bid-plan"', 'bid-plan scroll action');
requireIncludes('data-action="scroll-essential-docs"', 'essential-documents scroll action');
requireIncludes('v2-analysis-next', 'post-analysis next-step panel');
requireIncludes("const target = $('v2BidPlanCard') || $('v2BiddingSummaryCard') || $('analysisCard');", 'bid-plan scroll should target cards, not workflow tabs');
requireIncludes("const target = $('v2EssentialDocumentsCard') || $('analysisCard');", 'essential-documents scroll should target cards, not workflow tabs');
if (core.includes('document.querySelector(\'[data-workflow-step="bid"]\')') || core.includes('document.querySelector(\'[data-workflow-step="risk"]\')')) {
  fail('post-analysis scroll buttons should not target workflow tab buttons.');
}

requireStyleIncludes('.v2-next-step-card {\n  border-left: 4px solid var(--accent);', 'next-step card visual anchor');
requireStyleIncludes('.v2-next-flow {\n  list-style: none;\n  display: grid;\n  grid-template-columns: repeat(4,minmax(0,1fr));', 'desktop next-step flow grid');
requireStyleIncludes('.v2-analysis-next {\n  margin-top: 14px;', 'post-analysis next panel styling');
requireStyleIncludes('body .v2-next-flow {\n    grid-template-columns: repeat(2,minmax(0,1fr));', 'mobile next-step flow grid');
requireStyleIncludes('body .v2-analysis-next {\n    margin-top: 10px;', 'mobile post-analysis panel spacing');

if (!style.includes('html, body { margin: 0; padding: 0; max-width: 100%; overflow-x: hidden; }')) {
  fail('page should prevent body-level horizontal overflow.');
}

if (!style.includes('.container { width: 100%; max-width: 1040px; margin: 0 auto; padding: 0 24px; }')) {
  fail('global containers should have an explicit responsive width.');
}

if (!/max-width:\s*100%;\s*overflow-x:\s*hidden;/.test(style)) {
  fail('footer should not create horizontal overflow.');
}

console.log('Home layout guard passed.');
