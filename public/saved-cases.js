(() => {
  const STORAGE_KEY = 'auctionSavedCases:v1';
  let latestReport = null;
  let currentSort = 'savedAt';
  let currentFilter = 'all';

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

  function getSaved() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function setSaved(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function calcProfit({ sale, bid, inherited, acquireRate = 0.056, sellRate = 0.008, taxRate = 0.77 }) {
    const acquisitionCost = bid * acquireRate;
    const saleCost = sale * sellRate;
    const beforeTax = sale - bid - inherited - acquisitionCost - saleCost;
    const tax = Math.max(0, beforeTax) * taxRate;
    return beforeTax - tax;
  }

  function maxBidForTarget({ sale, inherited, targetProfit = 10000000 }) {
    if (!sale) return null;
    const bestCase = calcProfit({ sale, bid: 0, inherited });
    if (bestCase < targetProfit) return null;

    let lo = 0;
    let hi = Math.max(0, sale - inherited);
    for (let i = 0; i < 70; i++) {
      const mid = (lo + hi) / 2;
      const profit = calcProfit({ sale, bid: mid, inherited });
      if (profit >= targetProfit) lo = mid;
      else hi = mid;
    }
    return Math.floor(lo / 10000) * 10000;
  }

  function riskScore(report) {
    const appraisal = parseKrw(report.basic?.['감정평가액'] || report.basic?.['감정가']);
    const minBid = parseKrw(report.basic?.['최저매각가격'] || report.basic?.['최저가']) || Number(report.baedang?.bidPrice || 0);
    const inherited = Number(report.inherited?.total || 0);
    const tenants = report.tenants || [];
    const rights = report.rights || [];
    const daehang = tenants.filter((t) => t.daehang === '있음').length;
    const unknownTenant = tenants.filter((t) => !t.moveIn || t.daehang === '?' || t.daehang === '확인필요').length;
    const special = rights.filter((r) => /유치권|법정지상권|분묘기지권/.test(r.type || '')).length;

    let score = 82;
    if (report.risk?.level === 'warn') score -= 16;
    if (report.risk?.level === 'danger') score -= 34;
    score -= Math.min(30, Math.round((inherited / Math.max(minBid || 1, 1)) * 70));
    score -= daehang * 8;
    score -= unknownTenant * 10;
    score -= special * 18;
    return Math.max(5, Math.min(95, score));
  }

  function classify(item) {
    if (!item.maxBid) return '패스';
    if (item.riskLevel === 'danger') return '패스';
    if (item.maxBid < item.minBid) return '패스';
    if (item.maxBid - item.minBid >= 10000000 && item.score >= 65) return '입찰후보';
    if (item.maxBid - item.minBid >= 0) return '경계';
    return '보류';
  }

  function reportToItem(report) {
    const basic = report.basic || {};
    const appraisal = parseKrw(basic['감정평가액'] || basic['감정가']);
    const minBid = parseKrw(basic['최저매각가격'] || basic['최저가']) || Number(report.baedang?.bidPrice || 0);
    const inherited = Number(report.inherited?.total || 0);
    const conservativeSale = Math.round((appraisal || minBid) * 0.92 / 10000) * 10000;
    const maxBid = maxBidForTarget({ sale: conservativeSale, inherited });
    const address = String(basic['소재지'] || report.case || '').replace(/\s+/g, ' ').trim();
    const id = `${report.court || basic['법원'] || ''}-${report.case || basic['사건번호'] || Date.now()}`;
    const item = {
      id,
      savedAt: Date.now(),
      court: report.court || basic['법원'] || '',
      caseNo: report.case || basic['사건번호'] || '',
      address,
      appraisal,
      minBid,
      failCount: String(basic['유찰횟수'] || '').replace(/[^0-9]/g, '') || '-',
      inherited,
      conservativeSale,
      maxBid,
      recommendedBid: maxBid ? Math.floor(maxBid * 0.97 / 10000) * 10000 : null,
      gap: maxBid == null ? null : maxBid - minBid,
      riskLevel: report.risk?.level || 'warn',
      score: riskScore(report),
      daehang: (report.tenants || []).filter((t) => t.daehang === '있음').length,
      memo: '',
    };
    item.status = classify(item);
    return item;
  }

  function injectStyles() {
    if (document.getElementById('savedCasesStyles')) return;
    const style = document.createElement('style');
    style.id = 'savedCasesStyles';
    style.textContent = `
      .save-action-box { display:flex; gap:10px; justify-content:flex-end; align-items:center; margin-bottom:14px; flex-wrap:wrap; }
      .btn-save-case { background:var(--accent); color:var(--accent-ink); border:none; border-radius:10px; padding:10px 16px; font-weight:800; cursor:pointer; }
      .btn-save-case:hover { transform: translateY(-1px); box-shadow:0 8px 18px rgba(11,61,46,.18); }
      .saved-board { margin: 26px auto 50px; }
      .saved-board h3 { font-family:var(--font-serif); font-size:22px; margin:0; }
      .saved-toolbar { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:center; margin:12px 0 16px; }
      .saved-buttons { display:flex; gap:8px; flex-wrap:wrap; }
      .saved-buttons button, .saved-row button, .saved-row select { border:1px solid var(--line); background:#fff; border-radius:8px; padding:7px 10px; cursor:pointer; font-size:12.5px; }
      .saved-buttons button.active { background:var(--accent); color:#fff; border-color:var(--accent); }
      .saved-table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:14px; background:#fff; }
      .saved-table { width:100%; min-width:1040px; border-collapse:collapse; font-size:13px; }
      .saved-table th { text-align:left; color:var(--ink-3); border-bottom:1px solid var(--line); padding:10px 9px; font-size:11.5px; white-space:nowrap; }
      .saved-table td { border-bottom:1px solid var(--line); padding:10px 9px; vertical-align:top; }
      .saved-table tr:last-child td { border-bottom:none; }
      .case-title { font-weight:800; white-space:nowrap; }
      .case-address { color:var(--ink-3); font-size:12px; max-width:260px; line-height:1.45; }
      .status-pill { display:inline-flex; padding:4px 8px; border-radius:999px; font-weight:800; font-size:11px; white-space:nowrap; }
      .status-candidate { background:var(--ok-bg); color:var(--ok); }
      .status-watch { background:var(--warn-bg); color:var(--warn); }
      .status-pass { background:var(--danger-bg); color:var(--danger); }
      .saved-memo { width:180px; border:1px solid var(--line); border-radius:8px; padding:7px 9px; }
      .saved-empty { padding:28px; text-align:center; color:var(--ink-3); border:1px dashed var(--line-2); border-radius:14px; background:#fff; }
      @media (max-width:640px) { .save-action-box { justify-content:stretch; } .btn-save-case { width:100%; } }
    `;
    document.head.appendChild(style);
  }

  function statusClass(status) {
    if (status === '입찰후보') return 'status-candidate';
    if (status === '경계' || status === '보류') return 'status-watch';
    return 'status-pass';
  }

  function getFilteredSortedItems() {
    let items = getSaved();
    if (currentFilter !== 'all') items = items.filter((item) => item.status === currentFilter);
    const by = {
      savedAt: (a, b) => b.savedAt - a.savedAt,
      gap: (a, b) => (b.gap ?? -Infinity) - (a.gap ?? -Infinity),
      score: (a, b) => b.score - a.score,
      minBid: (a, b) => a.minBid - b.minBid,
      failCount: (a, b) => Number(b.failCount || 0) - Number(a.failCount || 0),
    }[currentSort];
    return [...items].sort(by || ((a, b) => b.savedAt - a.savedAt));
  }

  function renderSavedBoard() {
    injectStyles();
    let board = document.getElementById('savedCasesBoard');
    const resultsSection = document.getElementById('resultsSection');
    if (!resultsSection) return;
    if (!board) {
      board = document.createElement('section');
      board.id = 'savedCasesBoard';
      board.className = 'saved-board container';
      resultsSection.insertAdjacentElement('afterend', board);
    }

    const all = getSaved();
    const items = getFilteredSortedItems();
    const counts = all.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});

    if (!all.length) {
      board.innerHTML = `
        <div class="subcard">
          <h3>📂 관심 사건 비교</h3>
          <div class="saved-empty">분석 결과에서 <b>관심사건에 저장</b>을 누르면 후보·경계·패스 물건을 비교할 수 있습니다.</div>
        </div>`;
      return;
    }

    board.innerHTML = `
      <div class="subcard">
        <h3>📂 관심 사건 비교</h3>
        <p class="muted">저장한 사건을 수익여유, 위험점수, 최저가, 유찰횟수 기준으로 비교합니다. 데이터는 현재 브라우저에만 저장됩니다.</p>
        <div class="saved-toolbar">
          <div class="saved-buttons">
            ${['all','입찰후보','경계','보류','패스'].map((f) => `<button class="${currentFilter === f ? 'active' : ''}" onclick="window.setSavedFilter('${f}')">${f === 'all' ? '전체' : f} ${f === 'all' ? all.length : (counts[f] || 0)}</button>`).join('')}
          </div>
          <div class="saved-buttons">
            <button class="${currentSort === 'gap' ? 'active' : ''}" onclick="window.setSavedSort('gap')">수익여유순</button>
            <button class="${currentSort === 'score' ? 'active' : ''}" onclick="window.setSavedSort('score')">점수순</button>
            <button class="${currentSort === 'minBid' ? 'active' : ''}" onclick="window.setSavedSort('minBid')">최저가순</button>
            <button class="${currentSort === 'failCount' ? 'active' : ''}" onclick="window.setSavedSort('failCount')">유찰순</button>
            <button class="${currentSort === 'savedAt' ? 'active' : ''}" onclick="window.setSavedSort('savedAt')">최근저장</button>
          </div>
        </div>
        <div class="saved-table-wrap">
          <table class="saved-table">
            <thead><tr><th>판정</th><th>사건</th><th>감정가</th><th>최저가</th><th>유찰</th><th>인수금액</th><th>보수시세</th><th>최대입찰가</th><th>여유</th><th>점수</th><th>메모</th><th></th></tr></thead>
            <tbody>
              ${items.map((item) => `
                <tr class="saved-row">
                  <td><span class="status-pill ${statusClass(item.status)}">${esc(item.status)}</span></td>
                  <td><div class="case-title">${esc(item.caseNo || '-')}</div><div class="case-address">${esc(item.address || item.court || '')}</div></td>
                  <td>${krw(item.appraisal)}</td>
                  <td><b>${krw(item.minBid)}</b></td>
                  <td>${esc(item.failCount)}</td>
                  <td class="${item.inherited > 0 ? 'danger' : ''}">${krw(item.inherited)}</td>
                  <td>${krw(item.conservativeSale)}</td>
                  <td>${item.maxBid ? krw(item.maxBid) : '<span class="danger">불가</span>'}</td>
                  <td class="${(item.gap || 0) >= 0 ? 'ok' : 'danger'}">${item.gap == null ? '-' : krw(item.gap)}</td>
                  <td>${item.score}</td>
                  <td><input class="saved-memo" value="${esc(item.memo || '')}" placeholder="메모" onchange="window.updateSavedMemo('${esc(item.id)}', this.value)"></td>
                  <td><button onclick="window.deleteSavedCase('${esc(item.id)}')">삭제</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function injectSaveButton(report) {
    const rs = document.getElementById('resultsSection');
    if (!rs || rs.querySelector('.save-action-box')) return;
    const top = rs.querySelector('[style*="text-align:right"]') || rs.firstElementChild;
    if (!top) return;
    const box = document.createElement('div');
    box.className = 'save-action-box';
    box.innerHTML = `<button class="btn-save-case" onclick="window.saveCurrentCase()">＋ 관심사건에 저장</button>`;
    top.insertAdjacentElement('afterend', box);
  }

  window.saveCurrentCase = function saveCurrentCase() {
    if (!latestReport) return;
    const item = reportToItem(latestReport);
    const saved = getSaved();
    const existing = saved.find((s) => s.id === item.id);
    if (existing) {
      item.memo = existing.memo || '';
      item.savedAt = existing.savedAt || item.savedAt;
    }
    const next = [item, ...saved.filter((s) => s.id !== item.id)];
    setSaved(next);
    renderSavedBoard();
    alert('관심사건에 저장했습니다. 아래 비교표에서 확인하세요.');
  };

  window.deleteSavedCase = function deleteSavedCase(id) {
    setSaved(getSaved().filter((item) => item.id !== id));
    renderSavedBoard();
  };

  window.updateSavedMemo = function updateSavedMemo(id, memo) {
    setSaved(getSaved().map((item) => item.id === id ? { ...item, memo } : item));
  };

  window.setSavedSort = function setSavedSort(sort) {
    currentSort = sort;
    renderSavedBoard();
  };

  window.setSavedFilter = function setSavedFilter(filter) {
    currentFilter = filter;
    renderSavedBoard();
  };

  function boot() {
    injectStyles();
    renderSavedBoard();
  }

  const wait = setInterval(() => {
    if (typeof window.renderReport === 'function') {
      clearInterval(wait);
      const originalRenderReport = window.renderReport;
      window.renderReport = function savedCasesRenderReport(report) {
        latestReport = report;
        originalRenderReport(report);
        injectSaveButton(report);
        renderSavedBoard();
      };
    }
  }, 50);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
