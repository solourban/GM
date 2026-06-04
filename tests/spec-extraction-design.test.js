const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DESIGN_PATH = path.join(ROOT, 'docs', 'auction-specification-text-extraction-design.md');
const design = fs.readFileSync(DESIGN_PATH, 'utf8').replace(/\r\n?/g, '\n');

function fail(message) {
  console.error(`Specification extraction design guard failed: ${message}`);
  process.exit(1);
}

function requireIncludes(needle, label) {
  if (!design.includes(needle)) fail(`${label} is missing.`);
}

[
  ['자동 확정하지 않는다.', 'no automatic confirmation principle'],
  ['추출만으로 Step 2 입력값이나 권리분석 결과를 변경하지 않는다.', 'no mutation before confirmation'],
  ['원문과 추출 후보를 같은 검토 화면에서 함께 보여준다.', 'side-by-side review principle'],
  ['기존 값 유지를 기본값으로 한다.', 'conflict-safe default'],
  ['1단계 파서는 브라우저에서만 실행한다.', 'client-only parser'],
  ['원문·근거 문구는 `/api/analyze` 요청에 포함하지 않는다.', 'analyze request privacy'],
  ['원문은 최대 100,000자로 제한한다.', 'raw text size limit'],
  ['window.__auctionCaseScope.currentCaseKey()', 'current case identity contract'],
  ['manual.specReview', 'review-only data contract'],
  ['SCHEMA_VERSION = 3', 'backward-compatible persistence decision'],
  ['현재 사건 입력 초기화 시 현재 사건의 원문 초안·미확정 후보·확인된 `specReview`를 삭제한다.', 'current-case reset scope'],
  ['특수권리·인수 문구는 의심 문구로 표시되고 위험도로 자동 확정되지 않는다.', 'special-right safety acceptance criterion'],
  ['`매수인이 인수할 권리 없음`', 'negative takeover phrase handling'],
  ['PDF 파일 첨부와 OCR', 'PDF OCR exclusion'],
  ['법원 매각물건명세서 자동조회', 'court auto-fetch exclusion'],
].forEach(([needle, label]) => requireIncludes(needle, label));

const pr1 = design.indexOf('### PR 1. 순수 파서와 fixture');
const pr2 = design.indexOf('### PR 2. 원문·후보 검토 UI');
const pr3 = design.indexOf('### PR 3. 확인 적용과 사건별 저장');
if (pr1 === -1 || pr2 === -1 || pr3 === -1 || !(pr1 < pr2 && pr2 < pr3)) {
  fail('implementation sequence must keep parser, review UI, and confirmation apply in separate ordered PRs.');
}

console.log('Specification extraction design guard passed.');
