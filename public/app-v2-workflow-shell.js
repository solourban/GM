(() => {
  const SHELL_ID = 'v2WorkflowShell';
  const SUMMARY_ID = 'v2CaseSummaryBar';
  const TABS_ID = 'v2WorkflowTabs';
  const BODY_ID = 'v2WorkflowBody';
  const PREV_ID = 'v2WorkflowPrevBtn';
  const NEXT_ID = 'v2WorkflowNextBtn';

  const STEPS = [
    { id: 'basic', label: '기본정보', wrapperId: 'v2StepBasic', anchors: ['resultsSection'] },
    { id: 'input', label: '내역입력', wrapperId: 'v2StepInput', anchors: ['step2InputCard', 'v2SpecExtractorMount'] },
    { id: 'market', label: '시세/입지', wrapperId: 'v2StepMarket', anchors: ['v2LocationCard', 'v2MolitTradeCard'] },
    { id: 'risk', label: '리스크', wrapperId: 'v2StepRisk', anchors: ['analysisCard', 'v2RiskBriefCard', 'v2EssentialDocumentsCard', 'v2ExternalVerificationCard'] },
    { id: 'bid', label: '입찰가', wrapperId: 'v2StepBid', anchors: ['v2BidRangeCard', 'v2FundingReviewCard', 'v2BidPlanCard'] },
    { id: 'judgment', label: '최종판단', wrapperId: 'v2StepJudgment', anchors: ['v2FinalJudgmentCard', 'v2DecisionConfidenceCard'] },
    { id: 'save', label: '저장/복사', wrapperId: 'v2StepSave', anchors: ['v2CopySummaryCard', 'v2FinalCopyCard'] },
  ];

  let activeStep = 'basic';
  let syncing = false;

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

  function hasCase() {
    const state = appState();
    return Boolean(state?.raw || document.getElementById('step2InputCard') || document.getElementById('analysisCard'));
  }

  function firstRealCard() {
    return Array.from(root()?.children || []).find((node) => node.id !== SHELL_ID && node.classList?.contains('v2-result-card')) || root();
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

  function valueFromBasic(keys) {
    const basic = appState()?.raw?.basic || {};
    for (const key of keys) {
      const value = clean(basic[key]);
      if (value) return value;
    }
    return '-';
  }

  function renderSummary() {
    return `
      <div id="${SUMMARY_ID}" class="v2-workflow-summary">
        <div><span>법원</span><strong>${esc(valueFromBasic(['법원', '법원명']))}</strong></div>
        <div><span>사건</span><strong>${esc(valueFromBasic(['사건번호', '사건']))}</strong></div>
        <div><span>매각기일</span><strong>${esc(valueFromBasic(['매각기일', '기일']))}</strong></div>
        <div><span>최저가</span><strong>${esc(valueFromBasic(['최저매각가격', '최저가']))}</strong></div>
      </div>
    `;
  }

  function renderTabs() {
    return `
      <div id="${TABS_ID}" class="v2-workflow-tabs" role="tablist" aria-label="검토 단계">
        ${STEPS.map((step) => {
          const available = Boolean(anchorFor(step));
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
      .v2-workflow-summary span { display:block; margin-bottom:4px; color:var(--muted); font-size:12px; }
      .v2-workflow-summary strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14px; }
      .v2-workflow-tabs { display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; }
      .v2-workflow-tab { flex:0 0 auto; border:1px solid var(--line-2); border-radius:999px; background:#fff; padding:9px 12px; color:var(--text); font:inherit; font-weight:800; cursor:pointer; }
      .v2-workflow-tab.active { border-color:var(--primary); background:var(--primary); color:#fff; }
      .v2-workflow-tab[aria-disabled="true"] { opacity:.48; }
      .v2-workflow-body { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
      .v2-workflow-controls { display:flex; justify-content:space-between; gap:10px; margin-top:12px; }
      .v2-workflow-controls button { min-width:118px; }
      @media (max-width: 760px) {
        .v2-workflow-shell { position:relative; top:auto; padding:12px; }
        .v2-workflow-summary { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .v2-workflow-controls button { min-width:0; flex:1; }
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

  function syncShell() {
    if (syncing) return;
    syncing = true;
    window.requestAnimationFrame(() => {
      syncing = false;
      const resultRoot = root();
      if (!resultRoot) return;
      if (!hasCase()) {
        shell()?.remove();
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

      if (!stepById(activeStep) || !anchorFor(stepById(activeStep))) activeStep = 'basic';
      card.innerHTML = renderShell();
      bindShell(card);
    });
  }

  function moveTo(stepId) {
    const step = stepById(stepId);
    const target = anchorFor(step);
    activeStep = step.id;
    syncShell();
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
    const observer = new MutationObserver(syncShell);
    observer.observe(resultRoot, { childList: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    observe();
    syncShell();
  });
  document.addEventListener('auction:result-card-change', syncShell);
  window.__auctionWorkflowShell = { STEPS: [...STEPS], sync: syncShell, moveTo };
})();
