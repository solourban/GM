const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const index = read('public/index.html');
const pkg = read('package.json');
const workflow = read('public/app-v2-workflow-shell.js');
const essentialDocs = read('public/app-v2-essential-documents.js');
const date = read('public/app-v2-date.js');
const dateCourts = read('public/app-v2-date-courts.js');
const resultOrder = read('public/app-v2-result-order.js');

function fail(message) {
  throw new Error(`Workflow shell regression guard failed: ${message}`);
}

function requireIncludes(source, needle, label) {
  if (!source.includes(needle)) fail(`${label} missing`);
}

function forbidIncludes(source, needle, label) {
  if (source.includes(needle)) fail(`${label} should not be present`);
}

[
  ['/app-v2-workflow-shell.js', 'workflow shell script'],
  ['/app-v2-essential-documents.js', 'essential documents script'],
].forEach(([needle, label]) => requireIncludes(index, needle, label));

[
  'node --check public/app-v2-workflow-shell.js',
  'node --check public/app-v2-essential-documents.js',
  'node tests/workflow-shell-regression.test.js',
  'npm run test:workflow-shell',
].forEach((needle) => requireIncludes(pkg, needle, needle));

forbidIncludes(index, '/app-v2-date-seoul-only.js', 'Seoul-only date lock script');
forbidIncludes(pkg, 'app-v2-date-seoul-only.js', 'Seoul-only date lock syntax check');

[
  'v2WorkflowShell',
  'v2CaseSummaryBar',
  'v2WorkflowTabs',
  'v2WorkflowBody',
  'v2StepBasic',
  'v2StepInput',
  'v2StepMarket',
  'v2StepRisk',
  'v2StepBid',
  'v2StepJudgment',
  'v2StepSave',
  'v2WorkflowPrevBtn',
  'v2WorkflowNextBtn',
  'const CARD_STEP_BY_ID',
  'function classifyCards',
  'function applyStepVisibility',
  'dataset.workflowManaged',
  'v2-workflow-card-hidden',
  "syncShell({ immediate: true })",
  'visibleCardIds',
  'window.__auctionWorkflowShell',
].forEach((needle) => requireIncludes(workflow, needle, needle));

[
  "step2InputCard: 'input'",
  "v2LocationCard: 'market'",
  "v2MolitTradeCard: 'market'",
  "analysisCard: 'risk'",
  "v2EssentialDocumentsCard: 'risk'",
  "v2PreBidChecklistCard: 'risk'",
  "v2BidRangeCard: 'bid'",
  "v2FundingReviewCard: 'bid'",
  "v2FinalJudgmentCard: 'judgment'",
  "v2CopySummaryCard: 'save'",
  "v2FinalCopyCard: 'save'",
].forEach((needle) => requireIncludes(workflow, needle, needle));

[
  'v2EssentialDocumentsCard',
  'https://www.courtauction.go.kr/',
  '매각물건명세서',
  '현황조사보고서',
  '감정평가서',
  '확인 필요',
  "dataset.workflowStep = 'risk'",
].forEach((needle) => requireIncludes(essentialDocs, needle, needle));

forbidIncludes(essentialDocs, '열람 가능', 'automatic document availability wording');

[
  'const DEFAULT_COURT',
  'function sameCourt',
  'renderCourtOptions',
  'new URLSearchParams({ court, start, end',
  'sameCourt(data.court || court, court)',
  'state.meta = { court: data.court || court',
].forEach((needle) => requireIncludes(date, needle, needle));

[
  'SUPPORTED_COURT',
  'SEARCH_COURT',
  'isSupportedCourt',
  'const court = DEFAULT_COURT;',
  'state.form.court = DEFAULT_COURT',
  '서울중앙만',
].forEach((needle) => forbidIncludes(date, needle, needle));

[
  'window.__auctionDateCourts',
  'function shouldRefreshOptions',
  "if (current.tagName === 'SELECT')",
  'COURTS: COURTS.map',
].forEach((needle) => requireIncludes(dateCourts, needle, needle));

requireIncludes(resultOrder, "'v2EssentialDocumentsCard'", 'essential document card result order');

console.log('Workflow shell regression guard passed.');
