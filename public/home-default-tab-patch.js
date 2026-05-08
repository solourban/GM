(() => {
  function text(el) { return String(el?.textContent || '').replace(/\s+/g, ' ').trim(); }

  function clickSearchTab() {
    const buttons = [...document.querySelectorAll('button,a,[role="button"]')];
    const search = buttons.find((el) => /물건\s*검색/.test(text(el)));
    const date = buttons.find((el) => /매각기일\s*추천/.test(text(el)));
    if (!search) return false;

    const alreadyActive = /active|selected|current/i.test(search.className || '') || search.getAttribute('aria-selected') === 'true';
    if (!alreadyActive) search.click();

    // If a date recommendation panel was restored from a previous session, hide it unless the user explicitly clicks the tab again.
    setTimeout(() => {
      const searchAgain = [...document.querySelectorAll('button,a,[role="button"]')].find((el) => /물건\s*검색/.test(text(el)));
      if (searchAgain && !(/active|selected|current/i.test(searchAgain.className || '') || searchAgain.getAttribute('aria-selected') === 'true')) searchAgain.click();
    }, 150);
    return true;
  }

  function clearSavedTabHints() {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (/tab|home|mode|active/i.test(key)) {
          const value = String(localStorage.getItem(key) || '');
          if (/매각|date|recommend|auction/i.test(value)) localStorage.removeItem(key);
        }
      });
      sessionStorage.removeItem('activeHomeTab');
      sessionStorage.removeItem('homeTab');
    } catch (_) {}
  }

  function run() {
    clearSavedTabHints();
    clickSearchTab();
  }

  document.addEventListener('DOMContentLoaded', run);
  window.addEventListener('pageshow', run);
  setTimeout(run, 0);
  setTimeout(run, 400);
  setTimeout(run, 1200);
  window.GM?.patches?.register?.('home-default-tab', { version: 'v1-search-first' });
})();
