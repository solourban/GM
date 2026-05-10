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

  function percent(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '-';
    return `${n.toFixed(1)}%`;
  }

  function uniqueList(items) {
    return Array.from(new Set(items.map(clean).filter(Boolean)));
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

  function checklistItems(report) {
    const items = [];
    const tenants = Array.isArray(report?.tenants) ? report.tenants : [];
    const rights = Array.isArray(report?.rights) ? report.rights : [];
    const riskFlags = Array.isArray(report?.risk?.flags) ? report.risk.flags : [];
    const hasDaehangTenant = tenants.some((tenant) => tenant.daehang === '있음');
    const hasUnknownTenant = tenants.some((tenant) => ['?', '확인필요'].includes(tenant.daehang));
    const hasZeroDeposit = tenants.some((tenant) => !numberValue(tenant.deposit));
    const hasSpecialRight = rights.some((right) => right.status === '인수');
    const hasInvalidDate = riskFlags.some((flag) => /날짜|접수일자/.test(flag.msg || ''));

    items.push('등기부등본에서 말소기준권리 접수일과 권리종류를 원본 기준으로 재확인');
    items.push('매각물건명세서에서 임차인, 배당요구, 인수되는 권리 여부 확인');
    items.push('전입세대열람 또는 현장 확인으로 실제 점유자와 전입일 확인');

    if (!report?.malso) items.push('말소기준권리가 확정되지 않았으므로 등기부상 최선순위 권리부터 다시 정리');
    if (hasDaehangTenant) items.push('대항력 임차인의 보증금 전액 배당 가능성과 미배당 잔액 인수 가능성 확인');
    if (hasUnknownTenant) items.push('대항력 판단이 불명확한 임차인의 전입일·확정일자·점유 여부 재확인');
    if (hasZeroDeposit) items.push('보증금이 비어 있거나 0원인 임차인의 실제 보증금 확인');
    if (hasSpecialRight) items.push('유치권·법정지상권·분묘기지권 등 특수권리 원본 서류와 현장 상태 확인');
    if (hasInvalidDate) items.push('날짜 형식이 이상한 권리/임차인 항목을 원본 문서 기준으로 다시 입력');

    items.push('최저가에 인수 추정금액과 취득세·수리비·명도비용을 더한 실질 부담액 기준으로 입찰가 검토');
    return uniqueList(items);
  }

  function bidRangeMessage(report, lower, upper, base, inheritedTotal) {
    const level = report?.risk?.level || 'ok';
    if (!upper || upper <= 0) return '검토 가능한 상한가를 계산하지 못했습니다. 감정가와 최저가 정보를 다시 확인하세요.';
    if (level === 'danger') return '고위험 물건입니다. 이 범위는 자동 입찰 추천가가 아니라, 위험 반영 후 검토 상한선입니다.';
    if (inheritedTotal > 0) return '인수 추정금액이 있으므로 입찰가는 낙찰가가 아니라 실질 부담액 기준으로 판단해야 합니다.';
    if (base && upper < base) return '감정가 대비 할인 여지는 있으나, 시세·관리비·수리비·명도비를 별도로 반영해야 합니다.';
    return '입력값 기준으로 산출한 보수적 검토 범위입니다. 실제 입찰가는 시세와 경쟁률을 함께 봐야 합니다.';
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

  function upsertBidRange() {
    const s = state();
    const report = s?.report;
    const summary = document.getElementById('v2BiddingSummaryCard');
    if (!report || !summary || !report.bidRec) {
      document.getElementById('v2BidRangeCard')?.remove();
      return;
    }

    const lower = numberValue(report.bidRec.lower);
    const upper = numberValue(report.bidRec.upper);
    const base = numberValue(report.bidRec.base);
    const inheritedTotal = numberValue(report.inherited?.total);
    const upperAfterInherited = Math.max(0, upper - inheritedTotal);
    const upperRate = base ? (upper / base) * 100 : 0;

    let card = document.getElementById('v2BidRangeCard');
    if (!card) {
      card = document.createElement('section');
      card.id = 'v2BidRangeCard';
      card.className = 'v2-card';
      summary.parentNode.insertBefore(card, summary.nextSibling);
    }

    card.innerHTML = `
      <span class="v2-badge">가격 검토</span>
      <h3>입찰가 검토 기준</h3>
      <p class="v2-note">자동 산식으로 만든 참고 범위입니다. 실제 입찰가는 실거래가, 현장 상태, 명도비, 경쟁률을 별도로 반영해야 합니다.</p>
      <div class="v2-grid four">
        <div class="v2-info-box"><span>입찰 하한 기준</span><strong>${money(lower)}</strong></div>
        <div class="v2-info-box"><span>검토 상한 기준</span><strong>${money(upper)}</strong></div>
        <div class="v2-info-box"><span>감정가 대비 상한</span><strong>${percent(upperRate)}</strong></div>
        <div class="v2-info-box"><span>인수 반영 후 여유</span><strong>${money(upperAfterInherited)}</strong></div>
      </div>
      <ul class="v2-list">
        <li>${bidRangeMessage(report, lower, upper, base, inheritedTotal)}</li>
        <li>입찰가를 정할 때는 낙찰가가 아니라 낙찰가 + 인수금액 + 취득비용 + 수리·명도비용 기준으로 다시 계산하세요.</li>
      </ul>
    `;
  }

  function upsertChecklist() {
    const s = state();
    const report = s?.report;
    const summary = document.getElementById('v2BiddingSummaryCard');
    if (!report || !summary) {
      document.getElementById('v2PreBidChecklistCard')?.remove();
      return;
    }

    const items = checklistItems(report);
    let card = document.getElementById('v2PreBidChecklistCard');
    if (!card) {
      card = document.createElement('section');
      card.id = 'v2PreBidChecklistCard';
      card.className = 'v2-card';
      const bidRange = document.getElementById('v2BidRangeCard');
      summary.parentNode.insertBefore(card, bidRange?.nextSibling || summary.nextSibling);
    }

    card.innerHTML = `
      <span class="v2-badge">확인 목록</span>
      <h3>입찰 전 확인 체크리스트</h3>
      <p class="v2-note">분석 결과에서 파생된 확인 항목입니다. 입찰 전 원본 서류와 현장 확인 기준으로 하나씩 점검하세요.</p>
      <ul class="v2-list">
        ${items.map((item) => `<li>□ ${item}</li>`).join('')}
      </ul>
    `;
  }

  function run() {
    replaceMalsoZeroAmountInAnalysis();
    addMissingAmountNotice();
    upsertBiddingSummary();
    upsertBidRange();
    upsertChecklist();
  }

  setInterval(run, 500);
})();
