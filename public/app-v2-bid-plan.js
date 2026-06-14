(() => {
  const STORAGE_PREFIX = 'auction-note:v2.2:bid-plan:';
  const FIELD_DEFAULTS = Object.freeze({
    plannedBid: '',
    expectedSalePrice: '',
    acquisitionTaxRate: '1.1',
    registryCost: '0',
    legalFee: '0',
    unpaidManagementFee: '0',
    repairCost: '0',
    evictionCost: '0',
    loanAmount: '',
    appraisalLoanRate: '60',
    bidLoanRate: '80',
    roomDeduction: '0',
    annualInterestRate: '5',
    holdingMonths: '6',
    prepaymentPenaltyRate: '0',
    sellBrokerageFee: '0',
    incomeTaxRate: '0',
    localIncomeTaxRate: '10',
  });

  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function app() {
    return window.__auctionV2 || null;
  }

  function state() {
    return app()?.state || null;
  }

  function esc(value) {
    return clean(value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function numberValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
    const normalized = clean(value).replace(/,/g, '').replace(/[^0-9.]/g, '');
    if (!normalized) return 0;
    const n = Number(normalized);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function won(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '0원';
    return `${Math.round(n).toLocaleString('ko-KR')}원`;
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

  function normalizePlan(value) {
    const source = value && typeof value === 'object' ? value : {};
    return Object.keys(FIELD_DEFAULTS).reduce((acc, key) => {
      acc[key] = clean(source[key] ?? FIELD_DEFAULTS[key]);
      return acc;
    }, {});
  }

  function parseStoredPlan(raw) {
    const trimmed = clean(raw);
    if (!trimmed) return normalizePlan();
    if (!trimmed.startsWith('{')) return normalizePlan({ plannedBid: trimmed });
    try {
      return normalizePlan(JSON.parse(trimmed));
    } catch (_) {
      return normalizePlan({ plannedBid: trimmed });
    }
  }

  function loadPlan(report) {
    try {
      return parseStoredPlan(localStorage.getItem(storageKey(report)) || '');
    } catch (_) {
      return normalizePlan();
    }
  }

  function savePlan(report, plan) {
    try {
      const normalized = normalizePlan(plan);
      const hasUserValue = Object.keys(normalized).some((key) => clean(normalized[key]) !== clean(FIELD_DEFAULTS[key]));
      if (hasUserValue) localStorage.setItem(storageKey(report), JSON.stringify(normalized));
      else localStorage.removeItem(storageKey(report));
    } catch (_) {}
  }

  function readPlanFromCard(card, fallback) {
    const plan = normalizePlan(fallback);
    card?.querySelectorAll('[data-bid-plan-field]').forEach((input) => {
      const key = input.dataset.bidPlanField;
      if (key && Object.prototype.hasOwnProperty.call(FIELD_DEFAULTS, key)) {
        plan[key] = clean(input.value);
      }
    });
    return normalizePlan(plan);
  }

  function reportNumbers(report) {
    return {
      minBid: numberValue(report?.basic?.['최저매각가격'] || report?.basic?.['최저가']),
      appraisedValue: numberValue(report?.basic?.['감정평가액'] || report?.basic?.['감정가'] || report?.bidRec?.base),
      bidUpper: numberValue(report?.bidRec?.upper),
      inheritedTotal: numberValue(report?.inherited?.total),
      bidDepositRate: numberValue(report?.basic?.['입찰보증금률']) || 10,
      riskLevel: report?.risk?.level || 'ok',
    };
  }

  function messageForSnapshot(snapshot) {
    if (!snapshot.plannedBid) return '입찰가와 예상 매도가를 입력하면 필요 현금과 세후수익을 계산합니다.';
    if (snapshot.minBid && snapshot.plannedBid < snapshot.minBid) {
      return '입찰 예정가가 최저가보다 낮습니다. 실제 입찰 가능 금액인지 다시 확인하세요.';
    }
    if (snapshot.bidUpper && snapshot.plannedBid > snapshot.bidUpper) {
      return '입찰 예정가가 검토상한가를 넘습니다. 과입찰 가능성을 보수적으로 다시 보세요.';
    }
    if (snapshot.expectedSalePrice && snapshot.afterTaxProfit < 0) {
      return '세후수익이 음수입니다. 예상 매도가, 비용, 대출 조건을 다시 검토하세요.';
    }
    if (snapshot.riskLevel === 'danger' && snapshot.inheritedTotal > 0) {
      return '고위험 물건이고 인수금액이 있습니다. 낙찰가보다 총 부담액과 필요 현금을 먼저 확인하세요.';
    }
    if (snapshot.loanAmount > 0) {
      return '대출 반영 계산입니다. 실제 대출 가능 여부는 금융기관 확인이 필요합니다.';
    }
    return '입력값 기준의 참고 계산입니다. 세금과 비용은 실제 조건에 맞게 조정하세요.';
  }

  function computePlan(planInput, report) {
    const plan = normalizePlan(planInput);
    const base = reportNumbers(report);
    const plannedBid = numberValue(plan.plannedBid);
    const expectedSalePrice = numberValue(plan.expectedSalePrice);
    const acquisitionTaxRate = numberValue(plan.acquisitionTaxRate);
    const acquisitionTax = Math.round(plannedBid * acquisitionTaxRate / 100);
    const registryCost = Math.round(numberValue(plan.registryCost));
    const legalFee = Math.round(numberValue(plan.legalFee));
    const unpaidManagementFee = Math.round(numberValue(plan.unpaidManagementFee));
    const repairCost = Math.round(numberValue(plan.repairCost));
    const evictionCost = Math.round(numberValue(plan.evictionCost));
    const appraisalLoanRate = numberValue(plan.appraisalLoanRate);
    const bidLoanRate = numberValue(plan.bidLoanRate);
    const roomDeduction = Math.round(numberValue(plan.roomDeduction));
    const appraisalLoanCap = Math.round(base.appraisedValue * appraisalLoanRate / 100);
    const bidLoanCap = Math.round(plannedBid * bidLoanRate / 100);
    const loanCaps = [appraisalLoanCap, bidLoanCap].filter((value) => value > 0);
    const suggestedLoan = Math.max(0, (loanCaps.length ? Math.min(...loanCaps) : 0) - roomDeduction);
    const hasManualLoan = clean(plan.loanAmount) !== '';
    const loanAmount = hasManualLoan ? Math.round(numberValue(plan.loanAmount)) : suggestedLoan;
    const annualInterestRate = numberValue(plan.annualInterestRate);
    const holdingMonths = numberValue(plan.holdingMonths);
    const monthlyInterest = Math.round(loanAmount * annualInterestRate / 100 / 12);
    const holdingInterest = Math.round(monthlyInterest * holdingMonths);
    const prepaymentPenaltyRate = numberValue(plan.prepaymentPenaltyRate);
    const prepaymentPenalty = Math.round(loanAmount * prepaymentPenaltyRate / 100);
    const sellBrokerageFee = Math.round(numberValue(plan.sellBrokerageFee));
    const incomeTaxRate = numberValue(plan.incomeTaxRate);
    const localIncomeTaxRate = numberValue(plan.localIncomeTaxRate);
    const bidDeposit = Math.round(plannedBid * base.bidDepositRate / 100);
    const totalAcquisitionCost = plannedBid
      + acquisitionTax
      + registryCost
      + legalFee
      + unpaidManagementFee
      + repairCost
      + evictionCost
      + holdingInterest
      + prepaymentPenalty;
    const totalBurden = totalAcquisitionCost + base.inheritedTotal;
    const requiredCash = Math.max(0, totalBurden - loanAmount);
    const preTaxProfit = expectedSalePrice ? expectedSalePrice - plannedBid : 0;
    const deductibleCost = acquisitionTax
      + registryCost
      + legalFee
      + unpaidManagementFee
      + repairCost
      + evictionCost
      + holdingInterest
      + prepaymentPenalty
      + sellBrokerageFee;
    const taxableBase = expectedSalePrice ? Math.max(0, preTaxProfit - deductibleCost) : 0;
    const incomeTax = Math.round(taxableBase * incomeTaxRate / 100);
    const localIncomeTax = Math.round(incomeTax * localIncomeTaxRate / 100);
    const totalTax = incomeTax + localIncomeTax;
    const totalCost = totalBurden + sellBrokerageFee + totalTax;
    const afterTaxProfit = expectedSalePrice ? expectedSalePrice - totalCost : 0;
    const breakEvenSalePrice = totalCost;
    const holdingMonthlyCost = holdingMonths ? Math.round((holdingInterest + unpaidManagementFee + repairCost) / holdingMonths) : 0;
    const roi = requiredCash ? (afterTaxProfit / requiredCash) * 100 : 0;
    const minBidRate = base.minBid ? (plannedBid / base.minBid) * 100 : 0;
    const appraisedRate = base.appraisedValue ? (plannedBid / base.appraisedValue) * 100 : 0;
    const snapshot = {
      ...base,
      plan,
      plannedBid,
      expectedSalePrice,
      acquisitionTaxRate,
      acquisitionTax,
      registryCost,
      legalFee,
      unpaidManagementFee,
      repairCost,
      evictionCost,
      appraisalLoanRate,
      bidLoanRate,
      roomDeduction,
      appraisalLoanCap,
      bidLoanCap,
      suggestedLoan,
      hasManualLoan,
      loanAmount,
      annualInterestRate,
      holdingMonths,
      monthlyInterest,
      holdingInterest,
      prepaymentPenaltyRate,
      prepaymentPenalty,
      sellBrokerageFee,
      incomeTaxRate,
      localIncomeTaxRate,
      bidDeposit,
      totalAcquisitionCost,
      totalBurden,
      requiredCash,
      preTaxProfit,
      deductibleCost,
      taxableBase,
      incomeTax,
      localIncomeTax,
      totalTax,
      totalCost,
      afterTaxProfit,
      breakEvenSalePrice,
      holdingMonthlyCost,
      roi,
      minBidRate,
      appraisedRate,
    };
    snapshot.message = messageForSnapshot(snapshot);
    return snapshot;
  }

  function inputHtml(key, label, placeholder) {
    const id = key === 'plannedBid' ? 'v2PlannedBidInput' : `v2BidPlan_${key}`;
    return `
      <label class="v2-field">
        <span>${esc(label)}</span>
        <input id="${esc(id)}" class="v2-input" inputmode="numeric" data-bid-plan-field="${esc(key)}" placeholder="${esc(placeholder)}">
      </label>
    `;
  }

  function setInputValues(card, plan) {
    card.querySelectorAll('[data-bid-plan-field]').forEach((input) => {
      const key = input.dataset.bidPlanField;
      input.value = clean(plan[key]);
    });
  }

  function setText(card, key, value) {
    const el = card.querySelector(`[data-bid-plan="${key}"]`);
    if (el) el.textContent = value;
  }

  function updateCalculated(card, report) {
    const plan = readPlanFromCard(card, loadPlan(report));
    const snapshot = computePlan(plan, report);
    savePlan(report, plan);
    card.__bidPlanSnapshot = snapshot;

    setText(card, 'deposit', won(snapshot.bidDeposit));
    setText(card, 'acquisitionTax', won(snapshot.acquisitionTax));
    setText(card, 'registryCost', won(snapshot.registryCost));
    setText(card, 'legalFee', won(snapshot.legalFee));
    setText(card, 'unpaidManagementFee', won(snapshot.unpaidManagementFee));
    setText(card, 'repairCost', won(snapshot.repairCost));
    setText(card, 'evictionCost', won(snapshot.evictionCost));
    setText(card, 'burden', won(snapshot.totalBurden));
    setText(card, 'minRate', snapshot.plannedBid ? percent(snapshot.minBidRate) : '-');
    setText(card, 'appraisedRate', snapshot.plannedBid ? percent(snapshot.appraisedRate) : '-');
    setText(card, 'appraisalLoanCap', won(snapshot.appraisalLoanCap));
    setText(card, 'bidLoanCap', won(snapshot.bidLoanCap));
    setText(card, 'roomDeduction', won(snapshot.roomDeduction));
    setText(card, 'suggestedLoan', won(snapshot.suggestedLoan));
    setText(card, 'loanAmount', won(snapshot.loanAmount));
    setText(card, 'loanSource', snapshot.hasManualLoan ? '직접 입력' : '한도 참고 자동 반영');
    setText(card, 'monthlyInterest', won(snapshot.monthlyInterest));
    setText(card, 'holdingInterest', won(snapshot.holdingInterest));
    setText(card, 'prepaymentPenalty', won(snapshot.prepaymentPenalty));
    setText(card, 'totalAcquisitionCost', won(snapshot.totalAcquisitionCost));
    setText(card, 'requiredCash', won(snapshot.requiredCash));
    setText(card, 'taxableBase', won(snapshot.taxableBase));
    setText(card, 'preTaxProfit', snapshot.expectedSalePrice ? won(snapshot.preTaxProfit) : '-');
    setText(card, 'deductibleCost', won(snapshot.deductibleCost));
    setText(card, 'sellBrokerageFee', won(snapshot.sellBrokerageFee));
    setText(card, 'incomeTax', won(snapshot.incomeTax));
    setText(card, 'localIncomeTax', won(snapshot.localIncomeTax));
    setText(card, 'totalTax', won(snapshot.totalTax));
    setText(card, 'totalCost', won(snapshot.totalCost));
    setText(card, 'afterTaxProfit', snapshot.expectedSalePrice ? won(snapshot.afterTaxProfit) : '-');
    setText(card, 'breakEvenSalePrice', snapshot.expectedSalePrice ? won(snapshot.breakEvenSalePrice) : '-');
    setText(card, 'holdingMonthlyCost', won(snapshot.holdingMonthlyCost));
    setText(card, 'roi', snapshot.expectedSalePrice && snapshot.requiredCash ? percent(snapshot.roi) : '-');
    setText(card, 'message', snapshot.message);

    document.dispatchEvent(new CustomEvent('auction:bid-plan-change', {
      detail: { caseKey: caseKey(report), snapshot },
    }));
    return snapshot;
  }

  function renderCard(card, report) {
    card.innerHTML = `
      <span class="v2-badge">입찰가 산정</span>
      <h3>입찰가·필요 현금 계산</h3>
      <p class="v2-note">입찰가, 대출, 보유비용, 매도비용을 넣어 필요 현금과 세후수익을 참고 계산합니다.</p>
      <div class="v2-form-block">
        <h4>입찰가</h4>
        <div class="v2-input-grid">
          ${inputHtml('plannedBid', '입찰 예정가', '예: 520,000,000')}
          ${inputHtml('expectedSalePrice', '예상 매도가', '예: 650,000,000')}
        </div>
      </div>
      <div class="v2-form-block">
        <h4>취득·보유 비용</h4>
        <div class="v2-input-grid">
          ${inputHtml('acquisitionTaxRate', '취득세율+지방세율(%)', '예: 1.1')}
          ${inputHtml('registryCost', '기타 등기비용', '예: 1,000,000')}
          ${inputHtml('legalFee', '법무비', '예: 800,000')}
          ${inputHtml('unpaidManagementFee', '미납관리비', '예: 2,000,000')}
          ${inputHtml('repairCost', '수리비', '예: 20,000,000')}
          ${inputHtml('evictionCost', '명도비', '예: 5,000,000')}
        </div>
      </div>
      <div class="v2-form-block">
        <h4>대출·이자</h4>
        <div class="v2-input-grid">
          ${inputHtml('loanAmount', '대출금액', '비우면 참고 한도 반영')}
          ${inputHtml('appraisalLoanRate', '감정가 기준 대출률(%)', '예: 60')}
          ${inputHtml('bidLoanRate', '낙찰가 기준 대출률(%)', '예: 80')}
          ${inputHtml('roomDeduction', '방공제 금액', '예: 55,000,000')}
          ${inputHtml('annualInterestRate', '연 이자율(%)', '예: 5')}
          ${inputHtml('holdingMonths', '보유기간(개월)', '예: 6')}
          ${inputHtml('prepaymentPenaltyRate', '중도상환수수료율(%)', '예: 1')}
        </div>
      </div>
      <div class="v2-form-block">
        <h4>매도·세금</h4>
        <div class="v2-input-grid">
          ${inputHtml('sellBrokerageFee', '매도 중개수수료', '예: 3,000,000')}
          ${inputHtml('incomeTaxRate', '양도세/소득세율(%)', '직접 입력')}
          ${inputHtml('localIncomeTaxRate', '양도세 지방세율(%)', '예: 10')}
        </div>
      </div>
      <div class="v2-grid four">
        <div class="v2-info-box"><span>입찰보증금</span><strong data-bid-plan="deposit">0원</strong></div>
        <div class="v2-info-box"><span>총 취득비용</span><strong data-bid-plan="totalAcquisitionCost">0원</strong></div>
        <div class="v2-info-box"><span>대출 반영액</span><strong data-bid-plan="loanAmount">0원</strong><small data-bid-plan="loanSource">-</small></div>
        <div class="v2-info-box"><span>필요 현금</span><strong data-bid-plan="requiredCash">0원</strong></div>
      </div>
      <div class="v2-grid four">
        <div class="v2-info-box"><span>입찰가+인수 포함 부담</span><strong data-bid-plan="burden">0원</strong></div>
        <div class="v2-info-box"><span>월 이자</span><strong data-bid-plan="monthlyInterest">0원</strong></div>
        <div class="v2-info-box"><span>보유기간 이자</span><strong data-bid-plan="holdingInterest">0원</strong></div>
        <div class="v2-info-box"><span>최저가 / 감정가 대비</span><strong><span data-bid-plan="minRate">-</span> / <span data-bid-plan="appraisedRate">-</span></strong></div>
      </div>
      <div class="v2-grid four">
        <div class="v2-info-box"><span>과세표준 참고</span><strong data-bid-plan="taxableBase">0원</strong></div>
        <div class="v2-info-box"><span>세금 참고액</span><strong data-bid-plan="totalTax">0원</strong></div>
        <div class="v2-info-box"><span>세후수익</span><strong data-bid-plan="afterTaxProfit">-</strong></div>
        <div class="v2-info-box"><span>수익률</span><strong data-bid-plan="roi">-</strong></div>
      </div>
      <div class="v2-grid four">
        <div class="v2-info-box"><span>세전수익</span><strong data-bid-plan="preTaxProfit">-</strong></div>
        <div class="v2-info-box"><span>비용처리금액</span><strong data-bid-plan="deductibleCost">0원</strong></div>
        <div class="v2-info-box"><span>손익분기 매도가</span><strong data-bid-plan="breakEvenSalePrice">-</strong></div>
        <div class="v2-info-box"><span>월평균 보유비용</span><strong data-bid-plan="holdingMonthlyCost">0원</strong></div>
      </div>
      <div class="v2-form-block">
        <h4>계산 상세</h4>
        <div class="v2-grid four">
          <div class="v2-info-box"><span>취득세+지방세</span><strong data-bid-plan="acquisitionTax">0원</strong></div>
          <div class="v2-info-box"><span>기타 등기비용</span><strong data-bid-plan="registryCost">0원</strong></div>
          <div class="v2-info-box"><span>법무비</span><strong data-bid-plan="legalFee">0원</strong></div>
          <div class="v2-info-box"><span>미납관리비</span><strong data-bid-plan="unpaidManagementFee">0원</strong></div>
        </div>
        <div class="v2-grid four">
          <div class="v2-info-box"><span>수리비</span><strong data-bid-plan="repairCost">0원</strong></div>
          <div class="v2-info-box"><span>명도비</span><strong data-bid-plan="evictionCost">0원</strong></div>
          <div class="v2-info-box"><span>중도상환수수료</span><strong data-bid-plan="prepaymentPenalty">0원</strong></div>
          <div class="v2-info-box"><span>매도 중개수수료</span><strong data-bid-plan="sellBrokerageFee">0원</strong></div>
        </div>
        <div class="v2-grid four">
          <div class="v2-info-box"><span>감정가 기준 대출</span><strong data-bid-plan="appraisalLoanCap">0원</strong></div>
          <div class="v2-info-box"><span>낙찰가 기준 대출</span><strong data-bid-plan="bidLoanCap">0원</strong></div>
          <div class="v2-info-box"><span>방공제 금액</span><strong data-bid-plan="roomDeduction">0원</strong></div>
          <div class="v2-info-box"><span>참고 대출한도</span><strong data-bid-plan="suggestedLoan">0원</strong></div>
        </div>
        <div class="v2-grid four">
          <div class="v2-info-box"><span>양도세/소득세</span><strong data-bid-plan="incomeTax">0원</strong></div>
          <div class="v2-info-box"><span>양도세 지방세</span><strong data-bid-plan="localIncomeTax">0원</strong></div>
          <div class="v2-info-box"><span>총 비용(세금 포함)</span><strong data-bid-plan="totalCost">0원</strong></div>
          <div class="v2-info-box"><span>총 취득비용</span><strong data-bid-plan="totalAcquisitionCost">0원</strong></div>
        </div>
      </div>
      <ul class="v2-list">
        <li data-bid-plan="message">입찰가와 예상 매도가를 입력하면 필요 현금과 세후수익을 계산합니다.</li>
        <li>대출 가능 여부는 LTV, DSR, 지역 규제, 신용, 소득, 주택 수에 따라 달라집니다. 금융기관 확인이 필요합니다.</li>
        <li>세금 계산은 참고용입니다. 실제 양도세·소득세·지방세는 세무 전문가 확인이 필요합니다.</li>
        <li>권리관계와 명도 가능성은 원본 서류와 현장 확인이 필요합니다.</li>
        <li>총 비용은 입찰가, 인수금액, 취득·보유·매도비용, 세금 참고액을 합산한 값입니다.</li>
      </ul>
    `;

    const plan = loadPlan(report);
    setInputValues(card, plan);
    card.querySelectorAll('[data-bid-plan-field]').forEach((input) => {
      input.addEventListener('input', () => updateCalculated(card, report));
    });
  }

  function currentSnapshot(report = state()?.report) {
    if (!report) return null;
    const card = document.getElementById('v2BidPlanCard');
    const plan = card ? readPlanFromCard(card, loadPlan(report)) : loadPlan(report);
    return computePlan(plan, report);
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
      renderCard(card, report);
    }

    updateCalculated(card, report);
  }

  window.__auctionBidPlan = {
    STORAGE_PREFIX,
    FIELD_DEFAULTS,
    storageKey,
    loadPlan,
    savePlan,
    computePlan,
    currentSnapshot,
  };

  setInterval(upsertBidPlanCard, 700);
})();
