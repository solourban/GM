const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CASE_RESET_PATH = path.join(ROOT, 'public', 'app-v2-case-reset.js');
const content = fs.readFileSync(CASE_RESET_PATH, 'utf8');

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
];

requiredSessionKeys.forEach((key) => requireIncludes(key, `session key ${key}`));
requiredCardIds.forEach((id) => requireIncludes(`document.getElementById('${id}')?.remove()`, `card cleanup for ${id}`));

requireIncludes('const TRANSIENT_SESSION_KEYS = [', 'transient session key list');
requireIncludes('function clearTransientCaseData()', 'clearTransientCaseData function');
requireIncludes('TRANSIENT_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key))', 'transient session cleanup loop');
requireIncludes('function syncActiveCaseSession(identity)', 'syncActiveCaseSession function');
requireIncludes('sessionStorage.getItem(ACTIVE_CASE_SESSION_KEY)', 'previous active case lookup');
requireIncludes('sessionStorage.setItem(ACTIVE_CASE_SESSION_KEY, identity.key)', 'active case key sync');
requireIncludes('if (previous && previous !== identity.key) clearTransientCaseData();', 'transient cleanup on active case mismatch');
requireIncludes('clearTransientCaseData();\n    syncActiveCaseSession(identity);', 'transient cleanup before applying saved case state');
requireIncludes('setInterval(checkCaseSwitch, 250)', 'case switch watcher interval');
requirePattern(/if \(s\.__coreCaseResetActiveKey === identity\.key\) return;/, 'same-case no-op guard');
requirePattern(/s\.__coreCaseResetActiveKey = identity\.key;\s*applyCaseState\(identity\);/s, 'case switch apply flow');

console.log('Case reset safety guard passed.');
