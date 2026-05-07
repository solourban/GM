(() => {
  const TAB_KEY = 'gm_home_discovery_tab_v1';

  function injectStyles() {
    if (document.getElementById('homeTabsPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'homeTabsPatchStyles';
    style.textContent = `
      .header-inner { justify-content: space-between; gap: 18px; }
      .home-discovery-tabs { margin-left:auto; }
      .home-tab-buttons { display:flex; gap:8px; align-items:center; }
      .home-tab-buttons button { border:1px solid var(--line); background:#fff; color:var(--ink-2); border-radius:999px; padding:9px 14px; font-size:13px; font-weight:900; cursor:pointer; white-space:nowrap; }
      .home-tab-buttons button.active { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
      .home-tab-help { display:none; }
      .home-tab-panel-shell { background:var(--bg); border-bottom:1px solid var(--line); }
      .home-tab-panel { display:none; max-width:1040px; margin:0 auto; padding:22px 24px 4px; }
      .home-tab-panel.active { display:block; }
      .home-tab-panel > .today-dashboard-card,
      .home-tab-panel > .bulk-card,
      .home-tab-panel > .date-recs-card { margin:0 0 18px; }
      .home-tab-panel .bulk-card,
      .home-tab-panel .date-recs-card,
      .home-tab-panel .today-dashboard-card { color:#F6F5F1; }
      @media (max-width:900px) {
        .header-inner { align-items:flex-start; flex-direction:column; padding-top:14px; padding-bottom:14px; }
        .home-discovery-tabs { margin-left:0; width:100%; overflow-x:auto; padding-bottom:2px; }
        .home-tab-buttons { min-width:max-content; }
      }
      @media (max-width:720px) {
        .home-tab-buttons button { padding:8px 12px; font-size:12px; }
        .home-tab-panel { padding-left:18px; padding-right:18px; }
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

    const hero = document.querySelector('.hero');
    if (hero && !document.querySelector('.home-tab-panel-shell')) {
      hero.insertAdjacentHTML('afterend', `
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
    window.GM?.patches?.register?.('home-tabs', { version: 'v2-top-nav' });
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
