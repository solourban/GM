const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
const script = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-result-order.js'), 'utf8');

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
  [script, 'const ORDER = [', 'order list'],
  [script, 'moveIntoRoot', 'move cards into result root'],
  [script, 'moveAfter', 'move after helper'],
  [script, 'dataset.resultOrder', 'order signature'],
  [script, 'window.__auctionResultOrder', 'debug bridge'],
];

for (const id of expectedOrder) required.push([script, `'${id}'`, `order contains ${id}`]);

const missing = required.filter(([source, needle]) => !source.includes(needle)).map(([, , label]) => label);
if (missing.length) {
  throw new Error(`Result order regression guard failed: missing ${missing.join(', ')}`);
}

console.log('Result order regression guard passed.');
