(() => {
  if (window.GM?.core?.version) return;

  const VERSION = 'core-2026-05-06-1';
  const STORAGE_PREFIX = 'gm_';
  const MAX_ERRORS = 30;

  function now() {
    return new Date().toISOString();
  }

  function safeJsonParse(value, fallback) {
    try {
      if (value == null || value === '') return fallback;
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function storageKey(key) {
    return String(key || '').startsWith(STORAGE_PREFIX) ? String(key) : `${STORAGE_PREFIX}${key}`;
  }

  function getStorage(key, fallback = null) {
    try {
      return safeJsonParse(localStorage.getItem(storageKey(key)), fallback);
    } catch {
      return fallback;
    }
  }

  function setStorage(key, value) {
    try {
      localStorage.setItem(storageKey(key), JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function removeStorage(key) {
    try {
      localStorage.removeItem(storageKey(key));
      return true;
    } catch {
      return false;
    }
  }

  function emit(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(`gm:${name}`, { detail }));
  }

  function on(name, handler) {
    const eventName = `gm:${name}`;
    document.addEventListener(eventName, handler);
    return () => document.removeEventListener(eventName, handler);
  }

  function registerPatch(name, meta = {}) {
    const patches = window.__gmPatchStatus || {};
    patches[name] = {
      loaded: true,
      loadedAt: now(),
      ...meta,
    };
    window.__gmPatchStatus = patches;
    emit('patch-loaded', { name, meta: patches[name] });
    return patches[name];
  }

  function getPatchStatus() {
    return { ...(window.__gmPatchStatus || {}) };
  }

  function wrapOnce(target, methodName, wrapper, marker) {
    if (!target || typeof target[methodName] !== 'function') return false;
    const original = target[methodName];
    const flag = marker || `__gm_wrapped_${methodName}`;
    if (original[flag]) return true;
    const wrapped = wrapper(original);
    wrapped[flag] = true;
    target[methodName] = wrapped;
    return true;
  }

  function schedule(name, fn, delay = 80) {
    const timers = window.__gmTimers || (window.__gmTimers = {});
    clearTimeout(timers[name]);
    timers[name] = setTimeout(() => {
      try { fn(); }
      catch (e) { recordError(e, { source: `schedule:${name}` }); }
    }, delay);
  }

  function recordError(error, context = {}) {
    const item = {
      at: now(),
      message: error?.message || String(error || 'unknown error'),
      stack: String(error?.stack || '').slice(0, 2000),
      context,
    };
    const errors = getStorage('runtime_errors_v1', []);
    errors.unshift(item);
    setStorage('runtime_errors_v1', errors.slice(0, MAX_ERRORS));
    window.__gmLastError = item;
    emit('runtime-error', item);
    return item;
  }

  function recentErrors() {
    return getStorage('runtime_errors_v1', []);
  }

  function refreshAll() {
    const calls = [
      ['renderWatchlist', () => window.renderWatchlist?.()],
      ['updateMarketScenarios', () => window.updateMarketScenarios?.()],
      ['updateCapitalCheck', () => window.updateCapitalCheck?.()],
      ['updateCashflow', () => window.updateCashflow?.()],
      ['updateExitPlan', () => window.updateExitPlan?.()],
      ['updateBidChecklist', () => window.updateBidChecklist?.()],
    ];
    calls.forEach(([name, fn]) => {
      try { fn(); }
      catch (e) { recordError(e, { source: `refreshAll:${name}` }); }
    });
    emit('refresh-all');
  }

  window.GM = {
    ...(window.GM || {}),
    core: { version: VERSION, loadedAt: now() },
    storage: { key: storageKey, get: getStorage, set: setStorage, remove: removeStorage },
    events: { emit, on },
    patches: { register: registerPatch, status: getPatchStatus },
    utils: { safeJsonParse, wrapOnce, schedule, recordError, recentErrors, refreshAll },
  };

  window.addEventListener('error', (event) => {
    recordError(event.error || event.message, { source: 'window.error', filename: event.filename, lineno: event.lineno, colno: event.colno });
  });

  window.addEventListener('unhandledrejection', (event) => {
    recordError(event.reason || 'Unhandled promise rejection', { source: 'unhandledrejection' });
  });

  registerPatch('gm-core', { version: VERSION });
})();
