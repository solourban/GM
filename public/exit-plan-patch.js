(() => {
  const KEY = 'gm_exit_plan_profile_v1';

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

  function loadProfile() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch { return {}; }
  }

  function saveProfile(profile) {
    localStorage.setItem(KEY, JSON.stringify(profile));
  }

  function reportBase() {
    const report = window.__lastAuctionReport || {};
    const basic = report.basic || {};
    const minBid = Number(report.baedang?.bidPrice || 0) || parseMoney(basic['최저매각가격'] || basic['최저가']);
    const inherited = Number(report.inherited?.total || 0);
    const tenants = report.tenants || [];
    const daehang = tenants.filter((t) => t.daehang === '있음').length;
    const unknownTenant = tenants.filter((t) => !t.moveIn || t.daehang === '?' || t.daehang === '확인필요').length;
    const inheritedRights = (report.rights || []).filter((r) => r.status === '인수').length;
    return { minBid, inherited, tenants, daehang, unknownTenant, inheritedRights };
  }

  function scenarioNeutral() {
    return parseMoney(document.getElementById('scenarioNeutral')?.value);
  }

  function currentBid() {
    return parseMoney(document.getElementById('cashflowBid')?.value)
      || parseMoney(document.getElementById('capitalPlannedBid')?.value)
      || reportBase().minBid;
  }

  function injectStyles() {
    if (document.getElementById('exitPlanPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'exitPlanPatchStyles';
    style.textContent = `
      .exit-plan-card { margin-top:14px; }
      .exit-plan-form { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin-top:12px; }
      .exit-plan-form label { display:flex; flex-direction:column; gap:4px; color:var(--ink-3); font-size:12px; font-weight:700; }
      .exit-plan-form input { background:var(--bg); border:1px solid var(--line); border-radius:10px; padding:10px 12px; color:var(--ink); }
      .exit-plan-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-top:12px; }
      .exit-plan-option { border:1px solid var(--line); border-radius:14px; background:#fff; padding:14px; }
      .exit-plan-option.recommend { border-color:var(--accent); box-shadow:0 0 0 3px rgba(92,69,34,.12); }
      .exit-plan-option h5 { margin:0 0 8px; font-family:var(--font-serif); font-size:17px; }
      .exit-plan-option .profit { font-family:var(--font-serif); font-size:22px; font-weight:900; margin:6px 0; }
      .exit-plan-option .desc { color:var(--ink-3); font-size:12.5px; line-height:1.55; }
      .exit-plan-pill { display:inline-block; border-radius:999px; padding:4px 9px; font-size:11px; font-weight:900; margin-bottom:8px; }
      .exit-plan-pill.good { background:var(--ok-bg); color:var(--ok); }
      .exit-plan-pill.warn { background:var(--warn-bg); color:var(--warn); }
      .exit-plan-pill.danger { background:var(--danger-bg); color:var(--danger); }
      .exit-plan-verdict { border-radius:14px; padding:14px; margin-top:12px; font-weight:800; }
      .exit-plan-verdict.good { background:var(--ok-bg); color:var(--ok); }
      .exit-plan-verdict.warn { background:var(--warn-bg); color:var(--warn); }
      .exit-plan-verdict.danger { background:var(--danger-bg); color:var(--danger); }
    `;
    document.head.appendChild(style);
  }

  function getInputs() {
    return {
      bid: parseMoney(document.getElementById('exitPlanBid')?.value),
      marketPrice: parseMoney(document.getElementById('exitPlanMarketPrice')?.value),
      repairCost: parseMoney(document.getElementById('exitPlanRepairCost')?.value),
      arrangeCost: parseMoney(document.getElementById('exitPlanArrangeCost')?.value),
      monthlyCost: parseMoney(document.getElementById('exitPlanMonthlyCost')?.value),
      normalMonths: Number(document.getElementById('exitPlanNormalMonths')?.value || 6),
      quickDiscount: Number(document.getElementById('exitPlanQuickDiscount')?.value || 5),
      leaseDeposit: parseMoney(document.getElementById('exitPlanLeaseDeposit')?.value),
      sellCostRate: Number(document.getElementById('exitPlanSellCostRate')?.value || 0.8),
      acquisitionRate: Number(document.getElementById('exitPlanAcquisitionRate')?.value || 5.6),
    };
  }

  function calcProfit({ sale, bid, inherited, acquisitionCost, sellCost, repairCost, arrangeCost, holdingCost }) {
    return sale - bid - inherited - acquisitionCost - sellCost - repairCost - arrangeCost - holdingCost;
  }

  function optionClass(profit) {
    if (profit >= 10000000) return 'good';
    if (profit > 0) return 'warn';
    return 'danger';
  }

  function renderOption(id, option, recommendedId) {
    const el = document.getElementById(id);
    if (!el) return;
    const cls = optionClass(option.profit);
    el.className = `exit-plan-option ${id === recommendedId ? 'recommend' : ''}`;
    el.innerHTML = `
      <span class="exit-plan-pill ${cls}">${id === recommendedId ? '추천' : option.label}</span>
      <h5>${option.title}</h5>
      <div class="profit ${cls === 'danger' ? 'danger' : cls === 'good' ? 'ok' : ''}">${krw(option.profit)}</div>
      <div class="desc">${option.desc}</div>
    `;
  }

  function updateExitPlan() {
    const p = getInputs();
    saveProfile(p);
    const base = reportBase();
    const bid = p.bid;
    const inherited = base.inherited;
    const acquisitionCost = bid * (p.acquisitionRate / 100);

    const normalSale = p.marketPrice;
    const normalSellCost = normalSale * (p.sellCostRate / 100);
    const normalHolding = p.monthlyCost * p.normalMonths;
    const normalProfit = calcProfit({ sale: normalSale, bid, inherited, acquisitionCost, sellCost: normalSellCost, repairCost: p.repairCost, arrangeCost: p.arrangeCost, holdingCost: normalHolding });

    const quickSale = p.marketPrice * (1 - p.quickDiscount / 100);
    const quickSellCost = quickSale * (p.sellCostRate / 100);
    const quickHolding = p.monthlyCost * Math.max(1, Math.ceil(p.normalMonths / 2));
    const quickArrangeCost = Math.max(0, p.arrangeCost * 0.35);
    const quickProfit = calcProfit({ sale: quickSale, bid, inherited, acquisitionCost, sellCost: quickSellCost, repairCost: 0, arrangeCost: quickArrangeCost, holdingCost: quickHolding });

    const leaseCashBack = Math.max(0, p.leaseDeposit);
    const holdHolding = p.monthlyCost * 12;
    const holdProfit = leaseCashBack - bid - inherited - acquisitionCost - p.repairCost - holdHolding;

    const options = {
      exitPlanNormal: {
        label: '일반매도',
        title: '일반매도',
        profit: normalProfit,
        desc: `정리기간 ${p.normalMonths}개월, 정리비 ${krw(p.arrangeCost)}, 수리비 ${krw(p.repairCost)}를 반영한 일반 매도 기준입니다.`
      },
      exitPlanQuick: {
        label: '빠른정리',
        title: '빠른 협의정리',
        profit: quickProfit,
        desc: `시세에서 ${p.quickDiscount}% 낮춰 빠르게 정리하는 가정입니다. 보유기간과 수리 부담을 줄이는 전략입니다.`
      },
      exitPlanLease: {
        label: '보유',
        title: '전세세팅 / 보유',
        profit: holdProfit,
        desc: `예상 전세보증금 ${krw(p.leaseDeposit)}으로 투입금을 회수하는 1차 가정입니다. 실제 전세수요 확인이 필요합니다.`
      }
    };

    const ranked = Object.entries(options).sort((a, b) => b[1].profit - a[1].profit);
    const bestId = ranked[0]?.[0];
    renderOption('exitPlanNormal', options.exitPlanNormal, bestId);
    renderOption('exitPlanQuick', options.exitPlanQuick, bestId);
    renderOption('exitPlanLease', options.exitPlanLease, bestId);

    let riskNotes = [];
    if (base.daehang) riskNotes.push(`대항력 임차인 ${base.daehang}명`);
    if (base.unknownTenant) riskNotes.push(`임차인 정보 확인필요 ${base.unknownTenant}명`);
    if (base.inheritedRights) riskNotes.push(`인수권리 ${base.inheritedRights}건`);
    if (base.inherited > 0) riskNotes.push(`인수금액 ${krw(base.inherited)}`);

    const best = options[bestId];
    let cls = optionClass(best.profit);
    let msg = `현재 입력값 기준 추천 방향은 ${best.title}입니다. 예상값은 ${krw(best.profit)}입니다.`;
    if (riskNotes.length) {
      cls = cls === 'good' ? 'warn' : cls;
      msg += ` 단, ${riskNotes.join(', ')} 때문에 원본 문서와 현장 확인이 우선입니다.`;
    }

    const verdict = document.getElementById('exitPlanVerdict');
    if (verdict) {
      verdict.className = `exit-plan-verdict ${cls}`;
      verdict.textContent = msg;
    }
  }

  function renderExitPlanCard() {
    injectStyles();
    const anchor = document.querySelector('.cashflow-card') || document.querySelector('.capital-card') || document.querySelector('.scenario-card');
    if (!anchor || document.querySelector('.exit-plan-card')) return;

    const saved = loadProfile();
    const base = reportBase();
    const bid = saved.bid || currentBid() || base.minBid || 0;
    const marketPrice = saved.marketPrice || scenarioNeutral() || 0;

    anchor.insertAdjacentHTML('afterend', `
      <div class="subcard input-card platform-card exit-plan-card">
        <h4>🚪 점유정리 / 엑시트 전략 비교</h4>
        <p class="muted">낙찰 후 어떤 방식으로 빠져나갈지 비교합니다. 일반매도, 빠른 협의정리, 전세세팅을 1차 수익성 기준으로 봅니다.</p>
        <div class="exit-plan-form">
          <label>입찰가 <input id="exitPlanBid" type="number" value="${bid}" oninput="updateExitPlan()"></label>
          <label>예상 시세/매도가 <input id="exitPlanMarketPrice" type="number" value="${marketPrice}" oninput="updateExitPlan()"></label>
          <label>수리비 <input id="exitPlanRepairCost" type="number" value="${saved.repairCost || 5000000}" oninput="updateExitPlan()"></label>
          <label>점유정리 비용 <input id="exitPlanArrangeCost" type="number" value="${saved.arrangeCost || 3000000}" oninput="updateExitPlan()"></label>
          <label>월 보유비 <input id="exitPlanMonthlyCost" type="number" value="${saved.monthlyCost || 300000}" oninput="updateExitPlan()"></label>
          <label>일반매도 보유개월 <input id="exitPlanNormalMonths" type="number" value="${saved.normalMonths || 6}" oninput="updateExitPlan()"></label>
          <label>빠른정리 할인율 % <input id="exitPlanQuickDiscount" type="number" value="${saved.quickDiscount || 5}" step="0.5" oninput="updateExitPlan()"></label>
          <label>예상 전세보증금 <input id="exitPlanLeaseDeposit" type="number" value="${saved.leaseDeposit || ''}" placeholder="전세세팅 검토 시" oninput="updateExitPlan()"></label>
          <label>취득·기타비용 % <input id="exitPlanAcquisitionRate" type="number" value="${saved.acquisitionRate || 5.6}" step="0.1" oninput="updateExitPlan()"></label>
          <label>매도비용 % <input id="exitPlanSellCostRate" type="number" value="${saved.sellCostRate || 0.8}" step="0.1" oninput="updateExitPlan()"></label>
        </div>
        <div class="exit-plan-grid">
          <div id="exitPlanNormal" class="exit-plan-option"></div>
          <div id="exitPlanQuick" class="exit-plan-option"></div>
          <div id="exitPlanLease" class="exit-plan-option"></div>
        </div>
        <div id="exitPlanVerdict" class="exit-plan-verdict warn">입력 필요</div>
        <div class="note warn-note" style="margin-top:12px">점유관계, 임차인 권리, 협의 가능성, 전세수요, 세금은 사건별로 달라집니다. 이 카드는 입찰 전 엑시트 방향을 고르는 1차 비교용입니다.</div>
      </div>
    `);
    updateExitPlan();
  }

  window.updateExitPlan = updateExitPlan;

  const observer = new MutationObserver(() => renderExitPlanCard());
  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    observer.observe(document.body, { childList: true, subtree: true });
    renderExitPlanCard();
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
})();
