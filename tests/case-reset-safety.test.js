const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CASE_RESET_PATH = path.join(ROOT, 'public', 'app-v2-case-reset.js');
const content = fs.readFileSync(CASE_RESET_PATH, 'utf8').replace(/\r\n?/g, '\n');

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
requireIncludes('const TRANSIENT_CARD_IDS = [', 'transient card id list');
requireIncludes("const BID_PLAN_STORAGE_PREFIX = 'auction-note:v2.2:bid-plan:'", 'bid plan storage prefix');
requireIncludes('function currentCaseKey(identity = currentCaseIdentity())', 'currentCaseKey function');
requireIncludes('function identityFromSearchForm()', 'form-based identity function');
requireIncludes('function resetCaseRuntimeState(s)', 'resetCaseRuntimeState function');
requireIncludes('function clearTransientCaseData()', 'clearTransientCaseData function');
requireIncludes('TRANSIENT_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key))', 'transient session cleanup loop');
requireIncludes('TRANSIENT_CARD_IDS.forEach((id) => document.getElementById(id)?.remove())', 'transient card cleanup loop');
requireIncludes('function syncActiveCaseSession(identity)', 'syncActiveCaseSession function');
requireIncludes('sessionStorage.getItem(ACTIVE_CASE_SESSION_KEY)', 'previous active case lookup');
requireIncludes('sessionStorage.setItem(ACTIVE_CASE_SESSION_KEY, identity.key)', 'active case key sync');
requireIncludes('if (previous && previous !== identity.key) clearTransientCaseData();', 'transient cleanup on active case mismatch');
requireIncludes('clearTransientCaseData();\n    syncActiveCaseSession(identity);', 'transient cleanup before applying saved case state');
requireIncludes('function resetCurrentCaseState()', 'current case reset function');
requireIncludes('removeCurrentCaseStorage(identity);', 'current case storage reset');
requireIncludes('resetCaseRuntimeState(s);', 'runtime state reset call');
requireIncludes('localStorage.removeItem(key);', 'case storage removal');
requireIncludes('localStorage.removeItem(bidKey);', 'bid plan storage removal');
requireIncludes('다른 사건으로 전환하면 이전 사건 입력값은 표시하지 않습니다.', 'case scope safety copy');
requireIncludes('function prepareForSearchCase()', 'pre-fetch case preparation function');
requireIncludes("event.target.closest('#btnFetchV2')", 'fetch button pre-clear hook');
requireIncludes('window.__auctionCaseScope = {', 'case scope public bridge');
requireIncludes('setInterval(() => {\n    syncCurrentCase();\n    renderCaseScopeNotice();\n  }, 250)', 'case switch watcher interval');
requirePattern(/if \(s\.__coreCaseResetActiveKey === identity\.key\) return false;/, 'same-case no-op guard');
requirePattern(/s\.__coreCaseResetActiveKey = identity\.key;\s*applyCaseState\(identity\);/s, 'case switch apply flow');

console.log('Case reset safety guard passed.');
