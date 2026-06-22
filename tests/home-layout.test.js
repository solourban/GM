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

function requireNotIncludes(source, needle, label) {
  if (source.includes(needle)) fail(`${label} should not be present.`);
}

if (/\.hero\s*\{\s*min-height:660px/.test(core)) {
  fail('desktop hero must not keep the old 660px empty first-screen height.');
}

if (/max-width:900px[\s\S]*\.hero\{min-height:560px/.test(core)) {
  fail('tablet hero must not keep the old 560px empty first-screen height.');
}

requireIncludes('.hero { min-height:auto; padding:32px 0 28px; display:flex; align-items:flex-start; background:linear-gradient(180deg,#074332 0%,#053525 100%); max-width:100%; overflow:hidden; }', 'compact desktop hero sizing');
requireIncludes('#v2HomePanels { width:100%; min-width:0; max-width:100%; min-height:0; }', 'home panel should not reserve extra empty height');
requireIncludes('.results-section:empty { min-height:0; padding-top:0; padding-bottom:0; }', 'empty search results should collapse');
requireIncludes('.hero{min-height:auto; padding:24px 0 24px;}', 'compact tablet hero sizing');
requireIncludes('.v2-panel { display:none; width:100%; min-width:0; max-width:var(--v2-card-width); margin:0 auto; }', 'home panels should shrink inside the viewport');
requireIncludes('.v2-card, .v2-result-card { width:100%; min-width:0; max-width:100%; background:#fff; color:var(--ink); border:1px solid rgba(229,228,222,.96); border-radius:18px; padding:20px; box-shadow:0 16px 38px rgba(11,15,20,.09); overflow-wrap:anywhere; }', 'cards should wrap long values instead of overflowing');
requireIncludes('.v2-card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; }', 'home cards should have a designed title row');
requireIncludes('.v2-eyebrow { display:inline-flex;', 'home cards should expose compact step labels');
requireIncludes("['onbid', '온비드 공매'],", 'core header tabs should include Onbid directly');
requireIncludes('function firstValue(source, keys, fallback = \'\')', 'case overview should normalize alternate source labels');
requireIncludes('function caseMetric(label, value)', 'case overview should render key metrics');
requireIncludes('function caseChip(value)', 'case overview should render compact chips');
requireIncludes('function openStep2(options = {})', 'core should expose one action that opens Step 2');
requireIncludes("window.__auctionWorkflowShell.moveTo('input')", 'Step 2 open action should sync the workflow shell');
requireIncludes('openStep2, closeStep2, tabResultsRoot', 'public v2 API should expose Step 2 controls');
requireIncludes('<section class="v2-result-card v2-case-overview-card">', 'case overview result card');
requireIncludes('<div class="v2-case-hero">', 'case overview hero band');
requireIncludes('class="v2-grid v2-case-detail-grid"', 'case overview detail grid should preserve full basic fields');
requireIncludes('${caseMetric(\'최저매각가격\', minPrice)}', 'case overview should highlight minimum bid');
requireIncludes('${caseMetric(\'매각기일\', saleDate)}', 'case overview should highlight sale date');
requireIncludes('.v2-form { width:100%; min-width:0; display:grid;', 'forms should not force wider than the card');
requireIncludes('.v2-field input, .v2-field select { width:100%; min-width:0; max-width:100%;', 'inputs should shrink within mobile cards');
requireIncludes('.v2-btn, .v2-secondary-btn, .v2-small-btn, .v2-danger-btn { min-width:0; max-width:100%; min-height:42px; border-radius:11px; padding:0 16px; font-weight:900; cursor:pointer; border:1px solid var(--line); white-space:normal; line-height:1.25; text-align:center; }', 'buttons should allow responsive wrapping');
requireIncludes('.v2-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:100%;min-width:0;max-width:100%;gap:5px;align-items:stretch;overflow:visible;padding:3px}', 'mobile tabs should keep all five tabs visible without horizontal scrolling');
if (core.includes('.header-inner{width:100%;gap:9px;padding:0 14px;max-width:100%;min-width:0;overflow:hidden}')) {
  fail('mobile header must not hide overflowing tabs by clipping them.');
}

requireIncludes('.site-header { position: sticky; top: 0; z-index: 100; background: rgba(250,249,245,.98); backdrop-filter: blur(14px); border-bottom:1px solid rgba(209,207,197,.74); box-shadow:0 10px 28px rgba(11,15,20,.05); max-width:100%; overflow:visible; }', 'site header should feel designed and avoid clipping');
requireIncludes('.header-inner{width:100%;gap:8px;padding:0 12px;max-width:100%;min-width:0;overflow:visible;align-items:stretch}', 'mobile header should let tab rows fit instead of clipping');
requireIncludes('.v2-tab{width:100%;min-width:0;max-width:100%;min-height:34px;padding:7px 5px;font-size:11.5px;line-height:1.2;text-align:center;white-space:normal;display:flex;align-items:center;justify-content:center}', 'mobile tabs should stay compact while showing every label');
if (!style.includes('body .v2-tabs {\n    display: grid;\n    grid-template-columns: repeat(3,minmax(0,1fr));')) {
  fail('mobile visual override should keep all header tabs visible in a compact grid.');
}

if (!style.includes('body .v2-tab {\n    min-height: 34px;')) {
  fail('mobile visual override should reduce tab height.');
}

if (!style.includes('body .hero {\n    padding: 14px 0 18px;\n    align-items: flex-start;')) {
  fail('mobile visual override should reduce the green input area weight.');
}

if (!style.includes('.hero-copy { display: none; }')) {
  fail('static CSS should hide the pre-boot marketing hero copy.');
}

if (!style.includes('body .v2-card,\n  body .v2-result-card {\n    border-radius: 16px;\n    padding: 16px;')) {
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

requireIncludes('function hasManualInput() {', 'manual input evidence helper');
requireIncludes("return hasManualInput();", 'analysis gate should ignore default select-only values');
requireIncludes("${info('물건 수', `${objects.length || 1}개`)}", 'case overview should absorb object count');
requireIncludes("${info('이해관계인', `${interested.length}명`)}", 'case overview should absorb interested-party count');
requireIncludes("${info('임차인', `${tenants.length}명`)}", 'case overview should absorb tenant count');
requireNotIncludes(core, '<h3>현황 요약</h3>', 'duplicate status summary card');
requireNotIncludes(core, 'function renderNextStep()', 'duplicate next-step card renderer');
requireNotIncludes(core, 'v2-next-step-card', 'duplicate next-step workflow card');
requireNotIncludes(core, 'v2-next-flow', 'duplicate next-step workflow list');
requireIncludes('data-action="scroll-bid-plan"', 'bid-plan scroll action');
requireIncludes('data-action="scroll-essential-docs"', 'essential-documents scroll action');
requireIncludes('v2-analysis-next', 'post-analysis next-step panel');
requireIncludes("const target = $('v2BidPlanCard') || $('v2BiddingSummaryCard') || $('analysisCard');", 'bid-plan scroll should target cards, not workflow tabs');
requireIncludes("const target = $('v2EssentialDocumentsCard') || $('analysisCard');", 'essential-documents scroll should target cards, not workflow tabs');
if (core.includes('document.querySelector(\'[data-workflow-step="bid"]\')') || core.includes('document.querySelector(\'[data-workflow-step="risk"]\')')) {
  fail('post-analysis scroll buttons should not target workflow tab buttons.');
}

requireStyleIncludes('.v2-case-overview-card {\n  padding: 0;\n  overflow: hidden;', 'case overview card should use an edge-to-edge hero band');
requireStyleIncludes('.v2-case-metrics {\n  display: grid;\n  grid-template-columns: repeat(4,minmax(0,1fr));', 'desktop case overview metric grid');
requireStyleIncludes('body .v2-case-metrics {\n    grid-template-columns: repeat(2,minmax(0,1fr));', 'mobile case overview metric grid');
requireNotIncludes(style, '.v2-next-step-card', 'unused next-step card CSS');
requireNotIncludes(style, '.v2-next-flow', 'unused next-step flow CSS');
requireStyleIncludes('.v2-analysis-next {\n  margin-top: 14px;', 'post-analysis next panel styling');
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
