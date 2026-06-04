(() => {
  const CARD_ID = 'v2BulkRuntimeCard';
  const RESULT_ID = 'v2BulkResultCard';
  const STACK_KEY = 'auction-note:v2:date-candidate-stack';
  const SAVED_KEY = 'auction-note:v2:saved-candidates';
  const BULK_STATE_KEY = 'auction-note:v2:bulk-lookup-state';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const state = {
    rendered: false,
    courts: [],
    running: false,
    rows: [],
    message: '',
    inputText: '',
    selectedCourt: '',
    restored: false,
    propertyType: 'all',
  };

  function appState() {
    return window.__auctionV2?.state || null;
  }

  function activeTab() {
    return appState()?.activeTab || '';
  }

  function compact(value) {
    return clean(value).replace(/\s+/g, '').replace(/[^0-9가-힣A-Za-z]/g, '');
  }

  function numberValue(value) {
    const digits = clean(value).replace(/[^0-9]/g, '');
    return digits ? Number(digits) : 0;
  }

  function percent(value) {
    const n = Number(value || 0);
    return n > 0 ? `${n.toFixed(1)}%` : '-';
  }

  function discountRate(candidate) {
    const minBid = numberValue(candidate?.minBid);
    const appraisal = numberValue(candidate?.appraisal);
    return minBid && appraisal ? (minBid / appraisal) * 100 : 0;
  }

  function propertyTypes() {
    return window.__auctionPropertyTypes || null;
  }

  function loadJsonList(storage, key) {
    try {
      const parsed = JSON.parse(storage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveJsonList(storage, key, items, limit) {
    try {
      storage.setItem(key, JSON.stringify(items.slice(0, limit)));
    } catch (_) {}
  }

  function loadBulkState() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(BULK_STATE_KEY) || '{}');
      if (!parsed || typeof parsed !== 'object') return;
      state.inputText = String(parsed.inputText || '').slice(0, 3000);
      state.selectedCourt = clean(parsed.selectedCourt);
      state.rows = Array.isArray(parsed.rows) ? parsed.rows.slice(0, 10) : [];
      state.message = clean(parsed.message);
      state.propertyType = propertyTypes()?.normalize(clean(parsed.propertyType)) || 'all';
      state.restored = Boolean(state.inputText || state.rows.length);
    } catch (_) {}
  }

  function persistBulkState() {
    try {
      sessionStorage.setItem(BULK_STATE_KEY, JSON.stringify({
        inputText: state.inputText,
        selectedCourt: state.selectedCourt,
        rows: state.rows.slice(0, 10),
        message: state.message,
        propertyType: state.propertyType,
        savedAt: new Date().toISOString(),
      }));
    } catch (_) {}
  }

  function clearBulkState() {
    try {
      sessionStorage.removeItem(BULK_STATE_KEY);
    } catch (_) {}
  }

  function candidateKey(candidate) {
    return compact(candidate?.caseNo || 'unknown');
  }

  function findBulkPanel() {
    const panels = Array.from(document.querySelectorAll('.v2-panel'));
    return panels.find((panel) => panel.classList.contains('active') && panel.textContent.includes('여러 사건'))
      || panels.find((panel) => panel.textContent.includes('여러 사건'))
      || null;
  }

  async function loadCourts() {
    if (state.courts.length) return state.courts;
    const fallback = ['서울중앙지방법원', '서울동부지방법원', '서울서부지방법원', '서울남부지방법원', '서울북부지방법원', '수원지방법원', '인천지방법원', '대전지방법원', '천안지원', '청주지방법원', '부산지방법원', '대구지방법원', '광주지방법원', '전주지방법원', '제주지방법원'];
    try {
      const res = await fetch('/api/courts', { headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      const courts = Array.isArray(data.courts) ? data.courts.map((item) => clean(item.name || item)).filter(Boolean) : [];
      state.courts = courts.length ? courts : fallback;
    } catch (_) {
      state.courts = fallback;
    }
    if (!state.selectedCourt) state.selectedCourt = state.courts.includes('서울중앙지방법원') ? '서울중앙지방법원' : state.courts[0] || '';
    return state.courts;
  }

  function parseLine(line, defaultCourt) {
    const text = clean(line);
    if (!text) return null;
    const match = text.match(/(\d{4})\s*타경\s*(\d+)/) || text.match(/(\d{4})\D+(\d{1,10})$/);
    if (!match) return { raw: text, error: '사건번호 형식을 확인하세요.' };
    const year = match[1];
    const serial = match[2];
    const prefix = clean(text.slice(0, match.index));
    return {
      raw: text,
      court: prefix || defaultCourt,
      year,
      serial,
      key: `${prefix || defaultCourt}-${year}-${serial}`,
    };
  }

  function readFormState() {
    state.selectedCourt = clean(document.getElementById('v2BulkCourt')?.value) || state.selectedCourt || '서울중앙지방법원';
    state.inputText = String(document.getElementById('v2BulkCases')?.value || state.inputText || '').slice(0, 3000);
  }

  function parseInput() {
    readFormState();
    const defaultCourt = state.selectedCourt || '서울중앙지방법원';
    const lines = state.inputText.split(/\n+/).map(clean).filter(Boolean);
    const parsed = lines.map((line) => parseLine(line, defaultCourt)).filter(Boolean);
    const seen = new Set();
    return parsed.filter((item) => {
      if (item.error) return true;
      const key = item.key;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);
  }

  function courtOptions() {
    const courts = state.courts.length ? state.courts : ['서울중앙지방법원', '천안지원'];
    const selected = state.selectedCourt || '서울중앙지방법원';
    return courts.map((court) => `<option value="${esc(court)}" ${court === selected ? 'selected' : ''}>${esc(court)}</option>`).join('');
  }

  function rowCaseNo(row) {
    const basic = row?.raw?.basic || {};
    return clean(row?.raw?.caseNo || basic['사건번호'] || `${row?.year || ''}타경${row?.serial || ''}`);
  }

  function candidateFromRow(row) {
    const basic = row?.raw?.basic || {};
    const candidate = {
      caseNo: rowCaseNo(row),
      saleDate: clean(basic['매각기일']),
      usage: clean(basic['물건종별']),
      minBid: clean(basic['최저매각가격']),
      appraisal: clean(basic['감정평가액']),
      discount: '',
      failCount: clean(basic['유찰횟수']),
      reason: '일괄조회 성공 건',
      court: clean(row?.court || basic['법원']),
      source: '여러 사건 일괄조회',
    };
    candidate.discount = percent(discountRate(candidate));
    return candidate;
  }

  function saveTempCandidate(row) {
    const candidate = candidateFromRow(row);
    const key = candidateKey(candidate);
    if (!key || key === 'unknown') return false;
    const stack = loadJsonList(sessionStorage, STACK_KEY).filter((item) => candidateKey(item) !== key);
    saveJsonList(sessionStorage, STACK_KEY, [{ ...candidate, addedAt: new Date().toISOString() }, ...stack], 20);
    return true;
  }

  function savePermanentCandidate(row) {
    const candidate = candidateFromRow(row);
    const key = candidateKey(candidate);
    if (!key || key === 'unknown') return false;
    const saved = loadJsonList(localStorage, SAVED_KEY).filter((item) => candidateKey(item) !== key);
    saveJsonList(localStorage, SAVED_KEY, [{ ...candidate, savedAt: new Date().toISOString() }, ...saved], 50);
    return true;
  }

  function findRowByIndex(index) {
    const row = state.rows[Number(index)];
    return row?.ok ? row : null;
  }

  function visibleRows() {
    const indexed = state.rows.map((row, index) => ({ row, index }));
    if (state.propertyType === 'all' || !propertyTypes()) return indexed;
    return indexed.filter(({ row }) => row.ok && propertyTypes().matches(row, state.propertyType));
  }

  function renderRows(rows) {
    if (!state.rows.length) return '<p class="v2-note">아직 일괄조회 결과가 없습니다.</p>';
    if (!rows.length) return '<p class="v2-note">선택한 물건종류에 해당하는 일괄조회 성공 건이 없습니다.</p>';
    return `
      <div class="v2-detail-table-wrap">
        <table class="v2-detail-table">
          <thead><tr><th>상태</th><th>법원</th><th>사건번호</th><th>물건종별</th><th>소재지</th><th>최저가</th><th>매각기일</th><th>관리</th></tr></thead>
          <tbody>
            ${rows.map(({ row, index }) => {
              const basic = row.raw?.basic || {};
              const caseNo = rowCaseNo(row);
              return `
                <tr>
                  <td><span class="v2-pill ${row.ok ? 'no' : 'yes'}">${row.ok ? '성공' : '실패'}</span></td>
                  <td>${esc(row.court || '-')}</td>
                  <td>${esc(caseNo)}</td>
                  <td>${esc(basic['물건종별'] || '-')}</td>
                  <td>${esc(basic['소재지'] || row.error || '-')}</td>
                  <td>${esc(basic['최저매각가격'] || '-')}</td>
                  <td>${esc(basic['매각기일'] || '-')}</td>
                  <td>${row.ok ? `
                    <button type="button" class="v2-small-btn" data-bulk-action="open" data-index="${index}" data-court="${esc(row.court)}" data-year="${esc(row.year)}" data-serial="${esc(row.serial)}">단건조회</button>
                    <button type="button" class="v2-small-btn" data-bulk-action="temp" data-index="${index}">임시비교</button>
                    <button type="button" class="v2-small-btn" data-bulk-action="save" data-index="${index}">저장후보</button>
                  ` : '-'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderResults() {
    const okCount = state.rows.filter((row) => row.ok).length;
    const failCount = state.rows.filter((row) => !row.ok).length;
    const successfulRows = state.rows.filter((row) => row.ok);
    const displayRows = visibleRows();
    return `
      <section class="v2-card" id="${RESULT_ID}">
        <span class="v2-badge">일괄조회 결과</span>
        <h3>여러 사건 조회 결과</h3>
        <p class="v2-note">성공한 사건은 단건조회로 열거나 임시 비교 목록·저장 후보로 보낼 수 있습니다.</p>
        <div class="v2-grid compact">
          <div class="v2-info"><div class="k">성공</div><div class="v">${okCount}건</div></div>
          <div class="v2-info"><div class="k">실패</div><div class="v">${failCount}건</div></div>
          <div class="v2-info"><div class="k">상태</div><div class="v">${esc(state.running ? '조회 중' : '대기')}</div></div>
          <div class="v2-info"><div class="k">보존</div><div class="v">세션 저장</div></div>
        </div>
        ${successfulRows.length ? propertyTypes()?.render(successfulRows, state.propertyType, 'data-bulk-property-type') || '' : ''}
        ${renderRows(displayRows)}
      </section>
    `;
  }

  function renderCard() {
    return `
      <div class="v2-card" id="${CARD_ID}">
        <span class="v2-badge">일괄조회</span>
        <h3>여러 사건 일괄조회</h3>
        <p class="v2-note">한 줄에 하나씩 사건번호를 넣어 기본정보를 순차 조회합니다. 입력값과 결과는 현재 브라우저 세션에 보존됩니다.</p>
        <div class="v2-input-grid">
          <label class="v2-field"><span>기본 법원</span><select id="v2BulkCourt">${courtOptions()}</select></label>
          <label class="v2-field wide" style="grid-column:1/-1"><span>사건번호 목록</span><textarea id="v2BulkCases" rows="7" placeholder="예: 2024타경110754&#10;예: 천안지원 2024타경12345" style="width:100%; border:1px solid var(--line-2); border-radius:12px; padding:12px; font:inherit; resize:vertical;">${esc(state.inputText)}</textarea></label>
        </div>
        <div class="v2-cta-row">
          <button type="button" class="v2-btn" id="v2BulkRunBtn" ${state.running ? 'disabled' : ''}>${state.running ? '조회 중...' : '일괄조회 실행'}</button>
          <button type="button" class="v2-secondary-btn" id="v2BulkClearBtn" ${state.running ? 'disabled' : ''}>결과 초기화</button>
          <span class="v2-note">형식: 2024타경110754 또는 천안지원 2024타경12345</span>
        </div>
        ${state.restored ? '<p class="v2-note">이전 일괄조회 입력/결과를 복원했습니다.</p>' : ''}
        ${state.message ? `<div class="v2-form-message show warn">${esc(state.message)}</div>` : ''}
      </div>
      ${renderResults()}
    `;
  }

  function upsert() {
    if (activeTab() !== 'bulk') return;
    const panel = findBulkPanel();
    if (!panel) return;
    const input = document.getElementById('v2BulkCases');
    const court = document.getElementById('v2BulkCourt');
    if (input) state.inputText = String(input.value || '').slice(0, 3000);
    if (court) state.selectedCourt = clean(court.value);
    panel.innerHTML = renderCard();
    bindEvents();
    state.rendered = true;
  }

  async function runBulk() {
    if (state.running) return;
    const items = parseInput();
    if (!items.length) {
      state.message = '조회할 사건번호를 한 줄 이상 입력하세요.';
      persistBulkState();
      upsert();
      return;
    }
    state.running = true;
    state.message = '';
    state.rows = [];
    state.propertyType = 'all';
    persistBulkState();
    upsert();

    for (const item of items) {
      if (item.error) {
        state.rows.push({ ok: false, court: item.court || '-', year: '', serial: '', error: item.error });
        persistBulkState();
        upsert();
        continue;
      }
      try {
        const res = await fetch('/api/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jiwonNm: item.court, saYear: item.year, saSer: item.serial }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || '조회 실패');
        state.rows.push({ ok: true, court: item.court, year: item.year, serial: item.serial, raw: data.raw, elapsed: data.elapsed || '' });
      } catch (error) {
        state.rows.push({ ok: false, court: item.court, year: item.year, serial: item.serial, error: clean(error.message || String(error)) });
      }
      persistBulkState();
      upsert();
    }

    state.running = false;
    state.restored = false;
    persistBulkState();
    upsert();
  }

  function openSingle(button) {
    document.querySelector('[data-tab="search"]')?.click?.();
    setTimeout(() => {
      const court = document.getElementById('jiwonNmV2');
      const year = document.getElementById('saYearV2');
      const serial = document.getElementById('saSerV2');
      if (court && button.dataset.court) court.value = button.dataset.court;
      if (year) year.value = button.dataset.year || '';
      if (serial) {
        serial.value = button.dataset.serial || '';
        serial.focus();
      }
    }, 80);
  }

  function handleCandidateAction(button) {
    const row = findRowByIndex(button.dataset.index);
    if (!row) return;
    if (button.dataset.bulkAction === 'temp') {
      state.message = saveTempCandidate(row) ? '임시 비교 목록에 추가했습니다.' : '임시 비교 목록 추가에 실패했습니다.';
    }
    if (button.dataset.bulkAction === 'save') {
      state.message = savePermanentCandidate(row) ? '저장 후보에 추가했습니다.' : '저장 후보 추가에 실패했습니다.';
    }
    persistBulkState();
    upsert();
  }

  function syncFormPersistence() {
    readFormState();
    state.message = '';
    state.restored = false;
    persistBulkState();
  }

  function bindEvents() {
    const run = document.getElementById('v2BulkRunBtn');
    const clear = document.getElementById('v2BulkClearBtn');
    const input = document.getElementById('v2BulkCases');
    const court = document.getElementById('v2BulkCourt');
    if (run && !run.dataset.bound) {
      run.dataset.bound = '1';
      run.addEventListener('click', runBulk);
    }
    if (clear && !clear.dataset.bound) {
      clear.dataset.bound = '1';
      clear.addEventListener('click', () => {
        state.rows = [];
        state.message = '';
        state.inputText = '';
        state.restored = false;
        state.propertyType = 'all';
        clearBulkState();
        upsert();
      });
    }
    if (input && !input.dataset.bound) {
      input.dataset.bound = '1';
      input.addEventListener('input', syncFormPersistence);
    }
    if (court && !court.dataset.bound) {
      court.dataset.bound = '1';
      court.addEventListener('change', syncFormPersistence);
    }
    document.querySelectorAll('[data-bulk-action]').forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', () => {
        if (button.dataset.bulkAction === 'open') openSingle(button);
        if (button.dataset.bulkAction === 'temp' || button.dataset.bulkAction === 'save') handleCandidateAction(button);
      });
    });
    document.querySelectorAll('[data-bulk-property-type]').forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', () => {
        state.propertyType = button.dataset.bulkPropertyType || 'all';
        persistBulkState();
        upsert();
      });
    });
  }

  async function boot() {
    loadBulkState();
    await loadCourts();
    setInterval(upsert, 700);
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
