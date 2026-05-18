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
      .v2-summary-inline { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; margin-top:14px; }
      .v2-summary-inline > div { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:12px; }
      .v2-summary-inline span { display:block; color:var(--ink-3); font-size:12px; margin-bottom:4px; }
      .v2-summary-inline strong { display:block; font-size:16px; line-height:1.45; overflow-wrap:anywhere; }
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

  function patchStatusSummary() {
    const state = appState();
    const raw = state?.raw || null;
    if (!raw) return;
    const card = findCardByTitle('현황 요약');
    if (!card || card.dataset.v2StatusSummaryPatched === '1') return;

    const objects = Array.isArray(raw.objects) ? raw.objects : [];
    const interested = Array.isArray(raw.interested) ? raw.interested : [];
    const collectedTenants = interested.filter((item) => clean(item.type) === '임차인');
    const inputTenants = Array.isArray(state?.manual?.tenants)
      ? state.manual.tenants.filter((tenant) => ['name', 'moveIn', 'fixed', 'deposit'].some((key) => clean(tenant?.[key])))
      : [];

    card.dataset.v2StatusSummaryPatched = '1';
    card.innerHTML = `
      <h3>현황 요약</h3>
      <p class="v2-note">자동 수집 정보와 사용자가 입력한 권리분석 정보를 구분해서 표시합니다.</p>
      <div class="v2-grid compact">
        ${info('물건 수', `${objects.length || 1}개`)}
        ${info('이해관계인', `${interested.length}명`)}
        ${info('수집 임차인', `${collectedTenants.length}명`)}
        ${info('입력 임차인', `${inputTenants.length || 0}명`)}
        ${info('조회 상태', raw.status === 'ok' ? '정상 수집' : clean(raw.status || '-'))}
      </div>
    `;
  }

  function patch() {
    injectStyles();
    patchScheduleFallback();
    patchStatusSummary();
  }

  document.addEventListener('DOMContentLoaded', () => {
    patch();
    setInterval(patch, 900);
  });
})();
