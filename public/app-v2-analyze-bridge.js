(() => {
  const originalFetch = window.fetch.bind(window);
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function isAnalyzeRequest(input) {
    const url = typeof input === 'string' ? input : input?.url;
    if (!url) return false;
    try {
      return new URL(url, window.location.origin).pathname === '/api/analyze';
    } catch (_) {
      return String(url).includes('/api/analyze');
    }
  }

  function hasAnyValue(obj, keys) {
    return keys.some((key) => clean(obj?.[key]));
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeRights(rawRights, manual) {
    const rights = safeArray(rawRights).map((right) => ({ ...right }));
    const malso = manual?.malso || {};
    if (hasAnyValue(malso, ['date', 'type', 'holder', 'amount'])) {
      rights.push({
        date: clean(malso.date),
        type: clean(malso.type) || '근저당권',
        holder: clean(malso.holder),
        amount: clean(malso.amount),
        _userMalso: true,
      });
    }

    safeArray(manual?.specials).forEach((special) => {
      if (!hasAnyValue(special, ['holder', 'date', 'amount'])) return;
      rights.push({
        date: clean(special.date),
        type: clean(special.type) || '유치권',
        holder: clean(special.holder),
        amount: clean(special.amount),
      });
    });

    return rights;
  }

  function normalizeTenants(rawTenants, manual) {
    const manualTenants = safeArray(manual?.tenants)
      .map((tenant) => ({
        name: clean(tenant?.name),
        moveIn: clean(tenant?.moveIn),
        fixed: clean(tenant?.fixed),
        deposit: clean(tenant?.deposit),
      }))
      .filter((tenant) => hasAnyValue(tenant, ['name', 'moveIn', 'fixed', 'deposit']));

    if (manualTenants.length) return manualTenants;
    return safeArray(rawTenants).map((tenant) => ({ ...tenant }));
  }

  function bridgeRequestBody(body) {
    if (!body || typeof body !== 'object' || !body.raw) return body;
    const raw = body.raw && typeof body.raw === 'object' ? body.raw : {};
    const manual = body.manual && typeof body.manual === 'object' ? body.manual : {};
    return {
      ...raw,
      rights: normalizeRights(raw.rights, manual),
      tenants: normalizeTenants(raw.tenants, manual),
      __analyzeBridge: true,
    };
  }

  async function bridgeResponse(response) {
    const data = await response.clone().json().catch(() => null);
    if (!data || data.report || !data.result) return response;
    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify({ ...data, report: data.result }), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  window.fetch = async function patchedFetch(input, init = {}) {
    if (!isAnalyzeRequest(input)) return originalFetch(input, init);

    let nextInit = init;
    try {
      const parsed = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      if (parsed?.raw) {
        nextInit = {
          ...init,
          body: JSON.stringify(bridgeRequestBody(parsed)),
        };
      }
    } catch (_) {
      nextInit = init;
    }

    const response = await originalFetch(input, nextInit);
    return bridgeResponse(response);
  };
})();
