const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CASE_RESET_PATH = path.join(ROOT, 'public', 'app-v2-case-reset.js');
const content = fs.readFileSync(CASE_RESET_PATH, 'utf8').replace(/\r\n?/g, '\n');
const molit = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-molit-trades.js'), 'utf8').replace(/\r\n?/g, '\n');

function fail(message) {
  console.error(`Case reset safety guard failed: ${message}`);
  process.exit(1);
}

function requireIncludes(needle, label) {
  if (!content.includes(needle)) fail(`${label} is missing.`);
}

function requirePattern(pattern, label) {
  if (!pattern.test(content)) fail(`${label} is missing.`);
}

const requiredSessionKeys = [
  'auction-note:v2:active-case-key',
  'auction-note:v2:location-geocode',
  'auction-note:v2:molit-trades',
  'auction-note:v2:final-judgment',
  'auction-note:v2:spec-extraction:',
];
const preservedResetSessionKeys = [
  'auction-note:v2:location-geocode',
  'auction-note:v2:molit-trades',
];
const preservedResetCardIds = [
  'v2LocationCard',
  'v2MolitTradeCard',
];

const requiredCardIds = [
  'v2LocationCard',
  'v2MolitTradeCard',
  'v2FinalJudgmentCard',
  'v2DecisionConfidenceCard',
  'v2FinalCopyCard',
  'v2BiddingSummaryCard',
  'v2BidRangeCard',
  'v2FundingReviewCard',
  'v2PreBidChecklistCard',
  'v2RiskBriefCard',
  'v2CopySummaryCard',
  'v2BidPlanCard',
  'v2AllocationCard',
];

requiredSessionKeys.forEach((key) => requireIncludes(key, `session key ${key}`));
requiredCardIds.forEach((id) => requireIncludes(`'${id}'`, `card cleanup target ${id}`));

requireIncludes('const TRANSIENT_SESSION_KEYS = [', 'transient session key list');
requireIncludes('const ANALYSIS_SESSION_KEYS = [', 'analysis-only session key list');
requireIncludes('const TRANSIENT_CARD_IDS = [', 'transient card id list');
requireIncludes('const ANALYSIS_CARD_IDS = [', 'analysis-only card id list');
requireIncludes("const BID_PLAN_STORAGE_PREFIX = 'auction-note:v2.2:bid-plan:'", 'bid plan storage prefix');
requireIncludes("const SPEC_DRAFT_STORAGE_PREFIX = 'auction-note:v2:spec-extraction:'", 'spec draft storage prefix');
requireIncludes('function currentCaseBidPlanKeys(identity)', 'current case bid plan key candidates');
requireIncludes('function currentCaseKey(identity = currentCaseIdentity())', 'currentCaseKey function');
requireIncludes('function identityFromSearchForm()', 'form-based identity function');
requireIncludes('function resetCaseRuntimeState(s)', 'resetCaseRuntimeState function');
requireIncludes('function clearTransientCaseData()', 'clearTransientCaseData function');
requireIncludes('function clearAnalysisDerivedData()', 'clearAnalysisDerivedData function');
requireIncludes('function removeCurrentSpecDraft(identity)', 'current spec draft cleanup function');
requireIncludes('TRANSIENT_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key))', 'transient session cleanup loop');
requireIncludes('ANALYSIS_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key))', 'analysis session cleanup loop');
requireIncludes('TRANSIENT_CARD_IDS.forEach((id) => document.getElementById(id)?.remove())', 'transient card cleanup loop');
requireIncludes('ANALYSIS_CARD_IDS.forEach((id) => document.getElementById(id)?.remove())', 'analysis card cleanup loop');
requireIncludes('function syncActiveCaseSession(identity)', 'syncActiveCaseSession function');
requireIncludes('sessionStorage.getItem(ACTIVE_CASE_SESSION_KEY)', 'previous active case lookup');
requireIncludes('sessionStorage.setItem(ACTIVE_CASE_SESSION_KEY, identity.key)', 'active case key sync');
requireIncludes('if (previous && previous !== identity.key) clearTransientCaseData();', 'transient cleanup on active case mismatch');
requireIncludes('clearTransientCaseData();\n    syncActiveCaseSession(identity);', 'transient cleanup before applying saved case state');
requireIncludes('function resetCurrentCaseState()', 'current case reset function');
requireIncludes('removeCurrentCaseStorage(identity);', 'current case storage reset');
requireIncludes('removeCurrentSpecDraft(identity);', 'current case spec draft reset');
requireIncludes('resetCaseRuntimeState(s);', 'runtime state reset call');
requireIncludes('resetCaseRuntimeState(s);\n    clearAnalysisDerivedData();', 'analysis-only reset cleanup');
requireIncludes('localStorage.removeItem(key);', 'case storage removal');
requireIncludes('sessionStorage.removeItem(`${SPEC_DRAFT_STORAGE_PREFIX}${caseKey}`)', 'current spec draft session removal');
requireIncludes('window.__auctionSpecExtractor?.clearDraft?.(caseKey);', 'loaded spec extractor draft reset');
requireIncludes('currentCaseBidPlanKeys(identity).forEach((bidKey) => localStorage.removeItem(bidKey))', 'bid plan storage removal');
requireIncludes('event.preventDefault();\n    event.stopPropagation();\n    resetCurrentCaseState();', 'single reset click handling');
requireIncludes('저장 후보·외부검증 메모·실거래가 결과는 유지합니다.', 'reset preservation copy');
requireIncludes('if (notice.dataset.caseResetSignature === identity.key) return;', 'stable Step 2 reset button');
requireIncludes('function prepareForSearchCase()', 'pre-fetch case preparation function');
requireIncludes("event.target.closest('#btnFetchV2')", 'fetch button pre-clear hook');
requireIncludes('window.__auctionCaseScope = {', 'case scope public bridge');
requireIncludes('setInterval(() => {\n    syncCurrentCase();\n    renderCaseScopeNotice();\n  }, 250)', 'case switch watcher interval');
requirePattern(/if \(s\.__coreCaseResetActiveKey === identity\.key\) return false;/, 'same-case no-op guard');
requirePattern(/s\.__coreCaseResetActiveKey = identity\.key;\s*applyCaseState\(identity\);/s, 'case switch apply flow');

const analysisSessionBlock = content.match(/const ANALYSIS_SESSION_KEYS = \[(.*?)\];/s)?.[1] || '';
preservedResetSessionKeys.forEach((key) => {
  if (analysisSessionBlock.includes(key)) fail(`preserved reset session key ${key} must not be cleared by reset.`);
});
const analysisCardBlock = content.match(/const ANALYSIS_CARD_IDS = \[(.*?)\];/s)?.[1] || '';
preservedResetCardIds.forEach((id) => {
  if (analysisCardBlock.includes(id)) fail(`preserved reset card ${id} must not be cleared by reset.`);
});
const resetFunctionBlock = content.match(/function resetCurrentCaseState\(\) \{(.*?)\n  \}\n\n  function prepareForSearchCase/s)?.[1] || '';
if (resetFunctionBlock.includes('clearTransientCaseData()')) {
  fail('reset must not clear location or MOLIT transient caches.');
}
if (content.includes('auction-note:v2:external-verification:')) fail('reset must not reference external verification storage.');
if (content.includes('auction-note:v2:saved-candidates')) fail('reset must not reference saved candidate storage.');
if (!molit.includes('function loadCachedTradeResult(location)')) fail('MOLIT cache restore helper is missing.');
if (!molit.includes('const cached = loadCachedTradeResult(location);')) fail('MOLIT card does not restore preserved cache.');

console.log('Case reset safety guard passed.');
