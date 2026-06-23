(() => {
  const STYLE_ID = 'v2ResultPolishStyles';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function appState() {
    return window.__auctionV2?.state || null;
  }

  function info(label, value, extra = '') {
    return `<div class="v2-info ${extra}"><div class="k">${esc(label)}</div><div class="v">${esc(clean(value) || '-')}</div></div>`;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .v2-grid.one { grid-template-columns:1fr; }
      .v2-grid.four { grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); }
      .v2-info-box { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:12px; min-width:0; display:flex; flex-direction:column; gap:4px; }
      .v2-info-box span { color:var(--ink-3); font-size:12px; font-weight:750; line-height:1.45; }
      .v2-info-box strong { color:var(--ink); font-size:16px; font-weight:900; line-height:1.45; overflow-wrap:anywhere; }
      .v2-actions { margin-top:12px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
      .v2-input { width:min(100%,320px); background:#fff; border:1px solid var(--line-2); color:var(--ink); padding:12px 14px; border-radius:12px; font-size:15px; font-weight:650; outline:none; }
      .v2-input:focus { border-color:var(--accent); box-shadow:0 0 0 3px rgba(11,61,46,.12); }
      .v2-list, .v2-check-list { margin:14px 0 0; padding-left:20px; color:var(--ink-2); font-size:14px; line-height:1.75; }
      .v2-list li + li, .v2-check-list li + li { margin-top:4px; }
      .v2-decision-strip { margin:14px 0 12px; border:1px solid var(--line); border-left:4px solid var(--accent); border-radius:13px; background:#f7fbf8; padding:12px 14px; display:grid; gap:4px; }
      .v2-decision-strip span { color:var(--accent); font-size:12px; font-weight:950; line-height:1.35; }
      .v2-decision-strip strong { color:var(--ink); font-size:16px; line-height:1.55; overflow-wrap:anywhere; }
      .v2-decision-strip small { color:var(--ink-3); font-size:12px; line-height:1.55; }
      .v2-decision-strip.warn { border-left-color:#b7791f; background:#fff8e6; }
      .v2-decision-strip.warn span { color:#8a5a00; }
      .v2-decision-strip.danger { border-left-color:#b42318; background:#fff5f3; }
      .v2-decision-strip.danger span { color:#b42318; }
      .v2-decision-strip.ok { border-left-color:var(--ok); background:var(--ok-bg); }
      .v2-summary-inline { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; margin-top:14px; }
      .v2-summary-inline > div { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:12px; }
      .v2-summary-inline span { display:block; color:var(--ink-3); font-size:12px; margin-bottom:4px; }
      .v2-summary-inline strong { display:block; font-size:16px; line-height:1.45; overflow-wrap:anywhere; }
      @media (max-width:720px) {
        .v2-grid.four { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
        .v2-info-box { border-radius:10px; padding:9px; }
        .v2-info-box span { font-size:11px; }
        .v2-info-box strong { font-size:14px; line-height:1.35; }
        .v2-list, .v2-check-list { margin-top:10px; padding-left:18px; font-size:12px; line-height:1.6; }
        .v2-decision-strip { margin:10px 0; border-radius:10px; padding:10px 11px; }
        .v2-decision-strip strong { font-size:14px; line-height:1.45; }
      }
    `;
    document.head.appendChild(style);
  }

  function findCardByTitle(title) {
    return Array.from(document.querySelectorAll('.v2-result-card, .v2-card')).find((card) => {
      const h3 = card.querySelector('h3');
      return clean(h3?.textContent) === title;
    });
  }

  function patchScheduleFallback() {
    const state = appState();
    const basic = state?.raw?.basic || {};
    const saleDate = clean(basic['매각기일']);
    const card = findCardByTitle('진행일정 / 매각기일');
    if (!card || card.dataset.v2ScheduleFallbackPatched === '1') return;
    if (!card.textContent.includes('자동 수집된 기일내역이 없습니다')) return;
    if (!saleDate) return;

    card.dataset.v2ScheduleFallbackPatched = '1';
    card.innerHTML = `
      <h3>진행일정 / 매각기일</h3>
      <p class="v2-note">상세 기일내역은 자동 수집되지 않았지만, 기본정보의 매각기일을 우선 표시합니다. 입찰 전 원문에서 최종 재확인하세요.</p>
      <div class="v2-grid compact">
        ${info('기본정보 매각기일', saleDate)}
        ${info('최저매각가격', basic['최저매각가격'])}
        ${info('입찰보증금률', basic['입찰보증금률'])}
        ${info('배당요구종기', basic['배당요구종기'])}
      </div>
    `;
  }

  function patch() {
    injectStyles();
    patchScheduleFallback();
  }

  document.addEventListener('DOMContentLoaded', () => {
    patch();
    setInterval(patch, 900);
  });
})();
