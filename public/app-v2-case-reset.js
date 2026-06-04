(() => {
  const STORAGE_PREFIX = 'auction-note:v2.2:case:';
  const BID_PLAN_STORAGE_PREFIX = 'auction-note:v2.2:bid-plan:';
  const SPEC_DRAFT_STORAGE_PREFIX = 'auction-note:v2:spec-extraction:';
  const SCHEMA_VERSION = 3;
  const ACTIVE_CASE_SESSION_KEY = 'auction-note:v2:active-case-key';
  const TRANSIENT_SESSION_KEYS = [
    'auction-note:v2:location-geocode',
    'auction-note:v2:molit-trades',
    'auction-note:v2:final-judgment',
  ];
  const ANALYSIS_SESSION_KEYS = [
    'auction-note:v2:final-judgment',
  ];
  const TRANSIENT_CARD_IDS = [
    'v2LocationCard',
    'v2MolitTradeCard',
    'v2FinalJudgmentCard',
    'v2DecisionConfidenceCard',
    'v2FinalCopyCard',
    'v2BiddingSummaryCard',
    'v2BidRangeCard',
    'v2FundingReviewCard',
    'v2PreBidChecklistCard',
    'v2RiskBriefCard',
    'v2CopySummaryCard',
    'v2BidPlanCard',
    'v2AllocationCard',
  ];
  const ANALYSIS_CARD_IDS = [
    'v2FinalJudgmentCard',
    'v2DecisionConfidenceCard',
    'v2FinalCopyCard',
    'v2BiddingSummaryCard',
    'v2BidRangeCard',
    'v2FundingReviewCard',
    'v2PreBidChecklistCard',
    'v2RiskBriefCard',
    'v2CopySummaryCard',
    'v2BidPlanCard',
    'v2AllocationCard',
    'v2CaseSyncStatusCard',
    'v2ExternalVerificationCard',
  ];
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function app() {
    return window.__auctionV2 || null;
  }

  function state() {
    return app()?.state || null;
  }

  function defaultManual() {
    return {
      malso: { date: '', type: '근저당권', holder: '', amount: '' },
      tenants: [{ name: '', moveIn: '', fixed: '', deposit: '' }],
      specials: [],
      specReview: { occupants: [], specialRights: [], takeoverNotes: [] },
    };
  }

  function normalizeCourt(value) {
    return clean(value).replace(/\s+/g, '').replace(/지방법원법원/g, '지방법원');
  }

  function normalizeCaseNo(value, yearHint = '') {
    const raw = clean(value).replace(/\s+/g, '');
    if (!raw) return '';
    const full = raw.match(/(20\d{2})타경(\d{1,10})/);
    if (full) return `${full[1]}타경${full[2]}`;
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    const year = clean(yearHint).match(/20\d{2}/)?.[0] || '';
    if (year && digitsOnly) return `${year}타경${digitsOnly}`;
    return raw;
  }

  function yearFromCaseNo(caseNo, fallback = '') {
    return clean(caseNo).match(/20\d{2}/)?.[0] || clean(fallback).match(/20\d{2}/)?.[0] || '';
  }

  function currentCaseIdentity() {
    const s = state();
    if (!s?.raw) return null;
    const basic = s.raw.basic || {};
    const rawCaseNo = s.raw.caseNo || basic['사건번호'] || s.caseNo || s.form?.caseNo || '';
    const rawYear = s.year || s.form?.year || '';
    const caseNo = normalizeCaseNo(rawCaseNo, rawYear);
    const year = yearFromCaseNo(caseNo, rawYear);
    const court = normalizeCourt(s.raw.court || basic['법원'] || s.court || s.form?.court || '');
    if (!court || !caseNo) return null;
    return { court, year, caseNo, key: `${STORAGE_PREFIX}${court}:${year || 'no-year'}:${caseNo}` };
  }

  function identityFromSearchForm() {
    const court = normalizeCourt(document.getElementById('jiwonNmV2')?.value || '');
    const rawYear = clean(document.getElementById('saYearV2')?.value || '');
    const caseNo = normalizeCaseNo(document.getElementById('saSerV2')?.value || '', rawYear);
    const year = yearFromCaseNo(caseNo, rawYear);
    if (!court || !caseNo) return null;
    return { court, year, caseNo, key: `${STORAGE_PREFIX}${court}:${year || 'no-year'}:${caseNo}` };
  }

  function currentCaseKey(identity = currentCaseIdentity()) {
    return identity?.key || '';
  }

  function currentCaseBidPlanKeys(identity) {
    const s = state();
    const report = s?.report || {};
    const raw = s?.raw || {};
    const basic = raw.basic || {};
    const pairs = [
      [identity?.court, identity?.caseNo],
      [clean(raw.court || basic['법원']), clean(raw.caseNo || basic['사건번호'])],
      [clean(report.court || report.raw?.court), clean(report.case || report.caseNo)],
    ];
    return Array.from(new Set(pairs
      .filter(([court, caseNo]) => court && caseNo)
      .map(([court, caseNo]) => `${BID_PLAN_STORAGE_PREFIX}${court}:${caseNo}`)));
  }

  function resetCaseRuntimeState(s) {
    if (!s) return;
    s.manual = defaultManual();
    s.report = null;
    s.reportAt = '';
    s.analyzeError = '';
    s.analyzing = false;
    s.validationWarnings = [];
  }

  function clearTransientCaseData() {
    try {
      TRANSIENT_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));
    } catch (_) {}
    TRANSIENT_CARD_IDS.forEach((id) => document.getElementById(id)?.remove());
  }

  function clearAnalysisDerivedData() {
    try {
      ANALYSIS_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));
    } catch (_) {}
    ANALYSIS_CARD_IDS.forEach((id) => document.getElementById(id)?.remove());
  }

  function removeCurrentCaseStorage(identity) {
    const key = currentCaseKey(identity);
    if (!key) return;
    try {
      localStorage.removeItem(key);
      currentCaseBidPlanKeys(identity).forEach((bidKey) => localStorage.removeItem(bidKey));
    } catch (_) {}
  }

  function removeCurrentSpecDraft(identity) {
    const caseKey = currentCaseKey(identity);
    if (!caseKey) return;
    try {
      sessionStorage.removeItem(`${SPEC_DRAFT_STORAGE_PREFIX}${caseKey}`);
    } catch (_) {}
    window.__auctionSpecExtractor?.clearDraft?.(caseKey);
  }

  function syncActiveCaseSession(identity) {
    if (!identity?.key) return;
    try {
      const previous = sessionStorage.getItem(ACTIVE_CASE_SESSION_KEY) || '';
      if (previous && previous !== identity.key) clearTransientCaseData();
      sessionStorage.setItem(ACTIVE_CASE_SESSION_KEY, identity.key);
    } catch (_) {}
  }

  function safeManual(manual) {
    const src = manual || {};
    const tenants = Array.isArray(src.tenants) && src.tenants.length
      ? src.tenants.map((tenant) => ({
        name: clean(tenant?.name),
        moveIn: clean(tenant?.moveIn),
        fixed: clean(tenant?.fixed),
        deposit: clean(tenant?.deposit),
      }))
      : [{ name: '', moveIn: '', fixed: '', deposit: '' }];

    return {
      malso: {
        date: clean(src.malso?.date),
        type: clean(src.malso?.type) || '근저당권',
        holder: clean(src.malso?.holder),
        amount: clean(src.malso?.amount),
      },
      tenants,
      specials: Array.isArray(src.specials) ? src.specials.map((special) => ({
        type: clean(special?.type) || '유치권',
        holder: clean(special?.holder),
        date: clean(special?.date),
        amount: clean(special?.amount),
      })) : [],
      specReview: safeSpecReview(src.specReview),
    };
  }

  function safeSpecReview(value) {
    const src = value && typeof value === 'object' ? value : {};
    return {
      occupants: Array.isArray(src.occupants) ? src.occupants.map((item) => ({
        tenantName: clean(item?.tenantName),
        occupantName: clean(item?.occupantName),
        moveIn: clean(item?.moveIn),
        fixed: clean(item?.fixed),
        claimDate: clean(item?.claimDate),
        deposit: clean(item?.deposit),
        rent: clean(item?.rent),
        occupiedPart: clean(item?.occupiedPart),
        sourceId: clean(item?.sourceId),
        confirmedAt: clean(item?.confirmedAt),
      })).filter((item) => Object.values(item).some(clean)) : [],
      specialRights: Array.isArray(src.specialRights) ? src.specialRights.map((item) => ({
        typeCandidate: clean(item?.typeCandidate),
        holder: clean(item?.holder),
        date: clean(item?.date),
        amount: clean(item?.amount),
        phrase: clean(item?.phrase),
        sourceId: clean(item?.sourceId),
        confirmedAt: clean(item?.confirmedAt),
      })).filter((item) => Object.values(item).some(clean)) : [],
      takeoverNotes: Array.isArray(src.takeoverNotes) ? src.takeoverNotes.map((item) => ({
        kind: clean(item?.kind),
        phrase: clean(item?.phrase),
        sourceId: clean(item?.sourceId),
        confirmedAt: clean(item?.confirmedAt),
      })).filter((item) => Object.values(item).some(clean)) : [],
    };
  }

  function loadSavedCase(key) {
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function applyCaseState(identity) {
    const s = state();
    const api = app();
    if (!s || !identity?.key) return;

    clearTransientCaseData();
    syncActiveCaseSession(identity);

    const saved = loadSavedCase(identity.key);
    s.__persistSwitchingCase = true;
    if (saved?.manual || saved?.report) {
      s.manual = saved?.manual ? safeManual(saved.manual) : defaultManual();
      s.report = saved?.report || null;
      s.validationWarnings = Array.isArray(saved?.validationWarnings) ? saved.validationWarnings.filter(clean) : [];
      s.analyzeError = '';
      s.analyzing = false;
    } else {
      resetCaseRuntimeState(s);
    }
    s.__persistActiveCaseKey = identity.key;
    s.__persistRestoredKey = identity.key;
    s.__persistSwitchingCase = false;

    if (typeof api?.renderResults === 'function') {
      api.renderResults({ keepScroll: true });
    }
  }

  function resetCurrentCaseState() {
    const s = state();
    const api = app();
    const identity = currentCaseIdentity();
    if (!s || !identity?.key) return false;

    s.__persistSwitchingCase = true;
    removeCurrentCaseStorage(identity);
    removeCurrentSpecDraft(identity);
    resetCaseRuntimeState(s);
    clearAnalysisDerivedData();
    syncActiveCaseSession(identity);
    s.__persistActiveCaseKey = identity.key;
    s.__persistRestoredKey = identity.key;
    s.__coreCaseResetActiveKey = identity.key;
    s.__persistSwitchingCase = false;

    if (typeof api?.renderResults === 'function') {
      api.renderResults({ keepScroll: true });
    }
    return true;
  }

  function prepareForSearchCase() {
    const s = state();
    const nextIdentity = identityFromSearchForm();
    if (!s || !nextIdentity?.key) return false;
    if (!s.__coreCaseResetActiveKey || s.__coreCaseResetActiveKey === nextIdentity.key) return false;

    s.__persistSwitchingCase = true;
    resetCaseRuntimeState(s);
    clearTransientCaseData();
    s.__persistActiveCaseKey = nextIdentity.key;
    s.__persistRestoredKey = '';
    s.__coreCaseResetActiveKey = nextIdentity.key;
    s.__persistSwitchingCase = false;
    return true;
  }

  function syncCurrentCase() {
    const s = state();
    if (!s?.raw) return false;
    const identity = currentCaseIdentity();
    if (!identity?.key) return false;

    if (!s.__coreCaseResetActiveKey) {
      s.__coreCaseResetActiveKey = identity.key;
      syncActiveCaseSession(identity);
      return false;
    }

    if (s.__coreCaseResetActiveKey === identity.key) return false;
    s.__coreCaseResetActiveKey = identity.key;
    applyCaseState(identity);
    return true;
  }

  function renderCaseScopeNotice() {
    const identity = currentCaseIdentity();
    const step2 = document.getElementById('step2InputCard');
    if (!step2 || !identity?.key) return;

    let notice = document.getElementById('v2CaseScopeNotice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'v2CaseScopeNotice';
      notice.className = 'v2-cta-row';
      const title = step2.querySelector('h3');
      if (title?.nextSibling) step2.insertBefore(notice, title.nextSibling);
      else step2.prepend(notice);
    }
    if (notice.dataset.caseResetSignature === identity.key) return;
    notice.dataset.caseResetSignature = identity.key;
    notice.innerHTML = `
      <p class="v2-note" style="margin:0;flex:1 1 280px">입력값은 법원·연도·사건번호 기준으로 자동 저장됩니다. 초기화하면 현재 사건의 Step 2·권리분석·입찰가만 지우고, 저장 후보·외부검증 메모·실거래가 결과는 유지합니다.</p>
      <button class="v2-danger-btn" type="button" data-action="reset-current-case">현재 사건 입력 초기화</button>
    `;
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('#btnFetchV2')) {
      prepareForSearchCase();
      return;
    }
    if (!event.target.closest('[data-action="reset-current-case"]')) return;
    event.preventDefault();
    event.stopPropagation();
    resetCurrentCaseState();
  }, true);

  setInterval(() => {
    syncCurrentCase();
    renderCaseScopeNotice();
  }, 250);

  window.__auctionCaseScope = {
    syncCurrentCase,
    resetCurrentCase: resetCurrentCaseState,
    prepareForSearchCase,
    currentCaseIdentity,
    currentCaseKey,
    clearAnalysisDerivedData,
  };
})();
