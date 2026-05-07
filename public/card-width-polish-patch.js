(() => {
  if (document.getElementById('cardWidthPolishPatchStyles')) return;
  const style = document.createElement('style');
  style.id = 'cardWidthPolishPatchStyles';
  style.textContent = `
    .search-box,
    .bulk-card,
    .date-rec-card,
    .date-recs-card,
    .today-dashboard-card {
      max-width: 920px !important;
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
      max-width: 1040px;
    }
    .bulk-card textarea {
      min-height: 118px;
    }
    @media (max-width: 760px) {
      .search-box,
      .bulk-card,
      .date-rec-card,
      .date-recs-card,
      .today-dashboard-card {
        max-width: 100% !important;
      }
    }
  `;
  document.head.appendChild(style);
  window.GM?.patches?.register?.('card-width-polish', { version: 'v1' });
})();
