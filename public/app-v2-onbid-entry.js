(() => {
  const TAB = 'onbid';
  const PANEL_ID = 'v2OnbidEntryPanel';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const onbidState = {
    config: null,
    status: 'idle',
    error: '',
    items: [],
    totalCount: 0,
    requestId: '',
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function state() {
    return window.__auctionV2?.state || null;
  }

  function statusPill(ok, readyLabel = '준비됨', failLabel = '설정 필요') {
    return `<span class="v2-pill ${ok ? 'ok' : 'warn'}">${esc(ok ? readyLabel : failLabel)}</span>`;
  }

  function itemValue(item, keys) {
    for (const key of keys) {
      const value = clean(item?.[key]);
      if (value) return value;
    }
    return '';
  }

  async function loadConfig() {
    try {
      const res = await fetch('/api/config', { headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || '설정 상태 조회 실패');
      return data;
    } catch (error) {
      return { ok: false, error: clean(error.message || String(error)) };
    }
  }

  function formValue(name) {
    return clean(document.querySelector(`[data-onbid-field="${name}"]`)?.value);
  }

  function buildSearchParams() {
    const params = new URLSearchParams();
    params.set('pageNo', '1');
    params.set('numOfRows', '10');
    const entries = {
      lctnSdnm: formValue('lctnSdnm'),
      lctnSggnm: formValue('lctnSggnm'),
      keyword: formValue('keyword'),
      bidPrdYmdStart: formValue('bidPrdYmdStart').replace(/[^0-9]/g, '').slice(0, 8),
      bidPrdYmdEnd: formValue('bidPrdYmdEnd').replace(/[^0-9]/g, '').slice(0, 8),
    };
    Object.entries(entries).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params;
  }

  async function runSearch() {
    if (!onbidState.config?.hasOnbid) {
      onbidState.status = 'error';
      onbidState.error = 'ONBID_API_KEY 설정 후 검색할 수 있습니다.';
      renderIntoDom();
      return;
    }

    onbidState.status = 'loading';
    onbidState.error = '';
    onbidState.items = [];
    renderIntoDom();

    try {
      const res = await fetch(`/api/onbid/items?${buildSearchParams().toString()}`, { headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || '온비드 공매 물건 조회에 실패했습니다.');
      onbidState.status = 'success';
      onbidState.items = Array.isArray(data.items) ? data.items : [];
      onbidState.totalCount = Number(data.totalCount || onbidState.items.length || 0);
      onbidState.requestId = clean(data.requestId || '');
    } catch (error) {
      onbidState.status = 'error';
      onbidState.error = clean(error.message || String(error));
    }
    renderIntoDom();
  }

  function renderResults() {
    if (onbidState.status === 'loading') {
      return `<div class="v2-info wide"><div class="k">조회 중</div><div class="v">온비드 공매 물건을 조회하고 있습니다.</div></div>`;
    }
    if (onbidState.status === 'error') {
      return `<div class="v2-info wide"><div class="k">조회 실패</div><div class="v">${esc(onbidState.error || '조회 실패')}</div></div>`;
    }
    if (onbidState.status !== 'success') return '';
    if (!onbidState.items.length) {
      return `<div class="v2-info wide"><div class="k">조회 결과</div><div class="v">검색된 공매 물건이 없습니다.</div></div>`;
    }
    return `
      <div class="v2-info wide">
        <div class="k">조회 결과</div>
        <div class="v">${esc(String(onbidState.items.length))}건 표시 / 전체 ${esc(String(onbidState.totalCount || onbidState.items.length))}건</div>
        <p class="v2-note">상세 조회와 공매 판단 카드는 다음 단계에서 연결합니다.${onbidState.requestId ? ` 요청ID: ${esc(onbidState.requestId)}` : ''}</p>
      </div>
      <div class="v2-table-wrap" style="grid-column:1/-1">
        <table class="v2-table">
          <thead><tr><th>물건명</th><th>소재지</th><th>최저입찰가</th><th>입찰기간</th><th>공고기관</th><th>관리번호</th></tr></thead>
          <tbody>
            ${onbidState.items.map((item) => {
              const name = itemValue(item, ['cltrNm', 'CLTR_NM', '물건명']);
              const address = itemValue(item, ['lctnFullAddr', 'lctnDtlAddr', 'LCTN_FULL_ADDR', '소재지']);
              const price = itemValue(item, ['minBidPrc', 'lowstBidPrc', 'MIN_BID_PRC', '최저입찰가']);
              const period = [itemValue(item, ['bidStrtDtm', 'bidPrdYmdStart', '입찰시작일']), itemValue(item, ['bidEndDtm', 'bidPrdYmdEnd', '입찰종료일'])].filter(Boolean).join(' ~ ');
              const org = itemValue(item, ['pbctOrgNm', 'rqstOrgNm', 'PBCT_ORG_NM', '공고기관']);
              const no = itemValue(item, ['cltrMngNo', 'CLTR_MNG_NO', '물건관리번호']);
              return `<tr><td>${esc(name || '-')}</td><td>${esc(address || '-')}</td><td>${esc(price || '-')}</td><td>${esc(period || '-')}</td><td>${esc(org || '-')}</td><td>${esc(no || '-')}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPanel() {
    const config = onbidState.config || {};
    const ready = Boolean(config.hasOnbid);
    const requestId = clean(config.requestId || '');
    return `
      <section class="v2-panel ${state()?.activeTab === TAB ? 'active' : ''}" data-panel="${TAB}" id="${PANEL_ID}">
        <div class="v2-card">
          <span class="v2-badge">공매 모드</span>
          <h3>온비드 공매</h3>
          <p>법원경매와 분리된 공매 전용 흐름입니다. 사건번호가 아니라 지역·키워드·입찰조건으로 물건을 찾습니다.</p>
          <div class="v2-grid compact">
            <div class="v2-info wide">
              <div class="k">현재 단계</div>
              <div class="v">v2.1.8.x 공매 검색 카드</div>
              <p class="v2-note">기존 법원경매 결과와 섞이지 않도록 온비드 탭 안에서만 검색·표시합니다. 상세 판단은 다음 단계에서 붙입니다.</p>
            </div>
            <div class="v2-info"><div class="k">온비드 API</div><div class="v">${statusPill(ready)}</div></div>
            <div class="v2-info"><div class="k">기존 경매 데이터</div><div class="v">분리 유지</div></div>
            <div class="v2-info"><div class="k">요청ID</div><div class="v">${esc(requestId || '-')}</div></div>
          </div>
          <div class="v2-step-section">
            <h4>공매 물건 검색</h4>
            <div class="v2-input-grid">
              <label class="v2-field"><span>시·도</span><input data-onbid-field="lctnSdnm" placeholder="예: 충청남도"></label>
              <label class="v2-field"><span>시·군·구</span><input data-onbid-field="lctnSggnm" placeholder="예: 천안시"></label>
              <label class="v2-field"><span>키워드</span><input data-onbid-field="keyword" placeholder="예: 아파트, 토지"></label>
              <label class="v2-field"><span>입찰시작일</span><input data-onbid-field="bidPrdYmdStart" placeholder="YYYYMMDD" inputmode="numeric"></label>
              <label class="v2-field"><span>입찰종료일</span><input data-onbid-field="bidPrdYmdEnd" placeholder="YYYYMMDD" inputmode="numeric"></label>
            </div>
            <div class="v2-cta-row">
              <button class="v2-btn" data-onbid-action="search" ${ready ? '' : 'disabled'}>${onbidState.status === 'loading' ? '조회 중...' : '온비드 물건 조회'}</button>
              ${ready ? '<span class="v2-note">기본 10건만 우선 조회합니다.</span>' : '<span class="v2-note">ONBID_API_KEY 설정 후 조회할 수 있습니다.</span>'}
            </div>
          </div>
          <div class="v2-grid compact" id="v2OnbidResultArea">${renderResults()}</div>
        </div>
      </section>
    `;
  }

  function syncTab() {
    const nav = document.querySelector('.v2-tabs');
    if (!nav) return;
    let button = nav.querySelector('[data-tab="onbid"]');
    if (!button) {
      button = document.createElement('button');
      button.className = 'v2-tab';
      button.dataset.tab = TAB;
      button.type = 'button';
      button.textContent = '온비드 공매';
      nav.appendChild(button);
    }
    button.classList.toggle('active', state()?.activeTab === TAB);
  }

  function renderIntoDom() {
    const panels = document.getElementById('v2HomePanels');
    if (!panels) return;
    const old = document.getElementById(PANEL_ID);
    if (old) old.remove();
    panels.insertAdjacentHTML('beforeend', renderPanel());
  }

  async function syncPanel() {
    onbidState.config = await loadConfig();
    renderIntoDom();
  }

  let timer = null;
  function scheduleSync() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = null;
      syncTab();
      await syncPanel();
    }, 0);
  }

  function boot() {
    scheduleSync();
    document.addEventListener('click', (event) => {
      const onbidAction = event.target.closest('[data-onbid-action]');
      if (onbidAction?.dataset.onbidAction === 'search') {
        runSearch();
        return;
      }
      const tab = event.target.closest('.v2-tab');
      if (!tab?.dataset?.tab) return;
      if (tab.dataset.tab === TAB && state()) state().activeTab = TAB;
      scheduleSync();
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
