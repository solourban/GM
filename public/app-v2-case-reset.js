(() => {
  const STORAGE_PREFIX = 'auction-note:v2.2:case:';
  const SCHEMA_VERSION = 3;
  const ACTIVE_CASE_SESSION_KEY = 'auction-note:v2:active-case-key';
  const TRANSIENT_SESSION_KEYS = [
    'auction-note:v2:location-geocode',
    'auction-note:v2:molit-trades',
    'auction-note:v2:final-judgment',
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

  function clearTransientCaseData() {
    try {
      TRANSIENT_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));
    } catch (_) {}
    document.getElementById('v2LocationCard')?.remove();
    document.getElementById('v2MolitTradeCard')?.remove();
    document.getElementById('v2FinalJudgmentCard')?.remove();
    document.getElementById('v2DecisionConfidenceCard')?.remove();
    document.getElementById('v2FinalCopyCard')?.remove();
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
    s.manual = saved?.manual ? safeManual(saved.manual) : defaultManual();
    s.report = saved?.report || null;
    s.validationWarnings = Array.isArray(saved?.validationWarnings) ? saved.validationWarnings.filter(clean) : [];
    s.analyzeError = '';
    s.__persistActiveCaseKey = identity.key;
    s.__persistRestoredKey = identity.key;
    s.__persistSwitchingCase = false;

    if (typeof api?.renderResults === 'function') {
      api.renderResults({ keepScroll: true });
    }
  }

  function checkCaseSwitch() {
    const s = state();
    if (!s?.raw) return;
    const identity = currentCaseIdentity();
    if (!identity?.key) return;

    if (!s.__coreCaseResetActiveKey) {
      s.__coreCaseResetActiveKey = identity.key;
      syncActiveCaseSession(identity);
      return;
    }

    if (s.__coreCaseResetActiveKey === identity.key) return;
    s.__coreCaseResetActiveKey = identity.key;
    applyCaseState(identity);
  }

  setInterval(checkCaseSwitch, 250);
})();
