(() => {
  const CARD_ID = 'v2FinalJudgmentCard';
  const LOCATION_STORAGE_KEY = 'auction-note:v2:location-geocode';
  const TRADE_STORAGE_KEY = 'auction-note:v2:molit-trades';
  const FINAL_JUDGMENT_STORAGE_KEY = 'auction-note:v2:final-judgment';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function appState() {
    return window.__auctionV2?.state || null;
  }

  function report() {
    return appState()?.report || null;
  }

  function loadJson(key) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function saveFinalJudgment(payload) {
    try {
      sessionStorage.setItem(FINAL_JUDGMENT_STORAGE_KEY, JSON.stringify({
        ...payload,
        savedAt: new Date().toISOString(),
      }));
    } catch (_) {}
  }

  function clearFinalJudgment() {
    try {
      sessionStorage.removeItem(FINAL_JUDGMENT_STORAGE_KEY);
    } catch (_) {}
  }

  function numberValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
    const digits = clean(value).replace(/[^0-9]/g, '');
    return digits ? Math.max(0, Number(digits)) : 0;
  }

  function money(value) {
    const n = Number(value || 0);
    return n ? `${Math.round(n).toLocaleString('ko-KR')}원` : '-';
  }

  function ratioText(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) && n ? `${n.toFixed(1)}%` : '-';
  }

  function bidPlanSnapshot(currentReport) {
    try {
      const snapshot = window.__auctionBidPlan?.currentSnapshot?.(currentReport);
      return snapshot?.plannedBid ? snapshot : null;
    } catch (_) {
      return null;
    }
  }

  function reportMinBid(currentReport) {
    return numberValue(currentReport?.basic?.['최저매각가격'] || currentReport?.basic?.['최저가']);
  }

  function riskText(level) {
    if (level === 'danger') return '높음';
    if (level === 'warn') return '주의';
    return '낮음';
  }

  function tradeCount(trades) {
    return Number(trades?.count || trades?.stats?.count || 0);
  }

  function tradeScope(trades) {
    const count = tradeCount(trades);
    const aptName = clean(trades?.aptName || '');
    const rawCount = Number(trades?.rawCount || 0);
    const hasExactFilter = Boolean(aptName && aptName !== '-' && aptName !== '미적용');
    const veryBroad = count >= 80 || rawCount >= 80;

    if (!count) {
      return {
        level: 'none',
        label: '없음',
        priceComparable: false,
        text: '표시 가능한 실거래가가 없습니다.',
      };
    }

    if (hasExactFilter && !veryBroad) {
      return {
        level: 'specific',
        label: '동일 단지·건물 후보',
        priceComparable: true,
        text: '단지명 또는 건물명 후보가 적용된 실거래가입니다. 그래도 동·층·전용면적은 원본으로 재확인해야 합니다.',
      };
    }

    return {
      level: 'regional',
      label: '지역 참고시세',
      priceComparable: false,
      text: '동일 건물 확정값이 아니라 법정동·행정구역 단위 참고시세입니다. 최종 입찰가 산정에는 직접 반영하지 마세요.',
    };
  }

  function priceScore(comparison, trades) {
    const scope = tradeScope(trades);
    const ratio = Number(comparison?.avgRatio || 0);
    if (!scope.priceComparable || !ratio) return 0;
    if (ratio <= 70) return 2;
    if (ratio <= 90) return 1;
    return -1;
  }

  function riskScore(currentReport) {
    const level = currentReport?.risk?.level || 'ok';
    const inheritedTotal = numberValue(currentReport?.inherited?.total);
    if (level === 'danger') return -3;
    if (level === 'warn') return -1;
    if (inheritedTotal > 0) return -1;
    return 1;
  }

  function evidenceScore(location, trades) {
    let score = 0;
    if (location?.x && location?.y) score += 1;
    const scope = tradeScope(trades);
    if (scope.level === 'specific') score += 1;
    else if (scope.level === 'regional') score += 0.25;
    else score -= 1;
    return score;
  }

  function distanceText(value) {
    const meters = Number(value || 0);
    if (!Number.isFinite(meters) || meters <= 0) return '-';
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  }

  function nearbySummary(location) {
    const categories = Array.isArray(location?.nearby?.categories) ? location.nearby.categories : [];
    if (!categories.length) return '';
    return categories.map((category) => {
      if (category.error) return `${clean(category.label)} 확인 실패`;
      const nearest = Number(category.nearestDistance || 0);
      const count = Number(category.count || 0);
      return `${clean(category.label)} ${count}곳${nearest ? `·최근접 ${distanceText(nearest)}` : ''}`;
    }).join(' / ');
  }

  function finalDecision(currentReport, location, trades) {
    const comparison = trades?.comparison || {};
    const total = riskScore(currentReport) + priceScore(comparison, trades) + evidenceScore(location, trades);
    const riskLevel = currentReport?.risk?.level || 'ok';
    const scope = tradeScope(trades);

    if (riskLevel === 'danger') {
      return { label: '보류', tone: 'danger', score: total, text: '권리 위험이 높아 가격 조건보다 원본 서류 확인이 우선입니다.' };
    }
    if (scope.level !== 'specific' && total >= 2) {
      return { label: '조건부검토', tone: 'warn', score: total, text: '권리와 입지 기초조건은 양호하지만, 실거래가는 지역 참고시세라 가격 판단은 보수적으로 봐야 합니다.' };
    }
    if (total >= 3) {
      return { label: '우선검토', tone: 'ok', score: total, text: '현재 입력값 기준 검토 우선순위를 높일 수 있습니다. 가격은 실거래가 참고지표와 원본 확인을 함께 봐야 합니다.' };
    }
    if (total >= 0) {
      return { label: '조건부검토', tone: 'warn', score: total, text: '추가 비용과 원본 서류 확인을 전제로 검토할 수 있습니다.' };
    }
    return { label: '보류', tone: 'danger', score: total, text: '가격 참고 근거 또는 검토 근거가 부족해 현재 기준으로는 보수적 접근이 필요합니다.' };
  }

  function reasons(currentReport, location, trades) {
    const list = [];
    const riskLevel = currentReport?.risk?.level || 'ok';
    const inheritedTotal = numberValue(currentReport?.inherited?.total);
    const comparison = trades?.comparison || {};
    const count = tradeCount(trades);
    const scope = tradeScope(trades);
    const bidPlan = bidPlanSnapshot(currentReport);

    list.push(`권리 위험도: ${riskText(riskLevel)}`);
    if (inheritedTotal > 0) list.push(`인수 추정금액: ${money(inheritedTotal)} 확인 필요`);
    else list.push('인수 추정금액: 현재 입력값 기준 0원');
    if (bidPlan) list.push(`입찰가 산정: 필요 현금 ${money(bidPlan.requiredCash)} / 세후수익 ${money(bidPlan.afterTaxProfit)}`);

    if (scope.priceComparable && comparison.judgment) list.push(`가격 참고: ${clean(comparison.judgment)}`);
    else if (count > 0) list.push('가격 참고: 지역 참고시세라 최종 입찰가 판단에는 직접 반영하지 않음');
    else list.push('가격 참고: 실거래가 표본 정보 부족');

    const nearby = nearbySummary(location);
    if (location?.x && location?.y) list.push(`입지 확인: 주소 좌표 변환 완료${nearby ? ` · ${nearby}` : ''}`);
    else list.push('입지 확인: 좌표 변환 정보 없음');

    if (count > 0) list.push(`실거래가 표본 수: ${count}건 · ${scope.label}`);
    else list.push('실거래가 표본: 표시 가능한 거래 없음');

    if (scope.level === 'regional') list.push('주의: 동일 단지·동·층·전용면적 매칭 전까지 평균가 비율은 참고값으로만 사용');
    if (scope.level === 'specific') list.push('주의: 동일 단지 후보라도 동·층·전용면적 매칭 필요');

    return list.slice(0, 7);
  }

  function nextChecks(currentReport, location, trades, bidPlan) {
    const list = [];
    const riskLevel = currentReport?.risk?.level || 'ok';
    const inheritedTotal = numberValue(currentReport?.inherited?.total);
    const scope = tradeScope(trades);

    if (riskLevel === 'danger') list.push('권리 원본 재확인: 등기부, 매각물건명세서, 전입세대열람을 먼저 대조');
    if (inheritedTotal > 0) list.push('인수금액 검증: 미배당 보증금·특수권리 금액을 실질 부담액에 포함');
    if (!bidPlan) list.push('입찰가 산정 입력: 입찰 예정가, 대출, 보유비용, 예상 매도가 입력');
    else if (bidPlan.afterTaxProfit < 0) list.push('수익성 재검토: 세후수익이 음수라 입찰가·비용·매도가 조정 필요');
    if (!location?.x || !location?.y) list.push('입지 확인: 주소 좌표 변환 후 주변시설·현장성 확인');
    if (scope.level !== 'specific') list.push('시세 검증: 동일 단지·전용면적·층 매칭 거래로 재확인');
    list.push('최종 전 점검: 현장 점유자, 명도 가능성, 대출 가능액, 세금 전문가 확인');

    return Array.from(new Set(list)).slice(0, 6);
  }

  function buildSnapshot(currentReport, location, trades) {
    const decision = finalDecision(currentReport, location, trades);
    const comparison = trades?.comparison || {};
    const inheritedTotal = numberValue(currentReport?.inherited?.total);
    const minBid = reportMinBid(currentReport);
    const count = tradeCount(trades);
    const scope = tradeScope(trades);
    const avgRatio = scope.priceComparable ? Number(comparison.avgRatio || 0) : 0;
    const bidPlan = bidPlanSnapshot(currentReport);
    return {
      decision,
      reasons: reasons(currentReport, location, trades),
      riskLevel: currentReport?.risk?.level || 'ok',
      riskText: riskText(currentReport?.risk?.level || 'ok'),
      minBid,
      minBidText: money(minBid),
      inheritedTotal,
      inheritedTotalText: money(inheritedTotal),
      minBidBurden: minBid + inheritedTotal,
      minBidBurdenText: money(minBid + inheritedTotal),
      tradeCount: count,
      tradeScope: scope.label,
      tradeScopeLevel: scope.level,
      tradeScopeNote: scope.text,
      priceComparable: scope.priceComparable,
      avgRatio,
      comparisonJudgment: scope.priceComparable ? clean(comparison.judgment || '') : '지역 참고시세라 평균가 비율은 최종 판단에 직접 반영하지 않습니다.',
      hasLocation: Boolean(location?.x && location?.y),
      nearbyComplete: Boolean(location?.nearby?.complete),
      nearbySummary: nearbySummary(location) || '미확인',
      bidPlan: bidPlan ? {
        plannedBid: bidPlan.plannedBid,
        expectedSalePrice: bidPlan.expectedSalePrice,
        loanAmount: bidPlan.loanAmount,
        totalBurden: bidPlan.totalBurden,
        totalCost: bidPlan.totalCost,
        requiredCash: bidPlan.requiredCash,
        breakEvenSalePrice: bidPlan.breakEvenSalePrice,
        holdingMonthlyCost: bidPlan.holdingMonthlyCost,
        afterTaxProfit: bidPlan.afterTaxProfit,
        roi: bidPlan.roi,
        message: clean(bidPlan.message || ''),
      } : null,
      nextChecks: nextChecks(currentReport, location, trades, bidPlan),
    };
  }

  function findAnchor() {
    return document.getElementById('v2MolitTradeCard')
      || document.getElementById('v2LocationCard')
      || document.getElementById('v2BiddingSummaryCard')
      || document.getElementById('v2PreBidChecklistCard')
      || null;
  }

  function pillClass(tone) {
    if (tone === 'ok') return 'ok';
    if (tone === 'danger') return 'danger';
    return 'warn';
  }

  function bidPlanSummaryHtml(snapshot) {
    const plan = snapshot.bidPlan;
    if (!plan) return '';
    return `
      <div class="v2-info"><div class="k">입찰 예정가</div><div class="v">${esc(money(plan.plannedBid))}</div></div>
      <div class="v2-info"><div class="k">입찰가 기준 실질부담</div><div class="v">${esc(money(plan.totalBurden))}</div></div>
      <div class="v2-info"><div class="k">필요 현금</div><div class="v">${esc(money(plan.requiredCash))}</div></div>
      <div class="v2-info"><div class="k">세후수익</div><div class="v">${esc(money(plan.afterTaxProfit))}</div></div>
      <div class="v2-info"><div class="k">수익률</div><div class="v">${esc(plan.expectedSalePrice ? ratioText(plan.roi) : '-')}</div></div>
      <div class="v2-info"><div class="k">손익분기 매도가</div><div class="v">${esc(money(plan.breakEvenSalePrice))}</div></div>
    `;
  }

  function renderCard(currentReport, location, trades) {
    const snapshot = buildSnapshot(currentReport, location, trades);
    const decision = snapshot.decision;

    return `
      <section class="v2-card" id="${CARD_ID}">
        <span class="v2-badge">검토 방향</span>
        <h3>입찰 판단 종합</h3>
        <p class="v2-note">권리위험, 인수금액, 입지 확인, 실거래가 참고지표를 묶어 현재 검토 방향을 정리합니다.</p>
        <div class="v2-grid compact">
          <div class="v2-info wide"><div class="k">최종 검토 방향</div><div class="v"><span class="v2-pill ${pillClass(decision.tone)}">${esc(decision.label)}</span></div><p class="v2-note">${esc(decision.text)}</p></div>
          <div class="v2-info"><div class="k">권리 위험도</div><div class="v">${esc(snapshot.riskText)}</div></div>
          <div class="v2-info"><div class="k">최저가</div><div class="v">${esc(snapshot.minBidText)}</div></div>
          <div class="v2-info"><div class="k">인수 추정금액</div><div class="v">${esc(snapshot.inheritedTotalText)}</div></div>
          <div class="v2-info"><div class="k">최저가 기준 실질부담</div><div class="v">${esc(snapshot.minBidBurdenText)}</div></div>
          <div class="v2-info"><div class="k">실거래가 표본 수</div><div class="v">${esc(`${snapshot.tradeCount}건`)}</div></div>
          <div class="v2-info"><div class="k">참고 범위</div><div class="v">${esc(snapshot.tradeScope)}</div></div>
          <div class="v2-info"><div class="k">최저가/평균가 참고비율</div><div class="v">${esc(snapshot.avgRatio ? `${snapshot.avgRatio.toFixed(1)}%` : '-')}</div></div>
          <div class="v2-info wide"><div class="k">주변시설 분석</div><div class="v">${esc(snapshot.nearbySummary)}</div></div>
          ${bidPlanSummaryHtml(snapshot)}
        </div>
        <p class="v2-note">${esc(snapshot.tradeScopeNote)}</p>
        ${snapshot.bidPlan ? `<p class="v2-note">${esc(snapshot.bidPlan.message || '입찰가 산정은 참고 계산이며 대출 가능 여부와 세금은 별도 확인이 필요합니다.')}</p>` : ''}
        <ul class="v2-check-list">
          ${snapshot.reasons.map((item) => `<li>${esc(item)}</li>`).join('')}
        </ul>
        <h4 class="v2-detail-title">다음 확인순서</h4>
        <ol class="v2-check-list">
          ${snapshot.nextChecks.map((item) => `<li>${esc(item)}</li>`).join('')}
        </ol>
        <p class="v2-note">이 판단은 입력값 기반 참고용입니다. 실거래가는 수익 예측이나 적정가 확정값이 아니며, 실제 입찰 전 등기부, 매각물건명세서, 점유관계, 현장조사, 추가비용을 반드시 재확인해야 합니다.</p>
      </section>
    `;
  }

  function upsertFinalJudgment() {
    const currentReport = report();
    const anchor = findAnchor();
    const existing = document.getElementById(CARD_ID);

    if (!currentReport || !anchor) {
      existing?.remove();
      clearFinalJudgment();
      return;
    }

    const location = loadJson(LOCATION_STORAGE_KEY);
    const trades = loadJson(TRADE_STORAGE_KEY);
    const snapshot = buildSnapshot(currentReport, location, trades);
    saveFinalJudgment(snapshot);
    const html = renderCard(currentReport, location, trades);

    if (existing) existing.outerHTML = html;
    else anchor.insertAdjacentHTML('afterend', html);
  }

  setInterval(upsertFinalJudgment, 900);
})();
