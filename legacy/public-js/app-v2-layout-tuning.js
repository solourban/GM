(() => {
  const STYLE_ID = 'v2LayoutTuningStyles';

  function applyLayoutTuning() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .hero {
        min-height: clamp(300px, 36vh, 420px) !important;
        padding: 34px 0 30px !important;
        align-items: center !important;
      }
      .hero-inner,
      #v2HomePanels {
        width: 100% !important;
      }
      #v2HomePanels {
        min-height: 0 !important;
      }
      .results-section:empty,
      .v2-tab-results-section:empty {
        min-height: 0 !important;
        padding-top: 0 !important;
        padding-bottom: 0 !important;
      }
      @media (max-width: 900px) {
        .hero {
          min-height: auto !important;
          padding: 28px 0 30px !important;
        }
      }
      @media (max-width: 720px) {
        .hero {
          padding: 24px 0 28px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyLayoutTuning);
  } else {
    applyLayoutTuning();
  }
})();
