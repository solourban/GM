(() => {
  const KEY = 'gm_watchlist_v1';

  function parseKrw(value) {
    const digits = String(value || '').replace(/[^0-9.-]/g, '');
    const n = digits ? Number(digits) : 0;
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
    return String(value || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function shortAddress(value) {
    return String(value || '').replace(/\s+/g, ' ').replace(/^[,\s]+/, '').trim();
  }

  function injectStyles() {
    if (document.getElementById('watchlistPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'watchlistPatchStyles';
    style.textContent = `
      .watch-actions { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
      .watch-actions input { flex:1; min-width:220px; background:var(--bg); border:1px solid var(--line); border-radius:10px; padding:11px 12px; }
      .watch-btn { border:none; border-radius:10px; padding:10px 12px; font-weight:800; cursor:pointer; background:var(--accent); color:var(--accent-ink); white-space:nowrap; }
      .watch-btn.secondary { background:var(--bg); color:var(--ink-2); border:1px solid var(--line); }
      .watch-btn.danger { background:var(--danger-bg); color:var(--danger); }
      .watch-btn.compact { padding:7px 9px; font-size:12px; }
      .watchlist-table-wrap { overflow-x:auto; margin-top:12px; }
      .watchlist-table { width:100%; border-collapse:collapse; font-size:13px; min-width:1040px; }
      .watchlist-table th { text-align:left; color:var(--ink-3); border-bottom:1px solid var(--line); padding:10px 8px; font-size:12px; white-space:nowrap; }
      .watchlist-table td { border-bottom:1px solid var(--line); padding:11px 8px; vertical-align:middle; }
      .watchlist-table .addr { max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .watch-pill { display:inline-block; border-radius:999px; padding:4px 9px; font-size:11px; font-weight:800; white-space:nowrap; }
      .watch-pill.good { background:var(--ok-bg); color:var(--ok); }
      .watch-pill.warn { background:var(--warn-bg); color:var(--warn); }
      .watch-pill.danger { background:var(--danger-bg); color:var(--danger); }
      .watch-toolbar { display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap; margin-top:10px; }
      .watch-toolbar select { background:var(--bg); border:1px solid var(--line); border-radius:10px; padding:9px 10px; }
      .watch-small { font-size:12px; color:var(--ink-3); }
    `;
    document.head.appendChild(style);
  }

  function loadCases() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
  function saveCases(items) { localStorage.setItem(KEY, JSON.stringify(items)); }
  function caseKey(item) { return `${item.court || ''}|${item.caseNo || ''}`; }

  function scoreDecision({ risk, inherited, minBid, safetyMargin, marginRate }) {
    if (risk === 'danger') return { label: '보류', cls: 'danger' };
    if (minBid && inherited / minBid >= 0.35) return { label: '보류', cls: 'danger' };
    if (safetyMargin <= 0) return { label: '패스', cls: 'danger' };
    if (marginRate >= 0.18 && risk !== 'danger') return { label: '입찰후보', cls: 'good' };
    if (marginRate >= 0.06) return { label: '경계', cls: 'warn' };
    return { label: '보류', cls: 'warn' };
  }

  function summarizeReport(report) {
    const basic = report.basic || {};
    const appraisal = parseKrw(basic['감정평가액'] || basic['감정가']);
    const minBid = parseKrw(basic['최저매각가격'] || basic['최저가']) || Number(report.baedang?.bidPrice || 0);
    const inherited = Number(report.inherited?.total || 0);
    const safetyMargin = appraisal && minBid ? appraisal - minBid - inherited : 0;
    const marginRate = appraisal ? safetyMargin / appraisal : 0;
    const risk = report.risk?.level || 'warn';
    const daehang = (report.tenants || []).filter((t) => t.daehang === '있음').length;
    const inheritCount = (report.rights || []).filter((r) => r.status === '인수').length;
    const maxBid = report.bidRec?.upper || Math.max(0, Math.floor((appraisal - inherited - appraisal * 0.064) / 10000) * 10000);
    const decision = scoreDecision({ risk, inherited, minBid, safetyMargin, marginRate });

    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      savedAt: new Date().toISOString(),
      court: report.court || basic['법원'] || '',
      caseNo: report.case || basic['사건번호'] || '',
      address: shortAddress(basic['소재지'] || ''),
      appraisal,
      minBid,
      failCount: basic['유찰횟수'] || '',
      inherited,
      safetyMargin,
      marginRate,
      maxBid,
      risk,
      daehang,
      inheritCount,
      decision: decision.label,
      decisionClass: decision.cls,
      memo: '',
      raw: report.raw || null,
      report,
      source: 'analysis-report',
    };
  }

  function upsertCase(item) {
    const items = loadCases();
    const key = caseKey(item);
    const idx = items.findIndex((x) => caseKey(x) === key);
    if (idx >= 0) {
      item.id = items[idx].id;
      item.memo = items[idx].memo || item.memo;
      item.raw = item.raw || items[idx].raw || null;
      item.report = item.report || items[idx].report || null;
      items[idx] = { ...items[idx], ...item, savedAt: new Date().toISOString() };
    } else {
      items.unshift(item);
    }
    saveCases(items.slice(0, 150));
  }

  function deleteCase(id) {
    saveCases(loadCases().filter((x) => x.id !== id));
    renderWatchlist();
  }

  function updateMemo(id, value) {
    const items = loadCases();
    const item = items.find((x) => x.id === id);
    if (item) item.memo = value;
    saveCases(items);
  }

  function sortCases(items) {
    const mode = document.getElementById('watchSort')?.value || 'candidate';
    const copy = [...items];
    if (mode === 'candidate') {
      const rank = { '입찰후보': 0, '1차후보': 0, '경계': 1, '검토': 1, '보류': 2, '패스': 3 };
      copy.sort((a, b) => (rank[a.decision] ?? 9) - (rank[b.decision] ?? 9) || b.safetyMargin - a.safetyMargin);
    }
    if (mode === 'margin') copy.sort((a, b) => b.safetyMargin - a.safetyMargin);
    if (mode === 'maxBid') copy.sort((a, b) => b.maxBid - a.maxBid);
    if (mode === 'risk') {
      const rank = { ok: 0, basic: 1, warn: 2, danger: 3 };
      copy.sort((a, b) => (rank[a.risk] ?? 9) - (rank[b.risk] ?? 9));
    }
    if (mode === 'recent') copy.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    return copy;
  }

  function renderSaveCard(report) {
    const rs = document.getElementById('resultsSection');
    if (!rs || rs.querySelector('.watch-save-card')) return;
    const firstVerdict = rs.querySelector('.verdict');
    if (!firstVerdict) return;
    firstVerdict.insertAdjacentHTML('afterend', `
      <div class="subcard input-card watch-save-card">
        <h4>📌 관심사건 저장</h4>
        <p class="muted">이 사건을 저장해두고 다른 물건과 최저가·인수금액·안전마진·최대입찰가를 비교합니다.</p>
        <div class="watch-actions">
          <input id="watchMemo" placeholder="메모 예: 시세 확인 필요 / 임차인 매도 가능성 / 현장답사 예정">
          <button class="watch-btn" onclick="saveCurrentWatchCase()">관심사건에 저장</button>
          <button class="watch-btn secondary" onclick="renderWatchlist()">저장목록 보기</button>
        </div>
      </div>`);
    window.__watchCurrentReport = report;
  }

  function renderWatchlist() {
    injectStyles();
    const rs = document.getElementById('resultsSection');
    if (!rs) return;
    rs.querySelector('.watchlist-card')?.remove();
    const items = sortCases(loadCases());
    if (!items.length) return;

    const html = `
      <div class="subcard watchlist-card">
        <h4>📂 관심 사건 비교표</h4>
        <p class="muted">저장한 사건을 돈 되는 후보부터 빠르게 비교합니다. [상세분석]을 누르면 저장된 기본정보로 Step 1을 다시 엽니다.</p>
        <div class="watch-toolbar">
          <div class="watch-small">총 ${items.length}건 저장됨</div>
          <label class="watch-small">정렬
            <select id="watchSort" onchange="renderWatchlist()">
              <option value="candidate">후보 판정순</option><option value="margin">안전마진순</option><option value="maxBid">최대입찰가순</option><option value="risk">위험 낮은순</option><option value="recent">최근 저장순</option>
            </select>
          </label>
        </div>
        <div class="watchlist-table-wrap">
          <table class="watchlist-table">
            <thead><tr><th>판정</th><th>사건번호</th><th>주소</th><th>감정가</th><th>최저가</th><th>유찰</th><th>인수금액</th><th>안전마진</th><th>최대입찰가</th><th>리스크</th><th>메모</th><th>작업</th></tr></thead>
            <tbody>
              ${items.map((x) => `
                <tr>
                  <td><span class="watch-pill ${esc(x.decisionClass)}">${esc(x.decision)}</span></td>
                  <td>${esc(x.court)}<br><b>${esc(x.caseNo)}</b></td>
                  <td class="addr" title="${esc(x.address)}">${esc(x.address || '-')}</td>
                  <td>${krw(x.appraisal)}</td><td>${krw(x.minBid)}</td><td>${esc(x.failCount || '-')}</td>
                  <td class="${x.inherited ? 'danger' : ''}">${krw(x.inherited)}</td>
                  <td class="${x.safetyMargin > 0 ? 'ok' : 'danger'}">${krw(x.safetyMargin)}<br><span class="watch-small">${((x.marginRate || 0) * 100).toFixed(1)}%</span></td>
                  <td><b>${krw(x.maxBid)}</b></td>
                  <td>${esc(x.risk)}<br><span class="watch-small">대항 ${x.daehang || 0} / 인수권리 ${x.inheritCount || 0}</span></td>
                  <td><input style="width:170px" value="${esc(x.memo || '')}" oninput="updateWatchMemo('${esc(x.id)}', this.value)" placeholder="메모"></td>
                  <td>
                    <button class="watch-btn compact" onclick="openWatchCase('${esc(x.id)}')">상세분석</button>
                    <button class="watch-btn compact danger" onclick="deleteWatchCase('${esc(x.id)}')">삭제</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    const saveCard = rs.querySelector('.watch-save-card');
    if (saveCard) saveCard.insertAdjacentHTML('afterend', html);
    else rs.insertAdjacentHTML('afterbegin', html);
  }

  window.openWatchCase = function(id) {
    const item = loadCases().find((x) => x.id === id);
    if (!item) return alert('저장된 사건을 찾을 수 없습니다.');
    if (item.raw && typeof window.renderStep1 === 'function') {
      window.currentRaw = item.raw;
      window.renderStep1(item.raw, '저장됨');
      document.getElementById('resultsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const match = String(item.caseNo || '').match(/(20\d{2})타경(\d+)/);
    if (match) {
      const courtSelect = document.getElementById('jiwonNm');
      const yearInput = document.getElementById('saYear');
      const serInput = document.getElementById('saSer');
      if (courtSelect && item.court) courtSelect.value = item.court;
      if (yearInput) yearInput.value = match[1];
      if (serInput) serInput.value = match[2];
      document.querySelector('.search-box')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      alert('이 사건은 raw 기본정보가 저장되어 있지 않아 검색창에 값을 채웠습니다. 기본정보 가져오기를 눌러 다시 조회하세요.');
      return;
    }
    alert('상세분석을 열 수 없습니다. 사건번호 형식을 확인하세요.');
  };

  window.saveCurrentWatchCase = function() {
    const report = window.__watchCurrentReport || window.__lastAuctionReport;
    if (!report) return;
    const item = summarizeReport(report);
    item.memo = document.getElementById('watchMemo')?.value || '';
    if (window.currentRaw) item.raw = window.currentRaw;
    upsertCase(item);
    renderWatchlist();
  };

  window.renderWatchlist = renderWatchlist;
  window.deleteWatchCase = deleteCase;
  window.updateWatchMemo = updateMemo;
  window.__gmWatchlist = { loadCases, saveCases, upsertCase };

  function injectAfterReport(report) {
    injectStyles();
    renderSaveCard(report);
    renderWatchlist();
  }

  const wait = setInterval(() => {
    if (typeof window.renderReport === 'function') {
      clearInterval(wait);
      const originalRenderReport = window.renderReport;
      window.renderReport = function patchedWatchRenderReport(report) {
        originalRenderReport(report);
        injectAfterReport(report);
      };
    }
  }, 50);

  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    const rs = document.getElementById('resultsSection');
    if (rs && !rs.innerHTML.trim() && loadCases().length) renderWatchlist();
  });
})();
