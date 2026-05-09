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

  function readTenantCardsFromDom() {
    const step2 = document.getElementById('step2InputCard');
    if (!step2) return [];
    const cards = [...step2.querySelectorAll('.v2-repeat-card')].filter((card) => {
      const title = clean(card.querySelector('.v2-repeat-head b')?.textContent || '');
      return title.includes('임차인') || card.querySelector('[data-manual-path*=".moveIn"], [data-manual-path*=".fixed"], [data-manual-path*=".deposit"]');
    });

    return cards.map((card, index) => {
      const title = card.querySelector('.v2-repeat-head b');
      if (title) title.textContent = `임차인 ${index + 1}`;
      const inputs = [...card.querySelectorAll('input')];
      return {
        name: clean(inputs[0]?.value),
        moveIn: clean(inputs[1]?.value),
        fixed: clean(inputs[2]?.value),
        deposit: clean(inputs[3]?.value),
      };
    }).filter((tenant) => [tenant.name, tenant.moveIn, tenant.fixed, tenant.deposit].some(Boolean));
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

    const domTenants = readTenantCardsFromDom();
    state.manual.tenants = domTenants.length ? domTenants : normalizeTenantList(state.manual.tenants);
    state.manual.specials = normalizeSpecialList(state.manual.specials);
  }

  function patchRenderResults() {
    const api = window.__auctionV2;
    if (!api || api.__manualNormalizePatched) return false;
    api.__manualNormalizePatched = true;
    const original = api.renderResults;
    api.renderResults = function normalizedRenderResults(...args) {
      normalizeManualState();
      const result = original.apply(this, args);
      setTimeout(normalizeManualState, 0);
      return result;
    };
    return true;
  }

  document.addEventListener('input', (event) => {
    if (!event.target.closest('[data-manual-path]')) return;
    setTimeout(normalizeManualState, 0);
  }, true);

  document.addEventListener('change', (event) => {
    if (!event.target.closest('[data-manual-path]')) return;
    setTimeout(normalizeManualState, 0);
  }, true);

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-action], #btnAnalyzeV2')) return;
    normalizeManualState();
    setTimeout(normalizeManualState, 0);
  }, true);

  const wait = setInterval(() => {
    const ready = patchRenderResults();
    normalizeManualState();
    if (ready) clearInterval(wait);
  }, 50);
})();
