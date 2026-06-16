(() => {
  const TAB_CONFIG = [
    { id: 'saved', label: '오늘 확인 후보', selector: '.today-dashboard-card' },
    { id: 'bulk', label: '일괄조회', selector: '.bulk-card' },
    { id: 'date', label: '매각기일 추천', selector: '.date-rec-card' },
    { id: 'api', label: 'API 설정', selector: '.api-guide-card' },
  ];

  function injectStyles() {
    if (document.getElementById('homeLayoutPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'homeLayoutPatchStyles';
    style.textContent = `
      .home-workspace { max-width: 980px; margin: 18px auto 26px; border:1px solid rgba(246,245,241,.18); border-radius:20px; background:rgba(246,245,241,.06); padding:12px; }
      .home-tabs { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
      .home-tab-btn { border:1px solid rgba(246,245,241,.18); background:rgba(246,245,241,.08); color:#F6F5F1; border-radius:999px; padding:10px 14px; font-weight:900; cursor:pointer; }
      .home-tab-btn.active { background:var(--accent-ink); color:var(--accent); border-color:var(--accent-ink); }
      .home-tab-panel { display:none; }
      .home-tab-panel.active { display:block; }
      .home-tab-panel > .today-dashboard-card,
      .home-tab-panel > .bulk-card,
      .home-tab-panel > .date-rec-card,
      .home-tab-panel > .api-guide-card { margin:0; max-width:none; }
      #resultsSection { max-width: 980px; margin-left:auto; margin-right:auto; scroll-margin-top: 18px; }
      #resultsSection:not(:empty) { margin-top: 20px; margin-bottom: 18px; }
      .error-card.fetch-fail-card { max-width: 980px; margin: 0 auto; }
      @media (max-width:720px) {
        .home-workspace { margin:14px 12px 22px; }
        .home-tabs { display:grid; grid-template-columns:1fr 1fr; }
        .home-tab-btn { width:100%; padding:10px 8px; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureWorkspace() {
    injectStyles();
    let workspace = document.querySelector('.home-workspace');
    if (workspace) return workspace;

    const searchBox = document.querySelector('.search-box');
    if (!searchBox) return null;

    workspace = document.createElement('div');
    workspace.className = 'home-workspace';
    workspace.innerHTML = `
      <div class="home-tabs">
        ${TAB_CONFIG.map((tab, idx) => `<button type="button" class="home-tab-btn ${idx === 0 ? 'active' : ''}" data-tab="${tab.id}" onclick="switchHomeTab('${tab.id}')">${tab.label}</button>`).join('')}
      </div>
      <div class="home-tab-panels">
        ${TAB_CONFIG.map((tab, idx) => `<div id="homePanel_${tab.id}" class="home-tab-panel ${idx === 0 ? 'active' : ''}"></div>`).join('')}
      </div>
    `;

    const results = document.getElementById('resultsSection');
    if (results) {
      searchBox.insertAdjacentElement('afterend', results);
      results.insertAdjacentElement('afterend', workspace);
    } else {
      searchBox.insertAdjacentElement('afterend', workspace);
    }
    return workspace;
  }

  function moveResultsNearSearch() {
    const searchBox = document.querySelector('.search-box');
    const results = document.getElementById('resultsSection');
    if (!searchBox || !results) return;
    const next = searchBox.nextElementSibling;
    if (next !== results) searchBox.insertAdjacentElement('afterend', results);
  }

  function moveCardsIntoTabs() {
    const workspace = ensureWorkspace();
    if (!workspace) return;
    TAB_CONFIG.forEach((tab) => {
      const panel = document.getElementById(`homePanel_${tab.id}`);
      const card = document.querySelector(tab.selector);
      if (panel && card && card.parentElement !== panel) panel.appendChild(card);
    });
  }

  window.switchHomeTab = function(tabId) {
    document.querySelectorAll('.home-tab-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabId));
    document.querySelectorAll('.home-tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `homePanel_${tabId}`));
    window.__homeActiveTab = tabId;
  };

  function stabilizeHome() {
    ensureWorkspace();
    moveResultsNearSearch();
    moveCardsIntoTabs();
    if (window.__homeActiveTab) window.switchHomeTab(window.__homeActiveTab);
    window.GM?.patches?.register?.('home-layout', { version: 'v1' });
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      stabilizeHome();
    });
  }

  document.addEventListener('DOMContentLoaded', stabilizeHome);
  if (document.body) {
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    stabilizeHome();
  }
})();
