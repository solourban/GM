(() => {
  function krw(n) {
    const num = Number(n || 0);
    if (!num) return '-';
    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(Math.round(num));
    const eok = Math.floor(abs / 100000000);
    const man = Math.floor((abs % 100000000) / 10000);
    const parts = [];
    if (eok) parts.push(`${eok}억`);
    if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
    return sign + (parts.join(' ') || '0') + '원';
  }

  function parseKrw(value) {
    const digits = String(value || '').replace(/[^0-9]/g, '');
    return digits ? Number(digits) : 0;
  }

  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function injectStyles() {
    if (document.getElementById('platformPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'platformPatchStyles';
    style.textContent = `
      .platform-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-top:14px; }
      .platform-score { display:flex; align-items:center; gap:18px; flex-wrap:wrap; }
      .score-circle { width:96px; height:96px; border-radius:50%; display:grid; place-items:center; background:var(--ink); color:var(--accent-ink); font-family:var(--font-serif); font-size:28px; font-weight:800; box-shadow: inset 0 0 0 8px rgba(244,233,199,.14); }
      .score-copy { flex:1; min-width:220px; }
      .score-copy h4 { margin:0 0 6px; }
      .mini-metric { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:14px; }
      .mini-metric .k { color:var(--ink-3); font-size:12px; }
      .mini-metric .v { font-family:var(--font-serif); font-weight:800; font-size:20px; }
      .checklist { display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:10px; margin-top:12px; }
      .check-item { border:1px solid var(--line); border-radius:12px; padding:12px; background:#fff; }
      .check-item label { display:flex; gap:8px; align-items:flex-start; cursor:pointer; }
      .check-item b { display:block; font-size:13.5px; }
      .check-item span { display:block; color:var(--ink-3); font-size:12px; margin-top:2px; }
      .strategy-list { display:grid; gap:10px; margin-top:12px; }
      .strategy-item { border-left:4px solid var(--accent); background:var(--bg); border-radius:0 10px 10px 0; padding:12px 14px; }
      .strategy-item.warn { border-left-color:var(--warn); background:var(--warn-bg); }
      .strategy-item.danger { border-left-color:var(--danger); background:var(--danger-bg); }
    `;
    document.head.appendChild(style);
  }

  function analyzePlatformGaps(report) {
    const appraisal = parseKrw(report.basic?.['감정평가액'] || report.basic?.['감정가']);
    const minBid = parseKrw(report.basic?.['최저매각가격'] || report.basic?.['최저가']);
    const inherited = Number(report.inherited?.total || 0);
    const tenants = report.tenants || [];
    const rights = report.rights || [];
    const riskLevel = report.risk?.level || 'warn';
    const hasTenant = tenants.length > 0;
    const daehang = tenants.filter((t) => t.daehang === '있음');
    const unknownTenant = tenants.filter((t) => !t.moveIn || t.daehang === '?' || t.daehang === '확인필요');
    const special = rights.filter((r) => /유치권|법정지상권|분묘기지권/.test(r.type || ''));

    const missing = [];
    if (!appraisal || !minBid) missing.push('감정가/최저가 원본 재확인');
    if (!report.malso?.date) missing.push('말소기준권리 접수일');
    if (hasTenant && unknownTenant.length) missing.push('임차인 전입일·확정일자');
    if (hasTenant && tenants.some((t) => !t.deposit)) missing.push('임차인 보증금');
    if (hasTenant) missing.push('배당요구 여부');
    if (special.length) missing.push('특수권리 원본 문구');

    let score = 82;
    if (riskLevel === 'warn') score -= 16;
    if (riskLevel === 'danger') score -= 34;
    score -= Math.min(30, Math.round((inherited / Math.max(minBid || 1, 1)) * 70));
    score -= daehang.length * 8;
    score -= unknownTenant.length * 10;
    score -= special.length * 18;
    score -= Math.min(18, missing.length * 4);
    score = Math.max(5, Math.min(95, score));

    const confidence = Math.max(35, Math.min(92, 92 - missing.length * 7 - unknownTenant.length * 8 - special.length * 10));
    const safetyMargin = appraisal && minBid ? appraisal - minBid - inherited : 0;
    const safetyMarginRate = appraisal ? (safetyMargin / appraisal) * 100 : 0;

    return { appraisal, minBid, inherited, tenants, daehang, unknownTenant, special, missing, score, confidence, safetyMargin, safetyMarginRate };
  }

  function renderPlatformSummary(report) {
    const g = analyzePlatformGaps(report);
    const scoreLabel = g.score >= 75 ? '검토 가능' : g.score >= 50 ? '주의 검토' : '고위험';
    const scoreClass = g.score >= 75 ? '' : g.score >= 50 ? 'warn' : 'danger';
    const marginClass = g.safetyMargin > 0 ? '' : 'danger';
    const missingText = g.missing.length ? g.missing.map(esc).join(', ') : '핵심 입력값은 대체로 입력됨';

    return `
      <div class="subcard input-card platform-card">
        <div class="platform-score">
          <div class="score-circle">${g.score}</div>
          <div class="score-copy">
            <h4>🧭 투자판단 스코어 · ${scoreLabel}</h4>
            <p class="muted">권리위험, 인수금액, 임차인 정보 완성도, 특수권리 여부를 합산한 내부 참고점수입니다.</p>
            <div class="note ${scoreClass ? scoreClass + '-note' : ''}">누락·재확인 항목: ${missingText}</div>
          </div>
        </div>
        <div class="platform-grid">
          <div class="mini-metric"><div class="k">분석 신뢰도</div><div class="v">${g.confidence}%</div></div>
          <div class="mini-metric"><div class="k">시세 대비 안전마진</div><div class="v ${marginClass}">${krw(g.safetyMargin)}</div></div>
          <div class="mini-metric"><div class="k">안전마진율</div><div class="v ${marginClass}">${g.safetyMarginRate.toFixed(1)}%</div></div>
          <div class="mini-metric"><div class="k">대항력 임차인</div><div class="v ${g.daehang.length ? 'danger' : ''}">${g.daehang.length}명</div></div>
        </div>
      </div>`;
  }

  function renderDueDiligenceChecklist(report) {
    const g = analyzePlatformGaps(report);
    const items = [
      ['등기부등본', '말소기준권리·선순위 권리·가처분·가등기 확인', Boolean(report.malso?.date)],
      ['매각물건명세서', '최선순위 설정, 임차내역, 비고란 특수조건 확인', true],
      ['현황조사서', '실제 점유자, 전입자, 조사 불능 문구 확인', false],
      ['전입세대확인서', '등기부에 안 나오는 임차인 전입일 확인', g.tenants.length > 0 && !g.unknownTenant.length],
      ['배당요구 여부', '대항력 임차인의 미배당 인수 가능성 확인', false],
      ['임대차계약/보증금', '보증금·월세·계약기간·갱신 가능성 확인', g.tenants.length > 0 && !g.tenants.some((t) => !t.deposit)],
      ['관리비·체납', '공용관리비·수선충당금·공과금 분쟁 가능성 확인', false],
      ['시세 검증', '실거래가·호가·전세가·급매가 3개 이상 비교', false],
      ['명도 전략', '임차인 매수 제안, 합의명도, 인도명령 가능성 구분', false],
      ['엑시트 전략', '일반 매도/임차인 매도/보유 후 매도 중 수익성 비교', true]
    ];

    return `
      <div class="subcard platform-card">
        <h4>✅ 입찰 전 실사 체크리스트</h4>
        <p class="muted">마이옥션식 사건정보표 + 리치고식 투자 체크리스트 느낌으로, 사용자가 다음에 뭘 확인해야 하는지 보여주는 카드입니다.</p>
        <div class="checklist">
          ${items.map(([title, desc, checked]) => `
            <div class="check-item">
              <label><input type="checkbox" ${checked ? 'checked' : ''}> <span><b>${esc(title)}</b><span>${esc(desc)}</span></span></label>
            </div>`).join('')}
        </div>
      </div>`;
  }

  function renderStrategyGuide(report) {
    const g = analyzePlatformGaps(report);
    const strategies = [];
    if (g.special.length) strategies.push(['danger', '특수권리 먼저 확인', '유치권·법정지상권·분묘기지권은 계산보다 원본 문구와 현장 확인이 먼저입니다.']);
    if (g.daehang.length) strategies.push(['warn', '임차인 엑시트 가능성 검토', '대항력 임차인이 있으면 보증금 인수 후 일반 매도 또는 임차인 매도 시나리오를 비교하세요.']);
    if (g.safetyMargin <= 0) strategies.push(['danger', '가격 메리트 부족', '감정가 기준 안전마진이 부족합니다. 실거래·급매가를 보수적으로 다시 넣어보세요.']);
    if (!strategies.length) strategies.push(['', '기본 권리위험은 낮음', '다만 전입세대확인서·현황조사서·시세 검증이 끝나기 전까지는 입찰 확정으로 보면 안 됩니다.']);

    return `
      <div class="subcard platform-card">
        <h4>🎯 다음 판단</h4>
        <div class="strategy-list">
          ${strategies.map(([sev, title, desc]) => `<div class="strategy-item ${sev}"><b>${esc(title)}</b><br><span class="muted">${esc(desc)}</span></div>`).join('')}
        </div>
      </div>`;
  }

  function injectPlatformCards(report) {
    injectStyles();
    const rs = document.getElementById('resultsSection');
    if (!rs || rs.querySelector('.platform-card')) return;
    const firstVerdict = rs.querySelector('.verdict');
    if (!firstVerdict) return;
    firstVerdict.insertAdjacentHTML('afterend', renderPlatformSummary(report) + renderDueDiligenceChecklist(report) + renderStrategyGuide(report));
  }

  const wait = setInterval(() => {
    if (typeof window.renderReport === 'function') {
      clearInterval(wait);
      const originalRenderReport = window.renderReport;
      window.renderReport = function patchedRenderReport(report) {
        originalRenderReport(report);
        injectPlatformCards(report);
      };
    }
  }, 50);
})();
