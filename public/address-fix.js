(() => {
  function normalizeDetail(text) {
    let detail = String(text || '')
      .replace(/^[\s,，ㆍ·]+/, '')
      .replace(/\s+/g, ' ')
      .trim();

    detail = detail.replace(/(\d+)층\s*(\d+)호/g, '$1층 $2호');

    const paren = detail.match(/^(.*?)\s*\((.*)\)\s*$/);
    if (paren) {
      const room = paren[1].replace(/[\s,，]+$/g, '').trim();
      const inside = paren[2]
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' · ');
      detail = [room, inside].filter(Boolean).join(' / ');
    }

    return detail;
  }

  function cleanAddressTitles() {
    document.querySelectorAll('.property-address-detail').forEach((detailEl) => {
      const cleaned = normalizeDetail(detailEl.textContent);
      if (cleaned && detailEl.textContent !== cleaned) detailEl.textContent = cleaned;
    });
  }

  function injectAddressStyles() {
    if (document.getElementById('addressFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'addressFixStyles';
    style.textContent = `
      .verdict h3 { line-height: 1.42; }
      .property-address-main { display:block; word-break:keep-all; }
      .property-address-detail { display:block; margin-top:6px; font-size:20px; color:var(--ink-2); word-break:keep-all; }
      @media (max-width: 640px) { .property-address-detail { font-size:17px; } }
    `;
    document.head.appendChild(style);
  }

  injectAddressStyles();
  cleanAddressTitles();

  const target = document.getElementById('resultsSection') || document.body;
  const observer = new MutationObserver(() => cleanAddressTitles());
  observer.observe(target, { childList: true, subtree: true });
})();
