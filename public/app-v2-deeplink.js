(function () {
  const TAB_ALIASES = {
    search: 'search',
    auction: 'search',
    case: 'search',
    bulk: 'bulk',
    batch: 'bulk',
    date: 'date',
    schedule: 'date',
    saved: 'saved',
    candidates: 'saved',
    onbid: 'onbid',
  };

  function collectParams() {
    const params = new URLSearchParams(window.location.search || '');
    const hash = String(window.location.hash || '').replace(/^#/, '').trim();
    if (hash) {
      if (hash.includes('=')) {
        new URLSearchParams(hash).forEach((value, key) => {
          if (!params.has(key)) params.set(key, value);
        });
      } else if (!params.has('tab')) {
        params.set('tab', hash);
      }
    }
    return params;
  }

  function normalizedTab(params) {
    const raw = String(params.get('tab') || '').trim().toLowerCase();
    return TAB_ALIASES[raw] || '';
  }

  function setValue(id, value) {
    const el = document.getElementById(id);
    const next = String(value || '').trim();
    if (!el || !next) return;
    el.value = next;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applySearchFields(params) {
    setValue('jiwonNmV2', params.get('court') || params.get('jiwonNm'));
    setValue('saYearV2', params.get('year') || params.get('saYear'));
    setValue('saSerV2', params.get('case') || params.get('caseNo') || params.get('saSer'));
  }

  function activateTab(tab) {
    if (!tab) return false;
    const button = document.querySelector(`.v2-tab[data-tab="${tab}"]`);
    if (!button) return false;
    button.click();
    return true;
  }

  function shouldAutoFetch(params) {
    return /^(1|true|yes)$/i.test(String(params.get('auto') || ''));
  }

  function applyDeepLink() {
    const params = collectParams();
    const tab = normalizedTab(params);
    if (tab) activateTab(tab);
    applySearchFields(params);
    if (shouldAutoFetch(params)) {
      setTimeout(() => document.getElementById('btnFetchV2')?.click(), 80);
    }
  }

  function waitForApp(attempt = 0) {
    if (window.__auctionV2 && document.querySelector('.v2-tab')) {
      applyDeepLink();
      return;
    }
    if (attempt < 40) window.setTimeout(() => waitForApp(attempt + 1), 50);
  }

  window.__nakchalnoteDeepLink = {
    apply: applyDeepLink,
    collectParams,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForApp(), { once: true });
  } else {
    waitForApp();
  }

  window.addEventListener('hashchange', () => waitForApp());
  window.addEventListener('popstate', () => waitForApp());
})();
