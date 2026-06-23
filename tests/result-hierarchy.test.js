const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const displayFix = read('public/app-v2-display-fix.js');
const molit = read('public/app-v2-molit-trades.js');
const polish = read('public/app-v2-result-polish.js');

function requireIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Result hierarchy guard failed: missing ${label}`);
  }
}

function requireNotIncludes(source, needle, label) {
  if (source.includes(needle)) {
    throw new Error(`Result hierarchy guard failed: ${label} should not be present`);
  }
}

requireIncludes(displayFix, 'function decisionStrip(label, message, tone = \'neutral\')', 'decision strip helper');
requireIncludes(displayFix, "decisionStrip('이번 판단'", 'bidding summary decision strip');
requireIncludes(displayFix, "decisionStrip('가격 기준'", 'bid range decision strip');
requireIncludes(displayFix, "decisionStrip('자금 체크'", 'funding decision strip');
requireIncludes(displayFix, "decisionStrip('체크 시작점'", 'checklist decision strip');
requireIncludes(displayFix, "등기부·매각물건명세서·전입세대열람 원본 확인 전에는 참고 판단으로만 보세요.", 'non-duplicated evidence reminder');
requireNotIncludes(displayFix, '<li>${esc(decisionMessage(report, inheritedTotal, minBid))}</li>', 'duplicated bidding summary message');
requireNotIncludes(displayFix, '<li>${esc(bidRangeMessage(report, lower, upper, base, inheritedTotal))}</li>', 'duplicated bid range message');
requireNotIncludes(displayFix, '<li>${esc(fundingMessage(report, minTotal, upperTotal))}</li>', 'duplicated funding message');

requireIncludes(molit, 'function renderTradeSummaryBand(scope, comparison, stats)', 'trade summary band helper');
requireIncludes(molit, '${renderTradeSummaryBand(scope, comparison, stats)}', 'trade summary band placement');
requireIncludes(molit, '<small>${esc(comparison.judgment)}</small>', 'secondary trade judgment');
requireNotIncludes(molit, "${info('참고 범위', scope.label, 'wide')}", 'duplicated trade scope info box');
requireNotIncludes(molit, "${info('표본 해석', scope.judgment, 'wide')}", 'duplicated trade judgment info box');
requireNotIncludes(molit, "${info('가격 참고 메모', comparison.judgment, 'wide')}", 'duplicated price memo info box');

requireIncludes(polish, '.v2-decision-strip {', 'decision strip styling');
requireIncludes(polish, '.v2-decision-strip.warn', 'warning decision strip styling');
requireIncludes(polish, '.v2-decision-strip.danger', 'danger decision strip styling');
requireIncludes(polish, '@media (max-width:720px)', 'mobile result polish media query');
requireIncludes(polish, '.v2-grid.four { grid-template-columns:repeat(2,minmax(0,1fr));', 'mobile four-grid compaction');
requireNotIncludes(polish, "findCardByTitle('현황 요약')", 'dead status summary patch');

console.log('Result hierarchy guard passed.');
