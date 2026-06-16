(() => {
  function parseMoney(value) {
    const n = Number(String(value || '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
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
  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }
  function injectStyles() {
    let style = document.getElementById('finalSummaryPatchStyles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'finalSummaryPatchStyles';
      document.head.appendChild(style);
    }
    style.textContent = `
      .final-summary-card { margin:0 0 16px; border:1px solid var(--line); background:#fff; border-radius:18px; padding:18px; box-shadow:0 10px 28px rgba(0,0,0,.05); }
      .final-summary-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap; }
      .final-summary-head h3 { margin:0; font-family:var(--font-serif); font-size:22px; }
      .final-summary-verdict { border-radius:999px; padding:7px 12px; font-size:13px; font-weight:900; white-space:nowrap; }
      .final-summary-verdict.good { background:var(--ok-bg); color:var(--ok); }
      .final-summary-verdict.warn { background:var(--warn-bg); color:var(--warn); }
      .final-summary-verdict.danger { background:var(--danger-bg); color:var(--danger); }
      .final-summary-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:10px; margin-top:14px; }
      .final-summary-box { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:12px; }
      .final-summary-box .k { color:var(--ink-3); font-size:12px; }
      .final-summary-box .v { font-family:var(--font-serif); font-weight:900; font-size:18px; margin-top:3px; overflow-wrap:anywhere; }
      .final-summary-columns { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px; margin-top:14px; }
      .final-summary-panel { border:1px solid var(--line); border-radius:14px; padding:14px; background:#fff; }
      .final-summary-panel h4 { margin:0 0 8px; font-size:15px; }
      .final-summary-panel ul { margin:0; padding-left:18px; color:var(--ink-2); font-size:13px; line-height:1.6; }
      .final-summary-note { margin-top:12px; color:var(--ink-3); font-size:12.5px; line-height:1.55; }
    `;
  }
  function base() {
    const report = window.__lastAuctionReport || {};
    const raw = window.currentRaw || window.__lastAuctionRaw || {};
    const basic = report.basic || raw.basic || {};
    return {
      report,
      raw,
      basic,
      appraisal: parseMoney(basic['감정평가액'] || basic['감정가']),
      minBid: Number(report.baedang?.bidPrice || 0) || parseMoney(basic['최저매각가격'] || basic['최저가']),
      inherited: Number(report.inherited?.total || 0),
      risk: report.risk?.level || 'warn',
      tenants: report.tenants || [],
      rights: report.rights || []
    };
  }
  function scenario() {
    const conservative = parseMoney(document.getElementById('scenarioConservative')?.value);
    const neutral = parseMoney(document.getElementById('scenarioNeutral')?.value);
    const aggressive = parseMoney(document.getElementById('scenarioAggressive')?.value);
    return { conservative, neutral, aggressive, applied:Boolean(conservative || neutral || aggressive) };
  }
  function checklist() {
    const checks = [...document.querySelectorAll('[id^="bidCheck_"]')];
    if (!checks.length) return { done:0, total:0, rate:0 };
    const done = checks.filter(x => x.checked).length;
    return { done, total:checks.length, rate:done / checks.length };
  }
  function capital() {
    const t = document.getElementById('capitalVerdict')?.textContent || '';
    if (/입찰 가능/.test(t)) return { label:'가능', cls:'good' };
    if (/잔금 위험|입찰 불가/.test(t)) return { label:'불가/위험', cls:'danger' };
    if (/경계/.test(t)) return { label:'경계', cls:'warn' };
    return { label:'미확인', cls:'warn' };
  }
  function cashflow() {
    const t = document.getElementById('cashflowVerdict')?.textContent || '';
    const profit = parseMoney(document.getElementById('cashflowProfit')?.textContent || '');
    if (/손실/.test(t) || profit < 0) return { label:'손실/위험', cls:'danger', profit };
    if (/여유가 작|수익은 남지만/.test(t) || (profit > 0 && profit < 10000000)) return { label:'박함', cls:'warn', profit };
    if (profit >= 10000000) return { label:'수익권', cls:'good', profit };
    return { label:'미확인', cls:'warn', profit };
  }
  function exitStatus() {
    const t = document.getElementById('exitPlanVerdict')?.textContent || '';
    const m = t.match(/추천 방향은\s*(.*?)입니다/);
    return m?.[1]?.trim() || (t ? '확인됨' : '미확인');
  }
  function maxBid({ neutral, appraisal, inherited }) {
    const baseValue = neutral || appraisal;
    if (!baseValue) return 0;
    return Math.max(0, Math.floor((baseValue - inherited - baseValue * 0.064 - baseValue * 0.08) / 10000) * 10000);
  }
  function decide(b, sc, mx, cap, cf, ck) {
    let score = 50;
    if (b.risk === 'danger') score -= 30;
    if (b.risk === 'ok') score += 10;
    if (b.inherited > 0 && b.minBid && b.inherited / b.minBid > 0.2) score -= 20;
    score += sc.applied ? 12 : -8;
    if (mx && b.minBid && mx >= b.minBid) score += 15;
    if (mx && b.minBid && mx < b.minBid) score -= 18;
    if (cap.cls === 'good') score += 12;
    if (cap.cls === 'danger') score -= 25;
    if (cf.cls === 'good') score += 12;
    if (cf.cls === 'danger') score -= 25;
    if (ck.total) score += Math.round(ck.rate * 10) - 10;
    if (score >= 75) return { label:'입찰후보', cls:'good', score };
    if (score >= 55) return { label:'경계', cls:'warn', score };
    if (score >= 35) return { label:'보류', cls:'warn', score };
    return { label:'패스', cls:'danger', score };
  }
  function risks(b, sc, cap, cf, ck) {
    const out = [];
    const daehang = b.tenants.filter(t => t.daehang === '있음').length;
    const unknownTenant = b.tenants.filter(t => !t.moveIn || t.daehang === '?' || t.daehang === '확인필요').length;
    const inheritRights = b.rights.filter(r => r.status === '인수').length;
    if (b.risk === 'danger') out.push('권리분석 위험등급 높음');
    if (b.inherited > 0) out.push(`인수금액 ${krw(b.inherited)}`);
    if (daehang) out.push(`대항력 임차인 ${daehang}명`);
    if (unknownTenant) out.push(`임차인 정보 확인필요 ${unknownTenant}명`);
    if (inheritRights) out.push(`인수권리 ${inheritRights}건`);
    if (!sc.applied) out.push('실거래가/시세 시나리오 미반영');
    if (cap.cls === 'danger') out.push('내 자금 기준 잔금 위험');
    if (cf.cls === 'danger') out.push('보유비 반영 시 손실 가능성');
    if (ck.total && ck.rate < 1) out.push(`체크리스트 ${ck.done}/${ck.total} 완료`);
    return out.slice(0, 5);
  }
  function actions(risks, sc, cap, cf, ck, mx, minBid, verdict) {
    const out = [];
    if (!sc.applied) out.push('실거래가 조회 후 시세 3단 시나리오에 반영');
    if (ck.total && ck.rate < 1) out.push('체크리스트 미확인 항목 먼저 확인');
    if (cap.cls !== 'good') out.push('가용현금·대출가능액 기준 입찰가 재조정');
    if (cf.cls === 'danger') out.push('보유개월·수리비·매도가 보수적으로 재검토');
    if (risks.some(x => /임차인|인수|권리/.test(x))) out.push('매각물건명세서·등기부·전입세대 재확인');
    if (mx && minBid && mx < minBid) out.push('현재 최저가가 상한보다 높으므로 패스 검토');
    if (!out.length && verdict.cls === 'good') out.push('현장답사 후 입찰가를 상한 이하로 제한');
    if (!out.length) out.push('추가 시세와 현장 확인 후 보수적으로 판단');
    return out.slice(0, 4);
  }
  function html() {
    const b = base();
    const sc = scenario();
    const ck = checklist();
    const cap = capital();
    const cf = cashflow();
    const mx = maxBid({ neutral:sc.neutral, appraisal:b.appraisal, inherited:b.inherited });
    const margin = mx && b.minBid ? mx - b.minBid : 0;
    const verdict = decide(b, sc, mx, cap, cf, ck);
    const riskList = risks(b, sc, cap, cf, ck);
    const actionList = actions(riskList, sc, cap, cf, ck, mx, b.minBid, verdict);
    return `
      <div class="final-summary-card" data-final-summary-stable="1">
        <div class="final-summary-head"><div><h3>🏁 현재 기준 1차 판단 요약</h3><div class="final-summary-note">현재 입력값과 자동 수집 정보를 종합한 임시 의사결정 요약입니다. 명세서·임차인·시세·자금 입력 후 다시 갱신됩니다.</div></div><span class="final-summary-verdict ${verdict.cls}">${verdict.label} · ${verdict.score}점</span></div>
        <div class="final-summary-grid">
          <div class="final-summary-box"><div class="k">권장 입찰상한</div><div class="v">${krw(mx)}</div></div>
          <div class="final-summary-box"><div class="k">현재 최저가</div><div class="v">${krw(b.minBid)}</div></div>
          <div class="final-summary-box"><div class="k">상한 대비 여유</div><div class="v">${krw(margin)}</div></div>
          <div class="final-summary-box"><div class="k">내 자금</div><div class="v">${esc(cap.label)}</div></div>
          <div class="final-summary-box"><div class="k">현금흐름</div><div class="v">${esc(cf.label)}</div></div>
          <div class="final-summary-box"><div class="k">체크리스트</div><div class="v">${ck.total ? `${ck.done}/${ck.total}` : '미생성'}</div></div>
          <div class="final-summary-box"><div class="k">시세 반영</div><div class="v">${sc.applied ? '반영됨' : '미반영'}</div></div>
          <div class="final-summary-box"><div class="k">엑시트</div><div class="v">${esc(exitStatus())}</div></div>
        </div>
        <div class="final-summary-columns"><div class="final-summary-panel"><h4>주요 리스크</h4><ul>${(riskList.length ? riskList : ['현재 입력값 기준 중대 리스크가 뚜렷하지 않습니다.']).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div class="final-summary-panel"><h4>다음 행동</h4><ul>${actionList.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
        <div class="final-summary-note">이 요약은 입력값 기반의 1차 필터입니다. 실제 입찰 전 원본 서류, 현장, 대출, 세금은 별도로 확인해야 합니다.</div>
      </div>`;
  }
  function render() {
    injectStyles();
    const rs = document.getElementById('resultsSection');
    const firstVerdict = rs?.querySelector('.verdict');
    if (!rs || !firstVerdict) return;
    const nextHtml = html();
    const existing = rs.querySelector('.final-summary-card');
    if (existing) existing.outerHTML = nextHtml;
    else firstVerdict.insertAdjacentHTML('beforebegin', nextHtml);
  }
  function scheduleRender() {
    clearTimeout(window.__finalSummaryTimer);
    window.__finalSummaryTimer = setTimeout(render, 120);
  }
  const wait = setInterval(() => {
    if (typeof window.renderReport !== 'function') return;
    clearInterval(wait);
    const original = window.renderReport;
    window.renderReport = function(report) {
      window.__lastAuctionReport = report;
      original(report);
      scheduleRender();
    };
    window.GM?.patches?.register?.('final-summary', { version:'v3-no-global-observer' });
  }, 50);
  document.addEventListener('DOMContentLoaded', injectStyles);
  injectStyles();
})();
