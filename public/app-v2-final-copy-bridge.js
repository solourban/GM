(() => {
  const CARD_ID = 'v2FinalCopyCard';
  const FINAL_KEY = 'auction-note:v2:final-judgment';
  const LOCATION_KEY = 'auction-note:v2:location-geocode';
  const TRADE_KEY = 'auction-note:v2:molit-trades';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function loadJson(key) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function appState() {
    return window.__auctionV2?.state || null;
  }

  function numberValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
    const digits = clean(value).replace(/[^0-9]/g, '');
    return digits ? Math.max(0, Number(digits)) : 0;
  }

  function money(value) {
    const n = Number(value || 0);
    return n ? `${Math.round(n).toLocaleString('ko-KR')}원` : '0원';
  }

  function riskLabel(level) {
    if (level === 'danger') return '높음';
    if (level === 'warn') return '주의';
    return '낮음';
  }

  function caseLabel(report) {
    const court = clean(report?.court || report?.raw?.court || '');
    const caseNo = clean(report?.case || report?.caseNo || '');
    return [court, caseNo].filter(Boolean).join(' ') || '미확인';
  }

  function buildSummary() {
    const report = appState()?.report;
    if (!report) return '';
    const judgment = loadJson(FINAL_KEY);
    const location = loadJson(LOCATION_KEY);
    const trades = loadJson(TRADE_KEY);
    const comparison = trades?.comparison || {};
    const minBid = numberValue(report?.basic?.['최저매각가격'] || report?.basic?.['최저가']);
    const inherited = numberValue(report?.inherited?.total);
    const lines = [];

    lines.push('[낙찰노트 입찰 검토 요약]');
    lines.push(`사건: ${caseLabel(report)}`);
    lines.push(`위험도: ${riskLabel(report?.risk?.level)}`);
    lines.push(`최저가: ${money(minBid)}`);
    lines.push(`인수 추정금액: ${money(inherited)}`);
    lines.push(`최저가 기준 실질 부담: ${money(minBid + inherited)}`);

    if (judgment?.decision?.label) {
      lines.push('');
      lines.push('입찰 판단 종합:');
      lines.push(`- 최종 검토 방향: ${clean(judgment.decision.label)}`);
      if (judgment.decision.text) lines.push(`- 종합 판단: ${clean(judgment.decision.text)}`);
      if (judgment.riskText) lines.push(`- 권리 위험도: ${clean(judgment.riskText)}`);
      if (judgment.inheritedTotalText) lines.push(`- 인수 추정금액: ${clean(judgment.inheritedTotalText)}`);
      lines.push(`- 실거래가 표본: ${Number(judgment.tradeCount || 0)}건`);
      lines.push(`- 최저가/평균가: ${judgment.avgRatio ? `${Number(judgment.avgRatio).toFixed(1)}%` : '-'}`);
      lines.push(`- 입지 좌표 확인: ${judgment.hasLocation ? '완료' : '미확인'}`);
      if (judgment.comparisonJudgment) lines.push(`- 가격 비교 판단: ${clean(judgment.comparisonJudgment)}`);
      if (Array.isArray(judgment.reasons) && judgment.reasons.length) {
        lines.push('- 판단 근거:');
        judgment.reasons.slice(0, 6).forEach((reason) => lines.push(`  · ${clean(reason)}`));
      }
    }

    if (location?.queryAddress) {
      lines.push('');
      lines.push('입지 기초정보:');
      lines.push(`- 조회 주소: ${clean(location.queryAddress)}`);
      if (location.addressName) lines.push(`- 지번주소: ${clean(location.addressName)}`);
      if (location.roadAddress) lines.push(`- 도로명주소: ${clean(location.roadAddress)}`);
      if (location.x && location.y) lines.push(`- 좌표: X ${clean(location.x)} / Y ${clean(location.y)}`);
      if (location.bCode) lines.push(`- 법정동코드: ${clean(location.bCode)}`);
    }

    if (trades?.lawdCd) {
      lines.push('');
      lines.push('실거래가 기초정보:');
      lines.push(`- LAWD_CD: ${clean(trades.lawdCd)}`);
      if (trades.dealYmd) lines.push(`- 조회 계약월: ${clean(trades.dealYmd)}`);
      lines.push(`- 표시 결과: ${Number(trades.count || 0)}건`);
      if (trades.judgment) lines.push(`- 거래 판단: ${clean(trades.judgment)}`);
      if (comparison.judgment) lines.push(`- 가격 비교 판단: ${clean(comparison.judgment)}`);
      if (comparison.avgRatio) lines.push(`- 최저가/평균가: ${Number(comparison.avgRatio).toFixed(1)}%`);
    }

    lines.push('');
    lines.push('입찰 전 확인 필요:');
    lines.push('- 등기부등본 말소기준권리 접수일 재확인');
    lines.push('- 매각물건명세서 임차인·배당요구·인수권리 확인');
    lines.push('- 전입세대열람 또는 현장 확인으로 점유자 확인');
    lines.push('- 실거래가는 동일 단지·동·층·면적, 계약해제 여부, 거래시점 차이 확인');
    lines.push('');
    lines.push('※ 본 요약은 입력값 기반 참고자료이며, 실제 입찰 전 원본 서류와 현장조사를 반드시 재확인해야 합니다.');
    return lines.join('\n');
  }

  function findAnchor() {
    return document.getElementById('v2CopySummaryCard')
      || document.getElementById('v2FinalJudgmentCard')
      || document.getElementById('v2MolitTradeCard')
      || null;
  }

  function renderCard(summary) {
    return `
      <section class="v2-card" id="${CARD_ID}">
        <span class="v2-badge">종합 요약</span>
        <h3>종합 판단 포함 요약</h3>
        <p class="v2-note">아래 내용을 전체 선택해서 복사하면 권리·입지·실거래가·가격비교·최종 판단을 함께 기록할 수 있습니다.</p>
        <textarea readonly style="width:100%;min-height:260px;border:1px solid rgba(148,163,184,.35);border-radius:14px;padding:14px;font:13px/1.6 monospace;background:rgba(15,23,42,.03);">${esc(summary)}</textarea>
      </section>
    `;
  }

  function upsertCard() {
    const summary = buildSummary();
    const existing = document.getElementById(CARD_ID);
    if (!summary) {
      existing?.remove();
      return;
    }
    const anchor = findAnchor();
    if (!anchor) return;
    const html = renderCard(summary);
    if (existing) existing.outerHTML = html;
    else anchor.insertAdjacentHTML('afterend', html);
  }

  setInterval(upsertCard, 1200);
})();
