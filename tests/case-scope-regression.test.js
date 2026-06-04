const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const files = {
  caseReset: fs.readFileSync(path.join(ROOT, 'public', 'app-v2-case-reset.js'), 'utf8'),
  persist: fs.readFileSync(path.join(ROOT, 'public', 'app-v2-persist.js'), 'utf8'),
  bidPlan: fs.readFileSync(path.join(ROOT, 'public', 'app-v2-bid-plan.js'), 'utf8'),
  copySummary: fs.readFileSync(path.join(ROOT, 'public', 'app-v2-copy-summary.js'), 'utf8'),
};

function fail(scenario, message) {
  console.error(`Case scope regression failed (${scenario}): ${message}`);
  process.exit(1);
}

function requireIncludes(source, needle, scenario, label) {
  if (!source.includes(needle)) fail(scenario, `${label} is missing.`);
}

const scenarioAtoB = 'case A -> case B hides prior tenants/report/summary';
requireIncludes(files.caseReset, 'currentCaseIdentity()', scenarioAtoB, 'current case identity lookup');
requireIncludes(files.caseReset, 's.__coreCaseResetActiveKey === identity.key', scenarioAtoB, 'same-case guard');
requireIncludes(files.caseReset, 'applyCaseState(identity);', scenarioAtoB, 'different-case apply flow');
requireIncludes(files.caseReset, 'resetCaseRuntimeState(s);', scenarioAtoB, 'blank state fallback');
requireIncludes(files.caseReset, 'v2CopySummaryCard', scenarioAtoB, 'copy summary cleanup');
requireIncludes(files.caseReset, 'v2BidPlanCard', scenarioAtoB, 'bid simulation cleanup');
requireIncludes(files.caseReset, 'v2BiddingSummaryCard', scenarioAtoB, 'pre-bid summary cleanup');
requireIncludes(files.caseReset, 'function prepareForSearchCase()', scenarioAtoB, 'pre-fetch case preparation');
requireIncludes(files.caseReset, "event.target.closest('#btnFetchV2')", scenarioAtoB, 'fetch button pre-clear hook');
requireIncludes(files.caseReset, 's.__persistRestoredKey = \'\';', scenarioAtoB, 'saved state restore unlock for next case');

const scenarioReturnToA = 'case A restore keeps saved values';
requireIncludes(files.caseReset, 'loadSavedCase(identity.key)', scenarioReturnToA, 'case-key saved state load');
requireIncludes(files.caseReset, 'saved?.manual ? safeManual(saved.manual) : defaultManual()', scenarioReturnToA, 'saved manual restore');
requireIncludes(files.caseReset, 's.report = saved?.report || null;', scenarioReturnToA, 'saved report restore');
requireIncludes(files.caseReset, 'specReview: safeSpecReview(src.specReview)', scenarioReturnToA, 'saved specReview restore');
requireIncludes(files.persist, 'specReview: safeSpecReview(src?.specReview)', scenarioReturnToA, 'persisted specReview save');
requireIncludes(files.persist, 'if (s.__persistActiveCaseKey && s.__persistActiveCaseKey !== identity.key) return;', scenarioReturnToA, 'cross-case save guard');
requireIncludes(files.persist, 's.__persistRestoredKey === key', scenarioReturnToA, 'same-case restore guard');

const scenarioReset = 'reset clears current case state and bid plan';
requireIncludes(files.caseReset, 'function resetCurrentCaseState()', scenarioReset, 'reset function');
requireIncludes(files.caseReset, 'removeCurrentCaseStorage(identity);', scenarioReset, 'stored case removal');
requireIncludes(files.caseReset, 'removeCurrentSpecDraft(identity);', scenarioReset, 'current spec draft removal');
requireIncludes(files.caseReset, 'clearAnalysisDerivedData();', scenarioReset, 'analysis-only derived cleanup');
requireIncludes(files.caseReset, 'localStorage.removeItem(key);', scenarioReset, 'current case localStorage removal');
requireIncludes(files.caseReset, 'currentCaseBidPlanKeys(identity).forEach((bidKey) => localStorage.removeItem(bidKey))', scenarioReset, 'bid plan localStorage removal');
requireIncludes(files.caseReset, 'data-action="reset-current-case"', scenarioReset, 'reset UI action');
requireIncludes(files.caseReset, 'event.stopPropagation();', scenarioReset, 'duplicate core render prevention');
requireIncludes(files.bidPlan, "const STORAGE_PREFIX = 'auction-note:v2.2:bid-plan:';", scenarioReset, 'bid plan storage namespace');
requireIncludes(files.copySummary, "const BID_PLAN_STORAGE_PREFIX = 'auction-note:v2.2:bid-plan:';", scenarioReset, 'copy summary bid plan namespace');

const scenarioCopy = 'case scope copy is visible to users';
requireIncludes(files.caseReset, '법원·연도·사건번호 기준으로 자동 저장됩니다', scenarioCopy, 'case-key autosave copy');
requireIncludes(files.persist, '다른 사건 입력값은 표시하지 않습니다', scenarioCopy, 'persist safety copy');

const scenarioPreserve = 'reset preserves current case reference caches and external notes';
requireIncludes(files.caseReset, "const ANALYSIS_SESSION_KEYS = [", scenarioPreserve, 'analysis-only session cleanup scope');
requireIncludes(files.caseReset, "const TRANSIENT_SESSION_KEYS = [", scenarioPreserve, 'case-switch transient cleanup scope');
requireIncludes(files.caseReset, '저장 후보·외부검증 메모·실거래가 결과는 유지합니다.', scenarioPreserve, 'preservation copy');

console.log([
  `Case scope regression passed: ${scenarioAtoB}`,
  `Case scope regression passed: ${scenarioReturnToA}`,
  `Case scope regression passed: ${scenarioReset}`,
  `Case scope regression passed: ${scenarioCopy}`,
  `Case scope regression passed: ${scenarioPreserve}`,
].join('\n'));
