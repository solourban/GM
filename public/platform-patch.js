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
    const digits = String(value || '').replace(/[^0-9.-]/g, '');
    const n = digits ? Number(digits) : 0;
    return Number.isFinite(n) ? n : 0;
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
      .scenario-table { width:100%; border-collapse:collapse; font-size:13.5px; margin-top:12px; }
      .scenario-table th { text-align:left; color:var(--ink-3); border-bottom:1px solid var(--line); padding:10px 8px; font-size:12px; }
      .scenario-table td { border-bottom:1px solid var(--line); padding:11px 8px; vertical-align:middle; }
      .scenario-table input { width:100%; min-width:110px; background:var(--bg); border:1px solid var(--line); border-radius:8px; padding:8px 10px; color:var(--ink); }
      .scenario-pill { display:inline-block; border-radius:999px; padding:4px 9px; font-size:11px; font-weight:700; }
      .scenario-pill.ok { background:var(--ok-bg); color:var(--ok); }
      .scenario-pill.warn { background:var(--warn-bg); color:var(--warn); }
      .scenario-pill.danger { background:var(--danger-bg); color:var(--danger); }
      .checklist { display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:10px; margin-top:12px; }
      .check-item { border:1px solid var(--line); border-radius:12px; padding:12px; background:#fff; }
      .check-item label { display:flex; gap:8px; align-items:flex-start; cursor:pointer; }
      .check-item b { display:block; font-size:13.5px; }
      .check-item span { display:block; color:var(--ink-3); font-size:12px; margin-top:2px; }
      .strategy-list { display:grid; gap:10px; margin-top:12px; }
      .strategy-item { border-left:4px solid var(--accent); background:var(--bg); border-radius:0 10px 10px 0; padding:12px 14px; }
      .strategy-item.warn { border-left-color:var(--warn); background:var(--warn-bg); }
      .strategy-item.danger { border-left-color:var(--danger); background:var(--danger-bg); }
      @media (max-width: 720px) { .scenario-table { display:block; overflow-x:auto; } }
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

  function calcProfit({ sale, bid, inherited, acquireRate, sellRate, taxRate }) {
    const acquisitionCost = bid * acquireRate;
    const saleCost = sale * sellRate;
    const beforeTax = sale - bid - inherited - acquisitionCost - saleCost;
    const tax = Math.max(0, beforeTax) * taxRate;
    return beforeTax - tax;
  }

  function maxBidForTarget({ sale, inherited, targetProfit, acquireRate, sellRate, taxRate }) {
    if (!sale) return null;
    const bestCase = calcProfit({ sale, bid: 0, inherited, acquireRate, sellRate, taxRate });
    if (bestCase < targetProfit) return null;

    let lo = 0;
    let hi = Math.max(0, sale - inherited);
    for (let i = 0; i < 70; i++) {
      const mid = (lo + hi) / 2;
      const profit = calcProfit({ sale, bid: mid, inherited, acquireRate, sellRate, taxRate });
      if (profit >= targetProfit) lo = mid;
      else hi = mid;
    }
    return Math.floor(lo / 10000) * 10000;
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
          <div class="mini-metric"><div class="k">감정가 기준 안전마진</div><div class="v ${marginClass}">${krw(g.safetyMargin)}</div></div>
          <div class="mini-metric"><div class="k">안전마진율</div><div class="v ${marginClass}">${g.safetyMarginRate.toFixed(1)}%</div></div>
          <div class="mini-metric"><div class="k">대항력 임차인</div><div class="v ${g.daehang.length ? 'danger' : ''}">${g.daehang.length}명</div></div>
        </div>
      </div>`;
  }

  function renderMarketScenarioCard(report) {
    const g = analyzePlatformGaps(report);
    const base = g.appraisal || Math.max(g.minBid + g.inherited, 100000000);
    const conservative = Math.round(base * 0.92 / 10000) * 10000;
    const neutral = Math.round(base / 10000) * 10000;
    const aggressive = Math.round(base * 1.08 / 10000) * 10000;

    return `
      <div class="subcard input-card platform-card scenario-card">
        <h4>📊 시세 3단 시나리오 & 최대입찰가 역산</h4>
        <p class="muted">감정가가 아니라 보수·중립·공격 시세별로 “세후 목표수익을 남기려면 얼마까지 써도 되는지”를 역산합니다.</p>
        <div class="input-row exit-input-row">
          <label>세후 목표수익 <input type="number" id="scenarioTarget" value="10000000" oninput="updateMarketScenarios()"></label>
          <label>인수금액 <input type="number" id="scenarioInherited" value="${g.inherited}" oninput="updateMarketScenarios()"></label>
          <label>취득·기타비용 % <input type="number" id="scenarioAcquireRate" value="5.6" step="0.1" oninput="updateMarketScenarios()"></label>
          <label>매도비용 % <input type="number" id="scenarioSellRate" value="0.8" step="0.1" oninput="updateMarketScenarios()"></label>
          <label>양도세율 % <input type="number" id="scenarioTaxRate" value="77" step="1" oninput="updateMarketScenarios()"></label>
        </div>
        <table class="scenario-table">
          <thead><tr><th>시나리오</th><th>예상 시세</th><th>최대입찰가</th><th>권장입찰가</th><th>현재 최저가 대비</th><th>판정</th></tr></thead>
          <tbody>
            <tr><td><b>보수</b></td><td><input type="number" id="scenarioConservative" value="${conservative}" oninput="updateMarketScenarios()"></td><td id="maxBidConservative">-</td><td id="safeBidConservative">-</td><td id="gapConservative">-</td><td id="judgeConservative">-</td></tr>
            <tr><td><b>중립</b></td><td><input type="number" id="scenarioNeutral" value="${neutral}" oninput="updateMarketScenarios()"></td><td id="maxBidNeutral">-</td><td id="safeBidNeutral">-</td><td id="gapNeutral">-</td><td id="judgeNeutral">-</td></tr>
            <tr><td><b>공격</b></td><td><input type="number" id="scenarioAggressive" value="${aggressive}" oninput="updateMarketScenarios()"></td><td id="maxBidAggressive">-</td><td id="safeBidAggressive">-</td><td id="gapAggressive">-</td><td id="judgeAggressive">-</td></tr>
          </tbody>
        </table>
        <div id="scenarioSummary" class="note"></div>
        <div class="note warn-note">보수 시나리오에서 돈이 남지 않으면 입찰가를 낮추거나 패스하는 쪽이 안전합니다. 실제 시세는 실거래가·급매가·전세가를 직접 확인해 입력하세요.</div>
      </div>`;
  }

  window.updateMarketScenarios = function updateMarketScenarios() {
    const target = parseKrw(document.getElementById('scenarioTarget')?.value);
    const inherited = parseKrw(document.getElementById('scenarioInherited')?.value);
    const acquireRate = Number(document.getElementById('scenarioAcquireRate')?.value || 0) / 100;
    const sellRate = Number(document.getElementById('scenarioSellRate')?.value || 0) / 100;
    const taxRate = Number(document.getElementById('scenarioTaxRate')?.value || 0) / 100;
    const minBid = Number(window.__lastAuctionReport?.baedang?.bidPrice || 0) || parseKrw(window.__lastAuctionReport?.basic?.['최저매각가격']);
    const rows = [
      ['Conservative', '보수', parseKrw(document.getElementById('scenarioConservative')?.value)],
      ['Neutral', '중립', parseKrw(document.getElementById('scenarioNeutral')?.value)],
      ['Aggressive', '공격', parseKrw(document.getElementById('scenarioAggressive')?.value)]
    ];

    let best = null;
    rows.forEach(([key, label, sale]) => {
      const maxBid = maxBidForTarget({ sale, inherited, targetProfit: target, acquireRate, sellRate, taxRate });
      const safeBid = maxBid ? Math.floor(maxBid * 0.97 / 10000) * 10000 : null;
      const gap = maxBid == null ? null : maxBid - minBid;
      const judge = maxBid == null ? ['입찰 불가', 'danger'] : gap >= 5000000 ? ['후보', 'ok'] : gap >= 0 ? ['경계', 'warn'] : ['패스', 'danger'];

      const set = (id, html) => { const el = document.getElementById(id + key); if (el) el.innerHTML = html; };
      set('maxBid', maxBid == null ? '<span class="danger">불가</span>' : krw(maxBid));
      set('safeBid', safeBid == null ? '-' : krw(safeBid));
      set('gap', gap == null ? '-' : krw(gap));
      set('judge', `<span class="scenario-pill ${judge[1]}">${judge[0]}</span>`);

      if (maxBid != null && (!best || maxBid > best.maxBid)) best = { label, maxBid, safeBid, gap, judge: judge[0] };
    });

    const summary = document.getElementById('scenarioSummary');
    if (summary) {
      if (!best) {
        summary.className = 'note danger-note';
        summary.innerHTML = `세후 목표수익 ${krw(target)} 기준으로는 세 시나리오 모두 입찰가가 나오지 않습니다. 시세를 다시 확인하거나 패스가 우선입니다.`;
      } else {
        const cls = best.gap >= 5000000 ? '' : best.gap >= 0 ? 'warn-note' : 'danger-note';
        summary.className = `note ${cls}`;
        summary.innerHTML = `${best.label} 시나리오 기준 최대입찰가는 <b>${krw(best.maxBid)}</b>, 여유를 둔 권장입찰가는 <b>${krw(best.safeBid)}</b>입니다. 현재 최저가 대비 여유는 <b>${krw(best.gap)}</b>입니다.`;
      }
    }
  };

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
        <p class="muted">정보를 많이 보여주는 것보다, 빠뜨리면 돈 잃는 확인 항목을 강제로 체크하게 만드는 카드입니다.</p>
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
    window.__lastAuctionReport = report;
    const rs = document.getElementById('resultsSection');
    if (!rs || rs.querySelector('.platform-card')) return;
    const firstVerdict = rs.querySelector('.verdict');
    if (!firstVerdict) return;
    firstVerdict.insertAdjacentHTML('afterend', renderPlatformSummary(report) + renderMarketScenarioCard(report) + renderDueDiligenceChecklist(report) + renderStrategyGuide(report));
    setTimeout(() => window.updateMarketScenarios?.(), 0);
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
