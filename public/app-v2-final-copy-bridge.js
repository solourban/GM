(() => {
  const CARD_ID = 'v2FinalCopyCard';
  const TEXTAREA_ID = 'v2FinalCopyTextarea';
  const STATUS_ID = 'v2FinalCopyStatus';
  const FINAL_KEY = 'auction-note:v2:final-judgment';
  const LOCATION_KEY = 'auction-note:v2:location-geocode';
  const TRADE_KEY = 'auction-note:v2:molit-trades';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const copyState = { status: '', statusTone: 'ok' };

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

  function summarySignature(summary) {
    return `${summary.length}:${summary.slice(0, 48)}:${summary.slice(-48)}`;
  }

  function tradeScopeInfo(judgment, trades) {
    const rawScope = trades?.tradeScope || {};
    const level = clean(judgment?.tradeScopeLevel || rawScope.level || trades?.comparison?.scopeLevel || '');
    const label = clean(judgment?.tradeScope || rawScope.label || trades?.comparison?.scopeLabel || '');
    const comparable = Boolean(judgment?.priceComparable || trades?.comparison?.priceComparable || rawScope.priceComparable);
    if (level || label) {
      return {
        level: level || (comparable ? 'specific' : 'regional'),
        label: label || (comparable ? '동일 단지·건물 후보' : '지역 참고시세'),
        comparable,
      };
    }
    const count = Number(trades?.count || trades?.stats?.count || 0);
    if (!count) return { level: 'none', label: '없음', comparable: false };
    return { level: 'regional', label: '지역 참고시세', comparable: false };
  }

  function ratioText(ratio, scope) {
    const n = Number(ratio || 0);
    if (!n) return '-';
    if (!scope?.comparable) return `${n.toFixed(1)}% (지역 참고값·입찰가 산정 직접 반영 금지)`;
    return `${n.toFixed(1)}%`;
  }

  function regionalCaveat(scope) {
    if (scope?.level === 'specific' && scope?.comparable) return '';
    if (scope?.level === 'none') return '실거래가 표본이 없어 가격 비교 판단을 보류해야 합니다.';
    return '실거래가는 동일 건물·동·층·면적 매칭 전까지 지역 참고시세로만 보고, 최종 입찰가 산정에는 직접 반영하지 마세요.';
  }

  function buildSummary() {
    const report = appState()?.report;
    if (!report) return '';
    const judgment = loadJson(FINAL_KEY);
    const location = loadJson(LOCATION_KEY);
    const trades = loadJson(TRADE_KEY);
    const comparison = trades?.comparison || {};
    const scope = tradeScopeInfo(judgment, trades);
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
      lines.push(`- 실거래가 표본: ${Number(judgment.tradeCount || trades?.count || 0)}건`);
      lines.push(`- 시세 근거 범위: ${scope.label}`);
      lines.push(`- 최저가/평균가: ${ratioText(judgment.avgRatio || comparison.avgRatio, scope)}`);
      lines.push(`- 입지 좌표 확인: ${judgment.hasLocation ? '완료' : '미확인'}`);
      if (judgment.comparisonJudgment) lines.push(`- 가격 비교 판단: ${clean(judgment.comparisonJudgment)}`);
      else if (comparison.judgment) lines.push(`- 가격 비교 판단: ${clean(comparison.judgment)}`);
      const caveat = regionalCaveat(scope);
      if (caveat) lines.push(`- 시세 주의: ${caveat}`);
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
      lines.push(`- 시세 근거 범위: ${scope.label}`);
      if (trades.judgment) lines.push(`- 거래 판단: ${clean(trades.judgment)}`);
      if (comparison.judgment) lines.push(`- 가격 비교 판단: ${clean(comparison.judgment)}`);
      if (comparison.avgRatio) lines.push(`- 최저가/평균가: ${ratioText(comparison.avgRatio, scope)}`);
      const caveat = regionalCaveat(scope);
      if (caveat) lines.push(`- 실거래가 해석 주의: ${caveat}`);
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

  function renderStatus() {
    if (!copyState.status) return '';
    return `<div class="v2-form-message show ${copyState.statusTone === 'warn' ? 'warn' : 'ok'}" id="${STATUS_ID}">${esc(copyState.status)}</div>`;
  }

  function renderCard(summary) {
    return `
      <section class="v2-card" id="${CARD_ID}" data-summary-signature="${esc(summarySignature(summary))}">
        <span class="v2-badge">종합 요약</span>
        <h3>종합 판단 포함 요약</h3>
        <p class="v2-note">버튼 한 번으로 권리·입지·실거래가·가격비교·최종 판단을 함께 복사합니다. 복사가 막히면 전체 선택 후 직접 복사하면 됩니다.</p>
        <div class="v2-cta-row">
          <button type="button" class="v2-btn" data-final-copy-action="copy">종합 요약 복사</button>
          <button type="button" class="v2-secondary-btn" data-final-copy-action="select">전체 선택</button>
          <span class="v2-note">카톡·메모장·노션에 바로 붙여넣기용</span>
        </div>
        ${renderStatus()}
        <textarea id="${TEXTAREA_ID}" readonly style="width:100%;min-height:300px;border:1px solid rgba(148,163,184,.35);border-radius:14px;padding:14px;font:13px/1.6 monospace;background:rgba(15,23,42,.03);white-space:pre-wrap;">${esc(summary)}</textarea>
      </section>
    `;
  }

  function updateStatus(message, tone = 'ok') {
    copyState.status = message;
    copyState.statusTone = tone;
    const existing = document.getElementById(STATUS_ID);
    if (existing) {
      existing.className = `v2-form-message show ${tone === 'warn' ? 'warn' : 'ok'}`;
      existing.textContent = message;
    }
  }

  function selectSummary() {
    const textarea = document.getElementById(TEXTAREA_ID);
    if (!textarea) return false;
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return true;
  }

  function fallbackCopy(summary) {
    const textarea = document.getElementById(TEXTAREA_ID);
    if (textarea) {
      textarea.value = summary;
      selectSummary();
      try {
        if (document.execCommand && document.execCommand('copy')) return true;
      } catch (_) {}
    }

    const temp = document.createElement('textarea');
    temp.value = summary;
    temp.setAttribute('readonly', '');
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    temp.style.pointerEvents = 'none';
    document.body.appendChild(temp);
    temp.focus();
    temp.select();
    try {
      return Boolean(document.execCommand && document.execCommand('copy'));
    } catch (_) {
      return false;
    } finally {
      temp.remove();
    }
  }

  async function copySummary() {
    const summary = buildSummary();
    if (!summary) {
      updateStatus('복사할 종합 요약이 없습니다. 먼저 권리분석을 실행하세요.', 'warn');
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary);
        updateStatus('종합 요약을 클립보드에 복사했습니다. 원하는 곳에 붙여넣으세요.');
        return;
      }
    } catch (_) {}

    if (fallbackCopy(summary)) {
      updateStatus('종합 요약을 복사했습니다. 붙여넣기가 안 되면 전체 선택 상태에서 직접 복사하세요.');
    } else {
      selectSummary();
      updateStatus('브라우저가 자동 복사를 막았습니다. 아래 내용이 전체 선택되어 있으니 직접 복사하세요.', 'warn');
    }
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
    const signature = summarySignature(summary);
    if (existing?.dataset.summarySignature === signature) return;
    const html = renderCard(summary);
    if (existing) existing.outerHTML = html;
    else anchor.insertAdjacentHTML('afterend', html);
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-final-copy-action]');
    if (!button) return;
    if (button.dataset.finalCopyAction === 'copy') copySummary();
    if (button.dataset.finalCopyAction === 'select') {
      if (selectSummary()) updateStatus('전체 선택했습니다. Ctrl+C 또는 길게 눌러 복사하세요.');
      else updateStatus('선택할 종합 요약이 없습니다.', 'warn');
    }
  });

  setInterval(upsertCard, 1200);
})();
