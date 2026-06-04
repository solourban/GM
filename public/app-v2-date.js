(() => {
  const SUPPORTED_COURT = '서울중앙';
  const SEARCH_COURT = '서울중앙지방법원';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function todayInput() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function addDaysInput(days) {
    const d = new Date();
    d.setDate(d.getDate() + Number(days || 0));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function normalizeCourt(value) {
    return clean(value).replace(/\s+/g, '').replace(/지방법원|법원|지원/g, '');
  }

  function isSupportedCourt(value) {
    return normalizeCourt(value) === normalizeCourt(SUPPORTED_COURT);
  }

  const state = {
    mounted: false,
    loading: false,
    message: '',
    messageType: 'info',
    items: [],
    meta: null,
    handoff: null,
    selectedCandidate: null,
    sortMode: 'score',
    propertyType: 'all',
    form: {
      court: SUPPORTED_COURT,
      start: todayInput(),
      end: addDaysInput(7),
      usage: 'all',
    },
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function compactDate(value) {
    return clean(value).replace(/[^0-9]/g, '');
  }

  function numberValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
    const digits = clean(value).replace(/[^0-9]/g, '');
    return digits ? Math.max(0, Number(digits)) : 0;
  }

  function displayDate(value) {
    const digits = compactDate(value);
    if (/^\d{8}$/.test(digits)) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
    return clean(value);
  }

  function formatWon(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) && n > 0 ? `${n.toLocaleString('ko-KR')}원` : '-';
  }

  function percent(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return '-';
    return `${n.toFixed(1)}%`;
  }

  function parseCaseNo(value) {
    const raw = clean(value).replace(/\s+/g, '');
    const match = raw.match(/(20\d{2})\s*타경\s*(\d{1,10})/);
    if (!match) return null;
    return { year: match[1], serial: match[2] };
  }

  function sameCase(left, right) {
    return clean(left).replace(/\s+/g, '') === clean(right).replace(/\s+/g, '');
  }

  function isHousing(item) {
    return /주거|아파트|다세대|단독|연립|다가구|주택/i.test(clean(item?.usage));
  }

  function propertyTypes() {
    return window.__auctionPropertyTypes || null;
  }

  function candidateDiscountRate(item) {
    const minBid = numberValue(item?.minBid);
    const appraisal = numberValue(item?.appraisal);
    return minBid && appraisal ? (minBid / appraisal) * 100 : 0;
  }

  function visibleItems() {
    const filtered = propertyTypes()?.filter(state.items, state.propertyType) || [...state.items];
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (state.sortMode === 'minBid') return numberValue(a.minBid) - numberValue(b.minBid);
      if (state.sortMode === 'discount') return candidateDiscountRate(a) - candidateDiscountRate(b);
      if (state.sortMode === 'failCount') return Number(b.failCount || 0) - Number(a.failCount || 0);
      return Number(b.score || 0) - Number(a.score || 0);
    });
    return sorted;
  }

  function findDatePanel() {
    const panels = Array.from(document.querySelectorAll('.v2-panel'));
    return panels.find((panel) => panel.querySelector('h3')?.textContent?.includes('매각기일 추천')) || null;
  }

  function userMessageFromError(errorText) {
    const text = clean(errorText);
    if (!text) return '매각기일 목록을 불러오지 못했습니다. 법원명과 기간을 확인해 주세요.';
    if (text.includes('현재 지원 범위')) return text;
    if (text.includes('지원하지 않는 법원명')) return '현재 매각기일 추천은 서울중앙만 검증 중입니다. 다른 법원은 안정화 후 개방합니다.';
    if (text.includes('검증 가능한 매각기일 목록 데이터가 없습니다')) return '해당 조건에서 검증 가능한 매각기일 목록을 찾지 못했습니다. 기간을 넓히거나 조건을 바꿔 주세요.';
    if (text.includes('응답 법원 불일치')) return '조회 결과의 법원 정보가 요청값과 일치하지 않아 결과를 표시하지 않았습니다.';
    return '매각기일 목록을 불러오지 못했습니다. 조건을 바꿔 다시 조회해 주세요.';
  }

  function selected(value, target) {
    return String(value) === String(target) ? 'selected' : '';
  }

  function captureForm() {
    state.form.court = clean(document.getElementById('dateCourtV2')?.value) || state.form.court;
    state.form.start = document.getElementById('dateStartV2')?.value || state.form.start;
    state.form.end = document.getElementById('dateEndV2')?.value || state.form.end;
    state.form.usage = document.getElementById('dateUsageV2')?.value || state.form.usage;
  }

  function average(values) {
    const nums = values.map(numberValue).filter((n) => n > 0);
    if (!nums.length) return 0;
    return Math.round(nums.reduce((sum, n) => sum + n, 0) / nums.length);
  }

  function pickLowest(items, getter) {
    return items.reduce((best, item) => {
      const value = getter(item);
      if (!value) return best;
      if (!best || value < best.value) return { item, value };
      return best;
    }, null);
  }

  function pickHighest(items, getter) {
    return items.reduce((best, item) => {
      const value = getter(item);
      if (!Number.isFinite(value)) return best;
      if (!best || value > best.value) return { item, value };
      return best;
    }, null);
  }

  function selectedComparisonText(avgMinBid) {
    const selectedItem = state.selectedCandidate;
    if (!selectedItem || !avgMinBid) return '후보를 선택하면 목록 평균과 비교해 보여줍니다.';
    const minBid = numberValue(selectedItem.minBid);
    if (!minBid) return '선택 후보의 최저가 정보가 부족합니다.';
    if (minBid < avgMinBid) return `선택 후보 최저가는 목록 평균보다 ${(avgMinBid - minBid).toLocaleString('ko-KR')}원 낮습니다.`;
    if (minBid > avgMinBid) return `선택 후보 최저가는 목록 평균보다 ${(minBid - avgMinBid).toLocaleString('ko-KR')}원 높습니다.`;
    return '선택 후보 최저가는 목록 평균과 같습니다.';
  }

  function renderCandidateComparison() {
    const items = visibleItems();
    if (!items.length) return '';

    const lowestMinBid = pickLowest(items, (item) => numberValue(item.minBid));
    const lowestRate = pickLowest(items, candidateDiscountRate);
    const mostFailed = pickHighest(items, (item) => Number(item.failCount || 0));
    const housingCount = items.filter(isHousing).length;
    const avgMinBid = average(items.map((item) => item.minBid));

    return `
      <div class="v2-card">
        <span class="v2-badge">후보 비교</span>
        <h3>매각기일 후보 비교 요약</h3>
        <p class="v2-note">조회된 후보 목록 안에서 먼저 볼 만한 기준을 단순 비교한 값입니다. 실제 입찰 판단은 단일 사건 조회 후 권리분석으로 확인하세요.</p>
        <div class="v2-grid four">
          <div class="v2-info-box"><span>최저가 최저 후보</span><strong>${esc(lowestMinBid?.item?.caseNo || '-')}</strong><small>${formatWon(lowestMinBid?.item?.minBid)}</small></div>
          <div class="v2-info-box"><span>할인율 큰 후보</span><strong>${esc(lowestRate?.item?.caseNo || '-')}</strong><small>최저가/감정가 ${percent(lowestRate?.value)}</small></div>
          <div class="v2-info-box"><span>유찰 최다 후보</span><strong>${esc(mostFailed?.item?.caseNo || '-')}</strong><small>${esc(mostFailed?.item?.failCount ?? '-')}회</small></div>
          <div class="v2-info-box"><span>주거형 후보</span><strong>${housingCount}건</strong><small>전체 ${items.length}건 중</small></div>
        </div>
        <ul class="v2-list">
          <li>전체 후보 평균 최저가: ${formatWon(avgMinBid)}</li>
          <li>현재 표시 후보: ${items.length}건 / 전체 ${state.items.length}건</li>
          <li>${selectedComparisonText(avgMinBid)}</li>
        </ul>
      </div>
    `;
  }

  function renderSelectedCandidate() {
    const item = state.selectedCandidate;
    if (!item) return '';
    return `
      <div class="v2-card">
        <span class="v2-badge">최근 선택 후보</span>
        <h3>${esc(item.caseNo || '사건번호 미확인')}</h3>
        <p class="v2-note">선택한 매각기일 후보입니다. 물건검색에서 기본정보 조회 후 권리분석을 진행하세요.</p>
        <div class="v2-grid four">
          <div class="v2-info-box"><span>매각기일</span><strong>${esc(item.saleDate || '-')}</strong></div>
          <div class="v2-info-box"><span>용도</span><strong>${esc(item.usage || '-')}</strong></div>
          <div class="v2-info-box"><span>최저가</span><strong>${formatWon(item.minBid)}</strong></div>
          <div class="v2-info-box"><span>감정가</span><strong>${formatWon(item.appraisal)}</strong></div>
        </div>
      </div>
    `;
  }

  function renderSortControls(items) {
    if (!items.length) return '';
    return `
      <div class="v2-card">
        <span class="v2-badge">목록 정렬</span>
        <h3>후보 정렬·필터</h3>
        <div class="v2-form" style="grid-template-columns:minmax(180px,1fr);">
          <label class="v2-field"><span>정렬 기준</span><select id="dateSortModeV2">
            <option value="score" ${selected(state.sortMode, 'score')}>기본 추천순</option>
            <option value="minBid" ${selected(state.sortMode, 'minBid')}>최저가 낮은순</option>
            <option value="discount" ${selected(state.sortMode, 'discount')}>할인율 높은순</option>
            <option value="failCount" ${selected(state.sortMode, 'failCount')}>유찰 많은순</option>
          </select></label>
        </div>
        ${propertyTypes()?.render(items, state.propertyType, 'data-date-property-type') || ''}
      </div>
    `;
  }

  function renderRows(items) {
    if (!items.length) return '<p class="v2-note">현재 정렬/필터 조건에 맞는 매각기일 후보가 없습니다.</p>';
    return `
      <div class="v2-detail-table-wrap">
        <table class="v2-detail-table">
          <thead>
            <tr><th>상태</th><th>점수</th><th>사건번호</th><th>매각기일</th><th>용도</th><th>최저가</th><th>감정가</th><th>할인율</th><th>유찰</th><th>사유</th><th>연결</th></tr>
          </thead>
          <tbody>
            ${items.map((item) => {
              const parsed = parseCaseNo(item.caseNo || '');
              const disabled = parsed ? '' : 'disabled';
              const isSelected = state.selectedCandidate && sameCase(state.selectedCandidate.caseNo, item.caseNo);
              return `
                <tr data-selected-candidate="${isSelected ? '1' : '0'}">
                  <td>${isSelected ? '<span class="v2-badge">선택됨</span>' : '-'}</td>
                  <td>${esc(item.score ?? '-')}</td>
                  <td>${esc(item.caseNo || '-')}</td>
                  <td>${esc(item.saleDate || '-')}</td>
                  <td>${esc(item.usage || '-')}</td>
                  <td>${formatWon(item.minBid)}</td>
                  <td>${formatWon(item.appraisal)}</td>
                  <td>${percent(candidateDiscountRate(item))}</td>
                  <td>${esc(item.failCount ?? '-')}</td>
                  <td>${esc(Array.isArray(item.reasons) ? item.reasons.join(', ') : '')}</td>
                  <td><button type="button" class="v2-small-btn" data-date-search-case="${esc(item.caseNo || '')}" ${disabled}>이 사건 조회</button></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function render(panel) {
    const messageClass = state.message ? `v2-form-message show ${state.messageType}` : 'v2-form-message';
    const displayItems = visibleItems();
    panel.innerHTML = `
      <div class="v2-card">
        <h3>매각기일 추천</h3>
        <p>법원과 기간을 기준으로 이번에 볼 만한 매각기일 후보를 조회합니다. 결과는 후보 선별용이며, 단일 사건 조회로 다시 검토해야 합니다.</p>
        <div class="v2-form v2-date-search-form">
          <label class="v2-field"><span>법원</span><select id="dateCourtV2"><option value="${SUPPORTED_COURT}" ${selected(state.form.court, SUPPORTED_COURT)}>서울중앙</option></select></label>
          <label class="v2-field"><span>시작일</span><input id="dateStartV2" type="date" value="${esc(state.form.start)}"></label>
          <label class="v2-field"><span>종료일</span><input id="dateEndV2" type="date" value="${esc(state.form.end)}"></label>
          <label class="v2-field"><span>용도</span><select id="dateUsageV2"><option value="all" ${selected(state.form.usage, 'all')}>전체</option><option value="20100" ${selected(state.form.usage, '20100')}>주거형</option><option value="20104" ${selected(state.form.usage, '20104')}>아파트</option></select></label>
          <button id="dateFetchV2" class="v2-btn" ${state.loading ? 'disabled' : ''}>${state.loading ? '조회 중...' : '매각기일 조회'}</button>
        </div>
        <p class="v2-note">지원 범위: 현재 서울중앙만 검증 중입니다. 다른 법원은 조회 안정화 후 개방합니다.</p>
        <div id="dateMessageV2" class="${messageClass}">${esc(state.message)}</div>
        <p class="v2-note">매각기일 조회는 물건검색 결과와 권리분석 결과를 변경하지 않습니다.</p>
      </div>
      ${renderCandidateComparison()}
      ${renderSelectedCandidate()}
      ${state.loading ? `<div class="v2-result-card"><div class="v2-loading"><span class="v2-spinner"></span><div><h3>매각기일 목록을 조회 중입니다.</h3><p class="v2-note">조회 결과는 이 영역에 표시됩니다.</p></div></div></div>` : ''}
      ${state.meta || state.items.length ? `
        <div class="v2-result-card">
          <span class="v2-badge">매각기일</span>
          <h3>조회 결과</h3>
          <p class="v2-note">${esc(state.meta?.court || state.form.court)} ${displayDate(state.meta?.start || '')} ~ ${displayDate(state.meta?.end || '')} / 표시 ${displayItems.length}건 · 전체 ${state.items.length}건</p>
          <p class="v2-note">검증 상태: 서울중앙 기준 결과만 표시합니다. 요청 법원과 응답 법원이 다르면 결과를 폐기합니다.</p>
          ${renderSortControls(state.items)}
          ${renderRows(displayItems)}
          <p class="v2-note">관심 물건은 “이 사건 조회”로 물건검색 탭에 값을 옮긴 뒤, 기본정보 조회 버튼을 눌러 권리분석을 진행하세요.</p>
        </div>
      ` : ''}
    `;
    bind(panel);
  }

  function validate() {
    captureForm();
    const court = clean(state.form.court);
    const start = compactDate(state.form.start);
    const end = compactDate(state.form.end);
    if (!court) return '법원을 입력해주세요.';
    if (!isSupportedCourt(court)) return '현재 지원 범위는 서울중앙 매각기일 추천입니다. 다른 법원은 안정화 후 개방합니다.';
    if (!/^\d{8}$/.test(start)) return '시작일을 선택해주세요.';
    if (!/^\d{8}$/.test(end)) return '종료일을 선택해주세요.';
    if (start > end) return '종료일은 시작일 이후여야 합니다.';
    return '';
  }

  async function fetchDateRecommendations(panel) {
    const error = validate();
    if (error) {
      state.items = [];
      state.meta = null;
      state.message = error;
      state.messageType = 'error';
      render(panel);
      return;
    }

    const court = SUPPORTED_COURT;
    state.form.court = SUPPORTED_COURT;
    const start = compactDate(state.form.start);
    const end = compactDate(state.form.end);
    const usage = clean(state.form.usage) || 'all';
    const params = new URLSearchParams({ court, start, end, usage, maxBidRate: '1', limit: '20' });

    state.loading = true;
    state.items = [];
    state.meta = null;
    state.message = '매각기일 목록을 조회하고 있습니다.';
    state.messageType = 'info';
    render(panel);

    try {
      const res = await fetch(`/api/recommendations/by-date?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || '조회 실패');
      if (!isSupportedCourt(data.court || court)) throw new Error('응답 법원 불일치');
      state.items = Array.isArray(data.items) ? data.items : [];
      state.meta = { court: SUPPORTED_COURT, start: data.start || start, end: data.end || end };
      state.message = state.items.length ? '매각기일 조회가 완료되었습니다.' : '조회된 후보가 없습니다. 기간이나 조건을 바꿔 다시 조회해 주세요.';
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

  function showSearchMessage(message, type = 'info') {
    const msg = document.getElementById('v2FormMessage');
    if (!msg) return false;
    msg.className = `v2-form-message show ${type}`;
    msg.textContent = message;
    return true;
  }

  function setSearchCourt(courtSelect) {
    if (!courtSelect) return false;
    const options = Array.from(courtSelect.options || []);
    const option = options.find((opt) => clean(opt.value || opt.textContent) === SEARCH_COURT);
    if (option) {
      courtSelect.value = option.value;
    } else if (options.length) {
      const normalizedTarget = normalizeCourt(SEARCH_COURT);
      const looseOption = options.find((opt) => normalizeCourt(opt.value || opt.textContent) === normalizedTarget);
      if (looseOption) courtSelect.value = looseOption.value;
      else return false;
    } else {
      return false;
    }
    courtSelect.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function applySearchHandoff(attempt = 0) {
    const handoff = state.handoff;
    if (!handoff) return;

    const court = document.getElementById('jiwonNmV2');
    const year = document.getElementById('saYearV2');
    const serial = document.getElementById('saSerV2');
    const ready = court && year && serial && setSearchCourt(court);

    if (!ready) {
      if (attempt < 12) {
        window.setTimeout(() => applySearchHandoff(attempt + 1), 120);
      } else {
        showSearchMessage('사건번호 자동 입력에 실패했습니다. 물건검색에서 직접 입력해 주세요.', 'error');
        state.handoff = null;
      }
      return;
    }

    year.value = handoff.year;
    year.dispatchEvent(new Event('input', { bubbles: true }));
    serial.value = handoff.serial;
    serial.dispatchEvent(new Event('input', { bubbles: true }));
    serial.focus();
    showSearchMessage('매각기일 후보의 사건번호를 입력했습니다. 물건 기본정보 조회를 눌러 확인하세요.', 'info');
    state.handoff = null;
  }

  function selectCandidate(caseNo) {
    const item = state.items.find((candidate) => sameCase(candidate.caseNo, caseNo));
    state.selectedCandidate = item ? { ...item } : { caseNo: clean(caseNo) };
  }

  function openSearchTabWithCase(caseNo) {
    const parsed = parseCaseNo(caseNo);
    if (!parsed) {
      state.message = '사건번호 형식을 읽지 못했습니다. 물건검색에서 직접 입력해 주세요.';
      state.messageType = 'error';
      render(findDatePanel());
      return;
    }

    selectCandidate(caseNo);
    state.handoff = { ...parsed, caseNo: clean(caseNo) };
    const searchTab = document.querySelector('.v2-tab[data-tab="search"]');
    searchTab?.click();
    render(findDatePanel());
    window.setTimeout(() => applySearchHandoff(0), 80);
  }

  function bind(panel) {
    ['dateCourtV2', 'dateStartV2', 'dateEndV2', 'dateUsageV2'].forEach((id) => {
      const el = panel.querySelector(`#${id}`);
      if (!el || el.dataset.bound) return;
      el.dataset.bound = '1';
      el.addEventListener('input', captureForm);
      el.addEventListener('change', captureForm);
    });

    const sort = panel.querySelector('#dateSortModeV2');
    if (sort && !sort.dataset.bound) {
      sort.dataset.bound = '1';
      sort.addEventListener('change', () => {
        state.sortMode = sort.value;
        render(panel);
      });
    }

    panel.querySelectorAll('[data-date-property-type]').forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', () => {
        state.propertyType = button.dataset.datePropertyType || 'all';
        render(panel);
      });
    });

    const btn = panel.querySelector('#dateFetchV2');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => fetchDateRecommendations(panel));
    }

    panel.querySelectorAll('[data-date-search-case]').forEach((caseButton) => {
      if (caseButton.dataset.bound) return;
      caseButton.dataset.bound = '1';
      caseButton.addEventListener('click', () => openSearchTabWithCase(caseButton.dataset.dateSearchCase));
    });
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
