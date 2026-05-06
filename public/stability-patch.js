(() => {
  const DEDUPE_SELECTORS = [
    '.watch-save-card',
    '.watchlist-card',
    '.scenario-card',
    '.capital-card',
    '.cashflow-card',
    '.step2-toggle-card',
    '#kakaoMapBox',
    '.molit-card',
    '.bulk-card',
    '.bulk-report-card',
    '.final-summary-card',
    '.api-guide-card',
    '.exit-plan-card',
    '.bid-check-card'
  ];

  function injectStyles() {
    if (document.getElementById('stabilityPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'stabilityPatchStyles';
    style.textContent = `
      #resultsSection { scroll-margin-top: 18px; }
      .subcard, .input-card, .platform-card { max-width: 100%; box-sizing: border-box; }
      .subcard h3, .subcard h4, .verdict h3 { overflow-wrap: anywhere; }
      .muted, .note, .watch-small { overflow-wrap: anywhere; }
      .property-address-main, .property-address-detail, .addr { overflow-wrap: anywhere; }
      .table-wrap, .watchlist-table-wrap, .molit-table-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .scenario-table, .watchlist-table, .molit-table, .cashflow-table, .timeline-table { max-width: 100%; }
      .scenario-table th, .scenario-table td,
      .watchlist-table th, .watchlist-table td,
      .molit-table th, .molit-table td,
      .cashflow-table th, .cashflow-table td,
      .timeline-table th, .timeline-table td { word-break: keep-all; }
      input, textarea, select, button { box-sizing: border-box; max-width: 100%; }
      .watchlist-table input { min-width: 140px; }
      .capital-form input, .cashflow-form input, .molit-form input, .scenario-table input, .exit-plan-form input { font-size: 14px; }
      @media (max-width: 720px) {
        .container, main, section { max-width: 100%; }
        .verdict, .subcard, .input-card, .platform-card { padding: 16px !important; }
        .score-circle { width: 78px; height: 78px; font-size: 23px; }
        .scenario-table, .cashflow-table, .timeline-table { min-width: 680px; }
        .watchlist-table { min-width: 980px; }
        .watchlist-table.enhanced { min-width: 1320px; }
        .molit-table { min-width: 720px; }
        .watch-actions, .bulk-actions, .molit-actions, .api-guide-actions, .bid-check-toolbar { align-items: stretch; }
        .watch-actions button, .bulk-actions button, .molit-actions button, .api-guide-actions button, .bid-check-toolbar button { width: 100%; }
        .property-address-detail { font-size: 16px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function dedupe(selector) {
    const nodes = [...document.querySelectorAll(selector)];
    if (nodes.length <= 1) return;
    nodes.slice(1).forEach((node) => node.remove());
  }

  function dedupeAll() {
    DEDUPE_SELECTORS.forEach(dedupe);
  }

  function wrapLooseTables() {
    document.querySelectorAll('table').forEach((table) => {
      const parent = table.parentElement;
      if (!parent || parent.classList.contains('table-wrap') || /table-wrap|watchlist-table-wrap|molit-table-wrap/.test(parent.className)) return;
      if (table.classList.contains('scenario-table') || table.classList.contains('cashflow-table') || table.classList.contains('timeline-table')) {
        const wrap = document.createElement('div');
        wrap.className = 'table-wrap';
        parent.insertBefore(wrap, table);
        wrap.appendChild(table);
      }
    });
  }

  function markLoaded() {
    window.__gmPatchStatus = {
      ...(window.__gmPatchStatus || {}),
      stability: true,
      updatedAt: new Date().toISOString(),
    };
  }

  function stabilize() {
    injectStyles();
    dedupeAll();
    wrapLooseTables();
    markLoaded();
  }

  let scheduled = false;
  function scheduleStabilize() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      stabilize();
    });
  }

  document.addEventListener('DOMContentLoaded', stabilize);
  if (document.body) {
    const observer = new MutationObserver(scheduleStabilize);
    observer.observe(document.body, { childList: true, subtree: true });
    stabilize();
  }
})();
