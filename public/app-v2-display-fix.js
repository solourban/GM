(() => {
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function app() {
    return window.__auctionV2 || null;
  }

  function state() {
    return app()?.state || null;
  }

  function numberValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
    const digits = clean(value).replace(/[^0-9]/g, '');
    return digits ? Math.max(0, Number(digits)) : 0;
  }

  function money(value) {
    const n = numberValue(value);
    return n ? `${n.toLocaleString('ko-KR')}원` : '0원';
  }

  function isManualMalsoAmountMissing() {
    const s = state();
    return !clean(s?.manual?.malso?.amount);
  }

  function replaceMalsoZeroAmountInAnalysis() {
    const s = state();
    if (!s?.report || !isManualMalsoAmountMissing()) return;

    document.querySelectorAll('.v2-detail-table').forEach((table) => {
      const headers = Array.from(table.querySelectorAll('thead th')).map((th) => clean(th.textContent));
      const amountIndex = headers.findIndex((h) => h === '금액');
      const judgementIndex = headers.findIndex((h) => h === '판단');
      const rightIndex = headers.findIndex((h) => h === '권리');
      if (amountIndex < 0 || judgementIndex < 0 || rightIndex < 0) return;

      table.querySelectorAll('tbody tr').forEach((row) => {
        const cells = Array.from(row.children);
        const amountCell = cells[amountIndex];
        const judgementCell = cells[judgementIndex];
        const rightCell = cells[rightIndex];
        if (!amountCell || !judgementCell || !rightCell) return;

        const isMalso = judgementCell.textContent.includes('말소기준') || row.textContent.includes('사용자가 입력한 말소기준권리');
        const isMortgage = rightCell.textContent.includes('근저당') || rightCell.textContent.includes('저당');
        const amountText = clean(amountCell.textContent);
        if (isMalso && isMortgage && amountText === '0원') {
          amountCell.textContent = '미입력';
        }
      });
    });
  }

  function addMissingAmountNotice() {
    const s = state();
    if (!s?.report || !isManualMalsoAmountMissing()) {
      document.getElementById('v2MissingAmountNotice')?.remove();
      return;
    }

    const analysis = document.getElementById('analysisCard');
    if (!analysis) return;

    if (document.getElementById('v2MissingAmountNotice')) return;
    const notice = document.createElement('p');
    notice.id = 'v2MissingAmountNotice';
    notice.className = 'v2-note';
    notice.textContent = '채권금액을 입력하지 않은 권리는 화면에 미입력으로 표시되며, 배당 계산에는 0원으로 처리됩니다.';
    analysis.appendChild(notice);
  }

  function riskLabel(level) {
    if (level === 'danger') return '위험도 높음';
    if (level === 'warn') return '위험도 주의';
    return '위험도 낮음';
  }

  function decisionMessage(report, inheritedTotal, minBid) {
    const level = report?.risk?.level || 'ok';
    const tenantRisk = Array.isArray(report?.tenants) && report.tenants.some((tenant) => tenant.daehang === '있음');
    const specialRisk = Array.isArray(report?.rights) && report.rights.some((right) => right.status === '인수');

    if (level === 'danger') {
      if (tenantRisk) return '단순 최저가 입찰 금지. 대항력 임차인의 배당 가능성과 미배당 보증금 인수 가능성을 먼저 확인해야 합니다.';
      if (specialRisk) return '특수권리 또는 선순위 인수 가능 권리가 있습니다. 원본 등기부와 매각물건명세서 확인 전 입찰을 보류하세요.';
      return '고위험으로 분류됩니다. 인수금액과 배당 구조를 다시 확인해야 합니다.';
    }

    if (level === 'warn') {
      return '확인 필요 항목이 있습니다. 날짜·보증금·말소기준권리 입력값을 원본 서류와 대조한 뒤 판단하세요.';
    }

    if (inheritedTotal > 0) {
      return '큰 위험은 낮게 보이나 인수 추정금액이 있습니다. 실질 부담액 기준으로 입찰가를 다시 계산하세요.';
    }

    if (minBid > 0) {
      return '입력값 기준 큰 인수 위험은 낮습니다. 다만 등기부·매각물건명세서·전입세대열람은 최종 확인이 필요합니다.';
    }

    return '최저가 정보가 부족합니다. 기본정보와 원본 서류를 다시 확인하세요.';
  }

  function upsertBiddingSummary() {
    const s = state();
    const report = s?.report;
    const analysis = document.getElementById('analysisCard');
    if (!report || !analysis) {
      document.getElementById('v2BiddingSummaryCard')?.remove();
      return;
    }

    const minBid = numberValue(report.basic?.['최저매각가격'] || report.basic?.['최저가']);
    const inheritedTotal = numberValue(report.inherited?.total);
    const practicalBurden = minBid + inheritedTotal;
    const tenants = Array.isArray(report.tenants) ? report.tenants.length : 0;
    const inheritedItems = Array.isArray(report.inherited?.items) ? report.inherited.items.length : 0;
    const level = report.risk?.level || 'ok';

    let card = document.getElementById('v2BiddingSummaryCard');
    if (!card) {
      card = document.createElement('section');
      card.id = 'v2BiddingSummaryCard';
      card.className = 'v2-card';
      analysis.parentNode.insertBefore(card, analysis.nextSibling);
    }

    card.innerHTML = `
      <span class="v2-badge">입찰 판단</span>
      <h3>입찰 전 핵심 요약</h3>
      <p class="v2-note">권리분석 결과를 입찰 판단 기준으로 다시 정리한 요약입니다. 원본 서류 확인을 대체하지 않습니다.</p>
      <div class="v2-grid four">
        <div class="v2-info-box"><span>위험도</span><strong>${riskLabel(level)}</strong></div>
        <div class="v2-info-box"><span>최저가</span><strong>${money(minBid)}</strong></div>
        <div class="v2-info-box"><span>인수 추정금액</span><strong>${money(inheritedTotal)}</strong></div>
        <div class="v2-info-box"><span>실질 부담 추정</span><strong>${money(practicalBurden)}</strong></div>
      </div>
      <ul class="v2-list">
        <li>입력 임차인 ${tenants}명, 인수 가능 항목 ${inheritedItems}건 기준입니다.</li>
        <li>${decisionMessage(report, inheritedTotal, minBid)}</li>
      </ul>
    `;
  }

  function run() {
    replaceMalsoZeroAmountInAnalysis();
    addMissingAmountNotice();
    upsertBiddingSummary();
  }

  setInterval(run, 500);
})();
