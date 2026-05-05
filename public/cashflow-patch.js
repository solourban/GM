(() => {
  const KEY = 'gm_cashflow_profile_v1';

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
    const appraisal = parseMoney(basic['감정평가액'] || basic['감정가']);
    return { minBid, inherited, appraisal };
  }

  function scenarioNeutral() {
    return parseMoney(document.getElementById('scenarioNeutral')?.value);
  }

  function capitalProfile() {
    try { return JSON.parse(localStorage.getItem('gm_capital_profile_v1') || '{}'); }
    catch { return {}; }
  }

  function injectStyles() {
    if (document.getElementById('cashflowPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'cashflowPatchStyles';
    style.textContent = `
      .cashflow-card { margin-top:14px; }
      .cashflow-form { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin-top:12px; }
      .cashflow-form label { display:flex; flex-direction:column; gap:4px; color:var(--ink-3); font-size:12px; font-weight:700; }
      .cashflow-form input { background:var(--bg); border:1px solid var(--line); border-radius:10px; padding:10px 12px; color:var(--ink); }
      .cashflow-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap:10px; margin-top:12px; }
      .cashflow-box { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:12px; }
      .cashflow-box .k { color:var(--ink-3); font-size:12px; }
      .cashflow-box .v { font-family:var(--font-serif); font-weight:900; font-size:18px; margin-top:3px; }
      .cashflow-table { width:100%; border-collapse:collapse; margin-top:12px; font-size:13px; }
      .cashflow-table th { color:var(--ink-3); text-align:left; border-bottom:1px solid var(--line); padding:9px 8px; font-size:12px; }
      .cashflow-table td { border-bottom:1px solid var(--line); padding:10px 8px; }
      .cashflow-verdict { border-radius:14px; padding:14px; margin-top:12px; font-weight:800; }
      .cashflow-verdict.good { background:var(--ok-bg); color:var(--ok); }
      .cashflow-verdict.warn { background:var(--warn-bg); color:var(--warn); }
      .cashflow-verdict.danger { background:var(--danger-bg); color:var(--danger); }
    `;
    document.head.appendChild(style);
  }

  function getInputs() {
    return {
      bid: parseMoney(document.getElementById('cashflowBid')?.value),
      sale: parseMoney(document.getElementById('cashflowSale')?.value),
      loan: parseMoney(document.getElementById('cashflowLoan')?.value),
      holdingMonths: Number(document.getElementById('cashflowMonths')?.value || 6),
      monthlyCost: parseMoney(document.getElementById('cashflowMonthlyCost')?.value),
      annualInterest: Number(document.getElementById('cashflowInterest')?.value || 5.0),
      depositRate: Number(document.getElementById('cashflowDepositRate')?.value || 10),
      acquisitionRate: Number(document.getElementById('cashflowAcquisitionRate')?.value || 5.6),
      sellCostRate: Number(document.getElementById('cashflowSellCostRate')?.value || 0.8),
    };
  }

  function updateCashflow() {
    const p = getInputs();
    saveProfile(p);
    const { inherited } = reportBase();

    const bidDeposit = p.bid * (p.depositRate / 100);
    const acquisitionCost = p.bid * (p.acquisitionRate / 100);
    const sellCost = p.sale * (p.sellCostRate / 100);
    const loan = Math.min(p.loan, p.bid);
    const balanceCash = Math.max(0, p.bid - bidDeposit - loan) + acquisitionCost;
    const monthlyInterest = loan * (p.annualInterest / 100) / 12;
    const holdingCost = (p.monthlyCost + monthlyInterest) * p.holdingMonths;
    const totalCashBeforeSale = bidDeposit + balanceCash + holdingCost + inherited;
    const estimatedProfit = p.sale - p.bid - inherited - acquisitionCost - sellCost - holdingCost;

    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set('cashflowBidDeposit', krw(bidDeposit));
    set('cashflowBalanceCash', krw(balanceCash));
    set('cashflowAcquisitionCost', krw(acquisitionCost));
    set('cashflowHoldingCost', krw(holdingCost));
    set('cashflowSellCost', krw(sellCost));
    set('cashflowTotalCash', krw(totalCashBeforeSale));
    set('cashflowProfit', krw(estimatedProfit));

    const timeline = document.getElementById('cashflowTimeline');
    if (timeline) {
      timeline.innerHTML = `
        <tr><td>입찰일</td><td>입찰보증금 납부</td><td>${krw(bidDeposit)}</td><td>입찰가의 ${p.depositRate}% 가정</td></tr>
        <tr><td>잔금기한</td><td>잔금·취득비 준비</td><td>${krw(balanceCash)}</td><td>대출 ${krw(loan)} 반영</td></tr>
        <tr><td>보유기간 ${p.holdingMonths}개월</td><td>관리비·이자·운영비</td><td>${krw(holdingCost)}</td><td>월 보유비 + 대출이자</td></tr>
        <tr><td>인수 리스크</td><td>인수금액 최악 가정</td><td>${krw(inherited)}</td><td>대항력 임차인/인수권리 확인 필요</td></tr>
        <tr><td>매도 시</td><td>매도비용</td><td>${krw(sellCost)}</td><td>중개·정리비 등 ${p.sellCostRate}% 가정</td></tr>
      `;
    }

    let cls = 'warn';
    let msg = '입찰가와 예상 매도가를 입력하면 낙찰 후 현금흐름을 계산합니다.';
    if (p.bid > 0 && p.sale > 0) {
      if (estimatedProfit > 10000000) {
        cls = 'good';
        msg = `보유 ${p.holdingMonths}개월 기준 예상차익 ${krw(estimatedProfit)}입니다. 단, 명도·세금·시세 변동은 별도 확인하세요.`;
      } else if (estimatedProfit > 0) {
        cls = 'warn';
        msg = `수익은 남지만 예상차익 ${krw(estimatedProfit)}로 여유가 작습니다. 입찰가 상한을 낮추는 쪽이 안전합니다.`;
      } else {
        cls = 'danger';
        msg = `보유비와 매도비를 반영하면 ${krw(Math.abs(estimatedProfit))} 손실 구간입니다. 입찰가 또는 매도 시세를 다시 보세요.`;
      }
    }
    const verdict = document.getElementById('cashflowVerdict');
    if (verdict) {
      verdict.className = `cashflow-verdict ${cls}`;
      verdict.textContent = msg;
    }
  }

  function renderCashflowCard() {
    injectStyles();
    const anchor = document.querySelector('.capital-card') || document.querySelector('.scenario-card');
    if (!anchor || document.querySelector('.cashflow-card')) return;

    const { minBid, appraisal } = reportBase();
    const saved = loadProfile();
    const cap = capitalProfile();
    const bid = saved.bid || parseMoney(document.getElementById('capitalPlannedBid')?.value) || minBid || 0;
    const sale = saved.sale || scenarioNeutral() || appraisal || 0;
    const loan = saved.loan || cap.loan || 0;

    anchor.insertAdjacentHTML('afterend', `
      <div class="subcard input-card platform-card cashflow-card">
        <h4>📆 낙찰 후 현금흐름표</h4>
        <p class="muted">낙찰 이후 입찰보증금·잔금·취득비·보유비·매도비가 언제 얼마나 나가는지 1차로 계산합니다.</p>
        <div class="cashflow-form">
          <label>입찰가 <input id="cashflowBid" type="number" value="${bid}" oninput="updateCashflow()"></label>
          <label>예상 매도가 <input id="cashflowSale" type="number" value="${sale}" oninput="updateCashflow()"></label>
          <label>대출금 <input id="cashflowLoan" type="number" value="${loan}" oninput="updateCashflow()"></label>
          <label>보유개월 <input id="cashflowMonths" type="number" value="${saved.holdingMonths || 6}" oninput="updateCashflow()"></label>
          <label>월 보유비 <input id="cashflowMonthlyCost" type="number" value="${saved.monthlyCost || 300000}" oninput="updateCashflow()"></label>
          <label>연 이자율 % <input id="cashflowInterest" type="number" value="${saved.annualInterest || 5.0}" step="0.1" oninput="updateCashflow()"></label>
          <label>입찰보증금 % <input id="cashflowDepositRate" type="number" value="${saved.depositRate || 10}" step="1" oninput="updateCashflow()"></label>
          <label>취득·기타비용 % <input id="cashflowAcquisitionRate" type="number" value="${saved.acquisitionRate || 5.6}" step="0.1" oninput="updateCashflow()"></label>
          <label>매도비용 % <input id="cashflowSellCostRate" type="number" value="${saved.sellCostRate || 0.8}" step="0.1" oninput="updateCashflow()"></label>
        </div>
        <div class="cashflow-grid">
          <div class="cashflow-box"><div class="k">입찰보증금</div><div id="cashflowBidDeposit" class="v">-</div></div>
          <div class="cashflow-box"><div class="k">잔금일 추가현금</div><div id="cashflowBalanceCash" class="v">-</div></div>
          <div class="cashflow-box"><div class="k">취득·기타비용</div><div id="cashflowAcquisitionCost" class="v">-</div></div>
          <div class="cashflow-box"><div class="k">보유비+이자</div><div id="cashflowHoldingCost" class="v">-</div></div>
          <div class="cashflow-box"><div class="k">매도비용</div><div id="cashflowSellCost" class="v">-</div></div>
          <div class="cashflow-box"><div class="k">매도 전 총 투입현금</div><div id="cashflowTotalCash" class="v">-</div></div>
          <div class="cashflow-box"><div class="k">예상차익</div><div id="cashflowProfit" class="v">-</div></div>
        </div>
        <table class="cashflow-table">
          <thead><tr><th>시점</th><th>내용</th><th>금액</th><th>메모</th></tr></thead>
          <tbody id="cashflowTimeline"></tbody>
        </table>
        <div id="cashflowVerdict" class="cashflow-verdict warn">입력 필요</div>
        <div class="note warn-note" style="margin-top:12px">세금, 명도비, 수리비, 공실기간, 대출 승인 여부는 실제 조건에 따라 달라집니다. 이 카드는 입찰 전 생존 가능성 1차 점검용입니다.</div>
      </div>
    `);
    updateCashflow();
  }

  window.updateCashflow = updateCashflow;

  const observer = new MutationObserver(() => renderCashflowCard());
  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    observer.observe(document.body, { childList: true, subtree: true });
    renderCashflowCard();
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
})();
