const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const index = read('public/index.html');
const pkg = read('package.json');
const workflow = read('public/app-v2-workflow-shell.js');
const essentialDocs = read('public/app-v2-essential-documents.js');
const riskBrief = read('public/app-v2-risk-brief.js');
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
  'v2WorkflowEmptyState',
  'v2StepBasic',
  'v2StepInput',
  'v2StepMarket',
  'v2StepRisk',
  'v2StepBid',
  'v2StepJudgment',
  'v2StepSave',
  'v2WorkflowPrevBtn',
  'v2WorkflowNextBtn',
  'const HIDDEN_CLASS',
  'const CARD_STEP_BY_ID',
  'function classifyCard',
  'function classifyCards',
  'function setCardVisibility',
  'function applyStepVisibility',
  'function addedCards',
  'function primeAddedCards',
  'function activeCards',
  'function emptyCopy',
  'function renderEmptyState',
  'function syncEmptyState',
  'function summaryData',
  'function renderSummaryItem',
  'function ensureStepContent',
  'dataset.workflowEmptyState',
  'dataset.workflowManaged',
  "${HIDDEN_CLASS} { display:none !important; }",
  'primeAddedCards(records)',
  "window.__auctionV2?.openStep2?.({ workflow: false, scroll: false })",
  "const nextLabel = activeStep === 'basic' ? 'Step 2 입력 열기' : '다음 단계'",
  'ensureStepContent(step)',
  "syncShell({ immediate: true })",
  'visibleCardIds',
  'emptyStateId',
  'summarySnapshot',
  'window.__auctionWorkflowShell',
].forEach((needle) => requireIncludes(workflow, needle, needle));

[
  "valueFromBasic(['법원', '법원명'], ['court', 'requestedCourt'])",
  "valueFromBasic(['사건번호', '사건'], ['caseNo'])",
  "label: '물건종별'",
  "label: '감정가'",
  "label: '유찰'",
  "label: '소재지'",
  "className: 'wide'",
].forEach((needle) => requireIncludes(workflow, needle, needle));

[
  '시세·입지 참고정보를 기다리는 중입니다',
  '리스크 검토 카드가 아직 없습니다',
  '입찰가 검토 카드가 아직 없습니다',
  '최종판단 카드가 아직 없습니다',
  '저장·복사할 요약이 아직 없습니다',
].forEach((needle) => requireIncludes(workflow, needle, needle));

[
  "step2InputCard: 'input'",
  "v2LocationCard: 'market'",
  "v2MolitTradeCard: 'market'",
  "analysisCard: 'risk'",
  "v2EssentialDocumentsCard: 'risk'",
  "v2BiddingSummaryCard: 'bid'",
  "v2BidRangeCard: 'bid'",
  "v2FundingReviewCard: 'bid'",
  "v2PreBidChecklistCard: 'bid'",
  "v2BidPlanCard: 'bid'",
  "v2FinalJudgmentCard: 'judgment'",
  "v2CopySummaryCard: 'save'",
  "v2FinalCopyCard: 'save'",
].forEach((needle) => requireIncludes(workflow, needle, needle));

[
  "const CARD_ID = 'v2RiskBriefCard'",
  'function esc',
  'function signature',
  'function renderRiskBriefHtml',
  'function notifyResultChange',
  '최저가 기준 실질부담',
  "card.className = 'v2-result-card v2-risk-brief-card'",
  "card.dataset.workflowStep = 'risk'",
  'card.dataset.signature !== nextSignature',
].forEach((needle) => requireIncludes(riskBrief, needle, needle));

[
  'v2EssentialDocumentsCard',
  'v2EssentialDocumentsCopyStatus',
  'https://www.courtauction.go.kr/',
  'const DOCUMENTS',
  'function caseInfo',
  'function searchCopyText',
  'function renderCaseGuide',
  'function renderDocumentRows',
  'function copySearchText',
  '매각물건명세서',
  '현황조사보고서',
  '감정평가서',
  '확인 필요',
  '공식 사이트에서 사건 검색',
  '검색값 복사',
  'data-document-kind',
  'data-document-status="확인 필요"',
  '문서 존재 여부와 공개 상태는 자동 판정하지 않습니다',
  '매각물건명세서의 임차인·배당요구·인수 문구',
  'caseInfo',
  'searchCopyText',
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
