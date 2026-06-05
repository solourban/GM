(() => {
  const CARD_ID = 'v2ExternalVerificationCard';
  const STYLE_ID = 'v2ExternalVerificationStyles';
  const STORAGE_PREFIX = 'auction-note:v2:external-verification:';
  const CHANGE_EVENT = 'auction:result-card-change';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const ITEMS = [
    { id: 'community', title: '지역 분위기·단지 평판', source: '호갱노노 등', guide: '소음, 악취, 언덕, 주차, 하자, 동·라인 이슈가 반복 언급되는지 확인' },
    { id: 'supply', title: '입주물량·공급 부담', source: '아실 등', guide: '향후 입주물량, 주변 신축 공급, 전세·매매 공급 부담 확인' },
    { id: 'management', title: '관리비·주차·공용관리', source: 'K-apt 등', guide: '세대당 주차대수, 공용관리비, 장기수선충당금, 관리비 과다 여부 확인' },
    { id: 'finance', title: '금융권 시세·대출 기준', source: 'KB부동산 등', guide: 'KB시세 존재 여부, 일반평균가·하위평균가, 현금+대출 가능 범위 확인' },
    { id: 'listing', title: '현재 매물·호가·등록기간', source: '네이버 부동산 등', guide: '같은 단지·평형 현재 호가, 최초 등록일, 가격 변경 여부 확인' },
  ];

  function state() { return window.__auctionV2?.state || null; }
  function report() { return state()?.report || null; }

  function caseKey(currentReport = report()) {
    const court = clean(currentReport?.court || currentReport?.raw?.court || '');
    const caseNo = clean(currentReport?.case || currentReport?.caseNo || '');
    return [court, caseNo].filter(Boolean).join(':') || 'unknown';
  }

  function storageKey(currentReport = report()) { return `${STORAGE_PREFIX}${caseKey(currentReport)}`; }

  function defaultState() {
    return {
      checks: Object.fromEntries(ITEMS.map((item) => [item.id, false])),
      memos: Object.fromEntries(ITEMS.map((item) => [item.id, ''])),
    };
  }

  function loadChecklist(currentReport = report()) {
    const base = defaultState();
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey(currentReport)) || 'null') || {};
      return {
        ...base,
        ...parsed,
        checks: { ...base.checks, ...(parsed.checks || {}) },
        memos: { ...base.memos, ...(parsed.memos || {}) },
      };
    } catch (_) { return base; }
  }

  function saveChecklist(payload, currentReport = report()) {
    try { localStorage.setItem(storageKey(currentReport), JSON.stringify({ ...payload, savedAt: new Date().toISOString() })); } catch (_) {}
  }

  function checkedCount(payload = loadChecklist()) { return ITEMS.filter((item) => Boolean(payload.checks?.[item.id])).length; }
  function statusTone(count) { if (count >= 5) return 'ok'; if (count >= 3) return 'warn'; return 'danger'; }
  function statusText(count) {
    if (count >= 5) return '외부 검증 5대 항목이 모두 확인되었습니다.';
    if (count >= 3) return '외부 검증 일부가 확인되었습니다. 미확인 항목 보완 후 입찰가를 정하세요.';
    return '외부 검증이 부족합니다. 권리분석 결과만으로 입찰가를 정하지 마세요.';
  }

  function anchor() {
    return document.getElementById('v2EssentialDocumentsCard')
      || document.getElementById('v2RiskBriefCard')
      || document.getElementById('analysisCard')
      || document.getElementById('v2BiddingSummaryCard')
      || document.getElementById('v2FinalJudgmentCard')
      || document.getElementById('v2MolitTradeCard')
      || document.getElementById('v2LocationCard')
      || null;
  }

  function signature(currentReport = report(), payload = loadChecklist(currentReport)) {
    return `${caseKey(currentReport)}:${ITEMS.map((item) => `${item.id}:${payload.checks?.[item.id] ? 1 : 0}:${clean(payload.memos?.[item.id]).length}`).join('|')}`;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .v2-external-checklist-card .v2-note { max-width:760px; }
      .v2-external-list { display:grid; gap:10px; margin-top:14px; }
      .v2-external-row { display:grid; grid-template-columns:minmax(150px,.75fr) minmax(0,1.3fr) minmax(190px,.9fr); gap:12px; align-items:center; padding:12px; border:1px solid var(--line); border-radius:12px; background:var(--bg); }
      .v2-external-check { display:flex; align-items:center; gap:8px; font-weight:900; }
      .v2-external-check input { width:18px; height:18px; accent-color:var(--accent); }
      .v2-external-row strong, .v2-external-row span { display:block; }
      .v2-external-row span { margin-top:4px; color:var(--ink-3); font-size:12px; line-height:1.45; }
      .v2-external-row p { margin:0; color:var(--ink-2); font-size:13px; line-height:1.55; }
      .v2-external-row .v2-input { width:100%; }
      @media (max-width: 780px) {
        .v2-external-row { grid-template-columns:1fr; align-items:start; }
      }
    `;
    document.head.appendChild(style);
  }

  function renderChecklistRows(data) {
    return `
      <div class="v2-external-list">
        ${ITEMS.map((item) => `
          <div class="v2-external-row" data-external-item="${esc(item.id)}">
            <label class="v2-external-check">
              <input type="checkbox" data-external-check="${esc(item.id)}" ${data.checks?.[item.id] ? 'checked' : ''} aria-label="${esc(item.title)} 확인">
              <span>${esc(item.title)}</span>
            </label>
            <p>${esc(item.guide)}<span>${esc(item.source)}</span></p>
            <input class="v2-input" type="text" data-external-memo="${esc(item.id)}" value="${esc(data.memos?.[item.id] || '')}" placeholder="확인 결과 메모">
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderCardHtml(data = loadChecklist()) {
    const count = checkedCount(data);
    const tone = statusTone(count);
    return `
      <span class="v2-badge">외부 검증</span>
      <h3>외부 검증 체크리스트</h3>
      <p class="v2-note">권리분석과 필수 문서 확인 뒤, 시세·현장성·대출 기준을 따로 기록합니다. 아래 항목은 자동 확정값이 아니라 확인 기록입니다.</p>
      <div class="v2-grid compact">
        <div class="v2-info"><div class="k">확인 상태</div><div class="v"><span class="v2-pill ${tone}" data-external-count>${count}/5</span></div></div>
        <div class="v2-info wide"><div class="k">판단 안내</div><div class="v" data-external-status>${esc(statusText(count))}</div></div>
      </div>
      ${renderChecklistRows(data)}
      <p class="v2-note">확인처의 댓글·호가·통계는 참고자료입니다. 최종 입찰 판단은 등기부, 매각물건명세서, 점유관계, 현장조사, 대출 가능액을 함께 봐야 합니다.</p>
    `;
  }

  function updateCardStatus(payload = loadChecklist()) {
    const count = checkedCount(payload);
    const tone = statusTone(count);
    const countNode = document.querySelector(`#${CARD_ID} [data-external-count]`);
    const statusNode = document.querySelector(`#${CARD_ID} [data-external-status]`);
    if (countNode) {
      countNode.textContent = `${count}/5`;
      countNode.className = `v2-pill ${tone}`;
    }
    if (statusNode) statusNode.textContent = statusText(count);
  }

  function removeFinalJudgmentStatus() {
    document.getElementById('v2ExternalVerificationFinalStatus')?.remove();
  }

  function notifyResultChange() {
    document.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { id: CARD_ID } }));
    window.__auctionResultOrder?.schedule?.(CARD_ID);
  }

  function upsertCard() {
    const currentReport = report();
    const target = anchor();
    const existing = document.getElementById(CARD_ID);
    removeFinalJudgmentStatus();
    if (!currentReport) {
      existing?.remove();
      return;
    }
    if (!target) return;

    const data = loadChecklist(currentReport);
    const nextSignature = signature(currentReport, data);
    injectStyles();
    let card = existing;
    if (!card) {
      card = document.createElement('section');
      card.id = CARD_ID;
      card.className = 'v2-result-card v2-external-checklist-card';
      card.dataset.workflowStep = 'risk';
      card.innerHTML = renderCardHtml(data);
      card.dataset.caseKey = caseKey(currentReport);
      card.dataset.signature = nextSignature;
      target.insertAdjacentElement('afterend', card);
      notifyResultChange();
    } else if (card.dataset.caseKey !== caseKey(currentReport)) {
      card.className = 'v2-result-card v2-external-checklist-card';
      card.dataset.workflowStep = 'risk';
      card.innerHTML = renderCardHtml(data);
      card.dataset.caseKey = caseKey(currentReport);
      card.dataset.signature = nextSignature;
      notifyResultChange();
    } else {
      card.className = 'v2-result-card v2-external-checklist-card';
      card.dataset.workflowStep = 'risk';
      updateCardStatus(data);
    }
  }

  function updateFromDom() {
    const currentReport = report();
    if (!currentReport) return;
    const data = loadChecklist(currentReport);
    document.querySelectorAll(`#${CARD_ID} [data-external-check]`).forEach((input) => {
      data.checks[input.dataset.externalCheck] = Boolean(input.checked);
    });
    document.querySelectorAll(`#${CARD_ID} [data-external-memo]`).forEach((input) => {
      data.memos[input.dataset.externalMemo] = clean(input.value);
    });
    saveChecklist(data, currentReport);
    const card = document.getElementById(CARD_ID);
    if (card) card.dataset.signature = signature(currentReport, data);
    updateCardStatus(data);
    removeFinalJudgmentStatus();
  }

  document.addEventListener('change', (event) => { if (event.target.closest?.(`#${CARD_ID}`)) updateFromDom(); });
  document.addEventListener('input', (event) => { if (event.target.closest?.(`#${CARD_ID}`)) updateFromDom(); });

  let upsertTimer = 0;

  function scheduleUpsert(delay = 0) {
    window.clearTimeout(upsertTimer);
    upsertTimer = window.setTimeout(() => {
      if (window.__auctionResultOrder?.isUserScrolling?.()) {
        scheduleUpsert(220);
        return;
      }
      upsertCard();
    }, delay);
  }

  function observeResults() {
    const root = document.getElementById('resultsSection');
    if (!root || !window.MutationObserver) return;
    const observer = new MutationObserver(() => scheduleUpsert(0));
    observer.observe(root, { childList: true });
  }

  observeResults();
  document.addEventListener('DOMContentLoaded', () => scheduleUpsert(0));
  scheduleUpsert(0);
  window.__auctionExternalChecklist = { loadChecklist, checkedCount, upsertCard, scheduleUpsert };
})();
