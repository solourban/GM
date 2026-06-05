(() => {
  const SHELL_ID = 'v2WorkflowShell';
  const SUMMARY_ID = 'v2CaseSummaryBar';
  const TABS_ID = 'v2WorkflowTabs';
  const BODY_ID = 'v2WorkflowBody';
  const PREV_ID = 'v2WorkflowPrevBtn';
  const NEXT_ID = 'v2WorkflowNextBtn';
  const EMPTY_ID = 'v2WorkflowEmptyState';
  const HIDDEN_CLASS = 'v2-workflow-card-hidden';

  const STEPS = [
    { id: 'basic', label: '기본정보', wrapperId: 'v2StepBasic', anchors: ['resultsSection'] },
    { id: 'input', label: '내역입력', wrapperId: 'v2StepInput', anchors: ['step2InputCard', 'v2SpecExtractorMount'] },
    { id: 'market', label: '시세/입지', wrapperId: 'v2StepMarket', anchors: ['v2LocationCard', 'v2MolitTradeCard'] },
    { id: 'risk', label: '리스크', wrapperId: 'v2StepRisk', anchors: ['analysisCard', 'v2RiskBriefCard', 'v2EssentialDocumentsCard', 'v2ExternalVerificationCard'] },
    { id: 'bid', label: '입찰가', wrapperId: 'v2StepBid', anchors: ['v2BidRangeCard', 'v2FundingReviewCard', 'v2BidPlanCard'] },
    { id: 'judgment', label: '최종판단', wrapperId: 'v2StepJudgment', anchors: ['v2FinalJudgmentCard', 'v2DecisionConfidenceCard'] },
    { id: 'save', label: '저장/복사', wrapperId: 'v2StepSave', anchors: ['v2CopySummaryCard', 'v2FinalCopyCard'] },
  ];

  const CARD_STEP_BY_ID = {
    v2DateSourceCard: 'basic',
    step2InputCard: 'input',
    v2LocationCard: 'market',
    v2MolitTradeCard: 'market',
    analysisCard: 'risk',
    allocationExplainCard: 'risk',
    v2RiskBriefCard: 'risk',
    v2EssentialDocumentsCard: 'risk',
    v2ExternalVerificationCard: 'risk',
    v2PreBidChecklistCard: 'risk',
    v2BiddingSummaryCard: 'bid',
    v2BidRangeCard: 'bid',
    v2FundingReviewCard: 'bid',
    v2BidPlanCard: 'bid',
    v2FinalJudgmentCard: 'judgment',
    v2DecisionConfidenceCard: 'judgment',
    v2CaseSyncStatusCard: 'judgment',
    v2CopySummaryCard: 'save',
    v2FinalCopyCard: 'save',
  };

  let activeStep = 'basic';
  let syncFrame = 0;

  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));
  }

  function appState() {
    return window.__auctionV2?.state || null;
  }

  function root() {
    return document.getElementById('resultsSection');
  }

  function shell() {
    return document.getElementById(SHELL_ID);
  }

  function emptyState() {
    return document.getElementById(EMPTY_ID);
  }

  function hasCase() {
    const state = appState();
    return Boolean(state?.raw || document.getElementById('step2InputCard') || document.getElementById('analysisCard'));
  }

  function firstRealCard() {
    return Array.from(root()?.children || []).find((node) => node.id !== SHELL_ID && node.classList?.contains('v2-result-card')) || root();
  }

  function isResultCard(node) {
    return Boolean(
      node
      && node.nodeType === 1
      && node.id !== SHELL_ID
      && node.id !== EMPTY_ID
      && (node.classList?.contains('v2-result-card') || node.classList?.contains('v2-card'))
    );
  }

  function resultCards() {
    return Array.from(root()?.children || []).filter(isResultCard);
  }

  function stepExists(stepId) {
    return STEPS.some((step) => step.id === stepId);
  }

  function stepForCard(card) {
    if (!card || card.id === SHELL_ID) return '';
    const explicit = clean(card.dataset.workflowStep);
    if (stepExists(explicit)) return explicit;
    if (CARD_STEP_BY_ID[card.id]) return CARD_STEP_BY_ID[card.id];
    if (!card.id) return 'basic';
    return '';
  }

  function classifyCard(card) {
    const step = stepForCard(card);
    if (!step) {
      delete card.dataset.workflowManaged;
      return '';
    }
    card.dataset.workflowManaged = '1';
    card.dataset.workflowStep = step;
    return step;
  }

  function classifyCards() {
    resultCards().forEach(classifyCard);
  }

  function setCardVisibility(card, step = stepForCard(card)) {
    if (!step) {
      card.hidden = false;
      card.classList.remove(HIDDEN_CLASS);
      card.removeAttribute('aria-hidden');
      return;
    }
    const isVisible = step === activeStep;
    card.hidden = !isVisible;
    card.classList.toggle(HIDDEN_CLASS, !isVisible);
    if (isVisible) card.removeAttribute('aria-hidden');
    else card.setAttribute('aria-hidden', 'true');
  }

  function applyStepVisibility() {
    resultCards().forEach((card) => {
      setCardVisibility(card);
    });
  }

  function syncEmptyState() {
    const card = shell();
    const existing = emptyState();
    const step = stepById(activeStep);
    if (!card || !hasCase() || activeStep === 'basic' || activeCards().length) {
      existing?.remove();
      return;
    }

    const placeholder = existing || document.createElement('section');
    placeholder.id = EMPTY_ID;
    placeholder.className = 'v2-result-card v2-workflow-empty-state';
    placeholder.dataset.workflowEmptyState = activeStep;
    placeholder.innerHTML = renderEmptyState(step);

    if (!existing || placeholder.previousElementSibling !== card) {
      card.insertAdjacentElement('afterend', placeholder);
    }
  }

  function addedCards(records) {
    const cards = [];
    Array.from(records || []).forEach((record) => {
      Array.from(record.addedNodes || []).forEach((node) => {
        if (isResultCard(node)) cards.push(node);
      });
    });
    return cards;
  }

  function primeAddedCards(records) {
    addedCards(records).forEach((card) => {
      const step = classifyCard(card);
      setCardVisibility(card, step);
    });
  }

  function anchorFor(step) {
    if (step.id === 'basic') return firstRealCard();
    for (const id of step.anchors) {
      const found = document.getElementById(id);
      if (found) return found;
    }
    return null;
  }

  function stepById(id) {
    return STEPS.find((step) => step.id === id) || STEPS[0];
  }

  function stepIndex(id) {
    return Math.max(0, STEPS.findIndex((step) => step.id === id));
  }

  function activeCards() {
    return resultCards().filter((card) => stepForCard(card) === activeStep);
  }

  function emptyCopy(step) {
    const copy = {
      input: {
        title: '내역 입력을 시작할 준비가 필요합니다',
        note: '기본정보 카드에서 다음 단계 버튼을 눌러 명세서·권리 입력 카드를 열어 주세요.',
      },
      market: {
        title: '시세·입지 참고정보를 기다리는 중입니다',
        note: '주소 좌표와 실거래가 참고지표는 기본정보 조회 후 자동으로 표시됩니다. 주소가 없거나 연동 설정이 없으면 이 단계가 비어 있을 수 있습니다.',
      },
      risk: {
        title: '리스크 검토 카드가 아직 없습니다',
        note: '내역입력 단계에서 권리분석을 실행하면 권리분석, 필수 문서 확인, 외부검증 카드가 이 단계에 표시됩니다.',
      },
      bid: {
        title: '입찰가 검토 카드가 아직 없습니다',
        note: '권리분석 결과가 준비되면 검토 범위, 필요자금, 입찰 계획 카드가 이 단계에 표시됩니다.',
      },
      judgment: {
        title: '최종판단 카드가 아직 없습니다',
        note: '시세·입지와 리스크 검토가 준비되면 최종 판단과 신뢰도 카드가 이 단계에 표시됩니다.',
      },
      save: {
        title: '저장·복사할 요약이 아직 없습니다',
        note: '최종판단과 복사용 판단 메모가 준비되면 이 단계에서 확인할 수 있습니다.',
      },
    };
    return copy[step.id] || {
      title: `${step.label} 단계에 표시할 카드가 아직 없습니다`,
      note: '앞 단계의 조회나 분석이 끝나면 이 단계에 관련 카드가 표시됩니다.',
    };
  }

  function renderEmptyState(step) {
    const copy = emptyCopy(step);
    return `
      <span class="v2-badge">대기 중</span>
      <h3>${esc(copy.title)}</h3>
      <p class="v2-note">${esc(copy.note)}</p>
    `;
  }

  function valueFromBasic(keys, rawKeys = []) {
    const raw = appState()?.raw || {};
    const basic = raw.basic || {};
    for (const key of keys) {
      const value = clean(basic[key]);
      if (value) return value;
    }
    for (const key of rawKeys) {
      const value = clean(raw[key]);
      if (value) return value;
    }
    return '-';
  }

  function summaryData() {
    return [
      { label: '법원', value: valueFromBasic(['법원', '법원명'], ['court', 'requestedCourt']) },
      { label: '사건', value: valueFromBasic(['사건번호', '사건'], ['caseNo']) },
      { label: '매각기일', value: valueFromBasic(['매각기일', '기일']) },
      { label: '최저가', value: valueFromBasic(['최저매각가격', '최저가']) },
      { label: '물건종별', value: valueFromBasic(['물건종별', '용도']) },
      { label: '감정가', value: valueFromBasic(['감정평가액', '감정가']) },
      { label: '유찰', value: valueFromBasic(['유찰횟수']) },
      { label: '소재지', value: valueFromBasic(['소재지', '주소']), className: 'wide' },
    ];
  }

  function renderSummaryItem(item) {
    const value = clean(item.value) || '-';
    const classAttr = item.className ? ` class="${esc(item.className)}"` : '';
    return `<div${classAttr} title="${esc(value)}"><span>${esc(item.label)}</span><strong>${esc(value)}</strong></div>`;
  }

  function renderSummary() {
    return `<div id="${SUMMARY_ID}" class="v2-workflow-summary">${summaryData().map(renderSummaryItem).join('')}</div>`;
  }

  function renderTabs() {
    return `
      <div id="${TABS_ID}" class="v2-workflow-tabs" role="tablist" aria-label="검토 단계">
        ${STEPS.map((step) => {
          const available = hasCase() || Boolean(anchorFor(step));
          const active = step.id === activeStep;
          return `<button type="button" role="tab" class="v2-workflow-tab${active ? ' active' : ''}" data-workflow-step="${esc(step.id)}" aria-selected="${active ? 'true' : 'false'}" ${available ? '' : 'aria-disabled="true"'}>${esc(step.label)}</button>`;
        }).join('')}
      </div>
    `;
  }

  function renderStepAnchors() {
    return `
      <div id="${BODY_ID}" class="v2-workflow-body" aria-hidden="true">
        ${STEPS.map((step) => `<span id="${step.wrapperId}" data-workflow-wrapper="${step.id}"></span>`).join('')}
      </div>
    `;
  }

  function renderControls() {
    const index = stepIndex(activeStep);
    return `
      <div class="v2-workflow-controls">
        <button type="button" class="v2-secondary-btn" id="${PREV_ID}" ${index <= 0 ? 'disabled' : ''}>이전 단계</button>
        <button type="button" class="v2-btn" id="${NEXT_ID}" ${index >= STEPS.length - 1 ? 'disabled' : ''}>다음 단계</button>
      </div>
    `;
  }

  function renderShell() {
    return `
      ${renderSummary()}
      ${renderTabs()}
      ${renderStepAnchors()}
      ${renderControls()}
    `;
  }

  function injectStyles() {
    if (document.getElementById('v2WorkflowShellStyles')) return;
    const style = document.createElement('style');
    style.id = 'v2WorkflowShellStyles';
    style.textContent = `
      .v2-workflow-shell { position:sticky; top:88px; z-index:8; margin-bottom:16px; padding:16px; border:1px solid var(--line); border-radius:8px; background:rgba(255,255,255,.96); box-shadow:var(--shadow-sm); }
      .v2-workflow-summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-bottom:12px; }
      .v2-workflow-summary div { min-width:0; padding:10px 12px; border:1px solid var(--line); border-radius:8px; background:var(--surface); }
      .v2-workflow-summary .wide { grid-column:span 2; }
      .v2-workflow-summary span { display:block; margin-bottom:4px; color:var(--muted); font-size:12px; }
      .v2-workflow-summary strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14px; }
      .v2-workflow-tabs { display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; }
      .v2-workflow-tab { flex:0 0 auto; border:1px solid var(--line-2); border-radius:999px; background:#fff; padding:9px 12px; color:var(--text); font:inherit; font-weight:800; cursor:pointer; }
      .v2-workflow-tab.active { border-color:var(--primary); background:var(--primary); color:#fff; }
      .v2-workflow-tab[aria-disabled="true"] { opacity:.48; }
      .v2-workflow-body { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
      .${HIDDEN_CLASS} { display:none !important; }
      .v2-workflow-empty-state { margin-top:-4px; border-style:dashed; background:var(--surface); }
      .v2-workflow-controls { display:flex; justify-content:space-between; gap:10px; margin-top:12px; }
      .v2-workflow-controls button { min-width:118px; }
      @media (max-width: 760px) {
        .v2-workflow-shell { position:relative; top:auto; padding:12px; }
        .v2-workflow-summary { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .v2-workflow-controls button { min-width:0; flex:1; }
      }
      @media (max-width: 520px) {
        .v2-workflow-summary { grid-template-columns:1fr; }
        .v2-workflow-summary .wide { grid-column:auto; }
      }
    `;
    document.head.appendChild(style);
  }

  function bindShell(card) {
    if (card.dataset.bound === '1') return;
    card.dataset.bound = '1';
    card.addEventListener('click', (event) => {
      const stepButton = event.target.closest('[data-workflow-step]');
      if (stepButton) {
        moveTo(stepButton.dataset.workflowStep);
        return;
      }
      if (event.target.id === PREV_ID) moveBy(-1);
      if (event.target.id === NEXT_ID) moveBy(1);
    });
  }

  function applyShell() {
    syncFrame = 0;
    const resultRoot = root();
    if (!resultRoot) return;
    if (!hasCase()) {
      shell()?.remove();
      emptyState()?.remove();
      resultCards().forEach((card) => {
        card.hidden = false;
        card.classList.remove(HIDDEN_CLASS);
        card.removeAttribute('aria-hidden');
      });
      return;
    }

    injectStyles();
    let card = shell();
    if (!card) {
      card = document.createElement('section');
      card.id = SHELL_ID;
      card.className = 'v2-result-card v2-workflow-shell';
      resultRoot.insertBefore(card, resultRoot.firstChild || null);
    } else if (card.parentNode !== resultRoot) {
      resultRoot.insertBefore(card, resultRoot.firstChild || null);
    } else if (card !== resultRoot.firstElementChild) {
      resultRoot.insertBefore(card, resultRoot.firstChild || null);
    }

    classifyCards();
    if (!stepById(activeStep)) activeStep = 'basic';
    card.innerHTML = renderShell();
    bindShell(card);
    applyStepVisibility();
    syncEmptyState();
  }

  function syncShell(options = {}) {
    if (options.immediate) {
      if (syncFrame) {
        window.cancelAnimationFrame(syncFrame);
        syncFrame = 0;
      }
      applyShell();
      return;
    }
    if (syncFrame) return;
    syncFrame = window.requestAnimationFrame(applyShell);
  }

  function moveTo(stepId) {
    const step = stepById(stepId);
    activeStep = step.id;
    syncShell({ immediate: true });
    const target = anchorFor(step) || emptyState() || shell();
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function moveBy(offset) {
    const next = STEPS[stepIndex(activeStep) + offset];
    if (next) moveTo(next.id);
  }

  function observe() {
    const resultRoot = root();
    if (!resultRoot || resultRoot.dataset.workflowObserved === '1' || !window.MutationObserver) return;
    resultRoot.dataset.workflowObserved = '1';
    const observer = new MutationObserver((records) => {
      primeAddedCards(records);
      syncShell({ immediate: true });
    });
    observer.observe(resultRoot, { childList: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    observe();
    syncShell();
  });
  document.addEventListener('auction:result-card-change', () => syncShell({ immediate: true }));
  window.__auctionWorkflowShell = {
    STEPS: [...STEPS],
    CARD_STEP_BY_ID: { ...CARD_STEP_BY_ID },
    sync: syncShell,
    moveTo,
    activeStep: () => activeStep,
    emptyStateId: EMPTY_ID,
    summarySnapshot: () => summaryData().reduce((acc, item) => ({ ...acc, [item.label]: clean(item.value) || '-' }), {}),
    visibleCardIds: () => resultCards().filter((card) => !card.hidden).map((card) => card.id || '(basic)'),
  };
})();
