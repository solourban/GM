(() => {
  const STORAGE_PREFIX = 'auction-note:v2.2:bid-plan:';
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

  function caseKey(report) {
    const court = clean(report?.court || report?.raw?.court || '');
    const caseNo = clean(report?.case || report?.caseNo || '');
    return [court, caseNo].filter(Boolean).join(':') || 'unknown';
  }

  function storageKey(report) {
    return `${STORAGE_PREFIX}${caseKey(report)}`;
  }

  function loadPlannedBid(report) {
    try {
      return clean(localStorage.getItem(storageKey(report)) || '');
    } catch (_) {
      return '';
    }
  }

  function savePlannedBid(report, value) {
    try {
      const key = storageKey(report);
      const cleanValue = clean(value);
      if (cleanValue) localStorage.setItem(key, cleanValue);
      else localStorage.removeItem(key);
    } catch (_) {}
  }

  function messageForBid({ plannedBid, minBid, upper, inheritedTotal, riskLevel }) {
    if (!plannedBid) return '입찰 예정가를 입력하면 실질 부담액을 계산합니다.';
    if (plannedBid < minBid) return '입찰 예정가가 최저가보다 낮습니다. 실제 입찰 가능 금액인지 다시 확인하세요.';
    if (upper && plannedBid > upper) return '입찰 예정가가 검토상한가를 넘습니다. 경쟁심리로 과입찰하지 않도록 주의하세요.';
    if (riskLevel === 'danger' && inheritedTotal > 0) return '고위험 물건입니다. 입찰가보다 인수금액 포함 실질 부담액을 먼저 보세요.';
    if (inheritedTotal > 0) return '인수 추정금액이 있으므로 낙찰가만 보지 말고 실질 부담액 기준으로 판단하세요.';
    return '입력값 기준으로는 검토 범위 안에 있습니다. 시세·명도비·수리비를 추가로 반영하세요.';
  }

  function updateCalculated(card, report) {
    const input = card.querySelector('#v2PlannedBidInput');
    const plannedBid = numberValue(input?.value);
    const minBid = numberValue(report?.basic?.['최저매각가격'] || report?.basic?.['최저가']);
    const upper = numberValue(report?.bidRec?.upper);
    const base = numberValue(report?.bidRec?.base);
    const inheritedTotal = numberValue(report?.inherited?.total);
    const bidDepositRate = numberValue(report?.basic?.['입찰보증금률']) || 10;
    const bidDeposit = Math.round(plannedBid * bidDepositRate / 100);
    const totalBurden = plannedBid + inheritedTotal;
    const minBidRate = minBid ? (plannedBid / minBid) * 100 : 0;
    const appraisedRate = base ? (plannedBid / base) * 100 : 0;
    const riskLevel = report?.risk?.level || 'ok';

    const depositEl = card.querySelector('[data-bid-plan="deposit"]');
    const burdenEl = card.querySelector('[data-bid-plan="burden"]');
    const minRateEl = card.querySelector('[data-bid-plan="minRate"]');
    const appraisedRateEl = card.querySelector('[data-bid-plan="appraisedRate"]');
    const messageEl = card.querySelector('[data-bid-plan="message"]');

    if (depositEl) depositEl.textContent = money(bidDeposit);
    if (burdenEl) burdenEl.textContent = money(totalBurden);
    if (minRateEl) minRateEl.textContent = plannedBid ? percent(minBidRate) : '-';
    if (appraisedRateEl) appraisedRateEl.textContent = plannedBid ? percent(appraisedRate) : '-';
    if (messageEl) messageEl.textContent = messageForBid({ plannedBid, minBid, upper, inheritedTotal, riskLevel });
  }

  function upsertBidPlanCard() {
    const report = state()?.report;
    const checklist = document.getElementById('v2PreBidChecklistCard');
    const copy = document.getElementById('v2CopySummaryCard');
    const funding = document.getElementById('v2FundingReviewCard');
    const bidRange = document.getElementById('v2BidRangeCard');
    const summary = document.getElementById('v2BiddingSummaryCard');
    const anchor = checklist || funding || bidRange || summary || copy;

    if (!report || !anchor) {
      document.getElementById('v2BidPlanCard')?.remove();
      return;
    }

    const key = caseKey(report);
    let card = document.getElementById('v2BidPlanCard');
    const needsRender = !card || card.dataset.caseKey !== key;

    if (!card) {
      card = document.createElement('section');
      card.id = 'v2BidPlanCard';
      anchor.parentNode.insertBefore(card, anchor.nextSibling);
    }
    card.className = 'v2-result-card v2-bid-plan-card';
    card.dataset.workflowStep = 'bid';

    if (!card.dataset.resultOrderIndex && card.previousElementSibling !== anchor) {
      anchor.parentNode.insertBefore(card, anchor.nextSibling);
    }

    if (needsRender) {
      card.dataset.caseKey = key;
      const savedValue = loadPlannedBid(report);
      card.innerHTML = `
        <span class="v2-badge">입찰가 입력</span>
        <h3>내 입찰가 시뮬레이션</h3>
        <p class="v2-note">직접 생각한 입찰가를 넣어 인수금액 포함 실질 부담액을 확인합니다.</p>
        <div class="v2-actions">
          <input id="v2PlannedBidInput" class="v2-input" inputmode="numeric" placeholder="예: 80,000,000" value="${savedValue}">
        </div>
        <div class="v2-grid four">
          <div class="v2-info-box"><span>입찰보증금</span><strong data-bid-plan="deposit">0원</strong></div>
          <div class="v2-info-box"><span>입찰가+인수</span><strong data-bid-plan="burden">0원</strong></div>
          <div class="v2-info-box"><span>최저가 대비</span><strong data-bid-plan="minRate">-</strong></div>
          <div class="v2-info-box"><span>감정가 대비</span><strong data-bid-plan="appraisedRate">-</strong></div>
        </div>
        <ul class="v2-list">
          <li data-bid-plan="message">입찰 예정가를 입력하면 실질 부담액을 계산합니다.</li>
        </ul>
      `;

      const input = card.querySelector('#v2PlannedBidInput');
      input?.addEventListener('input', () => {
        savePlannedBid(report, input.value);
        updateCalculated(card, report);
      });
    }

    updateCalculated(card, report);
  }

  setInterval(upsertBidPlanCard, 700);
})();
