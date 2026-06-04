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
        text: '단지명 또는 건물명 후보가 적용된 실거래가입니다. 그래도 동·층·면적은 원본으로 재확인해야 합니다.',
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
      return { label: '적극검토', tone: 'ok', score: total, text: '현재 입력값 기준 권리·가격·입지 기초조건이 비교적 양호합니다.' };
    }
    if (total >= 0) {
      return { label: '조건부검토', tone: 'warn', score: total, text: '추가 비용과 원본 서류 확인을 전제로 검토할 수 있습니다.' };
    }
    return { label: '보류', tone: 'danger', score: total, text: '가격 매력 또는 검토 근거가 부족해 현재 기준으로는 보수적 접근이 필요합니다.' };
  }

  function reasons(currentReport, location, trades) {
    const list = [];
    const riskLevel = currentReport?.risk?.level || 'ok';
    const inheritedTotal = numberValue(currentReport?.inherited?.total);
    const comparison = trades?.comparison || {};
    const count = tradeCount(trades);
    const scope = tradeScope(trades);

    list.push(`권리 위험도: ${riskText(riskLevel)}`);
    if (inheritedTotal > 0) list.push(`인수 추정금액: ${money(inheritedTotal)} 확인 필요`);
    else list.push('인수 추정금액: 현재 입력값 기준 0원');

    if (scope.priceComparable && comparison.judgment) list.push(`가격 비교: ${clean(comparison.judgment)}`);
    else if (count > 0) list.push('가격 비교: 지역 참고시세라 최종 입찰가 판단에는 직접 반영하지 않음');
    else list.push('가격 비교: 실거래가 비교 정보 부족');

    const nearby = nearbySummary(location);
    if (location?.x && location?.y) list.push(`입지 확인: 주소 좌표 변환 완료${nearby ? ` · ${nearby}` : ''}`);
    else list.push('입지 확인: 좌표 변환 정보 없음');

    if (count > 0) list.push(`실거래가 표본: ${count}건 · ${scope.label}`);
    else list.push('실거래가 표본: 표시 가능한 거래 없음');

    if (scope.level === 'regional') list.push('주의: 동일 단지·동·층·면적 매칭 전까지 평균가 비율은 참고값으로만 사용');

    return list.slice(0, 6);
  }

  function buildSnapshot(currentReport, location, trades) {
    const decision = finalDecision(currentReport, location, trades);
    const comparison = trades?.comparison || {};
    const inheritedTotal = numberValue(currentReport?.inherited?.total);
    const count = tradeCount(trades);
    const scope = tradeScope(trades);
    const avgRatio = scope.priceComparable ? Number(comparison.avgRatio || 0) : 0;
    return {
      decision,
      reasons: reasons(currentReport, location, trades),
      riskLevel: currentReport?.risk?.level || 'ok',
      riskText: riskText(currentReport?.risk?.level || 'ok'),
      inheritedTotal,
      inheritedTotalText: money(inheritedTotal),
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

  function renderCard(currentReport, location, trades) {
    const snapshot = buildSnapshot(currentReport, location, trades);
    const decision = snapshot.decision;

    return `
      <section class="v2-card" id="${CARD_ID}">
        <span class="v2-badge">종합 판단</span>
        <h3>입찰 판단 종합</h3>
        <p class="v2-note">권리위험, 인수금액, 입지 확인, 실거래가 표본, 가격 비교를 묶어 현재 검토 방향을 정리합니다.</p>
        <div class="v2-grid compact">
          <div class="v2-info wide"><div class="k">최종 검토 방향</div><div class="v"><span class="v2-pill ${pillClass(decision.tone)}">${esc(decision.label)}</span></div><p class="v2-note">${esc(decision.text)}</p></div>
          <div class="v2-info"><div class="k">권리 위험도</div><div class="v">${esc(snapshot.riskText)}</div></div>
          <div class="v2-info"><div class="k">인수 추정금액</div><div class="v">${esc(snapshot.inheritedTotalText)}</div></div>
          <div class="v2-info"><div class="k">실거래가 표본</div><div class="v">${esc(`${snapshot.tradeCount}건`)}</div></div>
          <div class="v2-info"><div class="k">시세 근거 범위</div><div class="v">${esc(snapshot.tradeScope)}</div></div>
          <div class="v2-info"><div class="k">최저가/평균가</div><div class="v">${esc(snapshot.avgRatio ? `${snapshot.avgRatio.toFixed(1)}%` : '-')}</div></div>
          <div class="v2-info wide"><div class="k">주변시설 분석</div><div class="v">${esc(snapshot.nearbySummary)}</div></div>
        </div>
        <p class="v2-note">${esc(snapshot.tradeScopeNote)}</p>
        <ul class="v2-check-list">
          ${snapshot.reasons.map((item) => `<li>${esc(item)}</li>`).join('')}
        </ul>
        <p class="v2-note">이 판단은 입력값 기반 참고용입니다. 실제 입찰 전 등기부, 매각물건명세서, 점유관계, 현장조사, 추가비용을 반드시 재확인해야 합니다.</p>
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
