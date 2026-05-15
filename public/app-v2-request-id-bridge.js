(() => {
  if (window.__auctionRequestIdBridgeInstalled) return;
  window.__auctionRequestIdBridgeInstalled = true;

  const originalFetch = window.fetch?.bind(window);
  if (!originalFetch) return;

  function shouldPatch(url) {
    try {
      const value = typeof url === 'string' ? url : url?.url || '';
      const parsed = new URL(value, window.location.origin);
      return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/');
    } catch (_) {
      return false;
    }
  }

  function appendRequestId(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const requestId = String(payload.requestId || '').trim();
    const error = String(payload.error || '').trim();
    if (!requestId || !error || error.includes(requestId)) return payload;
    return {
      ...payload,
      error: `${error} (요청ID: ${requestId})`,
    };
  }

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (!shouldPatch(args[0])) return response;

    const originalJson = response.json.bind(response);
    response.json = async () => {
      const data = await originalJson();
      return appendRequestId(data);
    };
    return response;
  };
})();
