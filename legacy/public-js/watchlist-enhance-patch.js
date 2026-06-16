(() => {
  const KEY = 'gm_watchlist_v1';
  const CHECK_KEY = 'gm_bid_checklist_v1';
  const CAPITAL_KEY = 'gm_capital_profile_v1';

  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
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

  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function saveCases(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
  }

  function loadCases() {
    return loadJson(KEY, []);
  }

  function checklistRate(item) {
    const all = loadJson(CHECK_KEY, {});
    const candidates = [item.caseNo, item.raw?.caseNo, item.raw?.basic?.['사건번호'], `${item.court || ''}|${item.caseNo || ''}`].filter(Boolean);
    const state = candidates.map((k) => all[k]).find(Boolean);
    if (!state) return { done: 0, total: 0, rate: 0, label: '미확인' };
    const vals = Object.values(state);
    const total = vals.length;
    const done = vals.filter(Boolean).length;
    return { done, total, rate: total ? done / total : 0, label: total ? `${done}/${total}` : '미확인' };
  }

  function capitalFit(item) {
    const p = loadJson(CAPITAL_KEY, {});
    const cash = Number(p.cash || 0);
    const loan = Number(p.loan || 0);
    const reserve = Number(p.reserve || 5000000);
    const depositRate = Number(p.depositRate || 10);
    const acquisitionRate = Number(p.acquisitionRate || 5.6);
    const bid = Number(item.maxBid || item.minBid || 0);
    if (!cash || !bid) return { label: '미입력', cls: 'warn', gap: 0 };
    const bidDeposit = bid * (depositRate / 100);
    const acquisitionCost = bid * (acquisitionRate / 100);
    const loanApplied = Math.min(loan, bid);
    const needCash = Math.max(0, bid - loanApplied) + acquisitionCost + reserve;
    const worstCash = needCash + Number(item.inherited || 0);
    const gap = cash - worstCash;
    if (cash < bidDeposit) return { label: '보증금부족', cls: 'danger', gap: cash - bidDeposit };
    if (gap < 0) return { label: '잔금위험', cls: 'danger', gap };
    if (gap < Math.max(5000000, bid * 0.03)) return { label: '경계', cls: 'warn', gap };
    return { label: '가능', cls: 'good', gap };
  }

  function analysisStatus(item) {
    if (item.report) return { label: '상세분석', cls: 'good' };
    if (item.raw) return { label: '기본조회', cls: 'warn' };
    return { label: '재조회필요', cls: 'danger' };
  }

  function finalScore(item) {
    const check = checklistRate(item);
    const cap = capitalFit(item);
    const analysis = analysisStatus(item);
    let score = Number(item.bulkScore || 0);
    if (!score) {
      const marginRate = Number(item.marginRate || 0);
      score += marginRate >= 0.25 ? 35 : marginRate >= 0.15 ? 24 : marginRate >= 0.06 ? 12 : 0;
      score += item.decision === '입찰후보' || item.decision === '1차후보' ? 18 : item.decision === '검토' || item.decision === '경계' ? 8 : 0;
    }
    if (item.report) score += 12;
    if (item.risk === 'danger') score -= 25;
    if (Number(item.inherited || 0) > 0) score -= 12;
    if (cap.cls === 'good') score += 10;
    if (cap.cls === 'danger') score -= 18;
    if (check.total) score += Math.round(check.rate * 12) - 6;
    if (analysis.cls === 'danger') score -= 15;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function finalLabel(score) {
    if (score >= 70) return { label: '상위후보', cls: 'good' };
    if (score >= 45) return { label: '검토', cls: 'warn' };
    return { label: '보류', cls: 'danger' };
  }

  function getSortMode() {
    return window.__watchSortMode || document.getElementById('watchSort')?.value || 'final';
  }

  function sortCases(items, mode = getSortMode()) {
    const copy = [...items];
    if (mode === 'final') copy.sort((a, b) => finalScore(b) - finalScore(a));
    else if (mode === 'candidate') {
      const rank = { '입찰후보': 0, '1차후보': 0, '경계': 1, '검토': 1, '보류': 2, '패스': 3 };
      copy.sort((a, b) => (rank[a.decision] ?? 9) - (rank[b.decision] ?? 9) || b.safetyMargin - a.safetyMargin);
    } else if (mode === 'margin') copy.sort((a, b) => b.safetyMargin - a.safetyMargin);
    else if (mode === 'maxBid') copy.sort((a, b) => b.maxBid - a.maxBid);
    else if (mode === 'risk') {
      const rank = { ok: 0, basic: 1, warn: 2, danger: 3 };
      copy.sort((a, b) => (rank[a.risk] ?? 9) - (rank[b.risk] ?? 9));
    } else if (mode === 'recent') copy.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    return copy;
  }

  function injectStyles() {
    if (document.getElementById('watchlistEnhancePatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'watchlistEnhancePatchStyles';
    style.textContent = `
      .watchlist-table.enhanced { min-width: 1320px; }
      .watch-ready-cell { min-width: 118px; }
      .watch-score { font-family:var(--font-serif); font-size:20px; font-weight:900; }
      .watch-mini { display:block; margin-top:3px; color:var(--ink-3); font-size:11px; line-height:1.35; }
      .watch-pill.basic { background:var(--bg); color:var(--ink-3); border:1px solid var(--line); }
      .watch-progress { width:82px; height:7px; background:var(--bg); border:1px solid var(--line); border-radius:999px; overflow:hidden; margin-top:5px; }
      .watch-progress > div { height:100%; background:var(--accent); }
      .watch-quick-note { margin-top:8px; color:var(--ink-3); font-size:12px; }
    `;
    document.head.appendChild(style);
  }

  function deleteCase(id) {
    saveCases(loadCases().filter((x) => x.id !== id));
    renderEnhancedWatchlist();
  }

  function updateMemo(id, value) {
    const items = loadCases();
    const item = items.find((x) => x.id === id);
    if (item) item.memo = value;
    saveCases(items);
  }

  function renderEnhancedWatchlist() {
    injectStyles();
    const rs = document.getElementById('resultsSection');
    if (!rs) return;
    const selectedMode = getSortMode();
    rs.querySelector('.watchlist-card')?.remove();
    const items = sortCases(loadCases(), selectedMode);
    if (!items.length) return;

    const summary = items.reduce((acc, x) => {
      const s = finalScore(x);
      if (s >= 70) acc.top += 1;
      else if (s >= 45) acc.review += 1;
      else acc.hold += 1;
      return acc;
    }, { top: 0, review: 0, hold: 0 });

    const html = `
      <div class="subcard watchlist-card">
        <h4>📂 관심 사건 비교표</h4>
        <p class="muted">저장한 사건을 가격뿐 아니라 분석상태·체크리스트·자금 가능성까지 함께 비교합니다.</p>
        <div class="watch-toolbar">
          <div class="watch-small">총 ${items.length}건 · 상위후보 ${summary.top}건 · 검토 ${summary.review}건 · 보류 ${summary.hold}건</div>
          <label class="watch-small">정렬
            <select id="watchSort" onchange="window.__watchSortMode=this.value; renderWatchlist()">
              <option value="final" ${selectedMode === 'final' ? 'selected' : ''}>최종점수순</option>
              <option value="candidate" ${selectedMode === 'candidate' ? 'selected' : ''}>후보 판정순</option>
              <option value="margin" ${selectedMode === 'margin' ? 'selected' : ''}>안전마진순</option>
              <option value="maxBid" ${selectedMode === 'maxBid' ? 'selected' : ''}>최대입찰가순</option>
              <option value="risk" ${selectedMode === 'risk' ? 'selected' : ''}>위험 낮은순</option>
              <option value="recent" ${selectedMode === 'recent' ? 'selected' : ''}>최근 저장순</option>
            </select>
          </label>
        </div>
        <div class="watch-quick-note">자금 가능성은 저장된 가용현금/대출가능액 기준의 1차 추정입니다. 정확한 판단은 상세분석 화면에서 확인하세요.</div>
        <div class="watchlist-table-wrap">
          <table class="watchlist-table enhanced">
            <thead><tr><th>최종</th><th>판정</th><th>사건번호</th><th>주소</th><th>감정가</th><th>최저가</th><th>인수금액</th><th>안전마진</th><th>최대입찰가</th><th>분석상태</th><th>체크</th><th>자금</th><th>리스크</th><th>메모</th><th>작업</th></tr></thead>
            <tbody>
              ${items.map((x) => {
                const check = checklistRate(x);
                const cap = capitalFit(x);
                const analysis = analysisStatus(x);
                const score = finalScore(x);
                const final = finalLabel(score);
                return `
                  <tr>
                    <td><div class="watch-score ${final.cls === 'good' ? 'ok' : final.cls === 'danger' ? 'danger' : ''}">${score}</div><span class="watch-pill ${final.cls}">${final.label}</span></td>
                    <td><span class="watch-pill ${esc(x.decisionClass || 'warn')}">${esc(x.decision || '-')}</span></td>
                    <td>${esc(x.court)}<br><b>${esc(x.caseNo)}</b></td>
                    <td class="addr" title="${esc(x.address)}">${esc(x.address || '-')}</td>
                    <td>${krw(x.appraisal)}</td>
                    <td>${krw(x.minBid)}<span class="watch-mini">${esc(x.failCount || '')}</span></td>
                    <td class="${x.inherited ? 'danger' : ''}">${krw(x.inherited)}</td>
                    <td class="${x.safetyMargin > 0 ? 'ok' : 'danger'}">${krw(x.safetyMargin)}<span class="watch-mini">${((x.marginRate || 0) * 100).toFixed(1)}%</span></td>
                    <td><b>${krw(x.maxBid)}</b></td>
                    <td class="watch-ready-cell"><span class="watch-pill ${analysis.cls}">${analysis.label}</span><span class="watch-mini">${x.source === 'bulk-fetch' ? '일괄조회' : '단건저장'}</span></td>
                    <td class="watch-ready-cell">${check.label}<div class="watch-progress"><div style="width:${Math.round(check.rate * 100)}%"></div></div></td>
                    <td class="watch-ready-cell"><span class="watch-pill ${cap.cls}">${cap.label}</span><span class="watch-mini">여유 ${krw(cap.gap)}</span></td>
                    <td>${esc(x.risk)}<span class="watch-mini">대항 ${x.daehang || 0} / 인수권리 ${x.inheritCount || 0}</span></td>
                    <td><input style="width:170px" value="${esc(x.memo || '')}" oninput="updateWatchMemo('${esc(x.id)}', this.value)" placeholder="메모"></td>
                    <td>
                      <button class="watch-btn compact" onclick="openWatchCase('${esc(x.id)}')">상세분석</button>
                      <button class="watch-btn compact danger" onclick="deleteWatchCase('${esc(x.id)}')">삭제</button>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    const saveCard = rs.querySelector('.watch-save-card');
    if (saveCard) saveCard.insertAdjacentHTML('afterend', html);
    else rs.insertAdjacentHTML('afterbegin', html);
  }

  function install() {
    if (!window.__gmWatchlist) return false;
    injectStyles();
    window.renderWatchlist = renderEnhancedWatchlist;
    window.deleteWatchCase = deleteCase;
    window.updateWatchMemo = updateMemo;
    return true;
  }

  const timer = setInterval(() => {
    if (install()) {
      clearInterval(timer);
      const rs = document.getElementById('resultsSection');
      if (rs && loadCases().length) renderEnhancedWatchlist();
    }
  }, 80);

  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    install();
  });
})();
