(() => {
  const TAB_KEY = 'gm_home_discovery_tab_v2';
  const DEFAULT_TAB = 'search';

  const TAB_LABELS = {
    search: '물건 검색',
    bulk: '여러 사건 일괄조회',
    date: '매각기일 추천',
    today: '저장 후보 TOP 5',
  };

  function injectStyles() {
    if (document.getElementById('homeTabsPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'homeTabsPatchStyles';
    style.textContent = `
      .header-inner { justify-content: space-between; gap: 20px; min-height: 86px; }
      .brand { align-items:center; cursor:pointer; }
      .brand-mark { flex:0 0 auto; }
      .brand-text { display:flex; flex-direction:column; justify-content:center; transform:translateY(3px); }
      .brand-text h1 { line-height:1.04; }
      .brand-text p { line-height:1.15; }

      .home-discovery-tabs { margin-left:auto; }
      .home-tab-buttons { display:flex; gap:8px; align-items:center; }
      .home-tab-buttons button { border:1px solid var(--line); background:#fff; color:var(--ink-2); border-radius:999px; padding:9px 14px; font-size:13px; font-weight:900; cursor:pointer; white-space:nowrap; }
      .home-tab-buttons button.active { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }

      .home-hero-tools { max-width: 920px; width:100%; margin: 0 auto; }
      .home-hero-panel { display:none; width:100%; }
      .home-hero-panel.active { display:block; }
      .home-hero-panel > .search-box,
      .home-hero-panel > .bulk-card,
      .home-hero-panel > .date-rec-card,
      .home-hero-panel > .date-recs-card,
      .home-hero-panel > .today-dashboard-card { margin:0 auto !important; width:100% !important; max-width:920px !important; }

      .home-tool-empty { max-width:920px; margin:0 auto; border:1px solid rgba(246,245,241,.18); border-radius:20px; padding:22px; background:rgba(246,245,241,.08); color:rgba(246,245,241,.78); font-size:13px; line-height:1.6; text-align:center; }
      .home-tool-empty b { color:var(--accent-ink); }

      .home-tab-panel-shell { display:none !important; }

      @media (max-width:1040px) {
        .header-inner { align-items:center; flex-direction:column; padding-top:14px; padding-bottom:12px; min-height:auto; }
        .home-discovery-tabs { margin-left:0; width:100%; overflow-x:auto; padding-bottom:2px; }
        .home-tab-buttons { min-width:max-content; justify-content:center; }
      }
      @media (max-width:720px) {
        .header-inner { align-items:flex-start; }
        .home-tab-buttons { justify-content:flex-start; }
        .home-tab-buttons button { padding:8px 12px; font-size:12px; }
        .brand-text { transform:translateY(2px); }
        .home-hero-tools { max-width:100%; }
      }
    `;
    document.head.appendChild(style);
  }

  function getSavedTab() {
    try { return localStorage.getItem(TAB_KEY) || DEFAULT_TAB; } catch { return DEFAULT_TAB; }
  }

  function saveTab(tab) {
    try { localStorage.setItem(TAB_KEY, tab); } catch {}
  }

  function normalizeTab(tab) {
    return TAB_LABELS[tab] ? tab : DEFAULT_TAB;
  }

  function panelFor(tab) {
    return document.querySelector(`[data-home-hero-panel="${tab}"]`);
  }

  function ensureTabs() {
    injectStyles();
    const headerInner = document.querySelector('.header-inner');
    if (headerInner && !document.querySelector('.home-discovery-tabs')) {
      headerInner.insertAdjacentHTML('beforeend', `
        <nav class="home-discovery-tabs" aria-label="홈 도구 메뉴">
          <div class="home-tab-buttons">
            ${Object.entries(TAB_LABELS).map(([key, label]) => `<button type="button" data-home-tab="${key}" onclick="switchHomeTab('${key}')">${label}</button>`).join('')}
          </div>
        </nav>
      `);
    }
  }

  function ensureHeroPanels() {
    injectStyles();
    const heroInner = document.querySelector('.hero-inner');
    if (!heroInner) return;
    if (!document.querySelector('.home-hero-tools')) {
      const copy = heroInner.querySelector('.hero-copy');
      const shell = document.createElement('div');
      shell.className = 'home-hero-tools';
      shell.innerHTML = Object.keys(TAB_LABELS).map((tab) => `
        <div class="home-hero-panel" data-home-hero-panel="${tab}">
          ${tab === 'bulk' ? '<div class="home-tool-empty" data-home-placeholder="bulk"><b>여러 사건 일괄조회</b><br>일괄조회 도구를 불러오는 중입니다.</div>' : ''}
          ${tab === 'date' ? '<div class="home-tool-empty" data-home-placeholder="date"><b>매각기일 추천</b><br>추천 후보 검색 도구를 불러오는 중입니다.</div>' : ''}
          ${tab === 'today' ? '<div class="home-tool-empty" data-home-placeholder="today"><b>저장 후보 TOP 5</b><br>저장 후보 대시보드를 불러오는 중입니다.</div>' : ''}
        </div>
      `).join('');
      if (copy) copy.insertAdjacentElement('afterend', shell);
      else heroInner.appendChild(shell);
    }

    const oldShell = document.querySelector('.home-tab-panel-shell');
    if (oldShell) oldShell.remove();
  }

  function moveOne(tab, selector) {
    const panel = panelFor(tab);
    const card = document.querySelector(selector);
    if (!panel || !card) return false;
    if (card.parentElement !== panel) panel.appendChild(card);
    panel.querySelector(`[data-home-placeholder="${tab}"]`)?.remove();
    return true;
  }

  function moveCards() {
    ensureTabs();
    ensureHeroPanels();
    moveOne('search', '.search-box');
    moveOne('bulk', '.bulk-card');
    moveOne('date', '.date-rec-card') || moveOne('date', '.date-recs-card');
    moveOne('today', '.today-dashboard-card');
  }

  function setActive(tab, shouldScroll = false) {
    const nextTab = normalizeTab(tab || DEFAULT_TAB);
    saveTab(nextTab);
    moveCards();
    document.querySelectorAll('[data-home-tab]').forEach((btn) => btn.classList.toggle('active', btn.dataset.homeTab === nextTab));
    document.querySelectorAll('[data-home-hero-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.homeHeroPanel === nextTab));
    if (shouldScroll) document.querySelector('.hero')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  window.switchHomeTab = function(tab) {
    setActive(tab, true);
  };

  function wireBrand() {
    const brand = document.querySelector('.brand');
    if (!brand || brand.dataset.homeTabsWired === '1') return;
    brand.dataset.homeTabsWired = '1';
    brand.addEventListener('click', (e) => {
      e.preventDefault();
      setActive(DEFAULT_TAB, true);
    });
  }

  function initTabs() {
    moveCards();
    wireBrand();
    setActive(getSavedTab(), false);
    window.GM?.patches?.register?.('home-tabs', { version: 'v4-hero-panels' });
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const active = normalizeTab(getSavedTab());
      moveCards();
      setActive(active, false);
    });
  }

  document.addEventListener('DOMContentLoaded', initTabs);
  if (document.body) {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    initTabs();
  }
})();
