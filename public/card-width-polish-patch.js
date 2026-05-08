(() => {
  if (document.getElementById('cardWidthPolishPatchStyles')) return;
  const style = document.createElement('style');
  style.id = 'cardWidthPolishPatchStyles';
  style.textContent = `
    :root { --tool-card-width: 920px; --page-inner-width: 920px; }

    .site-header .container.header-inner,
    .hero .container.hero-inner,
    .results-section.container,
    .site-footer {
      max-width: calc(var(--page-inner-width) + 48px) !important;
      width: 100% !important;
      margin-left: auto !important;
      margin-right: auto !important;
      padding-left: 24px !important;
      padding-right: 24px !important;
    }

    .site-header {
      width: 100% !important;
    }

    .header-inner {
      justify-content: space-between !important;
      gap: 18px !important;
    }

    .home-tabs,
    .header-actions,
    .nav-actions {
      max-width: 100% !important;
    }

    .home-tabs {
      display: flex !important;
      gap: 10px !important;
      flex-wrap: wrap !important;
      justify-content: flex-end !important;
    }

    .search-box,
    .bulk-card,
    .date-rec-card,
    .date-recs-card,
    .today-dashboard-card {
      max-width: var(--tool-card-width) !important;
      width: 100% !important;
      margin-left: auto !important;
      margin-right: auto !important;
    }

    .home-tab-panel > .bulk-card,
    .home-tab-panel > .date-rec-card,
    .home-tab-panel > .date-recs-card,
    .home-tab-panel > .today-dashboard-card {
      margin-left: auto !important;
      margin-right: auto !important;
    }

    .home-tab-panel {
      max-width: calc(var(--tool-card-width) + 48px) !important;
      margin-left: auto !important;
      margin-right: auto !important;
      padding-left: 24px !important;
      padding-right: 24px !important;
    }

    .bulk-card textarea {
      min-height: 118px;
    }

    @media (max-width: 1040px) {
      .site-header .container.header-inner,
      .hero .container.hero-inner,
      .results-section.container,
      .site-footer,
      .home-tab-panel {
        max-width: 100% !important;
      }
    }

    @media (max-width: 760px) {
      :root { --page-inner-width: 100%; }
      .site-header .container.header-inner,
      .hero .container.hero-inner,
      .results-section.container,
      .site-footer,
      .home-tab-panel {
        padding-left: 18px !important;
        padding-right: 18px !important;
      }
      .search-box,
      .bulk-card,
      .date-rec-card,
      .date-recs-card,
      .today-dashboard-card {
        max-width: 100% !important;
      }
      .header-inner {
        align-items: flex-start !important;
        flex-direction: column !important;
        padding-top: 14px !important;
        padding-bottom: 14px !important;
      }
      .home-tabs {
        justify-content: flex-start !important;
        width: 100% !important;
      }
    }
  `;
  document.head.appendChild(style);
  window.GM?.patches?.register?.('card-width-polish', { version: 'v2-header-aligned' });
})();
