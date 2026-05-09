(() => {
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function appState() {
    return window.__auctionV2?.state || null;
  }

  function normalizeTenantList(tenants) {
    if (!Array.isArray(tenants)) return [{ name: '', moveIn: '', fixed: '', deposit: '' }];

    const normalized = [];
    tenants.forEach((tenant) => {
      if (!tenant || typeof tenant !== 'object') return;

      const base = {
        name: clean(tenant.name),
        moveIn: clean(tenant.moveIn),
        fixed: clean(tenant.fixed),
        deposit: clean(tenant.deposit),
      };

      if ([base.name, base.moveIn, base.fixed, base.deposit].some(Boolean)) normalized.push(base);
    });

    Object.keys(tenants).forEach((key) => {
      if (!/^\d+$/.test(key)) return;
      const tenant = tenants[key];
      if (!tenant || typeof tenant !== 'object') return;
      const base = {
        name: clean(tenant.name),
        moveIn: clean(tenant.moveIn),
        fixed: clean(tenant.fixed),
        deposit: clean(tenant.deposit),
      };
      if ([base.name, base.moveIn, base.fixed, base.deposit].some(Boolean)) normalized.push(base);
    });

    return normalized.length ? normalized : [{ name: '', moveIn: '', fixed: '', deposit: '' }];
  }

  function normalizeSpecialList(specials) {
    if (!Array.isArray(specials)) return [];
    return specials
      .filter((special) => special && typeof special === 'object')
      .map((special) => ({
        type: clean(special.type) || '유치권',
        holder: clean(special.holder),
        date: clean(special.date),
        amount: clean(special.amount),
      }))
      .filter((special) => [special.type, special.holder, special.date, special.amount].some(Boolean));
  }

  function normalizeManualState() {
    const state = appState();
    if (!state?.manual) return;

    state.manual.malso = {
      date: clean(state.manual.malso?.date),
      type: clean(state.manual.malso?.type) || '근저당권',
      holder: clean(state.manual.malso?.holder),
      amount: clean(state.manual.malso?.amount),
    };
    state.manual.tenants = normalizeTenantList(state.manual.tenants);
    state.manual.specials = normalizeSpecialList(state.manual.specials);
  }

  function patchRenderResults() {
    const api = window.__auctionV2;
    if (!api || api.__manualNormalizePatched) return false;
    api.__manualNormalizePatched = true;
    const original = api.renderResults;
    api.renderResults = function normalizedRenderResults(...args) {
      normalizeManualState();
      return original.apply(this, args);
    };
    return true;
  }

  document.addEventListener('input', (event) => {
    if (!event.target.closest('[data-manual-path]')) return;
    setTimeout(normalizeManualState, 0);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-action], #btnAnalyzeV2')) return;
    setTimeout(normalizeManualState, 0);
  });

  const wait = setInterval(() => {
    const ready = patchRenderResults();
    normalizeManualState();
    if (ready) clearInterval(wait);
  }, 50);
})();
