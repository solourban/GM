const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
const script = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-result-order.js'), 'utf8');
const displayFix = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-display-fix.js'), 'utf8');
const copySummary = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-copy-summary.js'), 'utf8');
const bidPlan = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-bid-plan.js'), 'utf8');

const expectedOrder = [
  'analysisCard',
  'v2RiskBriefCard',
  'v2BiddingSummaryCard',
  'v2FinalJudgmentCard',
  'v2ExternalVerificationCard',
  'v2DecisionConfidenceCard',
  'v2BidRangeCard',
  'v2FundingReviewCard',
  'v2PreBidChecklistCard',
  'v2CopySummaryCard',
  'v2BidPlanCard',
];

const required = [
  [index, '<script src="/app-v2-result-order.js"></script>', 'script include'],
  [pkg, 'node --check public/app-v2-result-order.js', 'syntax check'],
  [pkg, 'node tests/result-order-regression.test.js', 'package regression test'],
  [script, 'const ORDER = [', 'order list'],
  [script, 'MutationObserver', 'result mutation observer'],
  [script, 'isSameCardReplacement', 'same-card replacement ignore guard'],
  [script, 'isUserScrolling', 'active scroll guard'],
  [script, 'hasFocusedControl', 'focused input guard'],
  [script, 'preserveViewport', 'viewport preservation'],
  [script, 'currentOrderedIds', 'relative order comparison'],
  [script, 'alreadyOrdered', 'no-op order guard'],
  [script, 'auction:result-card-change', 'targeted result change event'],
  [script, 'window.__auctionResultOrder', 'debug bridge'],
  [displayFix, 'if (card.dataset.resultOrderIndex) return;', 'display fix order ownership handoff'],
  [copySummary, '!card.dataset.resultOrderIndex && card.previousElementSibling !== anchor', 'copy summary order ownership handoff'],
  [bidPlan, '!card.dataset.resultOrderIndex && card.previousElementSibling !== anchor', 'bid plan order ownership handoff'],
];

const forbidden = [
  [script, 'setInterval(', 'periodic result reorder'],
  [script, "document.addEventListener('click'", 'catch-all click reorder'],
  [script, 'subtree: true', 'deep result subtree observation'],
];

for (const id of expectedOrder) required.push([script, `'${id}'`, `order contains ${id}`]);

const missing = required.filter(([source, needle]) => !source.includes(needle)).map(([, , label]) => label);
const presentForbidden = forbidden.filter(([source, needle]) => source.includes(needle)).map(([, , label]) => label);

if (missing.length || presentForbidden.length) {
  const parts = [];
  if (missing.length) parts.push(`missing: ${missing.join(', ')}`);
  if (presentForbidden.length) parts.push(`forbidden: ${presentForbidden.join(', ')}`);
  throw new Error(`Result order regression guard failed: ${parts.join(' / ')}`);
}

console.log('Result order regression guard passed.');
