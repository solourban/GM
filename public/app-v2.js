(() => {
  const state = {
    status: 'idle',
    activeTab: 'search',
    raw: null,
    error: null,
    elapsed: '',
    interestedExpanded: false,
  };

  const $ = (id) => document.getElementById(id);
  const money = (value) => String(value || '').trim() || '-';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function splitAddress(value) {
    const s = clean(value);
    if (!s) return '-';
    const m = s.match(/\(([^()]+)\)\s*$/);
    const building = m ? m[0] : '';
    const body = building ? s.slice(0, s.length - building.length).trim() : s;
    const parts = body.split(',').map((x) => x.trim()).filter(Boolean);
    if (parts.length <= 1 && !building) return esc(s);
    return `<span class="v2-address"><span>${esc(parts[0] || body)}</span>${parts.slice(1).map((p) => `<span class="sub">${esc(p)}</span>`).join('')}${building ? `<span class="building">${esc(building)}</span>` : ''}</span>`;
  }

  function injectStyles() {
    let style = $('v2Styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'v2Styles';
      document.head.appendChild(style);
    }
    style.textContent = `
      :root { --v2-card-width: 920px; }
      .site-header { position: sticky; top: 0; z-index: 100; background: rgba(246,245,241,.96); backdrop-filter: blur(10px); border-bottom:1px solid var(--line); }
      .header-inner { min-height: 82px; display:flex; justify-content:space-between; gap:20px; align-items:center; }
      .brand { cursor:pointer; }
      .v2-tabs { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
      .v2-tab { border:1px solid var(--line); background:#fff; color:var(--ink-2); border-radius:999px; padding:9px 14px; font-size:13px; font-weight:900; cursor:pointer; white-space:nowrap; }
      .v2-tab.active { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
      .hero { min-height: 660px; display:flex; align-items:center; background: radial-gradient(circle at 82% 10%, rgba(244,233,199,.08), transparent 28%), linear-gradient(180deg,#074332 0%,#063727 100%); }
      .hero-inner { width:100%; }
      .hero-copy { max-width:760px; margin:0 auto 34px; text-align:center; }
      #v2HomePanels { min-height: 202px; }
      .v2-panel { display:none; max-width:var(--v2-card-width); margin:0 auto; }
      .v2-panel.active { display:block; }
      .v2-card { background:#fff; color:var(--ink); border:1px solid var(--line); border-radius:22px; padding:22px; box-shadow:0 18px 48px rgba(0,0,0,.18); min-height: 174px; }
      .v2-card h3 { margin:0 0 6px; font-size:20px; letter-spacing:-.04em; }
      .v2-card p { margin:0; color:var(--ink-3); font-size:13px; line-height:1.55; }
      .v2-form { display:grid; grid-template-columns:minmax(220px,1.4fr) minmax(90px,.55fr) minmax(180px,1fr) auto; gap:12px; align-items:end; margin-top:18px; }
      .v2-field { display:flex; flex-direction:column; gap:6px; min-width:0; }
      .v2-field span { color:var(--ink-3); font-size:12px; font-weight:750; }
      .v2-field input, .v2-field select { width:100%; background:#fff; border:1px solid var(--line-2); color:var(--ink); padding:13px 14px; border-radius:12px; font-size:15px; font-weight:650; outline:none; }
      .v2-btn { background:var(--accent); color:#fff; min-height:48px; padding:0 22px; border:0; border-radius:12px; font-weight:900; cursor:pointer; box-shadow:0 10px 22px rgba(11,61,46,.18); }
      .v2-btn:disabled { opacity:.62; cursor:not-allowed; }
      .v2-placeholder { text-align:center; padding:34px 22px; }
      .results-section { display:block !important; min-height:0; padding-top:32px; scroll-margin-top:100px; }
      .v2-result-card { background:#fff; border:1px solid var(--line); border-radius:18px; padding:20px; box-shadow:0 12px 28px rgba(0,0,0,.05); margin-bottom:16px; }
      .v2-result-card h3 { margin:0 0 10px; font-size:21px; letter-spacing:-.04em; }
      .v2-result-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; }
      .v2-result-head h3 { margin:6px 0 0; font-size:24px; letter-spacing:-.045em; }
      .v2-badge { display:inline-flex; border-radius:999px; padding:6px 10px; background:var(--accent-soft); color:var(--accent); font-size:12px; font-weight:900; }
      .v2-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:10px; margin-top:14px; }
      .v2-grid.compact { grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); }
      .v2-info { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:12px; min-width:0; }
      .v2-info.wide { grid-column: 1 / -1; }
      .v2-info .k { color:var(--ink-3); font-size:12px; margin-bottom:4px; }
      .v2-info .v { font-weight:900; font-size:16px; line-height:1.45; overflow-wrap:anywhere; }
      .v2-address { display:block; line-height:1.5; }
      .v2-address span { display:block; }
      .v2-address .sub { margin-top:3px; color:var(--ink-2); font-size:.92em; }
      .v2-address .building { margin-top:3px; color:var(--ink-3); font-size:.9em; }
      .v2-table-head { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:6px; }
      .v2-table-head h3 { margin:0; }
      .v2-small-btn { border:1px solid var(--line); background:var(--bg); color:var(--ink-2); border-radius:10px; padding:8px 11px; font-size:12px; font-weight:900; cursor:pointer; }
      .v2-table-wrap { overflow:auto; margin-top:12px; border:1px solid var(--line); border-radius:14px; }
      .v2-table { width:100%; border-collapse:collapse; font-size:13px; min-width: 620px; }
      .v2-table th { text-align:left; color:var(--ink-3); border-bottom:1px solid var(--line); padding:10px 9px; white-space:nowrap; background:var(--bg); }
      .v2-table td { border-bottom:1px solid var(--line); padding:10px 9px; vertical-align:top; }
      .v2-table tr:last-child td { border-bottom:0; }
      .v2-note { margin-top:12px; color:var(--ink-3); font-size:13px; line-height:1.6; }
      .v2-loading { display:flex; align-items:center; gap:12px; }
      .v2-spinner { width:22px; height:22px; border-radius:50%; border:3px solid var(--line); border-top-color:var(--accent); animation:v2spin .9s linear infinite; }
      @keyframes v2spin { to { transform:rotate(360deg); } }
      .v2-error { border-color:#fecdca; background:#fff7f7; }
      .v2-error h3 { color:#b42318; }
      @media (max-width:900px){ .v2-form{grid-template-columns:1fr 110px}.v2-court,.v2-case,.v2-btn{grid-column:1/-1}.v2-btn{width:100%;} .header-inner{align-items:flex-start; flex-direction:column; padding:14px 0;} .v2-tabs{justify-content:flex-start;} .hero{min-height:680px;} }
      @media (max-width:720px){ .hero{min-height:auto; padding:44px 0 38px;} .hero-copy{text-align:left;margin-bottom:24px;} #v2HomePanels{min-height:0}.v2-card{min-height:0}.v2-form{grid-template-columns:1fr;} }
    `;
  }

  function installTabs() {
    const header = document.querySelector('.header-inner');
    if (!header || document.querySelector('.v2-tabs')) return;
    const nav = document.createElement('nav');
    nav.className = 'v2-tabs';
    nav.innerHTML = `
      <button class="v2-tab active" data-tab="search">물건 검색</button>
      <button class="v2-tab" data-tab="bulk">여러 사건 일괄조회</button>
      <button class="v2-tab" data-tab="date">매각기일 추천</button>
      <button class="v2-tab" data-tab="saved">저장 후보 TOP 5</button>
    `;
    header.appendChild(nav);
    nav.addEventListener('click', (event) => {
      const button = event.target.closest('[data-tab]');
      if (!button) return;
      state.activeTab = button.dataset.tab;
      renderHome();
    });
  }

  function replaceHeroTools() {
    const heroInner = document.querySelector('.hero-inner');
    if (!heroInner || $('v2HomePanels')) return;
    const oldSearch = document.querySelector('.search-box');
    if (oldSearch) oldSearch.remove();
    const panels = document.createElement('div');
    panels.id = 'v2HomePanels';
    panels.innerHTML = `
      <section class="v2-panel active" data-panel="search">
        <div class="v2-card">
          <h3>물건 검색</h3>
          <p>사건번호로 대법원 경매정보의 기본정보를 조회합니다.</p>
          <div class="v2-form">
            <label class="v2-field v2-court"><span>법원</span><select id="jiwonNmV2"></select></label>
            <label class="v2-field"><span>연도</span><input id="saYearV2" type="text" value="2024" inputmode="numeric"></label>
            <label class="v2-field v2-case"><span>사건번호</span><input id="saSerV2" type="text" placeholder="예: 110754" inputmode="numeric"></label>
            <button id="btnFetchV2" class="v2-btn">물건 기본정보 조회</button>
          </div>
          <p class="v2-note">Step 1 — 조회 결과는 아래 결과 영역에 고정 표시됩니다.</p>
        </div>
      </section>
      <section class="v2-panel" data-panel="bulk"><div class="v2-card v2-placeholder"><h3>여러 사건 일괄조회</h3><p>v2 2차에서 안정화 후 연결합니다.</p></div></section>
      <section class="v2-panel" data-panel="date"><div class="v2-card v2-placeholder"><h3>매각기일 추천</h3><p>v2 3차에서 서버 payload 검증 후 연결합니다.</p></div></section>
      <section class="v2-panel" data-panel="saved"><div class="v2-card v2-placeholder"><h3>저장 후보 TOP 5</h3><p>v2 2차에서 저장 구조와 함께 연결합니다.</p></div></section>
    `;
    heroInner.appendChild(panels);
  }

  async function loadCourts() {
    const select = $('jiwonNmV2');
    if (!select) return;
    const fallback = ['서울중앙지방법원', '서울동부지방법원', '서울서부지방법원', '서울남부지방법원', '서울북부지방법원', '수원지방법원', '인천지방법원', '대전지방법원', '천안지원', '청주지방법원', '부산지방법원', '대구지방법원', '광주지방법원', '전주지방법원', '제주지방법원'];
    try {
      const res = await fetch('/api/courts');
      const data = await res.json();
      const courts = Array.isArray(data.courts) ? data.courts.map((x) => x.name) : fallback;
      select.innerHTML = courts.map((name) => `<option>${esc(name)}</option>`).join('');
      if (courts.includes('천안지원')) select.value = '천안지원';
    } catch (_) {
      select.innerHTML = fallback.map((name) => `<option>${esc(name)}</option>`).join('');
    }
  }

  function renderHome() {
    document.querySelectorAll('.v2-tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === state.activeTab));
    document.querySelectorAll('.v2-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === state.activeTab));
  }

  function validateInput() {
    const court = clean($('jiwonNmV2')?.value);
    const year = clean($('saYearV2')?.value);
    const serial = clean($('saSerV2')?.value);
    if (!court) return '법원을 선택해주세요.';
    if (!/^\d{4}$/.test(year)) return '사건연도는 4자리 숫자로 입력해주세요.';
    if (!/^\d+$/.test(serial)) return '사건번호는 숫자만 입력해주세요.';
    return '';
  }

  function setStatus(next) {
    Object.assign(state, next);
    renderResults();
  }

  async function fetchCase() {
    const error = validateInput();
    if (error) {
      setStatus({ status: 'error', error, raw: null, elapsed: '' });
      return;
    }
    const btn = $('btnFetchV2');
    if (btn) btn.disabled = true;
    setStatus({ status: 'loading', error: null, raw: null, elapsed: '', interestedExpanded: false });
    try {
      const payload = {
        jiwonNm: clean($('jiwonNmV2').value),
        saYear: clean($('saYearV2').value),
        saSer: clean($('saSerV2').value),
      };
      const res = await fetch('/api/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || data.detail || '조회에 실패했습니다.');
      setStatus({ status: 'success', raw: data.raw, elapsed: data.elapsed || '', error: null, interestedExpanded: false });
    } catch (err) {
      setStatus({ status: 'error', error: err.message || String(err), raw: null, elapsed: '' });
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function renderResults() {
    const root = $('resultsSection');
    if (!root) return;
    if (state.status === 'idle') {
      root.innerHTML = '';
      return;
    }
    if (state.status === 'loading') {
      root.innerHTML = `<div class="v2-result-card"><div class="v2-loading"><span class="v2-spinner"></span><div><h3>대법원 경매정보에서 기본정보를 가져오는 중...</h3><p class="v2-note">조회 결과가 나오면 이 영역에 고정 표시됩니다.</p></div></div></div>`;
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (state.status === 'error') {
      root.innerHTML = `<div class="v2-result-card v2-error"><h3>조회 실패</h3><p>${esc(state.error)}</p></div>`;
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    root.innerHTML = renderStep1(state.raw, state.elapsed);
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderStep1(raw, elapsed) {
    const basic = raw?.basic || {};
    const objects = Array.isArray(raw?.objects) ? raw.objects : [];
    const schedule = Array.isArray(raw?.schedule) ? raw.schedule : [];
    const interested = Array.isArray(raw?.interested) ? raw.interested : [];
    const tenants = interested.filter((x) => x.type === '임차인');
    return `
      <section class="v2-result-card">
        <div class="v2-result-head">
          <div><span class="v2-badge">Step 1 완료</span><h3>물건 기본정보</h3><p class="v2-note">${esc(raw?.court || '')} ${esc(raw?.caseNo || '')} ${elapsed ? `· ${esc(elapsed)}` : ''}</p></div>
        </div>
        <div class="v2-grid">
          ${info('사건번호', basic['사건번호'] || raw?.caseNo)}
          ${info('법원', basic['법원'] || raw?.court)}
          ${info('담당계', basic['담당계'])}
          ${info('사건명', basic['사건명'])}
          ${infoHtml('소재지', splitAddress(basic['소재지']), 'wide')}
          ${info('물건종별', basic['물건종별'])}
          ${info('감정평가액', money(basic['감정평가액']))}
          ${info('최저매각가격', money(basic['최저매각가격']))}
          ${info('매각기일', basic['매각기일'])}
          ${info('유찰횟수', basic['유찰횟수'])}
          ${info('배당요구종기', basic['배당요구종기'])}
          ${info('입찰보증금률', basic['입찰보증금률'])}
        </div>
      </section>
      <section class="v2-result-card">
        <h3>현황 요약</h3>
        <div class="v2-grid compact">
          ${info('물건 수', `${objects.length || 1}개`)}
          ${info('이해관계인', `${interested.length}명`)}
          ${info('임차인', `${tenants.length}명`)}
          ${info('조회 상태', raw?.status === 'ok' ? '정상 수집' : clean(raw?.status || '-'))}
        </div>
      </section>
      ${renderSchedule(schedule)}
      ${renderInterested(interested)}
      <section class="v2-result-card">
        <h3>다음 단계</h3>
        <p class="v2-note">v2 1차에서는 기본정보 조회 안정화까지만 반영했습니다. Step 2 명세서 입력과 권리분석은 결과 유지가 확인된 뒤 연결합니다.</p>
      </section>
    `;
  }

  function info(k, v, extraClass = '') {
    return `<div class="v2-info ${extraClass}"><div class="k">${esc(k)}</div><div class="v">${esc(clean(v) || '-')}</div></div>`;
  }

  function infoHtml(k, html, extraClass = '') {
    return `<div class="v2-info ${extraClass}"><div class="k">${esc(k)}</div><div class="v">${html || '-'}</div></div>`;
  }

  function renderSchedule(rows) {
    if (!rows.length) return `<section class="v2-result-card"><h3>진행일정 / 매각기일</h3><p class="v2-note">자동 수집된 기일내역이 없습니다. 원문에서 재확인하세요.</p></section>`;
    const visible = rows.slice(0, 12);
    return `<section class="v2-result-card"><div class="v2-table-head"><h3>진행일정 / 매각기일</h3><span class="v2-badge">${rows.length}건</span></div><div class="v2-table-wrap"><table class="v2-table"><thead><tr><th>일자</th><th>시간</th><th>장소</th><th>구분</th><th>결과</th><th>최저가</th></tr></thead><tbody>${visible.map((r) => `<tr>${[0,1,2,3,4,5].map((i) => `<td>${esc(r[i] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${rows.length > visible.length ? `<p class="v2-note">기일내역은 ${visible.length}건까지만 우선 표시했습니다. 원문에서 전체 일정을 재확인하세요.</p>` : ''}</section>`;
  }

  function renderInterested(rows) {
    if (!rows.length) return `<section class="v2-result-card"><h3>이해관계인</h3><p class="v2-note">자동 수집된 이해관계인 정보가 없습니다.</p></section>`;
    const limit = 8;
    const visible = state.interestedExpanded ? rows : rows.slice(0, limit);
    const button = rows.length > limit ? `<button class="v2-small-btn" type="button" onclick="window.__auctionV2.toggleInterested()">${state.interestedExpanded ? '상세 목록 접기' : `상세 목록 펼치기`}</button>` : '';
    return `<section class="v2-result-card"><div class="v2-table-head"><h3>이해관계인</h3><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="v2-badge">${rows.length}명</span>${button}</div></div><div class="v2-table-wrap"><table class="v2-table"><thead><tr><th>구분</th><th>이름</th><th>순번</th></tr></thead><tbody>${visible.map((r) => `<tr><td>${esc(r.type || '')}</td><td>${esc(r.name || '')}</td><td>${esc(r.seq || '')}</td></tr>`).join('')}</tbody></table></div>${rows.length > limit && !state.interestedExpanded ? `<p class="v2-note">전체 ${rows.length}명 중 ${limit}명만 우선 표시합니다.</p>` : ''}</section>`;
  }

  function bind() {
    $('btnFetchV2')?.addEventListener('click', fetchCase);
    $('saSerV2')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchCase(); });
    document.querySelector('.brand')?.addEventListener('click', (e) => {
      e.preventDefault();
      state.activeTab = 'search';
      renderHome();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function boot() {
    injectStyles();
    installTabs();
    replaceHeroTools();
    loadCourts();
    bind();
    renderHome();
    renderResults();
    window.__auctionV2 = {
      state,
      renderHome,
      renderResults,
      toggleInterested() {
        state.interestedExpanded = !state.interestedExpanded;
        renderResults();
      },
    };
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
