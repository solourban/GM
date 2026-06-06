const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const front = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-onbid-entry.js'), 'utf8');
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
requireIncludes(front, 'root.innerHTML = renderResultsArea()', 'Onbid result root write');
requireIncludes(layout, 'v2OnbidResultCard', 'tab layout guard must cover Onbid result card');

const panelStart = front.indexOf('function renderPanel()');
const panelEnd = front.indexOf('function syncTab()', panelStart);
if (panelStart === -1 || panelEnd === -1) fail('Cannot locate Onbid renderPanel section.');
const panel = front.slice(panelStart, panelEnd);

if (panel.includes('v2OnbidResultArea') || panel.includes('renderResults()') || panel.includes('renderDetail()')) {
  fail('Onbid result area must not be rendered inside the green input card.');
}

console.log('Onbid result layout guard passed.');
