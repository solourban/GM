(() => {
  let guarding = false;
  let lastLoadingHtml = '';
  let guardStartedAt = 0;
  let lastStatus = 'idle';

  function text(el) { return String(el?.textContent || '').replace(/\s+/g, ' ').trim(); }
  function rs() { return document.getElementById('resultsSection'); }

  function readFetchInputs() {
    return {
      year: String(document.getElementById('saYear')?.value || '').trim(),
      serial: String(document.getElementById('saSer')?.value || '').trim(),
      court: String(document.getElementById('jiwonNm')?.value || '').trim(),
    };
  }

  function validFetchInputs() {
    const { year, serial, court } = readFetchInputs();
    return /^\d{4}$/.test(year) && /^\d+$/.test(serial) && Boolean(court);
  }

  function isLoadingContent(t) {
    return /대법원 경매정보에서 기본정보를 가져오는 중|기본정보를 가져오는 중|조회 중|수집 중/.test(t || '');
  }

  function isTerminalContent(t) {
    return /Step\s*1\s*완료|기본정보 수집|자동 수집된 사건 정보|이해관계인\s*\(|요청 실패|법원경매정보 조회에 실패|사건 정보를 찾지 못했습니다|❌/.test(t || '');
  }

  function defaultLoadingHtml() {
    return '<div class="loading-card"><div class="spinner"></div><p>대법원 경매정보에서 기본정보를 가져오는 중...</p></div>';
  }

  function publish() {
    window.__gmFetchGuard = { guarding, lastStatus, guardStartedAt, input: readFetchInputs() };
  }

  function startGuard() {
    const el = rs();
    if (!el) return;
    if (!validFetchInputs()) {
      guarding = false;
      lastStatus = 'invalid-input-skip-guard';
      publish();
      return;
    }
    guarding = true;
    guardStartedAt = Date.now();
    lastStatus = 'guard-started';
    lastLoadingHtml = el.innerHTML && isLoadingContent(text(el)) ? el.innerHTML : defaultLoadingHtml();
    publish();
  }

  function stopGuard(reason) {
    guarding = false;
    lastStatus = reason || 'guard-stopped';
    publish();
  }

  function tick() {
    const el = rs();
    if (!el) return;
    if (guarding && !validFetchInputs()) {
      stopGuard('invalid-input-stop-guard');
      return;
    }
    const t = text(el);

    if (guarding && isTerminalContent(t)) {
      stopGuard('terminal-content-detected');
      return;
    }

    if (guarding && isLoadingContent(t) && el.innerHTML.trim()) {
      lastLoadingHtml = el.innerHTML;
      lastStatus = 'loading-content-seen';
      publish();
      return;
    }

    if (guarding && !t && Date.now() - guardStartedAt < 45000) {
      el.innerHTML = lastLoadingHtml || defaultLoadingHtml();
      lastStatus = 'empty-results-restored';
      publish();
      return;
    }

    if (guarding && Date.now() - guardStartedAt >= 45000) stopGuard('timeout');
  }

  function bindButtons() {
    [...document.querySelectorAll('button')].forEach((btn) => {
      if (btn.dataset.fetchGuardBound) return;
      if (!/물건\s*기본정보\s*조회|기본정보\s*조회/.test(text(btn))) return;
      btn.dataset.fetchGuardBound = '1';
      btn.addEventListener('click', () => {
        if (!validFetchInputs()) {
          guarding = false;
          lastStatus = 'invalid-input-click';
          publish();
          return;
        }
        setTimeout(startGuard, 0);
        setTimeout(tick, 50);
        setTimeout(tick, 250);
        setTimeout(tick, 800);
      }, true);
    });
  }

  const observer = new MutationObserver(() => {
    bindButtons();
    tick();
  });

  document.addEventListener('DOMContentLoaded', () => {
    bindButtons();
    observer.observe(document.body, { childList: true, subtree: true });
  });
  if (document.body) {
    bindButtons();
    observer.observe(document.body, { childList: true, subtree: true });
  }
  setInterval(() => { bindButtons(); tick(); }, 600);

  window.GM?.patches?.register?.('fetch-flow-guard', { version: 'v2-validate-before-guard' });
})();
