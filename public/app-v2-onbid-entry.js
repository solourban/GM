(() => {
  const TAB = 'onbid';
  const PANEL_ID = 'v2OnbidEntryPanel';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

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

  function renderPanel(config = {}) {
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
              <div class="v">v2.1.8.x 공매 모드 진입 구조</div>
              <p class="v2-note">이번 단계에서는 기존 법원경매 흐름과 섞이지 않도록 온비드 진입 영역만 분리합니다. 검색 결과와 상세 판단은 다음 단계에서 붙입니다.</p>
            </div>
            <div class="v2-info"><div class="k">온비드 API</div><div class="v">${statusPill(ready)}</div></div>
            <div class="v2-info"><div class="k">검색 방식</div><div class="v">지역 · 키워드 · 입찰기간</div></div>
            <div class="v2-info"><div class="k">기존 경매 데이터</div><div class="v">분리 유지</div></div>
            <div class="v2-info"><div class="k">요청ID</div><div class="v">${esc(requestId || '-')}</div></div>
          </div>
          ${ready ? '<p class="v2-note">다음 단계에서 온비드 물건 검색 카드와 목록 결과 카드를 연결합니다.</p>' : '<p class="v2-note">Railway 환경변수 <b>ONBID_API_KEY</b>가 없으면 공매 검색 API는 실행되지 않습니다.</p>'}
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

  async function syncPanel() {
    const panels = document.getElementById('v2HomePanels');
    if (!panels) return;
    const config = await loadConfig();
    const old = document.getElementById(PANEL_ID);
    if (old) old.remove();
    panels.insertAdjacentHTML('beforeend', renderPanel(config));
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
      const tab = event.target.closest('.v2-tab');
      if (!tab?.dataset?.tab) return;
      if (tab.dataset.tab === TAB && state()) state().activeTab = TAB;
      scheduleSync();
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
