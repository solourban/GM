const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HELPER_PATH = path.join(ROOT, 'public', 'app-v2-property-types.js');
const helperSource = fs.readFileSync(HELPER_PATH, 'utf8');
const dateSource = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-date.js'), 'utf8');
const bulkSource = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-bulk-tab.js'), 'utf8');
const savedSource = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-saved-tab.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');

function fail(message) {
  console.error(`Property type filter regression failed: ${message}`);
  process.exit(1);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) fail(`${message}. Expected ${expected}, received ${actual}.`);
}

function requireIncludes(content, needle, message) {
  if (!content.includes(needle)) fail(`${message} is missing.`);
}

const context = {
  window: {},
  document: {
    getElementById: () => null,
    createElement: () => ({}),
    head: { appendChild: () => {} },
  },
};
vm.runInNewContext(helperSource, context, { filename: HELPER_PATH });
const api = context.window.__auctionPropertyTypes;
if (!api) fail('shared property type API was not exposed.');

[
  ['아파트', 'apartment'],
  ['다세대주택', 'villa'],
  ['연립주택', 'villa'],
  ['오피스텔(업무시설)', 'officetel'],
  ['단독주택', 'detached'],
  ['다가구주택', 'detached'],
  ['근린생활시설', 'commercial'],
  ['상가', 'commercial'],
  ['임야', 'land'],
  ['답', 'land'],
  ['공장 및 창고', 'industrial'],
  ['자동차', 'other'],
].forEach(([usage, expected]) => assertEqual(api.classify(usage), expected, `${usage} classification`));

assertEqual(api.classify({ useType: '빌라' }), 'villa', 'legacy saved candidate useType classification');
assertEqual(api.classify({ raw: { basic: { 물건종별: '공장' } } }), 'industrial', 'bulk row classification');
assertEqual(api.filter([{ usage: '아파트' }, { usage: '토지' }], 'land').length, 1, 'land filter result count');
assertEqual(api.filter([{ usage: '아파트' }, { usage: '토지' }], 'invalid').length, 2, 'invalid filter fallback');

const rendered = api.render([{ usage: '아파트' }, { usage: '빌라' }], 'villa', 'data-test-filter');
requireIncludes(rendered, 'data-test-filter="villa"', 'filter button attribute');
requireIncludes(rendered, 'aria-pressed="true"', 'active filter accessibility state');
requireIncludes(rendered, '입찰 적합 여부를 판단하지 않습니다', 'filter reference-only copy');

requireIncludes(dateSource, "propertyTypes()?.filter(state.items, state.propertyType)", 'date candidate filtering');
requireIncludes(dateSource, 'data-date-property-type', 'date filter controls');
requireIncludes(dateSource, 'v2-form v2-date-search-form', 'responsive date search form');
requireIncludes(bulkSource, "propertyTypes().matches(row, state.propertyType)", 'bulk row filtering');
requireIncludes(bulkSource, 'data-bulk-property-type', 'bulk filter controls');
requireIncludes(savedSource, "propertyTypes()?.filter(items, selectedPropertyType)", 'saved candidate filtering');
requireIncludes(savedSource, 'data-saved-property-type', 'saved filter controls');

const helperIndex = indexSource.indexOf('/app-v2-property-types.js');
const dateIndex = indexSource.indexOf('/app-v2-date.js');
if (helperIndex === -1 || dateIndex === -1 || helperIndex > dateIndex) {
  fail('property type helper must load before date and candidate screens.');
}

console.log('Property type filter regression passed.');
