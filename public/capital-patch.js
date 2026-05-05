(() => {
  const KEY = 'gm_capital_profile_v1';

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
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveProfile(profile) {
    localStorage.setItem(KEY, JSON.stringify(profile));
  }

  function reportBase() {
    const report = window.__lastAuctionReport || {};
    const basic = report.basic || {};
    const minBid = Number(report.baedang?.bidPrice || 0) || parseMoney(basic['최저매각가격'] || basic['최저가']);
    const inherited = Number(report.inherited?.total || 0);
    return { minBid, inherited };
  }

  function injectStyles() {
    if (document.getElementById('capitalPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'capitalPatchStyles';
    style.textContent = `
      .capital-card { margin-top:14px; }
      .capital-form { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin-top:12px; }
      .capital-form label { display:flex; flex-direction:column; gap:4px; color:var(--ink-3); font-size:12px; font-weight:700; }
      .capital-form input { background:var(--bg); border:1px solid var(--line); border-radius:10px; padding:10px 12px; color:var(--ink); }
      .capital-result { display:grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap:10px; margin-top:12px; }
      .capital-box { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:12px; }
      .capital-box .k { color:var(--ink-3); font-size:12px; }
      .capital-box .v { font-family:var(--font-serif); font-weight:900; font-size:18px; margin-top:3px; }
      .capital-verdict { border-radius:14px; padding:14px; margin-top:12px; font-weight:800; }
      .capital-verdict.good { background:var(--ok-bg); color:var(--ok); }
      .capital-verdict.warn { background:var(--warn-bg); color:var(--warn); }
      .capital-verdict.danger { background:var(--danger-bg); color:var(--danger); }
    `;
    document.head.appendChild(style);
  }

  function getProfileFromInputs() {
    return {
      cash: parseMoney(document.getElementById('capitalCash')?.value),
      loan: parseMoney(document.getElementById('capitalLoan')?.value),
      plannedBid: parseMoney(document.getElementById('capitalPlannedBid')?.value),
      reserve: parseMoney(document.getElementById('capitalReserve')?.value),
      depositRate: Number(document.getElementById('capitalDepositRate')?.value || 10),
      acquisitionRate: Number(document.getElementById('capitalAcquisitionRate')?.value || 5.6),
    };
  }

  function updateCapitalCheck() {
    const profile = getProfileFromInputs();
    saveProfile(profile);

    const { inherited } = reportBase();
    const bid = profile.plannedBid;
    const cash = profile.cash;
    const loan = Math.min(profile.loan, bid);
    const bidDeposit = bid * (profile.depositRate / 100);
    const acquisitionCost = bid * (profile.acquisitionRate / 100);
    const closingCash = Math.max(0, bid - loan) + acquisitionCost + profile.reserve;
    const worstCash = closingCash + inherited;
    const closingGap = cash - closingCash;
    const worstGap = cash - worstCash;

    let label = '입력 필요';
    let cls = 'warn';
    let message = '가용현금·대출가능액·입찰예정가를 입력하면 자금 가능성을 계산합니다.';

    if (bid > 0 && cash > 0) {
      if (cash < bidDeposit) {
        label = '입찰 불가';
        cls = 'danger';
        message = `입찰보증금 ${krw(bidDeposit)}부터 부족합니다. 보증금 현금 확보가 먼저입니다.`;
      } else if (closingGap < 0) {
        label = '잔금 위험';
        cls = 'danger';
        message = `대출을 반영해도 잔금·취득비·예비비 기준 ${krw(Math.abs(closingGap))} 부족합니다.`;
      } else if (inherited > 0 && worstGap < 0) {
        label = '경계';
        cls = 'warn';
        message = `기본 잔금은 가능하지만 인수금액까지 최악 가정하면 ${krw(Math.abs(worstGap))} 부족합니다.`;
      } else {
        label = '입찰 가능';
        cls = 'good';
        message = `현재 입력 기준 잔금 후 여유 ${krw(closingGap)}, 인수금액 포함 최악 여유 ${krw(worstGap)}입니다.`;
      }
    }

    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set('capitalBidDeposit', krw(bidDeposit));
    set('capitalAcquisitionCost', krw(acquisitionCost));
    set('capitalClosingCash', krw(closingCash));
    set('capitalWorstCash', krw(worstCash));
    set('capitalClosingGap', krw(closingGap));
    set('capitalWorstGap', krw(worstGap));

    const verdict = document.getElementById('capitalVerdict');
    if (verdict) {
      verdict.className = `capital-verdict ${cls}`;
      verdict.innerHTML = `${label} · ${message}`;
    }
  }

  function renderCapitalCard() {
    injectStyles();
    const scenario = document.querySelector('.scenario-card');
    if (!scenario || document.querySelector('.capital-card')) return;

    const { minBid } = reportBase();
    const saved = loadProfile();
    const plannedBid = saved.plannedBid || minBid || 0;

    scenario.insertAdjacentHTML('afterend', `
      <div class="subcard input-card platform-card capital-card">
        <h4>💰 내 자금 기준 입찰 가능성</h4>
        <p class="muted">물건이 좋아 보여도 내 현금으로 잔금·취득비·예비비를 버틸 수 있는지 먼저 봅니다.</p>
        <div class="capital-form">
          <label>가용현금 <input id="capitalCash" type="number" value="${saved.cash || ''}" placeholder="예: 30000000" oninput="updateCapitalCheck()"></label>
          <label>대출가능액 <input id="capitalLoan" type="number" value="${saved.loan || ''}" placeholder="예: 80000000" oninput="updateCapitalCheck()"></label>
          <label>입찰예정가 <input id="capitalPlannedBid" type="number" value="${plannedBid}" oninput="updateCapitalCheck()"></label>
          <label>예비비 <input id="capitalReserve" type="number" value="${saved.reserve || 5000000}" oninput="updateCapitalCheck()"></label>
          <label>입찰보증금 % <input id="capitalDepositRate" type="number" value="${saved.depositRate || 10}" step="1" oninput="updateCapitalCheck()"></label>
          <label>취득·기타비용 % <input id="capitalAcquisitionRate" type="number" value="${saved.acquisitionRate || 5.6}" step="0.1" oninput="updateCapitalCheck()"></label>
        </div>
        <div class="capital-result">
          <div class="capital-box"><div class="k">입찰보증금</div><div id="capitalBidDeposit" class="v">-</div></div>
          <div class="capital-box"><div class="k">취득·기타비용</div><div id="capitalAcquisitionCost" class="v">-</div></div>
          <div class="capital-box"><div class="k">기본 필요현금</div><div id="capitalClosingCash" class="v">-</div></div>
          <div class="capital-box"><div class="k">인수금액 포함 최악</div><div id="capitalWorstCash" class="v">-</div></div>
          <div class="capital-box"><div class="k">기본 여유/부족</div><div id="capitalClosingGap" class="v">-</div></div>
          <div class="capital-box"><div class="k">최악 여유/부족</div><div id="capitalWorstGap" class="v">-</div></div>
        </div>
        <div id="capitalVerdict" class="capital-verdict warn">입력 필요</div>
        <div class="note warn-note" style="margin-top:12px">인수금액은 즉시 현금지출이 아닐 수 있지만, 대항력 임차인·미배당 보증금이 있으면 최악 시나리오로 별도 확인해야 합니다.</div>
      </div>
    `);
    updateCapitalCheck();
  }

  window.updateCapitalCheck = updateCapitalCheck;

  const observer = new MutationObserver(() => renderCapitalCard());
  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    observer.observe(document.body, { childList: true, subtree: true });
    renderCapitalCard();
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
})();
