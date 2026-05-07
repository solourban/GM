(() => {
  if (document.getElementById('headerResultAlignPatchStyles')) return;
  const style = document.createElement('style');
  style.id = 'headerResultAlignPatchStyles';
  style.textContent = `
    .brand-text { transform: translateY(2px); }
    .results-section { background: var(--bg); transition: background .2s ease; scroll-margin-top: 24px; }
    .results-section:empty { min-height: 220px; }
    @media (max-width: 760px) {
      .brand-text { transform: translateY(2px); }
    }
  `;
  document.head.appendChild(style);
  window.GM?.patches?.register?.('header-result-align', { version: 'v1' });
})();
