(() => {
  const TAB_KEY = 'gm_home_discovery_tab_v1';

  function injectStyles() {
    if (document.getElementById('homeTabsPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'homeTabsPatchStyles';
    style.textContent = `
      .header-inner { justify-content: space-between; gap: 20px; min-height: 86px; }
      .brand { align-items:center; }
      .brand-mark { flex:0 0 auto; }
      .brand-text { display:flex; flex-direction:column; justify-content:center; transform:translateY(2px); }
      .brand-text h1 { line-height:1.04; }
      .brand-text p { line-height:1.15; }
      .home-discovery-tabs { margin-left:auto; }
      .home-tab-buttons { display:flex; gap:8px; align-items:center; }
      .home-tab-buttons button { border:1px solid var(--line); background:#fff; color:var(--ink-2); border-radius:999px; padding:9px 14px; font-size:13px; font-weight:900; cursor:pointer; white-space:nowrap; }
      .home-tab-buttons button.active { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
      .home-tab-panel-shell { background:var(--bg); border-bottom:1px solid var(--line); }
      .home-tab-panel { display:none; max-width:1040px; margin:0 auto; padding:18px 24px 20px; }
      .home-tab-panel.active { display:block; }
      .home-tab-panel > .today-dashboard-card,
      .home-tab-panel > .bulk-card,
      .home-tab-panel > .date-recs-card { margin:0; }
      .home-tab-panel .bulk-card,
      .home-tab-panel .date-recs-card,
      .home-tab-panel .today-dashboard-card { color:#F6F5F1; }
      .hero + .home-tab-panel-shell { display:none; }
      @media (max-width:1040px) {
        .header-inner { align-items:center; flex-direction:column; padding-top:14px; padding-bottom:12px; min-height:auto; }
        .home-discovery-tabs { margin-left:0; width:100%; overflow-x:auto; padding-bottom:2px; }
        .home-tab-buttons { min-width:max-content; justify-content:center; }
      }
      @media (max-width:720px) {
        .header-inner { align-items:flex-start; }
        .home-tab-buttons { justify-content:flex-start; }
        .home-tab-buttons button { padding:8px 12px; font-size:12px; }
        .home-tab-panel { padding-left:18px; padding-right:18px; }
        .brand-text { transform:translateY(1px); }
      }
    `;
    document.head.appendChild(style);
  }

  function getSavedTab() {
    try { return localStorage.getItem(TAB_KEY) || ''; } catch { return ''; }
  }

  function saveTab(tab) {
    try { localStorage.setItem(TAB_KEY, tab); } catch {}
  }

  function panelFor(tab) {
    return document.querySelector(`[data-home-tab-panel="${tab}"]`);
  }

  function ensureShell() {
    injectStyles();
    const headerInner = document.querySelector('.header-inner');
    if (headerInner && !document.querySelector('.home-discovery-tabs')) {
      headerInner.insertAdjacentHTML('beforeend', `
        <nav class="home-discovery-tabs" aria-label="보조 도구 메뉴">
          <div class="home-tab-buttons">
            <button type="button" data-home-tab="bulk" onclick="switchHomeTab('bulk')">여러 사건 일괄조회</button>
            <button type="button" data-home-tab="date" onclick="switchHomeTab('date')">매각기일 추천</button>
            <button type="button" data-home-tab="today" onclick="switchHomeTab('today')">저장 후보 TOP 5</button>
          </div>
        </nav>
      `);
    }

    const header = document.querySelector('.site-header');
    if (header && !document.querySelector('.home-tab-panel-shell')) {
      header.insertAdjacentHTML('afterend', `
        <section class="home-tab-panel-shell">
          <div class="home-tab-panel" data-home-tab-panel="bulk"></div>
          <div class="home-tab-panel" data-home-tab-panel="date"></div>
          <div class="home-tab-panel" data-home-tab-panel="today"></div>
        </section>
      `);
    }
  }

  function moveCards() {
    ensureShell();
    const map = [
      ['bulk', '.bulk-card'],
      ['date', '.date-recs-card'],
      ['today', '.today-dashboard-card'],
    ];
    map.forEach(([tab, selector]) => {
      const card = document.querySelector(selector);
      const panel = panelFor(tab);
      if (card && panel && card.parentElement !== panel) panel.appendChild(card);
    });
  }

  window.switchHomeTab = function(tab) {
    moveCards();
    const currentActive = document.querySelector(`[data-home-tab="${tab}"]`)?.classList.contains('active');
    const nextTab = currentActive ? '' : tab;
    saveTab(nextTab);
    document.querySelectorAll('[data-home-tab]').forEach((btn) => btn.classList.toggle('active', btn.dataset.homeTab === nextTab));
    document.querySelectorAll('[data-home-tab-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.homeTabPanel === nextTab));
    if (nextTab) document.querySelector('.home-tab-panel-shell')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  function initTabs() {
    moveCards();
    const saved = getSavedTab();
    document.querySelectorAll('[data-home-tab]').forEach((btn) => btn.classList.toggle('active', btn.dataset.homeTab === saved));
    document.querySelectorAll('[data-home-tab-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.homeTabPanel === saved));
    window.GM?.patches?.register?.('home-tabs', { version: 'v3-header-nav' });
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      initTabs();
    });
  }

  document.addEventListener('DOMContentLoaded', initTabs);
  if (document.body) {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    initTabs();
  }
})();
