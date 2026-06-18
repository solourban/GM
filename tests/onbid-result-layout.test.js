const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const front = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-onbid-entry.js'), 'utf8');
const style = fs.readFileSync(path.join(ROOT, 'public', 'style.css'), 'utf8');
const layout = fs.readFileSync(path.join(ROOT, 'tests', 'tab-results-layout.test.js'), 'utf8');

function fail(message) {
  console.error(`Onbid result layout guard failed: ${message}`);
  process.exit(1);
}

function requireIncludes(source, needle, label) {
  if (!source.includes(needle)) fail(`${label} is missing.`);
}

requireIncludes(front, 'function resultRoot()', 'shared tab result root helper');
requireIncludes(front, 'function renderResultsArea()', 'below-hero onbid result renderer');
requireIncludes(front, 'id="v2OnbidResultCard"', 'Onbid result card id');
requireIncludes(front, 'id="v2OnbidResultArea"', 'Onbid result area id');
requireIncludes(front, 'function renderMobileItems(items)', 'Onbid mobile result card renderer');
requireIncludes(front, 'id="v2OnbidMobileCards"', 'Onbid mobile result card list');
requireIncludes(front, 'v2-onbid-table-wrap', 'Onbid desktop table wrapper');
requireIncludes(front, 'root.innerHTML = renderResultsArea()', 'Onbid result root write');
requireIncludes(front, 'function statusLabel(value)', 'Onbid status code label helper');
requireIncludes(front, 'function formatArea(detail = {})', 'Onbid area formatting helper');
requireIncludes(front, 'data-onbid-action="copy"', 'Onbid cltr number copy action');
requireIncludes(front, 'v2-row-actions', 'Onbid desktop row action grouping');
requireIncludes(front, 'data-onbid-action="sample-search"', 'Onbid sample search button');
requireIncludes(front, 'data-onbid-action="clear-filters"', 'Onbid clear filters button');
requireIncludes(front, 'class="v2-onbid-head"', 'Onbid compact header block');
requireIncludes(front, 'class="v2-onbid-status"', 'Onbid compact status strip');
requireIncludes(front, 'class="v2-step-section v2-onbid-search"', 'Onbid compact search section');
requireIncludes(front, 'renderUpstreamDiagnostic(onbidState.upstream)', 'Onbid error diagnostic display');
requireIncludes(front, 'renderDiagnosticNote(onbidState.diagnostic)', 'Onbid success/empty diagnostic display');
requireIncludes(layout, 'v2OnbidResultCard', 'tab layout guard must cover Onbid result card');
requireIncludes(style, '.v2-onbid-status {', 'Onbid status strip styles');
requireIncludes(style, 'body .v2-onbid-status {', 'Onbid mobile status strip styles');
requireIncludes(style, '.v2-onbid-head .v2-badge {', 'Onbid badge should not stretch across the card');
requireIncludes(style, 'body .v2-onbid-search .v2-input-grid {', 'Onbid mobile search grid should be compact');
requireIncludes(style, 'body .v2-onbid-search .v2-field:nth-child(3) {', 'Onbid keyword field should keep a full-width row');

const panelStart = front.indexOf('function renderPanel()');
const panelEnd = front.indexOf('function syncTab()', panelStart);
if (panelStart === -1 || panelEnd === -1) fail('Cannot locate Onbid renderPanel section.');
const panel = front.slice(panelStart, panelEnd);

if (panel.includes('v2OnbidResultArea') || panel.includes('renderResults()') || panel.includes('renderDetail()')) {
  fail('Onbid result area must not be rendered inside the green input card.');
}

if (panel.includes('v2.1.8.x') || panel.includes('현재 단계')) {
  fail('Onbid input panel should not spend first-screen space on release-stage copy.');
}

console.log('Onbid result layout guard passed.');
