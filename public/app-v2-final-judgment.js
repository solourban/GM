(() => {
  const CARD_ID = 'v2FinalJudgmentCard';
  const LOCATION_STORAGE_KEY = 'auction-note:v2:location-geocode';
  const TRADE_STORAGE_KEY = 'auction-note:v2:molit-trades';
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

  function priceScore(comparison) {
    const ratio = Number(comparison?.avgRatio || 0);
    if (!ratio) return 0;
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
    const count = Number(trades?.count || trades?.stats?.count || 0);
    if (count >= 5) score += 1;
    else if (count === 0) score -= 1;
    return score;
  }

  function finalDecision(currentReport, location, trades) {
    const comparison = trades?.comparison || {};
    const total = riskScore(currentReport) + priceScore(comparison) + evidenceScore(location, trades);
    const riskLevel = currentReport?.risk?.level || 'ok';

    if (riskLevel === 'danger') {
      return { label: '보류', tone: 'danger', score: total, text: '권리 위험이 높아 가격 조건보다 원본 서류 확인이 우선입니다.' };
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
    const count = Number(trades?.count || trades?.stats?.count || 0);

    list.push(`권리 위험도: ${riskText(riskLevel)}`);
    if (inheritedTotal > 0) list.push(`인수 추정금액: ${money(inheritedTotal)} 확인 필요`);
    else list.push('인수 추정금액: 현재 입력값 기준 0원');

    if (comparison.judgment) list.push(`가격 비교: ${clean(comparison.judgment)}`);
    else list.push('가격 비교: 실거래가 비교 정보 부족');

    if (location?.x && location?.y) list.push('입지 확인: 주소 좌표 변환 완료');
    else list.push('입지 확인: 좌표 변환 정보 없음');

    if (count >= 5) list.push(`실거래가 표본: ${count}건으로 참고 가능`);
    else if (count > 0) list.push(`실거래가 표본: ${count}건으로 표본 부족 주의`);
    else list.push('실거래가 표본: 표시 가능한 거래 없음');

    return list.slice(0, 6);
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
    const decision = finalDecision(currentReport, location, trades);
    const comparison = trades?.comparison || {};
    const inheritedTotal = numberValue(currentReport?.inherited?.total);
    const tradeCount = Number(trades?.count || trades?.stats?.count || 0);

    return `
      <section class="v2-card" id="${CARD_ID}">
        <span class="v2-badge">종합 판단</span>
        <h3>입찰 판단 종합</h3>
        <p class="v2-note">권리위험, 인수금액, 입지 확인, 실거래가 표본, 가격 비교를 묶어 현재 검토 방향을 정리합니다.</p>
        <div class="v2-grid compact">
          <div class="v2-info wide"><div class="k">최종 검토 방향</div><div class="v"><span class="v2-pill ${pillClass(decision.tone)}">${esc(decision.label)}</span></div><p class="v2-note">${esc(decision.text)}</p></div>
          <div class="v2-info"><div class="k">권리 위험도</div><div class="v">${esc(riskText(currentReport?.risk?.level || 'ok'))}</div></div>
          <div class="v2-info"><div class="k">인수 추정금액</div><div class="v">${esc(money(inheritedTotal))}</div></div>
          <div class="v2-info"><div class="k">실거래가 표본</div><div class="v">${esc(`${tradeCount}건`)}</div></div>
          <div class="v2-info"><div class="k">최저가/평균가</div><div class="v">${esc(comparison.avgRatio ? `${Number(comparison.avgRatio).toFixed(1)}%` : '-')}</div></div>
        </div>
        <ul class="v2-check-list">
          ${reasons(currentReport, location, trades).map((item) => `<li>${esc(item)}</li>`).join('')}
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
      return;
    }

    const location = loadJson(LOCATION_STORAGE_KEY);
    const trades = loadJson(TRADE_STORAGE_KEY);
    const html = renderCard(currentReport, location, trades);

    if (existing) existing.outerHTML = html;
    else anchor.insertAdjacentHTML('afterend', html);
  }

  setInterval(upsertFinalJudgment, 900);
})();
