(() => {
  const WATCH_KEY = 'gm_watchlist_v1';
  const CHECK_KEY = 'gm_bid_checklist_v1';
  const CAPITAL_KEY = 'gm_capital_profile_v1';

  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
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
    if (!cash || !bid) return { label: '자금 미입력', cls: 'warn', gap: 0 };
    const bidDeposit = bid * (depositRate / 100);
    const acquisitionCost = bid * (acquisitionRate / 100);
    const loanApplied = Math.min(loan, bid);
    const needCash = Math.max(0, bid - loanApplied) + acquisitionCost + reserve;
    const worstCash = needCash + Number(item.inherited || 0);
    const gap = cash - worstCash;
    if (cash < bidDeposit) return { label: '보증금 부족', cls: 'danger', gap: cash - bidDeposit };
    if (gap < 0) return { label: '잔금 위험', cls: 'danger', gap };
    if (gap < Math.max(5000000, bid * 0.03)) return { label: '자금 경계', cls: 'warn', gap };
    return { label: '자금 가능', cls: 'good', gap };
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

  function grade(score) {
    if (score >= 70) return { label: '상위후보', cls: 'good' };
    if (score >= 45) return { label: '검토', cls: 'warn' };
    return { label: '보류', cls: 'danger' };
  }

  function injectStyles() {
    if (document.getElementById('todayDashboardPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'todayDashboardPatchStyles';
    style.textContent = `
      .today-dashboard-card { margin:18px 0; border:1px solid rgba(246,245,241,.18); border-radius:20px; padding:18px; background:rgba(246,245,241,.08); color:#F6F5F1; }
      .today-dashboard-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; }
      .today-dashboard-head h3 { margin:0 0 6px; color:var(--accent-ink); font-family:var(--font-serif); font-size:21px; }
      .today-dashboard-head p { margin:0; color:rgba(246,245,241,.68); font-size:13px; line-height:1.55; }
      .today-dashboard-actions { display:flex; gap:8px; flex-wrap:wrap; }
      .today-dashboard-actions button { background:var(--accent-ink); color:var(--accent); border:none; border-radius:10px; padding:10px 13px; font-weight:900; cursor:pointer; }
      .today-dashboard-actions button.secondary { background:rgba(246,245,241,.1); color:#F6F5F1; border:1px solid rgba(246,245,241,.2); }
      .today-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px; margin-top:14px; }
      .today-kpi { background:rgba(0,0,0,.16); border:1px solid rgba(246,245,241,.16); border-radius:14px; padding:12px; }
      .today-kpi .k { color:rgba(246,245,241,.62); font-size:12px; }
      .today-kpi .v { font-family:var(--font-serif); color:#F4E9C7; font-size:22px; font-weight:900; margin-top:3px; }
      .today-list { display:grid; gap:10px; margin-top:14px; }
      .today-item { display:grid; grid-template-columns:76px 1fr auto; gap:12px; align-items:center; background:#fff; color:var(--ink); border:1px solid var(--line); border-radius:15px; padding:13px; }
      .today-score { text-align:center; font-family:var(--font-serif); font-size:26px; font-weight:900; }
      .today-title { font-weight:900; overflow-wrap:anywhere; }
      .today-meta { color:var(--ink-3); font-size:12.5px; line-height:1.55; margin-top:3px; overflow-wrap:anywhere; }
      .today-pills { display:flex; gap:6px; flex-wrap:wrap; margin-top:7px; }
      .today-pill { display:inline-block; border-radius:999px; padding:4px 9px; font-size:11px; font-weight:900; white-space:nowrap; }
      .today-pill.good { background:var(--ok-bg); color:var(--ok); }
      .today-pill.warn { background:var(--warn-bg); color:var(--warn); }
      .today-pill.danger { background:var(--danger-bg); color:var(--danger); }
      .today-pill.basic { background:var(--bg); color:var(--ink-3); border:1px solid var(--line); }
      .today-item button { background:var(--accent); color:var(--accent-ink); border:none; border-radius:10px; padding:10px 12px; font-weight:900; cursor:pointer; }
      .today-empty { margin-top:12px; padding:14px; border-radius:14px; background:rgba(0,0,0,.16); border:1px solid rgba(246,245,241,.16); color:rgba(246,245,241,.72); font-size:13px; line-height:1.6; }
      .today-warnings { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; margin-top:12px; }
      .today-warning { background:rgba(0,0,0,.12); border:1px solid rgba(246,245,241,.14); border-radius:12px; padding:11px; color:rgba(246,245,241,.78); font-size:12.5px; }
      @media (max-width:720px) { .today-item { grid-template-columns:1fr; } .today-score { text-align:left; } .today-dashboard-actions button, .today-item button { width:100%; } }
    `;
    document.head.appendChild(style);
  }

  function findMount() {
    return document.querySelector('.search-box') || document.querySelector('main') || document.body;
  }

  function openBulkArea() {
    document.getElementById('bulkCases')?.focus();
    document.querySelector('.bulk-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function itemHtml(item, idx) {
    const score = finalScore(item);
    const g = grade(score);
    const check = checklistRate(item);
    const cap = capitalFit(item);
    const analysis = analysisStatus(item);
    const margin = Number(item.safetyMargin || 0);
    const maxBid = Number(item.maxBid || item.minBid || 0);
    return `
      <div class="today-item">
        <div>
          <div class="today-score ${g.cls === 'good' ? 'ok' : g.cls === 'danger' ? 'danger' : ''}">${score}</div>
          <span class="today-pill ${g.cls}">#${idx + 1} ${g.label}</span>
        </div>
        <div>
          <div class="today-title">${esc(item.court || '-')} ${esc(item.caseNo || '-')}</div>
          <div class="today-meta">${esc(item.address || '주소 미확인')}</div>
          <div class="today-meta">최저가 ${krw(item.minBid)} · 권장상한 ${krw(maxBid)} · 안전마진 ${krw(margin)}</div>
          <div class="today-pills">
            <span class="today-pill ${analysis.cls}">${analysis.label}</span>
            <span class="today-pill ${cap.cls}">${cap.label}</span>
            <span class="today-pill ${check.rate >= 1 ? 'good' : check.rate > 0 ? 'warn' : 'basic'}">체크 ${check.label}</span>
            ${Number(item.inherited || 0) > 0 ? `<span class="today-pill danger">인수 ${krw(item.inherited)}</span>` : '<span class="today-pill good">인수금액 없음</span>'}
          </div>
        </div>
        <button type="button" onclick="openWatchCase('${esc(item.id)}')">상세분석</button>
      </div>
    `;
  }

  function renderTodayDashboard() {
    injectStyles();
    const mount = findMount();
    if (!mount) return;
    document.querySelector('.today-dashboard-card')?.remove();

    const items = loadJson(WATCH_KEY, []);
    const enriched = items.map((item) => ({ ...item, __score: finalScore(item) }));
    const top = [...enriched]
      .sort((a, b) => b.__score - a.__score || Number(b.safetyMargin || 0) - Number(a.safetyMargin || 0))
      .slice(0, 5);

    const topCount = enriched.filter((x) => x.__score >= 70).length;
    const reviewCount = enriched.filter((x) => x.__score >= 45 && x.__score < 70).length;
    const holdCount = enriched.filter((x) => x.__score < 45).length;
    const moneyRisk = enriched.filter((x) => capitalFit(x).cls === 'danger').length;
    const checklistOpen = enriched.filter((x) => {
      const c = checklistRate(x);
      return c.total && c.rate < 1;
    }).length;
    const notAnalyzed = enriched.filter((x) => !x.report).length;

    const html = `
      <div class="today-dashboard-card">
        <div class="today-dashboard-head">
          <div>
            <h3>🔥 오늘 확인할 후보 TOP 5</h3>
            <p>저장된 관심사건 중 최종점수·안전마진·자금 가능성·체크리스트 상태를 기준으로 오늘 먼저 볼 후보를 정리합니다.</p>
          </div>
          <div class="today-dashboard-actions">
            <button type="button" onclick="renderTodayDashboard()">새로고침</button>
            <button type="button" class="secondary" onclick="openBulkArea()">일괄조회 입력</button>
          </div>
        </div>
        <div class="today-kpis">
          <div class="today-kpi"><div class="k">저장 사건</div><div class="v">${items.length}건</div></div>
          <div class="today-kpi"><div class="k">상위후보</div><div class="v">${topCount}건</div></div>
          <div class="today-kpi"><div class="k">검토</div><div class="v">${reviewCount}건</div></div>
          <div class="today-kpi"><div class="k">보류</div><div class="v">${holdCount}건</div></div>
        </div>
        ${top.length ? `<div class="today-list">${top.map(itemHtml).join('')}</div>` : `
          <div class="today-empty">
            아직 저장된 관심사건이 없습니다. 단건 조회 후 관심사건에 저장하거나, 여러 사건번호를 일괄조회하면 오늘 확인할 후보가 자동으로 정리됩니다.
          </div>
        `}
        ${items.length ? `
          <div class="today-warnings">
            <div class="today-warning">자금 위험 후보: <b>${moneyRisk}건</b></div>
            <div class="today-warning">체크리스트 미완료: <b>${checklistOpen}건</b></div>
            <div class="today-warning">상세분석 전 후보: <b>${notAnalyzed}건</b></div>
          </div>
        ` : ''}
      </div>
    `;

    mount.insertAdjacentHTML('afterend', html);
    window.GM?.patches?.register?.('today-dashboard', { version: 'v1' });
  }

  window.renderTodayDashboard = renderTodayDashboard;
  window.openBulkArea = openBulkArea;

  document.addEventListener('DOMContentLoaded', renderTodayDashboard);
  document.addEventListener('gm:refresh-all', renderTodayDashboard);
  window.addEventListener('storage', (e) => {
    if ([WATCH_KEY, CHECK_KEY, CAPITAL_KEY].includes(e.key)) renderTodayDashboard();
  });

  const observer = new MutationObserver(() => {
    if (!document.querySelector('.today-dashboard-card')) renderTodayDashboard();
  });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    renderTodayDashboard();
  }
})();
