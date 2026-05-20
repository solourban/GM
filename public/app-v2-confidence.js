(() => {
  const CARD_ID = 'v2DecisionConfidenceCard';
  const LOCATION_KEY = 'auction-note:v2:location-geocode';
  const TRADE_KEY = 'auction-note:v2:molit-trades';
  const FINAL_KEY = 'auction-note:v2:final-judgment';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function appState() {
    return window.__auctionV2?.state || null;
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

  function hasBasicInfo(state) {
    return Boolean(state?.raw?.caseNo || state?.report?.case || state?.report?.caseNo);
  }

  function hasRightsAnalysis(report) {
    return Boolean(report?.risk || Array.isArray(report?.rights) || Array.isArray(report?.tenants));
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
    if (!count) return { key: 'none', label: '없음', ok: false, partial: false, miss: '실거래가 표본 없음' };
    if (hasExactFilter && !veryBroad) return { key: 'specific', label: '동일 단지·건물 후보', ok: true, partial: false, miss: '' };
    return { key: 'regional', label: '지역 참고시세', ok: false, partial: true, miss: '동일 건물·면적 실거래가 미확인' };
  }

  function qualitySnapshot() {
    const state = appState();
    const report = state?.report || null;
    const location = loadJson(LOCATION_KEY);
    const trades = loadJson(TRADE_KEY);
    const finalJudgment = loadJson(FINAL_KEY);
    const count = tradeCount(trades);
    const scope = tradeScope(trades);
    const minBid = numberValue(report?.basic?.['최저매각가격'] || report?.basic?.['최저가']);
    const checks = [
      { key: 'basic', label: '기본정보', ok: hasBasicInfo(state), partial: false, miss: '사건 기본정보 없음', weight: 12 },
      { key: 'rights', label: '권리분석', ok: hasRightsAnalysis(report), partial: false, miss: '권리분석 결과 없음', weight: 18 },
      { key: 'minBid', label: '최저가', ok: minBid > 0, partial: false, miss: '최저매각가격 없음', weight: 12 },
      { key: 'location', label: '입지 좌표', ok: Boolean(location?.x && location?.y), partial: false, miss: '주소 좌표 미확인', weight: 12 },
      { key: 'bCode', label: '법정동코드', ok: Boolean(location?.bCode), partial: false, miss: '법정동코드 미확인', weight: 12 },
      { key: 'trades', label: '실거래가', ok: scope.ok, partial: scope.partial, miss: scope.miss, weight: 14 },
      { key: 'comparison', label: '가격비교', ok: scope.ok && Boolean(trades?.comparison?.avgRatio), partial: scope.partial && Boolean(trades?.comparison?.avgRatio), miss: scope.partial ? '지역 참고시세 기준 가격비교' : '최저가와 실거래가 비교 불가', weight: 10 },
      { key: 'final', label: '종합판단', ok: Boolean(finalJudgment?.decision?.label), partial: false, miss: '입찰 판단 종합 미생성', weight: 10 },
    ];

    const pass = checks.filter((item) => item.ok).length;
    const total = checks.length;
    const ratio = Math.round(checks.reduce((sum, item) => {
      if (item.ok) return sum + item.weight;
      if (item.partial) return sum + Math.round(item.weight * 0.45);
      return sum;
    }, 0));
    let label = '낮음';
    let tone = 'danger';
    let message = '판단 근거가 부족합니다. 누락 항목을 먼저 보완해야 합니다.';
    if (ratio >= 85) {
      label = '높음';
      tone = 'ok';
      message = '기초 데이터가 비교적 충분합니다. 그래도 원본 서류와 현장 확인은 필요합니다.';
    } else if (ratio >= 60) {
      label = '보통';
      tone = 'warn';
      message = '핵심 데이터는 모였지만, 일부 항목은 참고값입니다. 보완 후 판단해야 합니다.';
    }
    return {
      checks,
      pass,
      total,
      ratio,
      label,
      tone,
      message,
      missing: checks.filter((item) => !item.ok).map((item) => item.miss).filter(Boolean),
      tradeCount: count,
      tradeScope: scope.label,
    };
  }

  function pillClass(tone) {
    if (tone === 'ok') return 'ok';
    if (tone === 'danger') return 'danger';
    return 'warn';
  }

  function findAnchor() {
    return document.getElementById('v2FinalJudgmentCard')
      || document.getElementById('v2MolitTradeCard')
      || document.getElementById('v2LocationCard')
      || document.getElementById('v2BiddingSummaryCard')
      || null;
  }

  function renderCheck(item) {
    const mark = item.ok ? '확인' : (item.partial ? '참고' : '누락');
    const tone = item.ok ? 'ok' : 'warn';
    return `<div class="v2-info"><div class="k">${esc(item.label)}</div><div class="v"><span class="v2-pill ${tone}">${esc(mark)}</span></div></div>`;
  }

  function renderCard(snapshot) {
    const missingText = snapshot.missing.length ? snapshot.missing.join(' / ') : '주요 누락 항목 없음';
    return `
      <section class="v2-card" id="${CARD_ID}">
        <span class="v2-badge">데이터 품질</span>
        <h3>판단 신뢰도</h3>
        <p class="v2-note">현재 입찰 판단이 어느 정도 데이터에 근거하는지 확인합니다. 신뢰도가 낮으면 최종 판단보다 누락 항목 보완이 우선입니다.</p>
        <div class="v2-grid compact">
          <div class="v2-info wide">
            <div class="k">현재 판단 신뢰도</div>
            <div class="v"><span class="v2-pill ${pillClass(snapshot.tone)}">${esc(snapshot.label)} · ${esc(`${snapshot.ratio}%`)}</span></div>
            <p class="v2-note">${esc(snapshot.message)}</p>
          </div>
          <div class="v2-info"><div class="k">확인 항목</div><div class="v">${esc(`${snapshot.pass}/${snapshot.total}`)}</div></div>
          <div class="v2-info"><div class="k">실거래가 표본</div><div class="v">${esc(`${snapshot.tradeCount}건`)}</div></div>
          <div class="v2-info"><div class="k">시세 근거 범위</div><div class="v">${esc(snapshot.tradeScope)}</div></div>
          <div class="v2-info wide"><div class="k">누락·주의 항목</div><div class="v">${esc(missingText)}</div></div>
          ${snapshot.checks.map(renderCheck).join('')}
        </div>
      </section>
    `;
  }

  function upsertConfidenceCard() {
    const state = appState();
    const existing = document.getElementById(CARD_ID);
    if (!state?.report) {
      existing?.remove();
      return;
    }
    const anchor = findAnchor();
    if (!anchor) return;
    const html = renderCard(qualitySnapshot());
    if (existing) existing.outerHTML = html;
    else anchor.insertAdjacentHTML('afterend', html);
  }

  setInterval(upsertConfidenceCard, 1000);
})();
