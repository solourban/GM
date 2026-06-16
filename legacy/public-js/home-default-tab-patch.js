(() => {
  const bornAt = Date.now();
  let didInitialRun = false;
  let userStartedLookup = false;

  function text(el) { return String(el?.textContent || '').replace(/\s+/g, ' ').trim(); }

  function hasResultsOrLoading() {
    const body = text(document.body);
    return /대법원 경매정보에서 기본정보를 가져오는 중|기본정보 수집|Step\s*1\s*완료|현재 기준 1차 판단 요약|최종 입찰 판단 요약|자동 수집된 사건 정보|이해관계인\s*\(/.test(body);
  }

  function bindLookupButtons() {
    [...document.querySelectorAll('button')].forEach((btn) => {
      if (btn.dataset.homeDefaultBound) return;
      if (!/물건\s*기본정보\s*조회|기본정보\s*조회/.test(text(btn))) return;
      btn.dataset.homeDefaultBound = '1';
      btn.addEventListener('click', () => {
        userStartedLookup = true;
      }, true);
    });
  }

  function clickSearchTabOnce() {
    bindLookupButtons();
    if (didInitialRun) return false;
    if (userStartedLookup) return false;
    if (Date.now() - bornAt > 1200) return false;
    if (hasResultsOrLoading()) return false;

    const buttons = [...document.querySelectorAll('button,a,[role="button"]')];
    const search = buttons.find((el) => /물건\s*검색/.test(text(el)));
    if (!search) return false;

    const alreadyActive = /active|selected|current/i.test(search.className || '') || search.getAttribute('aria-selected') === 'true';
    if (!alreadyActive) search.click();
    didInitialRun = true;
    return true;
  }

  function clearSavedTabHintsOnce() {
    if (didInitialRun || userStartedLookup || hasResultsOrLoading()) return;
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
    bindLookupButtons();
    clearSavedTabHintsOnce();
    clickSearchTabOnce();
  }

  document.addEventListener('DOMContentLoaded', run);
  window.addEventListener('pageshow', run);
  setTimeout(run, 0);
  setTimeout(run, 300);
  setTimeout(run, 900);
  window.GM?.patches?.register?.('home-default-tab', { version: 'v2-initial-only' });
})();
