(() => {
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  const state = {
    mounted: false,
    loading: false,
    message: '',
    messageType: 'info',
    items: [],
    meta: null,
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function todayInput() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function addDaysInput(days) {
    const d = new Date();
    d.setDate(d.getDate() + Number(days || 0));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function compactDate(value) {
    return clean(value).replace(/[^0-9]/g, '');
  }

  function formatWon(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) && n > 0 ? `${n.toLocaleString('ko-KR')}원` : '-';
  }

  function findDatePanel() {
    const panels = Array.from(document.querySelectorAll('.v2-panel'));
    return panels.find((panel) => panel.querySelector('h3')?.textContent?.includes('매각기일 추천')) || null;
  }

  function userMessageFromError(errorText) {
    const text = clean(errorText);
    if (!text) return '매각기일 목록을 불러오지 못했습니다. 법원명과 기간을 확인해 주세요.';
    if (text.includes('지원하지 않는 법원명')) return '지원하지 않는 법원명입니다. 법원명을 다시 선택해 주세요.';
    if (text.includes('검증 가능한 매각기일 목록 데이터가 없습니다')) return '해당 조건에서 검증 가능한 매각기일 목록을 찾지 못했습니다. 기간을 넓히거나 법원을 다시 선택해 주세요.';
    return '매각기일 목록을 불러오지 못했습니다. 조건을 바꿔 다시 조회해 주세요.';
  }

  function renderRows(items) {
    if (!items.length) return '<p class="v2-note">조회된 매각기일 후보가 없습니다.</p>';
    return `
      <div class="v2-detail-table-wrap">
        <table class="v2-detail-table">
          <thead>
            <tr><th>점수</th><th>사건번호</th><th>매각기일</th><th>용도</th><th>최저가</th><th>감정가</th><th>유찰</th><th>사유</th></tr>
          </thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>${esc(item.score ?? '-')}</td>
                <td>${esc(item.caseNo || '-')}</td>
                <td>${esc(item.saleDate || '-')}</td>
                <td>${esc(item.usage || '-')}</td>
                <td>${formatWon(item.minBid)}</td>
                <td>${formatWon(item.appraisal)}</td>
                <td>${esc(item.failCount ?? '-')}</td>
                <td>${esc(Array.isArray(item.reasons) ? item.reasons.join(', ') : '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function render(panel) {
    const messageClass = state.message ? `v2-form-message show ${state.messageType}` : 'v2-form-message';
    panel.innerHTML = `
      <div class="v2-card">
        <h3>매각기일 추천</h3>
        <p>법원과 기간을 기준으로 이번에 볼 만한 매각기일 후보를 조회합니다. 결과는 후보 선별용이며, 단일 사건 조회로 다시 검토해야 합니다.</p>
        <div class="v2-form" style="grid-template-columns:minmax(180px,1fr) minmax(140px,.7fr) minmax(140px,.7fr) minmax(140px,.7fr) auto;">
          <label class="v2-field"><span>법원</span><input id="dateCourtV2" type="text" value="천안" placeholder="예: 천안, 서울중앙"></label>
          <label class="v2-field"><span>시작일</span><input id="dateStartV2" type="date" value="${todayInput()}"></label>
          <label class="v2-field"><span>종료일</span><input id="dateEndV2" type="date" value="${addDaysInput(7)}"></label>
          <label class="v2-field"><span>용도</span><select id="dateUsageV2"><option value="all">전체</option><option value="20100">주거형</option><option value="20104">아파트</option></select></label>
          <button id="dateFetchV2" class="v2-btn" ${state.loading ? 'disabled' : ''}>${state.loading ? '조회 중...' : '매각기일 조회'}</button>
        </div>
        <div id="dateMessageV2" class="${messageClass}">${esc(state.message)}</div>
        <p class="v2-note">매각기일 조회는 물건검색 결과와 권리분석 결과를 변경하지 않습니다.</p>
      </div>
      ${state.loading ? `<div class="v2-result-card"><div class="v2-loading"><span class="v2-spinner"></span><div><h3>매각기일 목록을 조회 중입니다.</h3><p class="v2-note">조회 결과는 이 영역에 표시됩니다.</p></div></div></div>` : ''}
      ${state.meta || state.items.length ? `
        <div class="v2-result-card">
          <span class="v2-badge">매각기일</span>
          <h3>조회 결과</h3>
          <p class="v2-note">${esc(state.meta?.court || '')} ${esc(state.meta?.start || '')} ~ ${esc(state.meta?.end || '')} / ${state.items.length}건</p>
          ${renderRows(state.items)}
          <p class="v2-note">목록 후보는 기본 필터 결과입니다. 관심 물건은 사건번호로 다시 조회해 권리분석을 진행하세요.</p>
        </div>
      ` : ''}
    `;
    bind(panel);
  }

  function validate() {
    const court = clean(document.getElementById('dateCourtV2')?.value);
    const start = compactDate(document.getElementById('dateStartV2')?.value);
    const end = compactDate(document.getElementById('dateEndV2')?.value);
    if (!court) return '법원을 입력해주세요.';
    if (!/^\d{8}$/.test(start)) return '시작일을 선택해주세요.';
    if (!/^\d{8}$/.test(end)) return '종료일을 선택해주세요.';
    if (start > end) return '종료일은 시작일 이후여야 합니다.';
    return '';
  }

  async function fetchDateRecommendations(panel) {
    const error = validate();
    if (error) {
      state.message = error;
      state.messageType = 'error';
      render(panel);
      return;
    }

    const court = clean(document.getElementById('dateCourtV2')?.value);
    const start = compactDate(document.getElementById('dateStartV2')?.value);
    const end = compactDate(document.getElementById('dateEndV2')?.value);
    const usage = clean(document.getElementById('dateUsageV2')?.value) || 'all';
    const params = new URLSearchParams({ court, start, end, usage, maxBidRate: '1', limit: '20' });

    state.loading = true;
    state.message = '매각기일 목록을 조회하고 있습니다.';
    state.messageType = 'info';
    render(panel);

    try {
      const res = await fetch(`/api/recommendations/by-date?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || '조회 실패');
      state.items = Array.isArray(data.items) ? data.items : [];
      state.meta = { court: data.court || court, start: data.start || start, end: data.end || end };
      state.message = state.items.length ? '매각기일 조회가 완료되었습니다.' : '조회된 후보가 없습니다. 기간이나 법원을 바꿔 다시 조회해 주세요.';
      state.messageType = state.items.length ? 'info' : 'warn';
    } catch (error) {
      state.items = [];
      state.meta = null;
      state.message = userMessageFromError(error.message);
      state.messageType = 'error';
    } finally {
      state.loading = false;
      render(panel);
    }
  }

  function bind(panel) {
    const btn = panel.querySelector('#dateFetchV2');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => fetchDateRecommendations(panel));
    }
  }

  function mount() {
    const panel = findDatePanel();
    if (!panel) return;
    if (!panel.classList.contains('active')) return;
    if (panel.dataset.dateEnhanced === '1') return;
    panel.dataset.dateEnhanced = '1';
    render(panel);
  }

  setInterval(mount, 500);
})();
