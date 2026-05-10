(() => {
  const STORAGE_PREFIX = 'auction-note:v2.2:case:';
  const SCHEMA_VERSION = 3;
  const MAX_SAVED_CASES = 40;
  const MAX_AGE_DAYS = 90;
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
    return clean(value)
      .replace(/\s+/g, '')
      .replace(/지방법원법원/g, '지방법원');
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

  function caseIdentityFromState() {
    const s = state();
    if (!s) return null;

    const basic = s.raw?.basic || {};
    const rawCaseNo = s.raw?.caseNo || basic['사건번호'] || s.report?.case || s.caseNo || s.form?.caseNo || s.caseData?.caseNo || s.caseData?.case;
    const rawYear = s.year || s.form?.year || s.caseData?.year;
    const caseNo = normalizeCaseNo(rawCaseNo, rawYear);
    const year = yearFromCaseNo(caseNo, rawYear);
    const court = normalizeCourt(s.raw?.court || basic['법원'] || s.report?.court || s.court || s.form?.court || s.caseData?.court);

    if (!court || !caseNo) return null;
    return { court, year, caseNo, key: `${STORAGE_PREFIX}${court}:${year || 'no-year'}:${caseNo}` };
  }

  function caseKeyFromState() {
    return caseIdentityFromState()?.key || '';
  }

  function safeManual(manual) {
    const src = manual || {};
    const tenants = Array.isArray(src?.tenants) && src.tenants.length
      ? src.tenants.map((tenant) => ({
        name: clean(tenant?.name),
        moveIn: clean(tenant?.moveIn),
        fixed: clean(tenant?.fixed),
        deposit: clean(tenant?.deposit),
      }))
      : [{ name: '', moveIn: '', fixed: '', deposit: '' }];

    return {
      malso: {
        date: clean(src?.malso?.date),
        type: clean(src?.malso?.type) || '근저당권',
        holder: clean(src?.malso?.holder),
        amount: clean(src?.malso?.amount),
      },
      tenants,
      specials: Array.isArray(src?.specials) ? src.specials.map((special) => ({
        type: clean(special?.type) || '유치권',
        holder: clean(special?.holder),
        date: clean(special?.date),
        amount: clean(special?.amount),
      })) : [],
    };
  }

  function hasManualValue(manual) {
    const safe = safeManual(manual);
    const malsoHas = [safe.malso.date, safe.malso.holder, safe.malso.amount].some(clean);
    const tenantHas = safe.tenants.some((tenant) => [tenant.name, tenant.moveIn, tenant.fixed, tenant.deposit].some(clean));
    const specialHas = safe.specials.some((special) => [special.holder, special.date, special.amount].some(clean));
    return malsoHas || tenantHas || specialHas;
  }

  function loadCaseState(key) {
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
      return parsed;
    } catch (_) {
      try { localStorage.removeItem(key); } catch (__) {}
      return null;
    }
  }

  function saveCaseState() {
    const s = state();
    const identity = caseIdentityFromState();
    if (!s || !identity?.key) return;
    if (s.__persistSwitchingCase) return;
    if (s.__persistActiveCaseKey && s.__persistActiveCaseKey !== identity.key) return;

    const manual = safeManual(s.manual);
    const hasUsefulData = hasManualValue(manual) || Boolean(s.report);
    if (!hasUsefulData) return;

    const payload = {
      schemaVersion: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      identity,
      manual,
      report: s.report || null,
      validationWarnings: Array.isArray(s.validationWarnings) ? s.validationWarnings.filter(clean) : [],
    };

    try {
      localStorage.setItem(identity.key, JSON.stringify(payload));
    } catch (_) {
      // 저장 실패는 화면 기능을 막지 않는다.
    }
  }

  function applySavedOrBlankForCurrentCase(key) {
    const s = state();
    if (!s || !key) return false;

    const saved = loadCaseState(key);
    s.__persistSwitchingCase = true;
    if (saved?.manual) {
      s.manual = safeManual(saved.manual);
      s.report = saved.report || null;
      s.validationWarnings = Array.isArray(saved.validationWarnings) ? saved.validationWarnings.filter(clean) : [];
    } else {
      s.manual = defaultManual();
      s.report = null;
      s.validationWarnings = [];
    }
    s.__persistRestoredKey = key;
    s.__persistSwitchingCase = false;
    return Boolean(saved);
  }

  function handleCaseSwitch() {
    const s = state();
    const api = app();
    const key = caseKeyFromState();
    if (!s || !api || !key) return false;

    if (!s.__persistActiveCaseKey) {
      s.__persistActiveCaseKey = key;
      return false;
    }

    if (s.__persistActiveCaseKey === key) return false;

    s.__persistActiveCaseKey = key;
    applySavedOrBlankForCurrentCase(key);

    if (typeof api.renderResults === 'function') {
      api.renderResults({ keepScroll: true });
    }
    return true;
  }

  function restoreCaseState() {
    const s = state();
    const api = app();
    const key = caseKeyFromState();
    if (!s || !api || !key) return false;
    if (s.__persistRestoredKey === key) return false;

    const saved = loadCaseState(key);
    s.__persistRestoredKey = key;
    s.__persistActiveCaseKey = key;
    if (!saved) return false;

    const currentHasManual = hasManualValue(s.manual);
    if (!currentHasManual && saved.manual) {
      s.manual = safeManual(saved.manual);
    }

    if (!s.report && saved.report) {
      s.report = saved.report;
    }

    if (!Array.isArray(s.validationWarnings) && Array.isArray(saved.validationWarnings)) {
      s.validationWarnings = saved.validationWarnings.filter(clean);
    }

    if (typeof api.renderResults === 'function') {
      api.renderResults({ keepScroll: true });
    }
    return true;
  }

  function injectStatus() {
    const s = state();
    const key = caseKeyFromState();
    if (!s || !key) return;

    const step2 = document.getElementById('step2InputCard');
    if (!step2) return;

    let status = document.getElementById('v2PersistStatus');
    if (!status) {
      status = document.createElement('p');
      status.id = 'v2PersistStatus';
      status.className = 'v2-note';
      const title = step2.querySelector('h3');
      if (title?.nextSibling) step2.insertBefore(status, title.nextSibling);
      else step2.prepend(status);
    }

    const saved = loadCaseState(key);
    if (saved?.savedAt) {
      const date = new Date(saved.savedAt);
      const label = Number.isNaN(date.getTime()) ? '이전 입력값 저장됨' : `${date.toLocaleString('ko-KR')} 저장됨`;
      status.textContent = `입력값은 사건번호별로 자동 저장됩니다. 최근 저장: ${label}`;
    } else {
      status.textContent = '입력값은 사건번호별로 자동 저장됩니다.';
    }
  }

  function removeResetButtonIfExists() {
    document.getElementById('v2PersistResetBtn')?.remove();
  }

  function pruneOldSavedCases() {
    try {
      const now = Date.now();
      const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
      const entries = [];

      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
        const saved = loadCaseState(key);
        const savedTime = saved?.savedAt ? new Date(saved.savedAt).getTime() : 0;
        if (!saved || !savedTime || now - savedTime > maxAgeMs) {
          localStorage.removeItem(key);
          continue;
        }
        entries.push({ key, savedTime });
      }

      entries
        .sort((a, b) => b.savedTime - a.savedTime)
        .slice(MAX_SAVED_CASES)
        .forEach((entry) => localStorage.removeItem(entry.key));
    } catch (_) {}
  }

  function run() {
    removeResetButtonIfExists();
    if (handleCaseSwitch()) return;
    restoreCaseState();
    injectStatus();
  }

  document.addEventListener('input', (event) => {
    if (!event.target.closest('[data-manual-path]')) return;
    setTimeout(() => { run(); saveCaseState(); }, 0);
  }, true);

  document.addEventListener('change', (event) => {
    if (!event.target.closest('[data-manual-path]')) return;
    setTimeout(() => { run(); saveCaseState(); }, 0);
  }, true);

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-action="analyze"]')) return;
    setTimeout(() => { run(); saveCaseState(); }, 500);
    setTimeout(() => { run(); saveCaseState(); }, 1500);
  }, true);

  setInterval(() => {
    run();
    saveCaseState();
  }, 1000);

  setInterval(pruneOldSavedCases, 60_000);
})();
