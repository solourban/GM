const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
const guard = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-tab-scope-guard.js'), 'utf8');

const required = [
  [index, '<script src="/app-v2-tab-scope-guard.js"></script>', 'script include'],
  [pkg, 'node --check public/app-v2-tab-scope-guard.js', 'syntax check'],
  [guard, 'v2CandidateStackCard', 'candidate stack card cleanup'],
  [guard, 'v2CandidateRankingCard', 'candidate ranking card cleanup'],
  [guard, 'v2SavedCandidateCard', 'saved candidate card cleanup'],
  [guard, 'v2SavedTopFiveCard', 'saved top five card cleanup'],
  [guard, 'v2SavedTabRuntimeCard', 'saved tab runtime cleanup'],
  [guard, 'v2ServiceStatusCard', 'service status cleanup'],
  [guard, "tab === 'date'", 'date allowlist guard'],
  [guard, "tab === 'saved'", 'saved allowlist guard'],
  [guard, "tab === 'search'", 'search service allowlist'],
  [guard, 'removeOutOfScopeCards', 'out-of-scope cleanup'],
  [guard, 'MutationObserver', 'reinjected card cleanup'],
  [guard, '매각기일 후보 초기화', 'date reset label'],
  [guard, '현재 사건 입력 초기화', 'case reset label'],
  [guard, '저장 후보·외부검증 메모·실거래가 결과는 유지합니다.', 'case reset safety copy'],
  [guard, 'if (notice.dataset.caseResetSignature === signature) return;', 'stable next-step reset button'],
  [guard, 'reset-current-case', 'case reset bridge'],
  [guard, 'setInterval(tick, 150)', 'periodic cleanup'],
  [guard, 'window.__auctionTabScopeGuard', 'public bridge'],
];

const missing = required.filter(([source, needle]) => !source.includes(needle)).map(([, , label]) => label);
if (missing.length) {
  throw new Error(`Tab scope guard missing: ${missing.join(', ')}`);
}

console.log('Tab scope guard passed.');
