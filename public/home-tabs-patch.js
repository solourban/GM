(() => {
  const TAB_KEY = 'gm_home_discovery_tab_v1';

  function injectStyles() {
    if (document.getElementById('homeTabsPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'homeTabsPatchStyles';
    style.textContent = `
      .home-discovery-tabs { max-width: 980px; margin: 18px auto 0; border: 1px solid rgba(246,245,241,.18); border-radius: 20px; background: rgba(246,245,241,.06); padding: 12px; }
      .home-tab-buttons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .home-tab-buttons button { border:1px solid rgba(246,245,241,.18); background:rgba(246,245,241,.08); color:#F6F5F1; border-radius:12px; padding:11px 12px; font-weight:900; cursor:pointer; }
      .home-tab-buttons button.active { background: var(--accent-ink); color: var(--accent); border-color: var(--accent-ink); }
      .home-tab-help { color: rgba(246,245,241,.68); font-size: 12px; margin: 10px 4px 0; line-height: 1.55; }
      .home-tab-panel { display:none; max-width: 980px; margin: 12px auto 0; }
      .home-tab-panel.active { display:block; }
      .home-tab-panel > .today-dashboard-card,
      .home-tab-panel > .bulk-card,
      .home-tab-panel > .date-rec-card { margin: 0; }
      @media (max-width:720px) { .home-tab-buttons { grid-template-columns: 1fr; } .home-discovery-tabs { margin-left: 12px; margin-right: 12px; } .home-tab-panel { margin-left: 12px; margin-right: 12px; } }
    `;
    document.head.appendChild(style);
  }

  function getSavedTab() {
    try { return localStorage.getItem(TAB_KEY) || 'bulk'; } catch { return 'bulk'; }
  }

  function saveTab(tab) {
    try { localStorage.setItem(TAB_KEY, tab); } catch {}
  }

  function panelFor(tab) {
    return document.querySelector(`[data-home-tab-panel="${tab}"]`);
  }

  function ensureShell() {
    injectStyles();
    if (document.querySelector('.home-discovery-tabs')) return;
    const searchBox = document.querySelector('.search-box');
    if (!searchBox) return;
    searchBox.insertAdjacentHTML('afterend', `
      <div class="home-discovery-tabs">
        <div class="home-tab-buttons">
          <button type="button" data-home-tab="bulk" onclick="switchHomeTab('bulk')">여러 사건 일괄조회</button>
          <button type="button" data-home-tab="date" onclick="switchHomeTab('date')">매각기일 추천</button>
          <button type="button" data-home-tab="today" onclick="switchHomeTab('today')">저장 후보 TOP 5</button>
        </div>
        <div class="home-tab-help">처음 쓰는 경우에는 일괄조회가 가장 빠릅니다. 매각기일 추천은 대법원 목록 API 연결을 점검 중인 실험 기능입니다.</div>
      </div>
      <div class="home-tab-panel" data-home-tab-panel="bulk"></div>
      <div class="home-tab-panel" data-home-tab-panel="date"></div>
      <div class="home-tab-panel" data-home-tab-panel="today"></div>
    `);
  }

  function moveCards() {
    ensureShell();
    const map = [
      ['bulk', '.bulk-card'],
      ['date', '.date-rec-card'],
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
    saveTab(tab);
    document.querySelectorAll('[data-home-tab]').forEach((btn) => btn.classList.toggle('active', btn.dataset.homeTab === tab));
    document.querySelectorAll('[data-home-tab-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.homeTabPanel === tab));
  };

  function initTabs() {
    moveCards();
    window.switchHomeTab(getSavedTab());
    window.GM?.patches?.register?.('home-tabs', { version: 'v1' });
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
