(() => {
  const FILTERS = Object.freeze([
    { key: 'all', label: '전체' },
    { key: 'apartment', label: '아파트' },
    { key: 'villa', label: '다세대·빌라' },
    { key: 'officetel', label: '오피스텔' },
    { key: 'detached', label: '단독·다가구' },
    { key: 'commercial', label: '상가·근린' },
    { key: 'land', label: '토지' },
    { key: 'industrial', label: '공장·창고' },
    { key: 'other', label: '기타' },
  ]);
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function usageOf(value) {
    if (typeof value === 'string') return clean(value);
    const basic = value?.raw?.basic || value?.basic || {};
    return clean(
      value?.usage
      || value?.useType
      || value?.propertyType
      || basic['물건종별']
      || basic['용도']
      || '',
    );
  }

  function classify(value) {
    const usage = usageOf(value).replace(/\s+/g, '');
    if (/아파트/i.test(usage)) return 'apartment';
    if (/다세대|빌라|연립|도시형생활주택|공동주택/i.test(usage)) return 'villa';
    if (/오피스텔/i.test(usage)) return 'officetel';
    if (/단독|다가구|전원주택/i.test(usage) || usage === '주택') return 'detached';
    if (/상가|근린|점포|판매|업무시설|사무실|숙박|생활시설/i.test(usage)) return 'commercial';
    if (/토지|대지|전답|임야|과수원|도로|잡종지|목장용지|농지/i.test(usage) || usage === '전' || usage === '답') return 'land';
    if (/공장|창고|산업|물류/i.test(usage)) return 'industrial';
    return 'other';
  }

  function normalize(selected) {
    return FILTERS.some(({ key }) => key === selected) ? selected : 'all';
  }

  function matches(value, selected = 'all') {
    const key = normalize(selected);
    return key === 'all' || classify(value) === key;
  }

  function filter(items, selected = 'all') {
    const list = Array.isArray(items) ? items : [];
    const key = normalize(selected);
    return key === 'all' ? [...list] : list.filter((item) => matches(item, key));
  }

  function counts(items) {
    const result = Object.fromEntries(FILTERS.map(({ key }) => [key, 0]));
    const list = Array.isArray(items) ? items : [];
    result.all = list.length;
    list.forEach((item) => {
      result[classify(item)] += 1;
    });
    return result;
  }

  function render(items, selected = 'all', attribute = 'data-property-type-filter') {
    const active = normalize(selected);
    const totals = counts(items);
    const visible = active === 'all' ? totals.all : totals[active] || 0;
    return `
      <div class="v2-property-filter">
        <div class="v2-property-filter-head">
          <strong>물건종류</strong>
          <span>표시 ${visible}건 / 전체 ${totals.all}건</span>
        </div>
        <div class="v2-property-filter-options" role="group" aria-label="물건종류 필터">
          ${FILTERS.map(({ key, label }) => `
            <button type="button" class="v2-property-filter-button ${active === key ? 'active' : ''}" ${attribute}="${key}" aria-pressed="${active === key}" ${key !== 'all' && !totals[key] ? 'disabled' : ''}>
              ${label}<span>${totals[key]}</span>
            </button>
          `).join('')}
        </div>
        <p class="v2-note">물건종류 필터는 입찰 적합 여부를 판단하지 않습니다. 후보를 빠르게 좁히기 위한 참고 조건입니다.</p>
      </div>
    `;
  }

  function injectStyles() {
    if (document.getElementById('v2PropertyTypeStyles')) return;
    const style = document.createElement('style');
    style.id = 'v2PropertyTypeStyles';
    style.textContent = `
      .v2-date-search-form { grid-template-columns:minmax(180px,1fr) minmax(140px,.7fr) minmax(140px,.7fr) minmax(140px,.7fr) auto; }
      .v2-property-filter { min-width:0; max-width:100%; margin:16px 0 4px; padding:14px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
      .v2-property-filter-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
      .v2-property-filter-head strong { font-size:13px; color:var(--ink); }
      .v2-property-filter-head span { font-size:12px; color:var(--ink-3); }
      .v2-property-filter-options { display:flex; max-width:100%; gap:6px; overflow-x:auto; padding:0 0 6px; scrollbar-width:thin; }
      .v2-property-filter-button { flex:0 0 auto; min-height:36px; border:1px solid var(--line); border-radius:8px; padding:0 10px; background:#fff; color:var(--ink-2); font:inherit; font-size:12px; font-weight:800; cursor:pointer; }
      .v2-property-filter-button span { margin-left:5px; color:var(--ink-3); font-size:11px; }
      .v2-property-filter-button.active { background:var(--accent); border-color:var(--accent); color:#fff; }
      .v2-property-filter-button.active span { color:rgba(255,255,255,.76); }
      .v2-property-filter-button:disabled { cursor:not-allowed; opacity:.42; }
      .v2-property-filter .v2-note { margin-top:7px; }
      @media (max-width:720px) {
        .v2-date-search-form { grid-template-columns:1fr; }
        .v2-date-search-form .v2-btn { width:100%; }
        .v2-property-filter-head { align-items:flex-start; flex-direction:column; gap:2px; }
      }
    `;
    document.head.appendChild(style);
  }

  injectStyles();
  window.__auctionPropertyTypes = {
    FILTERS,
    usageOf,
    classify,
    normalize,
    matches,
    filter,
    counts,
    render,
  };
})();
