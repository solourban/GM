const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const UI_PATH = path.join(ROOT, 'public', 'app-v2-spec-extractor.js');
const CORE_PATH = path.join(ROOT, 'public', 'app-v2-core.js');
const PERSIST_PATH = path.join(ROOT, 'public', 'app-v2-persist.js');
const CASE_RESET_PATH = path.join(ROOT, 'public', 'app-v2-case-reset.js');
const INDEX_PATH = path.join(ROOT, 'public', 'index.html');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const source = fs.readFileSync(UI_PATH, 'utf8');
const core = fs.readFileSync(CORE_PATH, 'utf8');
const persist = fs.readFileSync(PERSIST_PATH, 'utf8');
const caseReset = fs.readFileSync(CASE_RESET_PATH, 'utf8');
const index = fs.readFileSync(INDEX_PATH, 'utf8');
const pkg = fs.readFileSync(PACKAGE_PATH, 'utf8');

function fail(message) {
  console.error(`Specification extractor apply UI failed: ${message}`);
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

function defaultManual() {
  return {
    malso: { date: '', type: '근저당권', holder: '', amount: '' },
    tenants: [{ name: '', moveIn: '', fixed: '', deposit: '' }],
    specials: [],
    specReview: { occupants: [], specialRights: [], takeoverNotes: [] },
  };
}

let caseKey = 'case-a';
const appState = { manual: defaultManual(), report: { keep: true } };
const sessionStorage = new MemoryStorage();
const document = {
  addEventListener: () => {},
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  head: { appendChild: () => {} },
};
const window = {
  __auctionV2: { state: appState, renderResults: () => { appState.rendered = true; } },
  __auctionCaseScope: { currentCaseKey: () => caseKey },
  __auctionSpecParser: { parse: () => ({ rawHash: 'parser-result', candidates: {}, warnings: [], stats: {} }) },
  clearTimeout: () => {},
  setTimeout: (callback) => {
    if (typeof callback === 'function') callback();
    return 1;
  },
};
const context = {
  window,
  document,
  sessionStorage,
  MutationObserver: function MutationObserver() {},
  CSS: { escape: (value) => String(value).replace(/"/g, '\\"') },
};
vm.runInNewContext(source, context, { filename: UI_PATH });
const api = window.__auctionSpecExtractor;

assert(api, 'apply UI bridge was not exposed');
assertEqual(api.storageKey(), 'auction-note:v2:spec-extraction:case-a', 'current case draft storage key');

const draftA = {
  rawText: '임차인: 김OO',
  result: { rawHash: 'a', candidates: {}, warnings: [], stats: {} },
  selected: { 'occupant-1': true },
  replace: {},
};
assert(api.saveDraft(draftA, 'case-a'), 'case A draft save');
caseKey = 'case-b';
assertEqual(api.loadDraft().rawText, '', 'case B must not see case A draft');
assertEqual(api.loadDraft('case-a').rawText, draftA.rawText, 'case A draft restore');
assertEqual(api.loadDraft('case-a').selected['occupant-1'], true, 'case A candidate selection restore');
assert(appState.report.keep, 'draft operations must not replace analysis result');
assert(!api.saveDraft({ rawText: '가'.repeat(100001), result: null }, 'too-long'), 'oversized source must not be stored');
assertEqual(api.loadDraft('too-long').rawText, '', 'oversized source storage must remain empty');

for (let indexValue = 0; indexValue < 12; indexValue += 1) {
  api.saveDraft({ rawText: `draft-${indexValue}`, result: null }, `case-${indexValue}`);
}
assertEqual(sessionStorage.length, api.MAX_DRAFTS, 'session draft limit');

const result = {
  candidates: {
    occupants: [{
      id: 'occ-1',
      values: {
        tenantName: '김OO',
        occupantName: '박OO',
        moveIn: '2022-02-25',
        fixed: '2022-02-03',
        claimDate: '2024-05-01',
        deposit: 267000000,
        rent: 500000,
        occupiedPart: '전부',
      },
      confidence: { tenantName: 'explicit' },
      evidence: [{ text: '임차인: 김OO | 점유자: 박OO' }],
      issues: [],
    }],
    specialRights: [{
      id: 'sp-1',
      typeCandidate: '유치권',
      holder: '공사업체OO',
      date: '2024-01-10',
      amount: 30000000,
      phrase: '유치권 신고 있음',
      evidence: [{ text: '유치권 신고 있음' }],
      issues: [],
    }],
    takeoverPhrases: [{
      id: 'take-1',
      kind: 'possible_takeover',
      phrase: '매수인이 인수할 수 있음',
      evidence: [{ text: '매수인이 인수할 수 있음' }],
    }],
  },
  warnings: [],
  stats: {},
};

appState.manual = defaultManual();
let summary = api.applyCandidates({ result, selectedIds: [], render: false });
assertEqual(summary.selected, 0, 'unselected candidates must not apply');
assertEqual(appState.manual.tenants[0].name, '', 'unselected occupant must not mutate tenant');
assertEqual(appState.manual.specReview.occupants.length, 0, 'unselected occupant must not create specReview');

summary = api.applyCandidates({ result, selectedIds: ['occ-1'], render: false });
assertEqual(summary.selected, 1, 'selected occupant count');
assertEqual(appState.manual.tenants[0].name, '김OO', 'selected tenant name applies');
assertEqual(appState.manual.tenants[0].moveIn, '2022-02-25', 'selected move-in applies');
assertEqual(appState.manual.tenants[0].deposit, '267,000,000', 'selected deposit is formatted for Step 2');
assertEqual(appState.manual.specReview.occupants.length, 1, 'occupant reference review stored');
assertEqual(appState.manual.specReview.occupants[0].occupantName, '박OO', 'occupantName stays in specReview');
assertEqual(appState.manual.specReview.occupants[0].claimDate, '2024-05-01', 'claimDate stays in specReview');
assertEqual(appState.manual.specReview.occupants[0].rent, '500,000', 'rent stays in specReview');
assert(appState.report.keep, 'candidate application must not clear existing analysis report');

appState.manual = defaultManual();
appState.manual.tenants = [{ name: '김OO', moveIn: '2020-01-01', fixed: '', deposit: '100,000' }];
summary = api.applyCandidates({ result, selectedIds: ['occ-1'], render: false });
assertEqual(summary.conflictsKept, 1, 'same-name conflicting tenant must be kept by default');
assertEqual(appState.manual.tenants[0].moveIn, '2020-01-01', 'conflict keeps existing move-in');
assertEqual(appState.manual.tenants[0].deposit, '100,000', 'conflict keeps existing deposit');
assertEqual(appState.manual.specReview.occupants.length, 1, 'conflict still stores review-only reference');

summary = api.applyCandidates({ result, selectedIds: ['occ-1'], replaceIds: ['occ-1'], render: false });
assertEqual(summary.tenantsUpdated, 1, 'explicit replace updates conflicting tenant');
assertEqual(appState.manual.tenants[0].moveIn, '2022-02-25', 'replace updates move-in');
assertEqual(appState.manual.tenants[0].deposit, '267,000,000', 'replace updates deposit');

appState.manual = defaultManual();
summary = api.applyCandidates({ result, selectedIds: ['sp-1', 'take-1'], render: false });
assertEqual(summary.specialsAdded, 1, 'allowed special right applies to manual.specials');
assertEqual(appState.manual.specials[0].type, '유치권', 'special type applies');
assertEqual(appState.manual.specials[0].amount, '30,000,000', 'special amount is formatted for Step 2');
assertEqual(appState.manual.specReview.specialRights.length, 1, 'special phrase is stored as review reference');
assertEqual(appState.manual.specReview.takeoverNotes.length, 1, 'takeover phrase is review-only');
assertEqual(appState.manual.tenants[0].name, '', 'takeover phrase must not create tenants');

const unallowedSpecial = {
  candidates: {
    occupants: [],
    specialRights: [{ id: 'sp-x', typeCandidate: '미확정권리', holder: 'OO', date: '2024-01-01', amount: 1, phrase: '확인 필요' }],
    takeoverPhrases: [],
  },
  warnings: [],
  stats: {},
};
appState.manual = defaultManual();
summary = api.applyCandidates({ result: unallowedSpecial, selectedIds: ['sp-x'], render: false });
assertEqual(summary.specialsAdded, 0, 'unallowed special type must not enter manual.specials');
assertEqual(appState.manual.specials.length, 0, 'manual.specials remains empty for unallowed type');
assertEqual(appState.manual.specReview.specialRights.length, 1, 'unallowed special remains review reference');

const reviewHtml = api.renderReview({
  candidates: {
    occupants: [{
      id: 'html-1',
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
  ['data-manual-path', 'core Step 2 input path mutation'],
].forEach(([needle, label]) => assert(!source.includes(needle), `${label} must not exist in spec extractor UI`));

assert(source.includes('sessionStorage.setItem'), 'session-only draft save is missing');
assert(source.includes('window.__auctionCaseScope?.currentCaseKey?.()'), 'current case scope lookup is missing');
assert(source.includes('mount.dataset.specSignature = draftSignature()'), 'typing-time mount stability guard is missing');
assert(source.includes('document.activeElement?.id === SOURCE_ID'), 'focused source replacement guard is missing');
assert(source.includes('data-spec-action="extract"'), 'candidate extraction control is missing');
assert(source.includes('data-spec-action="apply"'), 'candidate apply control is missing');
assert(source.includes('data-spec-select'), 'candidate selection checkbox is missing');
assert(source.includes('data-spec-replace'), 'explicit conflict replacement control is missing');
assert(source.includes('기본값은 기존 입력 유지입니다'), 'conflict-safe default copy is missing');
assert(source.includes('manual.specReview'), 'review-only manual storage is missing');
assert(source.includes('선택 후보 Step 2 반영'), 'confirmation apply action is missing');
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
assert(core.includes('function manualForAnalyze()'), 'analyze-safe manual projection is missing');
assert(core.includes("body: JSON.stringify({ raw: state.raw, manual: manualForAnalyze(), region:'other' })"), 'analyze request must exclude specReview');
assert(persist.includes('specReview: safeSpecReview(src?.specReview)'), 'persist restore must include specReview');
assert(persist.includes('safe.specReview.occupants.length'), 'persist useful-data guard must include specReview');
assert(caseReset.includes("const SPEC_DRAFT_STORAGE_PREFIX = 'auction-note:v2:spec-extraction:'"), 'case reset must know spec draft namespace');
assert(caseReset.includes('removeCurrentSpecDraft(identity);'), 'current case reset must clear current spec draft');
assert(caseReset.includes('specReview: safeSpecReview(src.specReview)'), 'case reset restore must preserve saved specReview');
assert(index.includes('<script src="/app-v2-spec-extractor.js"></script>'), 'review UI script load tag is missing');
assert(pkg.includes('node --check public/app-v2-spec-extractor.js'), 'review UI syntax check is missing');
assert(pkg.includes('node tests/spec-extractor-regression.test.js'), 'review UI regression command is missing');

console.log('Specification extractor apply UI passed.');
