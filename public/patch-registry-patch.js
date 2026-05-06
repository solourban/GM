(() => {
  const EXPECTED_PATCHES = [
    ['/gm-core-patch.js', 'gm-core', '공통 런타임'],
    ['/platform-patch.js', 'platform', '플랫폼 UI'],
    ['/address-fix.js', 'address-fix', '주소 표시 보정'],
    ['/watchlist-patch.js', 'watchlist', '관심사건 기본'],
    ['/watchlist-enhance-patch.js', 'watchlist-enhance', '비교표 고도화'],
    ['/stepflow-patch.js', 'stepflow', '단계형 화면'],
    ['/fetch-error-patch.js', 'fetch-error', '조회 실패 안내'],
    ['/court-list-patch.js', 'court-list', '법원 목록 보강'],
    ['/bulk-fetch-patch.js', 'bulk-fetch', '일괄조회'],
    ['/map-patch.js', 'map', '카카오 지도'],
    ['/molit-patch.js', 'molit', '국토부 실거래가'],
    ['/molit-scenario-patch.js', 'molit-scenario', '실거래가 시나리오 반영'],
    ['/capital-patch.js', 'capital', '자금 가능성'],
    ['/cashflow-patch.js', 'cashflow', '현금흐름표'],
    ['/stability-patch.js', 'stability', '화면 안정화'],
    ['/diagnostics-patch.js', 'diagnostics', '자가진단'],
    ['/exit-plan-patch.js', 'exit-plan', '엑시트 전략'],
    ['/bid-checklist-patch.js', 'bid-checklist', '입찰 체크리스트'],
    ['/final-summary-patch.js', 'final-summary', '최종 판단 요약'],
    ['/api-guide-patch.js', 'api-guide', 'API 설정 가이드'],
    ['/patch-registry-patch.js', 'patch-registry', '패치 등록 레이어'],
  ];

  function now() {
    return new Date().toISOString();
  }

  function loadedScripts() {
    return [...document.scripts]
      .map((script) => script.getAttribute('src') || '')
      .filter(Boolean);
  }

  function isLoaded(src, scripts) {
    return scripts.some((s) => s.includes(src));
  }

  function registerAll() {
    if (!window.GM?.patches?.register) {
      window.__gmPatchRegistryFallback = {
        attemptedAt: now(),
        error: 'GM core not loaded',
      };
      return false;
    }

    const scripts = loadedScripts();
    const loaded = [];
    const missing = [];

    EXPECTED_PATCHES.forEach(([src, name, label]) => {
      const ok = isLoaded(src, scripts);
      const meta = {
        version: 'registry-2026-05-06-1',
        source: src,
        label,
        detected: ok,
        registeredBy: 'patch-registry',
      };

      if (ok) {
        window.GM.patches.register(name, meta);
        loaded.push({ src, name, label });
      } else {
        missing.push({ src, name, label });
      }
    });

    window.__gmPatchRegistry = {
      updatedAt: now(),
      loadedCount: loaded.length,
      missingCount: missing.length,
      loaded,
      missing,
    };

    window.GM.patches.register('patch-registry', {
      version: 'registry-2026-05-06-1',
      loadedCount: loaded.length,
      missingCount: missing.length,
      missing: missing.map((x) => x.src),
    });

    window.GM.events?.emit?.('patch-registry-updated', window.__gmPatchRegistry);
    return true;
  }

  function scheduleRegister() {
    clearTimeout(window.__gmPatchRegistryTimer);
    window.__gmPatchRegistryTimer = setTimeout(registerAll, 120);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleRegister);
  } else {
    scheduleRegister();
  }

  window.refreshPatchRegistry = registerAll;
})();
