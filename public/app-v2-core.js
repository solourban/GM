(() => {
  const state = {
    activeTab: 'search',
    status: 'idle',
    requestId: 0,
    raw: null,
    elapsed: '',
    error: '',
    formMessage: '',
    formMessageType: 'info',
    interestedExpanded: false,
    step2Visible: false,
    analyzing: false,
    analyzeError: '',
    report: null,
    reportAt: '',
    manual: {
      malso: { date: '', type: '근저당권', holder: '', amount: '' },
      tenants: [{ name: '', moveIn: '', fixed: '', deposit: '' }],
      specials: [],
      specReview: { occupants: [], specialRights: [], takeoverNotes: [] },
    },
  };

  const $ = (id) => document.getElementById(id);
  const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const won = (v) => `${Number(v || 0).toLocaleString('ko-KR')}원`;
  const hasValue = (obj, keys) => keys.some((k) => clean(obj?.[k]));

  function injectStyles() {
    const old = $('v2Styles');
    if (old) old.remove();
    const oldA = $('v2AnalyzeStyles');
    if (oldA) oldA.remove();
    const style = document.createElement('style');
    style.id = 'v2CoreStyles';
    style.textContent = `
      :root { --v2-card-width: 920px; }
      .site-header { position: sticky; top: 0; z-index: 100; background: rgba(250,249,245,.98); backdrop-filter: blur(14px); border-bottom:1px solid rgba(209,207,197,.74); box-shadow:0 10px 28px rgba(11,15,20,.05); max-width:100%; overflow:visible; }
      .header-inner { width:100%; min-width:0; max-width:100%; min-height:76px; display:flex; justify-content:space-between; gap:18px; align-items:center; }
      .brand { cursor:pointer; text-decoration:none; min-width:0; max-width:100%; }
      .brand-text { min-width:0; }
      .brand-text h1, .brand-text p { overflow-wrap:anywhere; }
      .v2-tabs { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; max-width:100%; min-width:0; box-sizing:border-box; padding:4px; border:1px solid rgba(229,228,222,.88); border-radius:999px; background:rgba(255,255,255,.68); box-shadow:inset 0 1px 0 rgba(255,255,255,.9); }
      .v2-tab { min-width:0; max-width:100%; box-sizing:border-box; border:0; background:transparent; color:var(--ink-2); border-radius:999px; padding:8px 13px; font-size:13px; font-weight:900; cursor:pointer; white-space:nowrap; overflow-wrap:anywhere; }
      .v2-tab.active { background:var(--accent); color:#fff; box-shadow:0 8px 18px rgba(11,61,46,.18); }
      .hero { min-height:auto; padding:32px 0 28px; display:flex; align-items:flex-start; background:linear-gradient(180deg,#074332 0%,#053525 100%); max-width:100%; overflow:hidden; }
      .hero-inner { width:100%; min-width:0; max-width:100%; }
      .hero-copy { display:none; }
      #v2HomePanels { width:100%; min-width:0; max-width:100%; min-height:0; }
      .v2-panel { display:none; width:100%; min-width:0; max-width:var(--v2-card-width); margin:0 auto; }
      .v2-panel.active { display:block; }
      .v2-card, .v2-result-card { width:100%; min-width:0; max-width:100%; background:#fff; color:var(--ink); border:1px solid rgba(229,228,222,.96); border-radius:18px; padding:20px; box-shadow:0 16px 38px rgba(11,15,20,.09); overflow-wrap:anywhere; }
      .v2-card { min-height:0; }
      .v2-card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; }
      .v2-eyebrow { display:inline-flex; align-items:center; min-height:22px; padding:0 8px; border-radius:999px; background:var(--accent-soft); color:var(--accent); font-size:11px; font-weight:950; }
      .v2-card h3, .v2-result-card h3 { margin:4px 0 8px; font-size:21px; letter-spacing:0; }
      .v2-card p, .v2-note { margin:0; color:var(--ink-3); font-size:13px; line-height:1.6; }
      .v2-note { margin-top:10px; }
      .v2-form { width:100%; min-width:0; display:grid; grid-template-columns:minmax(220px,1.4fr) minmax(90px,.55fr) minmax(180px,1fr) auto; gap:12px; align-items:end; margin-top:16px; padding-top:14px; border-top:1px solid var(--line); }
      .v2-field { display:flex; flex-direction:column; gap:6px; min-width:0; max-width:100%; }
      .v2-field span { color:var(--ink-3); font-size:12px; font-weight:750; }
      .v2-field input, .v2-field select { width:100%; min-width:0; max-width:100%; background:#fff; border:1px solid var(--line-2); color:var(--ink); padding:13px 14px; border-radius:12px; font-size:15px; font-weight:650; outline:none; }
      .v2-field input:focus, .v2-field select:focus { border-color:var(--accent); box-shadow:0 0 0 3px rgba(11,61,46,.12); }
      .v2-btn, .v2-secondary-btn, .v2-small-btn, .v2-danger-btn { min-width:0; max-width:100%; min-height:42px; border-radius:11px; padding:0 16px; font-weight:900; cursor:pointer; border:1px solid var(--line); white-space:normal; line-height:1.25; text-align:center; }
      .v2-btn { background:var(--accent); color:#fff; border-color:var(--accent); box-shadow:0 10px 22px rgba(11,61,46,.18); }
      .v2-secondary-btn, .v2-small-btn { background:#fff; color:var(--ink-2); }
      .v2-danger-btn { background:#fff7f7; color:#b42318; border-color:#fecdca; min-height:34px; font-size:12px; }
      .v2-btn:disabled, .v2-secondary-btn:disabled { opacity:.6; cursor:not-allowed; }
      .v2-form-message { display:none; margin-top:12px; border-radius:12px; padding:11px 12px; font-size:13px; font-weight:750; line-height:1.45; }
      .v2-form-message.show { display:block; }
      .v2-form-message.info { background:var(--accent-soft); color:var(--accent); }
      .v2-form-message.warn { background:#fff7e6; color:#9a6700; border:1px solid #fedf89; }
      .v2-form-message.error { background:#fff1f0; color:#b42318; border:1px solid #fecdca; }
      .v2-tab-results-section { display:none; padding-top:22px; scroll-margin-top:100px; }
      .v2-tab-results-section.active { display:block; }
      .v2-tab-results-section:empty { display:none; }
      .results-section { display:block !important; padding-top:22px; scroll-margin-top:100px; }
      .results-section:empty { min-height:0; padding-top:0; padding-bottom:0; }
      .v2-result-card { border-radius:18px; margin-bottom:16px; box-shadow:0 12px 28px rgba(0,0,0,.05); }
      .v2-result-card.step2, .v2-result-card.analysis { border-left:4px solid var(--accent); }
      .v2-case-overview-card { padding:0; overflow:hidden; }
      .v2-case-hero { display:grid; gap:12px; padding:18px 20px; background:linear-gradient(135deg,#0b3d2e 0%,#052f21 100%); color:#fff; }
      .v2-case-hero .v2-badge { width:max-content; background:rgba(255,255,255,.12); color:#fff; border:1px solid rgba(255,255,255,.2); }
      .v2-case-title { margin:0; color:#fff; font-size:24px; line-height:1.3; letter-spacing:0; }
      .v2-case-meta { margin:0; color:rgba(255,255,255,.76); font-size:13px; line-height:1.55; }
      .v2-case-chip-row { display:flex; flex-wrap:wrap; gap:7px; }
      .v2-case-chip { display:inline-flex; align-items:center; min-height:28px; padding:0 9px; border-radius:999px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.18); color:rgba(255,255,255,.86); font-size:12px; font-weight:850; }
      .v2-case-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; padding:14px 20px 0; }
      .v2-case-metric { min-width:0; border:1px solid var(--line); border-radius:12px; background:var(--bg); padding:12px; }
      .v2-case-metric span { display:block; color:var(--ink-3); font-size:12px; font-weight:850; }
      .v2-case-metric strong { display:block; margin-top:4px; color:var(--ink); font-size:18px; line-height:1.35; overflow-wrap:anywhere; }
      .v2-case-detail-grid { padding:0 20px 20px; }
      .v2-error { background:#fff7f7; border-color:#fecdca; }
      .v2-error h3 { color:#b42318; }
      .v2-result-head, .v2-table-head, .v2-repeat-head { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
      .v2-result-head { align-items:flex-start; }
      .v2-badge, .v2-risk-badge, .v2-pill { display:inline-flex; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:900; }
      .v2-badge { background:var(--accent-soft); color:var(--accent); }
      .v2-risk-badge.ok, .v2-pill.no { background:var(--ok-bg); color:var(--ok); }
      .v2-risk-badge.warn, .v2-pill.unknown { background:var(--warn-bg); color:var(--warn); }
      .v2-risk-badge.danger, .v2-pill.yes { background:var(--danger-bg); color:var(--danger); }
      .v2-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:10px; margin-top:14px; }
      .v2-grid.compact { grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); }
      .v2-info { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:12px; min-width:0; }
      .v2-info.wide { grid-column:1 / -1; }
      .v2-info .k { color:var(--ink-3); font-size:12px; margin-bottom:4px; }
      .v2-info .v { font-weight:900; font-size:16px; line-height:1.45; overflow-wrap:anywhere; }
      .v2-address span { display:block; line-height:1.5; }
      .v2-address .sub { color:var(--ink-2); font-size:.92em; margin-top:3px; }
      .v2-table-wrap, .v2-detail-table-wrap { overflow:auto; margin-top:12px; border:1px solid var(--line); border-radius:14px; }
      .v2-table, .v2-detail-table { width:100%; border-collapse:collapse; font-size:13px; min-width:620px; }
      .v2-detail-table { min-width:760px; }
      .v2-table th, .v2-detail-table th { text-align:left; color:var(--ink-3); background:var(--bg); border-bottom:1px solid var(--line); padding:10px 9px; white-space:nowrap; }
      .v2-table td, .v2-detail-table td { border-bottom:1px solid var(--line); padding:10px 9px; vertical-align:top; }
      .v2-table tr:last-child td, .v2-detail-table tr:last-child td { border-bottom:0; }
      .v2-date-card-list { display:none; }
      .v2-date-item-card { border:1px solid var(--line); border-radius:14px; padding:14px; background:#fff; }
      .v2-date-item-card[data-selected-candidate="1"] { border-color:var(--accent); box-shadow:0 0 0 3px rgba(11,61,46,.08); }
      .v2-date-item-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
      .v2-date-item-head h4 { margin:7px 0 0; font-size:16px; letter-spacing:0; }
      .v2-date-item-head strong { font-size:13px; white-space:nowrap; color:var(--ink-2); }
      .v2-date-item-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-top:12px; }
      .v2-date-item-grid span { min-width:0; border:1px solid var(--line); background:var(--bg); border-radius:10px; padding:9px; }
      .v2-date-item-grid small { display:block; color:var(--ink-3); font-size:11px; font-weight:800; margin-bottom:3px; }
      .v2-date-item-grid b { display:block; font-size:13px; overflow-wrap:anywhere; }
      .v2-date-item-reasons { margin:10px 0 12px; color:var(--ink-3); font-size:12px; line-height:1.5; }
      .v2-mobile-card-list { display:none; }
      .v2-mobile-item-card { border:1px solid var(--line); border-radius:14px; padding:14px; background:#fff; }
      .v2-mobile-item-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
      .v2-mobile-item-head h4 { margin:7px 0 0; font-size:16px; letter-spacing:0; overflow-wrap:anywhere; }
      .v2-mobile-item-head strong { font-size:12px; color:var(--ink-3); white-space:nowrap; }
      .v2-mobile-item-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-top:12px; }
      .v2-mobile-item-grid span { min-width:0; border:1px solid var(--line); background:var(--bg); border-radius:10px; padding:9px; }
      .v2-mobile-item-grid small { display:block; color:var(--ink-3); font-size:11px; font-weight:800; margin-bottom:3px; }
      .v2-mobile-item-grid b { display:block; font-size:13px; overflow-wrap:anywhere; }
      .v2-mobile-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
      .v2-mobile-actions .v2-small-btn { min-height:34px; }
      .v2-row-actions { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
      .v2-loading { display:flex; align-items:center; gap:12px; }
      .v2-spinner { width:22px; height:22px; border-radius:50%; border:3px solid var(--line); border-top-color:var(--accent); animation:v2spin .9s linear infinite; }
      @keyframes v2spin { to { transform:rotate(360deg); } }
      .v2-cta-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:14px; }
      .v2-step-section { margin-top:18px; padding-top:16px; border-top:1px solid var(--line); }
      .v2-step-section:first-of-type { margin-top:10px; padding-top:0; border-top:0; }
      .v2-step-section h4, .v2-detail-title { margin:0 0 10px; font-size:16px; letter-spacing:-.03em; }
      .v2-input-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; }
      .v2-input-grid .v2-field input, .v2-input-grid .v2-field select { padding:11px 12px; font-size:14px; }
      .v2-repeat-card { border:1px solid var(--line); border-radius:14px; padding:12px; background:var(--bg); margin-top:10px; }
      .v2-analysis-list { margin:12px 0 0; padding-left:18px; color:var(--ink-2); font-size:13px; line-height:1.7; }
      @media (max-width:900px){ .site-header{padding:8px 0;} .header-inner{align-items:stretch; flex-direction:column; gap:10px; min-height:0; padding:0 18px; overflow:visible;} .brand{align-self:flex-start}.brand-mark{width:34px;height:34px;border-radius:9px;font-size:17px}.brand-text h1{font-size:17px}.brand-text p{font-size:10.5px}.v2-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));justify-content:stretch;width:100%;max-width:100%;border-radius:16px}.v2-tab{width:100%;min-width:0;max-width:100%;white-space:normal}.hero{min-height:auto; padding:24px 0 24px;} .v2-form{grid-template-columns:minmax(0,1fr) minmax(0,110px)}.v2-court,.v2-case,.v2-btn{grid-column:1/-1}.v2-btn{width:100%;} }
      @media (max-width:720px){ .container{width:100%;max-width:100%;padding-left:14px;padding-right:14px}.site-header{padding:6px 0;overflow:visible}.header-inner{width:100%;gap:8px;padding:0 12px;max-width:100%;min-width:0;overflow:visible;align-items:stretch}.brand{max-width:100%;min-width:0;align-self:flex-start}.v2-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:100%;min-width:0;max-width:100%;gap:5px;align-items:stretch;overflow:visible;padding:3px}.v2-tab{width:100%;min-width:0;max-width:100%;min-height:34px;padding:7px 5px;font-size:11.5px;line-height:1.2;text-align:center;white-space:normal;display:flex;align-items:center;justify-content:center}.hero{min-height:auto; padding:14px 0 18px;} .hero-copy{text-align:left;margin-bottom:18px;} #v2HomePanels{min-height:0}.v2-card{min-height:0;padding:16px;border-radius:16px}.v2-card h3,.v2-result-card h3{font-size:19px}.v2-form{grid-template-columns:minmax(0,1fr);gap:9px;margin-top:12px;padding-top:12px}.v2-field input,.v2-field select{padding:12px 13px;font-size:14px}.v2-cta-row .v2-btn,.v2-cta-row .v2-secondary-btn{width:100%;}.v2-tab-results-section{padding-top:18px;scroll-margin-top:118px}.v2-date-card-list,.v2-mobile-card-list{display:grid;gap:10px;margin-top:12px}.v2-date-table-wrap,.v2-bulk-table-wrap,.v2-saved-table-wrap,.v2-onbid-table-wrap{display:none}.v2-result-card{border-radius:16px;padding:16px}.v2-case-overview-card{padding:0}.v2-case-hero{padding:16px}.v2-case-title{font-size:21px}.v2-case-metrics{grid-template-columns:repeat(2,minmax(0,1fr));padding:12px 16px 0}.v2-case-metric{padding:10px}.v2-case-metric strong{font-size:15px}.v2-case-detail-grid{padding:0 16px 16px} }
      @media (max-width:360px){ .v2-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.v2-tab{min-height:34px;font-size:11px;padding-left:5px;padding-right:5px} }
    `;
    document.head.appendChild(style);
  }

  function ensureHeaderTabs() {
    const header = document.querySelector('.header-inner');
    if (!header) return;
    const old = header.querySelector('.v2-tabs');
    if (old) old.remove();
    const nav = document.createElement('nav');
    nav.className = 'v2-tabs';
    nav.innerHTML = [
      ['search', '물건 검색'],
      ['bulk', '여러 사건 일괄조회'],
      ['date', '매각기일 추천'],
      ['saved', '저장 후보 TOP 5'],
    ].map(([tab, label]) => `<button class="v2-tab ${state.activeTab === tab ? 'active' : ''}" data-tab="${tab}">${label}</button>`).join('');
    header.appendChild(nav);
  }

  function ensureHomePanels() {
    const heroInner = document.querySelector('.hero-inner');
    if (!heroInner) return;
    const oldSearch = document.querySelector('.search-box');
    if (oldSearch) oldSearch.remove();
    let panels = $('v2HomePanels');
    if (!panels) {
      panels = document.createElement('div');
      panels.id = 'v2HomePanels';
      heroInner.appendChild(panels);
    }
    panels.innerHTML = `
      <section class="v2-panel ${state.activeTab === 'search' ? 'active' : ''}" data-panel="search">
        <div class="v2-card">
          <div class="v2-card-head"><div><span class="v2-eyebrow">Step 1</span><h3>물건 검색</h3><p>사건번호로 대법원 경매정보의 기본정보를 조회하고, 입찰 전 검토 흐름으로 연결합니다.</p></div></div>
          <div class="v2-form">
            <label class="v2-field v2-court"><span>법원</span><select id="jiwonNmV2"></select></label>
            <label class="v2-field"><span>연도</span><input id="saYearV2" type="text" value="2024" inputmode="numeric"></label>
            <label class="v2-field v2-case"><span>사건번호</span><input id="saSerV2" type="text" placeholder="예: 110754" inputmode="numeric"></label>
            <button id="btnFetchV2" class="v2-btn">물건 기본정보 조회</button>
          </div>
          <div id="v2FormMessage" class="v2-form-message"></div>
          <p class="v2-note">Step 1 — 조회 결과는 아래 결과 영역에 고정 표시됩니다.</p>
        </div>
      </section>
      <section class="v2-panel ${state.activeTab === 'bulk' ? 'active' : ''}" data-panel="bulk"><div class="v2-card"><div class="v2-card-head"><div><span class="v2-eyebrow">Batch</span><h3>여러 사건 일괄조회</h3><p>기본 조회 안정화 이후 연결합니다.</p></div></div></div></section>
      <section class="v2-panel ${state.activeTab === 'date' ? 'active' : ''}" data-panel="date"><div class="v2-card"><div class="v2-card-head"><div><span class="v2-eyebrow">Date</span><h3>매각기일 추천</h3><p>대법원 목록 API 검증 후 다시 연결합니다.</p></div></div></div></section>
      <section class="v2-panel ${state.activeTab === 'saved' ? 'active' : ''}" data-panel="saved"><div class="v2-card"><div class="v2-card-head"><div><span class="v2-eyebrow">Saved</span><h3>저장 후보 TOP 5</h3><p>저장 구조 안정화 이후 연결합니다.</p></div></div></div></section>
    `;
    bindHomeControls();
    loadCourts();
    renderFormMessage();
    syncTabResultsVisibility();
  }

  function ensureTabResultsSection() {
    let section = $('v2TabResultsSection');
    if (section) return section;
    section = document.createElement('section');
    section.id = 'v2TabResultsSection';
    section.className = 'container v2-tab-results-section';
    section.setAttribute('aria-live', 'polite');
    const hero = document.querySelector('.hero');
    const results = $('resultsSection');
    if (hero) hero.insertAdjacentElement('afterend', section);
    else if (results?.parentNode) results.parentNode.insertBefore(section, results);
    else document.body.appendChild(section);
    return section;
  }

  function syncTabResultsVisibility() {
    const section = ensureTabResultsSection();
    if (!section) return null;
    const previousTab = section.dataset.activeTab || '';
    const activeTab = state.activeTab || 'search';
    const show = activeTab !== 'search';
    if (!show || (previousTab && previousTab !== activeTab)) section.innerHTML = '';
    section.dataset.activeTab = activeTab;
    section.classList.toggle('active', show);
    return section;
  }

  async function loadCourts() {
    const select = $('jiwonNmV2');
    if (!select || select.options.length) return;
    const fallback = ['서울중앙지방법원','서울동부지방법원','서울서부지방법원','서울남부지방법원','서울북부지방법원','수원지방법원','인천지방법원','대전지방법원','천안지원','청주지방법원','부산지방법원','대구지방법원','광주지방법원','전주지방법원','제주지방법원'];
    try {
      const res = await fetch('/api/courts');
      const data = await res.json();
      const courts = Array.isArray(data.courts) ? data.courts.map((x) => x.name) : fallback;
      select.innerHTML = courts.map((name) => `<option>${esc(name)}</option>`).join('');
      if (courts.includes('서울중앙지방법원')) select.value = '서울중앙지방법원';
    } catch (_) {
      select.innerHTML = fallback.map((name) => `<option>${esc(name)}</option>`).join('');
      setFormMessage('법원 목록을 불러오지 못해 기본 목록을 표시했습니다.', 'warn');
    }
  }

  function renderFormMessage() {
    const el = $('v2FormMessage');
    if (!el) return;
    el.className = `v2-form-message ${state.formMessage ? 'show' : ''} ${state.formMessageType}`;
    el.textContent = state.formMessage || '';
  }

  function setFormMessage(message, type = 'info') {
    state.formMessage = message || '';
    state.formMessageType = type;
    renderFormMessage();
  }

  function validateSearch() {
    const court = clean($('jiwonNmV2')?.value);
    const year = clean($('saYearV2')?.value);
    const serial = clean($('saSerV2')?.value);
    if (!court) return '법원을 선택해주세요.';
    if (!/^\d{4}$/.test(year)) return '사건연도는 4자리 숫자로 입력해주세요.';
    if (!serial) return '사건번호를 입력해주세요.';
    if (!/^\d+$/.test(serial)) return '사건번호는 숫자만 입력해주세요.';
    return '';
  }

  async function fetchCase() {
    const error = validateSearch();
    if (error) {
      setFormMessage(error, 'error');
      $('saSerV2')?.focus();
      return;
    }
    const requestId = ++state.requestId;
    const btn = $('btnFetchV2');
    if (btn) { btn.disabled = true; btn.textContent = '조회 중...'; }
    setFormMessage('대법원 경매정보에서 기본정보를 조회하고 있습니다.', 'info');
    state.status = 'loading';
    state.error = '';
    renderResults({ preserveSuccess: true });

    try {
      const payload = { jiwonNm: clean($('jiwonNmV2').value), saYear: clean($('saYearV2').value), saSer: clean($('saSerV2').value) };
      const res = await fetch('/api/fetch', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (requestId !== state.requestId) return;
      if (!res.ok || !data.ok) throw new Error(data.error || data.detail || '조회에 실패했습니다.');
      state.status = 'success';
      state.raw = data.raw;
      state.elapsed = data.elapsed || '';
      state.error = '';
      state.interestedExpanded = false;
      state.step2Visible = false;
      state.report = null;
      state.analyzeError = '';
      setFormMessage('기본정보 조회가 완료되었습니다.', 'info');
      renderResults();
    } catch (err) {
      if (requestId !== state.requestId) return;
      state.error = err.message || String(err);
      setFormMessage(state.error, 'error');
      if (state.raw) state.status = 'success';
      else state.status = 'error';
      renderResults({ keepScroll: true });
    } finally {
      if (requestId === state.requestId && btn) { btn.disabled = false; btn.textContent = '물건 기본정보 조회'; }
    }
  }

  function renderResults(options = {}) {
    const root = $('resultsSection');
    if (!root) return;
    if (state.status === 'idle') { root.innerHTML = ''; return; }
    if (state.status === 'loading' && !(options.preserveSuccess && state.raw)) {
      root.innerHTML = `<div class="v2-result-card"><div class="v2-loading"><span class="v2-spinner"></span><div><h3>기본정보를 가져오는 중...</h3><p class="v2-note">조회 결과가 나오면 이 영역에 표시됩니다.</p></div></div></div>`;
    } else if (state.status === 'error') {
      root.innerHTML = `<div class="v2-result-card v2-error"><h3>조회 실패</h3><p>${esc(state.error)}</p></div>`;
    } else {
      root.innerHTML = renderCaseResults();
    }
    bindResultControls();
    if (!options.keepScroll) root.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function splitAddress(value) {
    const s = clean(value);
    if (!s) return '-';
    const m = s.match(/\(([^()]+)\)\s*$/);
    const building = m ? m[0] : '';
    const body = building ? s.slice(0, s.length - building.length).trim() : s;
    const parts = body.split(',').map((x) => x.trim()).filter(Boolean);
    if (parts.length <= 1 && !building) return esc(s);
    return `<span class="v2-address"><span>${esc(parts[0] || body)}</span>${parts.slice(1).map((p) => `<span class="sub">${esc(p)}</span>`).join('')}${building ? `<span class="sub">${esc(building)}</span>` : ''}</span>`;
  }

  function info(k, v, extra = '') {
    return `<div class="v2-info ${extra}"><div class="k">${esc(k)}</div><div class="v">${esc(clean(v) || '-')}</div></div>`;
  }
  function infoHtml(k, html, extra = '') {
    return `<div class="v2-info ${extra}"><div class="k">${esc(k)}</div><div class="v">${html || '-'}</div></div>`;
  }

  function firstValue(source, keys, fallback = '') {
    const found = keys.map((key) => clean(source?.[key])).find(Boolean);
    return found || clean(fallback);
  }

  function caseMetric(label, value) {
    return `<div class="v2-case-metric"><span>${esc(label)}</span><strong>${esc(clean(value) || '-')}</strong></div>`;
  }

  function caseChip(value) {
    const text = clean(value);
    return text ? `<span class="v2-case-chip">${esc(text)}</span>` : '';
  }

  function renderCaseResults() {
    const raw = state.raw || {};
    const basic = raw.basic || {};
    const objects = Array.isArray(raw.objects) ? raw.objects : [];
    const schedule = Array.isArray(raw.schedule) ? raw.schedule : [];
    const interested = Array.isArray(raw.interested) ? raw.interested : [];
    const tenants = interested.filter((x) => x.type === '임차인');
    const address = firstValue(basic, ['소재지', '주소'], objects[0]?.address || '');
    const itemType = firstValue(basic, ['물건종별', '물건종류']);
    const caseTitle = firstValue(basic, ['사건명', '물건명'], itemType || address || '물건 기본정보');
    const court = firstValue(basic, ['법원'], raw.court || '');
    const caseNo = firstValue(basic, ['사건번호'], raw.caseNo || '');
    const minPrice = firstValue(basic, ['최저매각가격', '최저가']);
    const appraisal = firstValue(basic, ['감정평가액', '감정가']);
    const saleDate = firstValue(basic, ['매각기일', '기일']);
    const statusText = raw.status === 'ok' ? '정상 수집' : clean(raw.status || '');
    return `
      ${state.status === 'loading' ? `<section class="v2-result-card"><div class="v2-loading"><span class="v2-spinner"></span><div><h3>새 조회를 진행 중입니다.</h3><p class="v2-note">기존 결과는 유지하고 최신 응답 도착 후 교체합니다.</p></div></div></section>` : ''}
      ${state.error ? `<section class="v2-result-card v2-error"><h3>최근 조회 실패</h3><p>${esc(state.error)}</p><p class="v2-note">아래에는 마지막 성공 결과를 유지했습니다.</p></section>` : ''}
      <section class="v2-result-card v2-case-overview-card">
        <div class="v2-case-hero">
          <span class="v2-badge">Step 1 완료</span>
          <div>
            <h3 class="v2-case-title">${esc(caseTitle)}</h3>
            <p class="v2-case-meta">${esc([court, caseNo].filter(Boolean).join(' '))}${state.elapsed ? ` · ${esc(state.elapsed)}` : ''}</p>
          </div>
          <div class="v2-case-chip-row">${caseChip(itemType)}${caseChip(basic['담당계'])}${caseChip(statusText)}</div>
        </div>
        <div class="v2-case-metrics">
          ${caseMetric('최저매각가격', minPrice)}
          ${caseMetric('감정평가액', appraisal)}
          ${caseMetric('매각기일', saleDate)}
          ${caseMetric('입찰보증금률', basic['입찰보증금률'])}
        </div>
        <div class="v2-grid v2-case-detail-grid">
          ${info('사건번호', caseNo)}
          ${info('법원', court)}
          ${info('담당계', basic['담당계'])}
          ${info('사건명', basic['사건명'])}
          ${infoHtml('소재지', splitAddress(address), 'wide')}
          ${info('물건종별', itemType)}
          ${info('감정평가액', appraisal)}
          ${info('최저매각가격', minPrice)}
          ${info('매각기일', saleDate)}
          ${info('유찰횟수', basic['유찰횟수'])}
          ${info('배당요구종기', basic['배당요구종기'])}
          ${info('입찰보증금률', basic['입찰보증금률'])}
        </div>
      </section>
      <section class="v2-result-card"><h3>현황 요약</h3><div class="v2-grid compact">${info('물건 수', `${objects.length || 1}개`)}${info('이해관계인', `${interested.length}명`)}${info('임차인', `${tenants.length}명`)}${info('조회 상태', raw.status === 'ok' ? '정상 수집' : clean(raw.status || '-'))}</div></section>
      ${renderSchedule(schedule)}
      ${renderInterested(interested)}
      ${renderNextStep()}
      ${state.step2Visible ? renderStep2() : ''}
      ${renderAnalysis()}
    `;
  }

  function renderSchedule(rows) {
    if (!rows.length) return `<section class="v2-result-card"><h3>진행일정 / 매각기일</h3><p class="v2-note">자동 수집된 기일내역이 없습니다. 원문에서 재확인하세요.</p></section>`;
    const visible = rows.slice(0, 12);
    return `<section class="v2-result-card"><div class="v2-table-head"><h3>진행일정 / 매각기일</h3><span class="v2-badge">${rows.length}건</span></div><div class="v2-table-wrap"><table class="v2-table"><thead><tr><th>일자</th><th>시간</th><th>장소</th><th>구분</th><th>결과</th><th>최저가</th></tr></thead><tbody>${visible.map((r) => `<tr>${[0,1,2,3,4,5].map((i) => `<td>${esc(r[i] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
  }

  function renderInterested(rows) {
    if (!rows.length) return `<section class="v2-result-card"><h3>이해관계인</h3><p class="v2-note">자동 수집된 이해관계인 정보가 없습니다.</p></section>`;
    const limit = 8;
    const visible = state.interestedExpanded ? rows : rows.slice(0, limit);
    return `<section class="v2-result-card"><div class="v2-table-head"><h3>이해관계인</h3><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="v2-badge">${rows.length}명</span>${rows.length > limit ? `<button class="v2-small-btn" data-action="toggle-interested">${state.interestedExpanded ? '상세 목록 접기' : '상세 목록 펼치기'}</button>` : ''}</div></div><div class="v2-table-wrap"><table class="v2-table"><thead><tr><th>구분</th><th>이름</th><th>순번</th></tr></thead><tbody>${visible.map((r) => `<tr><td>${esc(r.type || '')}</td><td>${esc(r.name || '')}</td><td>${esc(r.seq || '')}</td></tr>`).join('')}</tbody></table></div>${rows.length > limit && !state.interestedExpanded ? `<p class="v2-note">전체 ${rows.length}명 중 ${limit}명만 우선 표시합니다.</p>` : ''}</section>`;
  }

  function renderFlowItem(label, status, note, tone = '') {
    return `<li class="${tone ? `is-${esc(tone)}` : ''}"><b>${esc(label)}</b><span>${esc(status)}</span><small>${esc(note)}</small></li>`;
  }

  function renderNextStep() {
    const hasMalso = hasValue(state.manual.malso, ['date','holder','amount']);
    const readyToAnalyze = hasManualInput();
    const analyzed = Boolean(state.report);
    const flow = [
      renderFlowItem('1. 기본정보 확인', '완료', '사건번호, 법원, 매각기일, 최저가를 우선 확인했습니다.', 'done'),
      renderFlowItem('2. 원문서 입력', readyToAnalyze ? '진행 중' : '필요', '매각물건명세서·등기부 기준으로 말소기준권리와 점유관계를 입력합니다.', readyToAnalyze ? 'ready' : 'todo'),
      renderFlowItem('3. 권리분석', analyzed ? '완료' : (readyToAnalyze ? '실행 가능' : '대기'), '입력값 기준으로 대항력, 인수금액, 특수권리를 1차 판단합니다.', analyzed ? 'done' : (readyToAnalyze ? 'ready' : 'todo')),
      renderFlowItem('4. 입찰가·자금', analyzed ? '다음' : '분석 후', '권리 리스크를 반영한 뒤 필요 현금과 입찰가 범위를 검토합니다.', analyzed ? 'ready' : 'todo'),
    ].join('');
    return `<section class="v2-result-card v2-next-step-card"><h3>다음 단계</h3><p class="v2-note">조회 결과는 시작점입니다. 원문 서류 입력 → 권리분석 → 입찰가·자금 검토 순서로 이어가세요.</p><ol class="v2-next-flow">${flow}</ol><div class="v2-grid compact">${info('최선순위', hasMalso ? '입력 중' : '미입력')}${info('임차인 입력', `${state.manual.tenants.length}명`)}${info('특수권리 입력', `${state.manual.specials.length}건`)}</div><div class="v2-cta-row"><button class="v2-btn" data-action="open-step2">${state.step2Visible ? 'Step 2 입력 계속하기' : 'Step 2 명세서 입력 시작'}</button>${state.step2Visible ? '<button class="v2-secondary-btn" data-action="close-step2">Step 2 접기</button>' : ''}${analyzed ? '<button class="v2-secondary-btn" data-action="scroll-bid-plan">입찰가·자금 계산 보기</button>' : ''}</div><p class="v2-note">자동 수집값이 비어 있거나 애매하면 법원경매정보 원문 문서를 우선 기준으로 보세요.</p></section>`;
  }

  function getManual(path) {
    const [group, indexOrKey, key] = path.split('.');
    if (group === 'malso') return state.manual.malso[indexOrKey] || '';
    if (group === 'tenants') return state.manual.tenants[Number(indexOrKey)]?.[key] || '';
    if (group === 'specials') return state.manual.specials[Number(indexOrKey)]?.[key] || '';
    return '';
  }

  function input(path, label, placeholder = '') {
    return `<label class="v2-field"><span>${esc(label)}</span><input value="${esc(getManual(path))}" placeholder="${esc(placeholder)}" data-manual-path="${esc(path)}"></label>`;
  }
  function select(path, label, options) {
    const value = getManual(path);
    return `<label class="v2-field"><span>${esc(label)}</span><select data-manual-path="${esc(path)}">${options.map((o) => `<option value="${esc(o)}" ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  }

  function renderTenant(tenant, index) {
    return `<div class="v2-repeat-card"><div class="v2-repeat-head"><b>임차인 ${index + 1}</b>${state.manual.tenants.length > 1 ? `<button class="v2-danger-btn" data-action="remove-tenant" data-index="${index}">삭제</button>` : ''}</div><div class="v2-input-grid">${input(`tenants.${index}.name`, '임차인명', '예: 김OO')}${input(`tenants.${index}.moveIn`, '전입일', '예: 2023.01.15')}${input(`tenants.${index}.fixed`, '확정일자', '예: 2023.01.16')}${input(`tenants.${index}.deposit`, '보증금', '예: 50,000,000')}</div></div>`;
  }

  function renderSpecial(special, index) {
    return `<div class="v2-repeat-card"><div class="v2-repeat-head"><b>특수권리 ${index + 1}</b><button class="v2-danger-btn" data-action="remove-special" data-index="${index}">삭제</button></div><div class="v2-input-grid">${select(`specials.${index}.type`, '권리 유형', ['유치권','법정지상권','분묘기지권','예고등기','가처분','가압류','기타'])}${input(`specials.${index}.holder`, '권리자', '예: 김OO')}${input(`specials.${index}.date`, '신고/접수일', '예: 2024.01.01')}${input(`specials.${index}.amount`, '금액/비고', '예: 10,000,000')}</div></div>`;
  }

  function hasManualInput() {
    return hasValue(state.manual.malso, ['date','holder','amount']) || state.manual.tenants.some((t) => hasValue(t, ['name','moveIn','fixed','deposit'])) || state.manual.specials.some((s) => hasValue(s, ['holder','date','amount']));
  }

  function canAnalyze() {
    return hasManualInput();
  }

  function renderStep2() {
    return `<section class="v2-result-card step2" id="step2InputCard"><span class="v2-badge">Step 2 입력</span><h3>명세서·권리 입력</h3><p class="v2-note">입력값은 화면 상태에 즉시 저장됩니다. 권리분석 실패 시에도 입력값은 유지됩니다.</p><div id="v2SpecExtractorMount"></div><div class="v2-step-section"><h4>1. 최선순위 권리</h4><div class="v2-input-grid">${input('malso.date','접수일자','예: 2020.05.01')}${select('malso.type','권리종류',['근저당권','저당권','압류','가압류','담보가등기','전세권','기타'])}${input('malso.holder','권리자','예: OO은행')}${input('malso.amount','채권금액','예: 120,000,000')}</div><p class="v2-note">말소기준권리 판단의 기준입니다. 접수일자와 권리종류를 정확히 입력하세요.</p></div><div class="v2-step-section"><div class="v2-table-head"><h4>2. 임차인</h4><button class="v2-small-btn" data-action="add-tenant">임차인 추가</button></div>${state.manual.tenants.map(renderTenant).join('')}</div><div class="v2-step-section"><div class="v2-table-head"><h4>3. 특수권리</h4><button class="v2-small-btn" data-action="add-special">특수권리 추가</button></div>${state.manual.specials.length ? state.manual.specials.map(renderSpecial).join('') : '<p class="v2-note">유치권·법정지상권 등 별도 확인 권리가 있으면 추가하세요.</p>'}</div><div class="v2-cta-row"><button class="v2-btn" data-action="analyze" ${state.analyzing || !canAnalyze() ? 'disabled' : ''}>${state.analyzing ? '분석 중...' : '권리분석 실행'}</button>${!canAnalyze() ? '<span class="v2-note">최선순위·임차인·특수권리 중 하나 이상 입력하면 실행할 수 있습니다.</span>' : '<button class="v2-secondary-btn" data-action="scroll-analysis">결과 영역 보기</button>'}</div></section>`;
  }

  function setManual(path, value) {
    const [group, indexOrKey, key] = path.split('.');
    if (group === 'malso') { state.manual.malso[indexOrKey] = value; return; }
    const index = Number(indexOrKey);
    if (group === 'tenants' && state.manual.tenants[index]) state.manual.tenants[index][key] = value;
    if (group === 'specials' && state.manual.specials[index]) state.manual.specials[index][key] = value;
  }

  function normalizeManual() {
    state.manual.malso = { date: clean(state.manual.malso.date), type: clean(state.manual.malso.type) || '근저당권', holder: clean(state.manual.malso.holder), amount: clean(state.manual.malso.amount) };
    state.manual.tenants = state.manual.tenants.map((t) => ({ name: clean(t.name), moveIn: clean(t.moveIn), fixed: clean(t.fixed), deposit: clean(t.deposit) }));
    if (!state.manual.tenants.length) state.manual.tenants = [{ name:'', moveIn:'', fixed:'', deposit:'' }];
    state.manual.specials = state.manual.specials.map((s) => ({ type: clean(s.type) || '유치권', holder: clean(s.holder), date: clean(s.date), amount: clean(s.amount) }));
    const review = state.manual.specReview && typeof state.manual.specReview === 'object' ? state.manual.specReview : {};
    state.manual.specReview = {
      occupants: Array.isArray(review.occupants) ? review.occupants : [],
      specialRights: Array.isArray(review.specialRights) ? review.specialRights : [],
      takeoverNotes: Array.isArray(review.takeoverNotes) ? review.takeoverNotes : [],
    };
  }

  function manualForAnalyze() {
    return {
      malso: state.manual.malso,
      tenants: state.manual.tenants,
      specials: state.manual.specials,
    };
  }

  async function runAnalyze() {
    if (!state.raw || state.analyzing || !canAnalyze()) return;
    normalizeManual();
    state.analyzing = true;
    state.analyzeError = '';
    renderResults({ keepScroll:true });
    try {
      const res = await fetch('/api/analyze', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ raw: state.raw, manual: manualForAnalyze(), region:'other' }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || data.detail || '권리분석에 실패했습니다.');
      state.report = data.report;
      state.reportAt = new Date().toLocaleString('ko-KR');
      state.analyzeError = '';
    } catch (err) {
      state.analyzeError = err.message || String(err);
    } finally {
      state.analyzing = false;
      renderResults({ keepScroll:true });
      $('analysisCard')?.scrollIntoView({ behavior:'smooth', block:'start' });
    }
  }

  function riskLabel(level) {
    const v = clean(level || 'warn');
    if (v === 'ok') return ['ok','낮음'];
    if (v === 'danger') return ['danger','높음'];
    return ['warn','주의'];
  }
  function tenantStatusClass(v) { return v === '있음' ? 'yes' : v === '없음' ? 'no' : 'unknown'; }
  function tenantUnpaid(t) {
    const deposit = Number(t?.deposit || 0);
    const paid = Number(t?._choi || 0) + Number(t?._baedang || 0);
    if (t?.daehang !== '있음') return 0;
    return Math.max(0, deposit - paid);
  }

  function renderAnalysis() {
    if (state.analyzing) return `<section class="v2-result-card analysis"><div class="v2-loading"><span class="v2-spinner"></span><div><h3>권리분석 중...</h3><p class="v2-note">입력값은 유지됩니다.</p></div></div></section>`;
    if (state.analyzeError) return `<section class="v2-result-card v2-error" id="analysisCard"><h3>권리분석 실패</h3><p>${esc(state.analyzeError)}</p><p class="v2-note">Step 2 입력값은 유지됩니다.</p></section>`;
    const r = state.report;
    if (!r) return '';
    const [cls, label] = riskLabel(r.risk?.level);
    const tenants = Array.isArray(r.tenants) ? r.tenants : [];
    const rights = Array.isArray(r.rights) ? r.rights : [];
    const inherited = Number(r.inherited?.total || 0);
    const items = [`입력 임차인 ${tenants.length}명 기준으로 대항력 여부를 1차 판단했습니다.`, inherited > 0 ? `인수 가능 금액이 ${inherited.toLocaleString('ko-KR')}원으로 계산되었습니다.` : '현재 입력 기준으로 인수금액은 0원으로 계산되었습니다.'];
    return `<section class="v2-result-card analysis" id="analysisCard"><span class="v2-risk-badge ${cls}">위험도 ${label}</span><h3>권리분석 결과</h3><p class="v2-note">${esc(state.reportAt)} 기준 실행 결과입니다.</p><div class="v2-grid compact">${info('위험 등급', label)}${info('인수금액', won(inherited))}${info('임차인', `${tenants.length}명`)}${info('권리', `${rights.length}건`)}</div><ul class="v2-analysis-list">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${renderTenantDetails(tenants)}${renderRightDetails(rights)}<div class="v2-analysis-next"><h4>분석 후 확인 순서</h4><ol><li>매각물건명세서·등기부 원문과 입력값이 일치하는지 재확인</li><li>인수금액과 명도·수리·체납 비용을 입찰가 계산에 반영</li><li>입찰가·필요 현금 계산 카드에서 보수적으로 수익성을 점검</li></ol><div class="v2-cta-row"><button class="v2-secondary-btn" data-action="scroll-bid-plan">입찰가·자금 계산 보기</button><button class="v2-secondary-btn" data-action="scroll-essential-docs">필수 문서 확인 보기</button></div></div><p class="v2-note">이 결과는 입력값 기반 1차 판단입니다. 실제 입찰 전 등기부, 매각물건명세서, 전입세대열람, 현장조사를 다시 확인해야 합니다.</p></section>`;
  }

  function renderTenantDetails(tenants) {
    if (!tenants.length) return '';
    return `<h4 class="v2-detail-title">임차인별 판단 근거</h4><div class="v2-detail-table-wrap"><table class="v2-detail-table"><thead><tr><th>임차인</th><th>전입일</th><th>확정일자</th><th>보증금</th><th>대항력</th><th>인수 가능액</th><th>판단 사유</th></tr></thead><tbody>${tenants.map((t) => `<tr><td>${esc(t.name || '임차인')}</td><td>${esc(t.moveIn || '-')}</td><td>${esc(t.fixed || '-')}</td><td>${won(t.deposit)}</td><td><span class="v2-pill ${tenantStatusClass(t.daehang)}">${esc(t.daehang || '확인필요')}</span></td><td>${won(tenantUnpaid(t))}</td><td>${esc(t.reason || '-')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderRightDetails(rights) {
    if (!rights.length) return '';
    return `<h4 class="v2-detail-title">권리별 판단 근거</h4><div class="v2-detail-table-wrap"><table class="v2-detail-table"><thead><tr><th>접수일</th><th>권리</th><th>권리자</th><th>금액</th><th>판단</th><th>사유</th></tr></thead><tbody>${rights.map((r) => `<tr><td>${esc(r.date || '-')}</td><td>${esc(r.type || '-')} ${r.isMalso ? '<span class="v2-badge">말소기준</span>' : ''}</td><td>${esc(r.holder || '-')}</td><td>${won(r.amount)}</td><td><span class="v2-pill ${r.status === '인수' ? 'yes' : r.status === '소멸' ? 'no' : 'unknown'}">${esc(r.status || '?')}</span></td><td>${esc(r.reason || '-')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function bindHomeControls() {
    $('btnFetchV2')?.addEventListener('click', fetchCase);
    $('saSerV2')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchCase(); });
    ['jiwonNmV2','saYearV2','saSerV2'].forEach((id) => {
      $(id)?.addEventListener('input', () => { if (state.formMessageType === 'error') setFormMessage('', 'info'); });
      $(id)?.addEventListener('change', () => { if (state.formMessageType === 'error') setFormMessage('', 'info'); });
    });
  }

  function bindResultControls() {
    const root = $('resultsSection');
    if (!root || root.__v2Bound) return;
    root.__v2Bound = true;
    root.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'toggle-interested') state.interestedExpanded = !state.interestedExpanded;
      if (action === 'open-step2') state.step2Visible = true;
      if (action === 'close-step2') state.step2Visible = false;
      if (action === 'add-tenant') state.manual.tenants.push({ name:'', moveIn:'', fixed:'', deposit:'' });
      if (action === 'remove-tenant' && state.manual.tenants.length > 1) state.manual.tenants.splice(Number(btn.dataset.index), 1);
      if (action === 'add-special') state.manual.specials.push({ type:'유치권', holder:'', date:'', amount:'' });
      if (action === 'remove-special') state.manual.specials.splice(Number(btn.dataset.index), 1);
      if (action === 'analyze') { runAnalyze(); return; }
      if (action === 'scroll-analysis') { $('analysisCard')?.scrollIntoView({ behavior:'smooth', block:'start' }); return; }
      if (action === 'scroll-bid-plan') {
        const target = $('v2BidPlanCard') || $('v2BiddingSummaryCard') || $('analysisCard');
        target?.scrollIntoView({ behavior:'smooth', block:'start' });
        return;
      }
      if (action === 'scroll-essential-docs') {
        const target = $('v2EssentialDocumentsCard') || $('analysisCard');
        target?.scrollIntoView({ behavior:'smooth', block:'start' });
        return;
      }
      renderResults({ keepScroll:true });
      if (['open-step2','add-tenant','add-special'].includes(action)) setTimeout(() => $('step2InputCard')?.scrollIntoView({ behavior:'smooth', block:'start' }), 50);
    });
    root.addEventListener('input', (event) => {
      const inputEl = event.target.closest('[data-manual-path]');
      if (!inputEl) return;
      setManual(inputEl.dataset.manualPath, inputEl.value);
    });
    root.addEventListener('change', (event) => {
      const inputEl = event.target.closest('[data-manual-path]');
      if (!inputEl) return;
      setManual(inputEl.dataset.manualPath, inputEl.value);
      renderResults({ keepScroll:true });
    });
  }

  function bindGlobal() {
    document.addEventListener('click', (event) => {
      const tab = event.target.closest('.v2-tab');
      if (tab?.dataset.tab) {
        state.activeTab = tab.dataset.tab;
        ensureHeaderTabs();
        ensureHomePanels();
        syncTabResultsVisibility();
      }
    });
    document.querySelector('.brand')?.addEventListener('click', (event) => {
      event.preventDefault();
      state.activeTab = 'search';
      ensureHeaderTabs();
      ensureHomePanels();
      syncTabResultsVisibility();
      window.scrollTo({ top:0, behavior:'smooth' });
    });
  }

  function boot() {
    injectStyles();
    ensureHeaderTabs();
    ensureHomePanels();
    bindGlobal();
    renderResults();
    window.__auctionV2 = { state, renderResults, tabResultsRoot: ensureTabResultsSection, syncTabResultsVisibility };
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
