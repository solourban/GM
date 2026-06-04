(() => {
  const FEATURE_CARD_IDS = [
    'v2CandidateStackCard',
    'v2CandidateRankingCard',
    'v2SavedCandidateCard',
    'v2SavedTopFiveCard',
    'v2SavedTabRuntimeCard',
    'v2ServiceStatusCard',
  ];
  const DATE_CARD_IDS = ['v2CandidateStackCard', 'v2CandidateRankingCard'];
  const SAVED_CARD_IDS = ['v2SavedCandidateCard', 'v2SavedTopFiveCard', 'v2SavedTabRuntimeCard'];
  const RESET_NOTICE_ID = 'v2NextStepCaseResetNotice';
  const SERVICE_TOGGLE_ID = 'v2ServiceStatusToggle';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function app() {
    return window.__auctionV2 || null;
  }

  function activeTab() {
    const stateTab = app()?.state?.activeTab;
    if (stateTab) return stateTab;
    const activeButton = document.querySelector('.v2-tab.active[data-tab], [data-tab].active');
    return activeButton?.dataset?.tab || 'search';
  }

  function removeByIds(ids) {
    ids.forEach((id) => document.getElementById(id)?.remove());
  }

  function removeOutOfScopeCards() {
    const tab = activeTab();
    const allowed = new Set();
    if (tab === 'date') DATE_CARD_IDS.forEach((id) => allowed.add(id));
    if (tab === 'saved') SAVED_CARD_IDS.forEach((id) => allowed.add(id));
    if (tab === 'search') allowed.add('v2ServiceStatusCard');

    FEATURE_CARD_IDS.forEach((id) => {
      const node = document.getElementById(id);
      if (node && !allowed.has(id)) node.remove();
    });
  }

  function moveAllowedCardsIntoActivePanel() {
    const tab = activeTab();
    const activePanel = document.querySelector(`.v2-panel.active[data-panel="${tab}"]`) || document.querySelector('.v2-panel.active');
    if (!activePanel) return;

    if (tab === 'date') {
      const stack = document.getElementById('v2CandidateStackCard');
      const ranking = document.getElementById('v2CandidateRankingCard');
      const anchor = document.getElementById('v2DateSourceCard') || activePanel.querySelector('.v2-card') || activePanel;
      if (stack && !activePanel.contains(stack)) anchor.insertAdjacentElement('afterend', stack);
      if (ranking && !activePanel.contains(ranking)) stack?.insertAdjacentElement('afterend', ranking);
    }
  }

  function scopeFeatureCards() {
    removeOutOfScopeCards();
    moveAllowedCardsIntoActivePanel();
  }

  function renameDateResetButtons() {
    document.querySelectorAll('#v2ClearCandidateStackBtn').forEach((button) => {
      button.textContent = '매각기일 후보 초기화';
      button.setAttribute('aria-label', '매각기일 후보 초기화');
    });
  }

  function currentCaseLabel() {
    const identity = window.__auctionCaseScope?.currentCaseIdentity?.();
    if (identity?.court || identity?.caseNo) {
      return [identity.court, identity.year, identity.caseNo].filter(Boolean).join(' · ');
    }
    const court = clean(document.getElementById('jiwonNmV2')?.value || '');
    const year = clean(document.getElementById('saYearV2')?.value || '');
    const serial = clean(document.getElementById('saSerV2')?.value || '');
    return [court, year, serial ? `${serial}` : ''].filter(Boolean).join(' · ');
  }

  function findNextStepCard() {
    return Array.from(document.querySelectorAll('#resultsSection .v2-result-card'))
      .find((card) => clean(card.querySelector('h3')?.textContent) === '다음 단계') || null;
  }

  function ensureNextStepResetControl() {
    const card = findNextStepCard();
    if (!card) {
      document.getElementById(RESET_NOTICE_ID)?.remove();
      return;
    }

    let notice = document.getElementById(RESET_NOTICE_ID);
    if (notice && !card.contains(notice)) notice.remove();
    notice = document.getElementById(RESET_NOTICE_ID);

    if (!notice) {
      notice = document.createElement('div');
      notice.id = RESET_NOTICE_ID;
      notice.className = 'v2-cta-row';
      card.appendChild(notice);
    }

    const signature = currentCaseLabel() || '-';
    if (notice.dataset.caseResetSignature === signature) return;
    notice.dataset.caseResetSignature = signature;
    notice.innerHTML = `
      <p class="v2-note" style="margin:0;flex:1 1 320px">
        현재 사건의 Step 2·권리분석·입찰가만 초기화합니다. 저장 후보·외부검증 메모·실거래가 결과는 유지합니다.<br>
        <strong style="color:var(--ink)">현재 기준: ${esc(signature)}</strong>
      </p>
      <button class="v2-danger-btn" type="button" data-action="reset-current-case">현재 사건 입력 초기화</button>
    `;
  }

  function ensureServiceStatusToggle() {
    const statusCard = document.getElementById('v2ServiceStatusCard');
    if (!statusCard) return;
    if (activeTab() !== 'search') return;

    const panels = document.getElementById('v2HomePanels');
    if (!panels) {
      statusCard.remove();
      return;
    }

    let toggle = document.getElementById(SERVICE_TOGGLE_ID);
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.id = SERVICE_TOGGLE_ID;
      toggle.type = 'button';
      toggle.className = 'v2-small-btn';
      toggle.style.margin = '14px auto 0';
      toggle.style.display = 'block';
      toggle.textContent = '연동 상태 보기';
      panels.insertAdjacentElement('afterend', toggle);
      toggle.addEventListener('click', () => {
        const card = document.getElementById('v2ServiceStatusCard');
        if (!card) return;
        const opened = card.dataset.open === '1';
        card.dataset.open = opened ? '0' : '1';
        card.hidden = opened;
        toggle.textContent = opened ? '연동 상태 보기' : '연동 상태 숨기기';
      });
    }

    if (statusCard.dataset.open !== '1') {
      statusCard.hidden = true;
      toggle.textContent = '연동 상태 보기';
    }
  }

  function cleanupServiceToggle() {
    if (activeTab() !== 'search') document.getElementById(SERVICE_TOGGLE_ID)?.remove();
  }

  function tick() {
    scopeFeatureCards();
    renameDateResetButtons();
    ensureNextStepResetControl();
    ensureServiceStatusToggle();
    cleanupServiceToggle();
  }

  let pending = false;
  function scheduleTick(delay = 0) {
    if (pending && delay === 0) return;
    pending = true;
    window.setTimeout(() => {
      pending = false;
      tick();
    }, delay);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('.brand, .v2-tab, [data-tab]')) {
      scheduleTick(0);
      scheduleTick(80);
      scheduleTick(250);
    }
  }, true);

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-action="reset-current-case"]')) return;
    scheduleTick(0);
    scheduleTick(120);
  }, true);

  const observer = new MutationObserver(() => scheduleTick(0));
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true });
    tick();
  });

  setInterval(tick, 150);
  window.__auctionTabScopeGuard = { tick, scopeFeatureCards, ensureNextStepResetControl };
})();
