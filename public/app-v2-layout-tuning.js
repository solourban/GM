(() => {
  const STYLE_ID = 'v2LayoutTuningStyles';

  function applyLayoutTuning() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .hero {
        min-height: auto !important;
        padding: 96px 0 72px !important;
        align-items: flex-start !important;
      }
      .hero-inner {
        width: 100% !important;
      }
      #v2HomePanels {
       