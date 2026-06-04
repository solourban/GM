const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const UI_PATH = path.join(ROOT, 'public', 'app-v2-spec-extractor.js');
const CORE_PATH = path.join(ROOT, 'public', 'app-v2-core.js');
const INDEX_PATH = path.join(ROOT, 'public', 'index.html');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const source = fs.readFileSync(UI_PATH, 'utf8');
const core = fs.readFileSync(CORE_PATH, 'utf8');
const index = fs.readFileSync(INDEX_PATH, 'utf8');
const pkg = fs.readFileSync(PACKAGE_PATH, 'utf8');

function fail(message) {
  console.error(`Specification extractor review UI failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) fail(`${message}. Expected ${expected}, received ${actual}.`);
}

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  get length() {
    return this.values.size;
  }

  key(index) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }
}

let caseKey = 'case-a';
const manualSentinel = {
  malso: { date: '2020-01-01' },
  tenants: [{ name: '기존 임차인' }],
  specials: [{ type: '유치권' }],
};
const appState = { manual: manualSentinel, report: { keep: true } };
const sessionStorage = new MemoryStorage();
const document = {
  addEventListener: () => {},
  getElementById: () => null,
  head: { appendChild: () => {} },
};
const window = {
  __auctionV2: { state: appState },
  __auctionCaseScope: { currentCaseKey: () => caseKey },
  __auctionSpecParser: { parse: () => ({ rawHash: 'parser-result', candidates: {}, warnings: [], stats: {} }) },
  clearTimeout: () => {},
  setTimeout: () => 1,
};
const context = {
  window,
  document,
  sessionStorage,
  MutationObserver: function MutationObserver() {},
};
vm.runInNewContext(source, context, { filename: UI_PATH });
const api = window.__auctionSpecExtractor;

assert(api, 'review UI bridge was not exposed');
assertEqual(api.storageKey(), 'auction-note:v2:spec-extraction:case-a', 'current case draft storage key');

const draftA = { rawText: '임차인: 김OO', result: { rawHash: 'a', candidates: {}, warnings: [], stats: {} } };
assert(api.saveDraft(draftA, 'case-a'), 'case A draft save');
caseKey = 'case-b';
assertEqual(api.loadDraft().rawText, '', 'case B must not see case A draft');
assertEqual(api.loadDraft('case-a').rawText, draftA.rawText, 'case A draft restore');
assert(appState.manual === manualSentinel, 'draft operations must not replace Step 2 manual state');
assert(appState.report.keep, 'draft operations must not replace analysis result');
assert(!api.saveDraft({ rawText: '가'.repeat(100001), result: null }, 'too-long'), 'oversized source must not be stored');
assertEqual(api.loadDraft('too-long').rawText, '', 'oversized source storage must remain empty');

for (let indexValue = 0; indexValue < 12; indexValue += 1) {
  api.saveDraft({ rawText: `draft-${indexValue}`, result: null }, `case-${indexValue}`);
}
assertEqual(sessionStorage.length, api.MAX_DRAFTS, 'session draft limit');

const reviewHtml = api.renderReview({
  candidates: {
    occupants: [{
      values: { tenantName: '<script>alert(1)</script>' },
      confidence: { tenantName: 'explicit' },
      evidence: [{ text: '<img src=x onerror=alert(1)>' }],
      issues: [],
    }],
    specialRights: [],
    takeoverPhrases: [],
  },
  warnings: [],
  stats: {},
});
assert(reviewHtml.includes('&lt;script&gt;'), 'candidate value must be HTML escaped');
assert(reviewHtml.includes('&lt;img'), 'candidate evidence must be HTML escaped');
assert(!reviewHtml.includes('<script>'), 'candidate script text must not execute');
assert(!reviewHtml.includes('<img src=x'), 'candidate image text must not execute');

[
  ['fetch', 'server request'],
  ['XMLHttpRequest', 'legacy server request'],
  ['localStorage', 'persistent raw text storage'],
  ['/api/analyze', 'analysis request'],
  ['data-manual-path', 'Step 2 field mutation path'],
  ['state.manual', 'Step 2 state mutation'],
  ['manual.tenants', 'tenant mutation'],
  ['manual.specials', 'special-right mutation'],
  ['선택 항목 Step 2 반영', 'confirmation apply action'],
].forEach(([needle, label]) => assert(!source.includes(needle), `${label} must not exist in review UI`));

assert(source.includes('sessionStorage.setItem'), 'session-only draft save is missing');
assert(source.includes('window.__auctionCaseScope?.currentCaseKey?.()'), 'current case scope lookup is missing');
assert(source.includes('mount.dataset.specSignature = draftSignature()'), 'typing-time mount stability guard is missing');
assert(source.includes("document.activeElement?.id === SOURCE_ID"), 'focused source replacement guard is missing');
assert(source.includes('data-spec-action="extract"'), 'candidate extraction control is missing');
assert(source.includes('Step 2 미반영'), 'read-only review status is missing');
assert(source.includes('원문 근거'), 'candidate evidence display is missing');
assert(source.includes("draft?.rawText ?? '').length > MAX_TEXT_LENGTH"), 'oversized draft storage guard is missing');
assert(source.includes("activeDraft.rawText.length > MAX_TEXT_LENGTH ? '글자 수 초과 · 미저장'"), 'oversized draft status is missing');
assert(!source.includes(`maxlength="\${MAX_TEXT_LENGTH}"`), 'oversized source must be rejected explicitly instead of silently truncated');
assert(source.includes('grid-template-columns:minmax(0,1fr) minmax(0,1fr)'), 'desktop side-by-side review layout is missing');
assert(source.includes('@media (max-width:760px)'), 'mobile stacked review layout is missing');

const mountIndex = core.indexOf('id="v2SpecExtractorMount"');
const firstManualSection = core.indexOf('1. 최선순위 권리');
assert(mountIndex !== -1, 'stable Step 2 mount is missing');
assert(firstManualSection !== -1 && mountIndex < firstManualSection, 'review mount must be above manual Step 2 fields');
assert(index.includes('<script src="/app-v2-spec-extractor.js"></script>'), 'review UI script load tag is missing');
assert(pkg.includes('node --check public/app-v2-spec-extractor.js'), 'review UI syntax check is missing');
assert(pkg.includes('node tests/spec-extractor-regression.test.js'), 'review UI regression command is missing');

console.log('Specification extractor review UI passed.');
