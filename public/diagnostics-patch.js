(() => {
  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function injectStyles() {
    if (document.getElementById('diagnosticsPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'diagnosticsPatchStyles';
    style.textContent = `
      .diag-fab { position: fixed; right: 16px; bottom: 16px; z-index: 9999; border: none; border-radius: 999px; background: var(--accent, #2b2418); color: var(--accent-ink, #f4e9c7); padding: 12px 15px; font-weight: 900; box-shadow: 0 10px 30px rgba(0,0,0,.18); cursor: pointer; }
      .diag-panel { position: fixed; right: 16px; bottom: 70px; width: min(560px, calc(100vw - 32px)); max-height: min(760px, calc(100vh - 100px)); overflow: auto; z-index: 9999; background: #fff; color: var(--ink, #1c1812); border: 1px solid var(--line, #ddd); border-radius: 18px; box-shadow: 0 18px 50px rgba(0,0,0,.2); padding: 16px; display: none; }
      .diag-panel.open { display: block; }
      .diag-head { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px; }
      .diag-head h3 { margin:0; font-family: var(--font-serif, serif); font-size:18px; }
      .diag-head button { border:1px solid var(--line, #ddd); background:var(--bg, #f6f5f1); border-radius:10px; padding:7px 10px; cursor:pointer; font-weight:800; }
      .diag-actions { display:flex; gap:8px; flex-wrap:wrap; margin:10px 0; }
      .diag-actions button { border:none; background:var(--accent, #2b2418); color:var(--accent-ink, #f4e9c7); border-radius:10px; padding:9px 12px; cursor:pointer; font-weight:900; }
      .diag-table { width:100%; border-collapse:collapse; font-size:13px; }
      .diag-table th { text-align:left; color:var(--ink-3, #777); border-bottom:1px solid var(--line, #ddd); padding:8px 6px; font-size:12px; }
      .diag-table td { border-bottom:1px solid var(--line, #ddd); padding:9px 6px; vertical-align:top; overflow-wrap:anywhere; }
      .diag-pill { display:inline-block; border-radius:999px; padding:4px 8px; font-size:11px; font-weight:900; }
      .diag-pill.ok { background:var(--ok-bg, #e8f5ee); color:var(--ok, #127a42); }
      .diag-pill.warn { background:var(--warn-bg, #fff4dc); color:var(--warn, #a86b00); }
      .diag-pill.danger { background:var(--danger-bg, #fde8e8); color:var(--danger, #b42318); }
      .diag-note { margin-top:10px; padding:10px; border-radius:12px; background:var(--bg, #f6f5f1); color:var(--ink-3, #777); font-size:12px; line-height:1.55; }
      .diag-pre { white-space:pre-wrap; overflow-wrap:anywhere; background:#111; color:#f4e9c7; border-radius:10px; padding:10px; font-size:11px; margin-top:10px; display:none; }
      .diag-section-title { margin:14px 0 6px; font-size:13px; font-weight:900; color:var(--ink-2, #3b3428); }
      .diag-list { margin:8px 0 0; padding-left:18px; color:var(--ink-3, #777); font-size:12px; line-height:1.55; }
      @media (max-width: 720px) { .diag-fab { right: 12px; bottom: 12px; } .diag-panel { right: 12px; bottom: 62px; width: calc(100vw - 24px); } }
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    injectStyles();
    if (document.getElementById('diagFab')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <button id="diagFab" class="diag-fab" onclick="toggleDiagnosticsPanel()">진단</button>
      <div id="diagPanel" class="diag-panel">
        <div class="diag-head">
          <h3>🧪 서비스 자가진단</h3>
          <button onclick="toggleDiagnosticsPanel(false)">닫기</button>
        </div>
        <div class="diag-actions">
          <button onclick="runDiagnostics()">다시 확인</button>
          <button onclick="copyDiagnostics()">결과 복사</button>
          <button onclick="showDiagnosticsRaw()">원문 보기</button>
        </div>
        <div id="diagResult" class="diag-note">진단 버튼을 누르면 서버/API/패치 상태를 확인합니다.</div>
        <pre id="diagRaw" class="diag-pre"></pre>
      </div>
    `);
  }

  function statusPill(status) {
    const cls = status === '정상' ? 'ok' : status === '주의' ? 'warn' : 'danger';
    return `<span class="diag-pill ${cls}">${esc(status)}</span>`;
  }

  async function fetchJson(url) {
    const started = performance.now();
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      const ms = Math.round(performance.now() - started);
      return { ok: res.ok, status: res.status, ms, data };
    } catch (e) {
      const ms = Math.round(performance.now() - started);
      return { ok: false, status: 'ERR', ms, error: e.message };
    }
  }

  function canUseLocalStorage() {
    try {
      const k = '__gm_diag_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  function detectLoadedScripts() {
    const srcs = [...document.scripts].map((s) => s.getAttribute('src') || '').filter(Boolean);
    const expected = [
      '/gm-core-patch.js', '/platform-patch.js', '/address-fix.js', '/watchlist-patch.js', '/watchlist-enhance-patch.js',
      '/stepflow-patch.js', '/fetch-error-patch.js', '/court-list-patch.js', '/bulk-fetch-patch.js',
      '/map-patch.js', '/molit-patch.js', '/molit-scenario-patch.js', '/capital-patch.js',
      '/cashflow-patch.js', '/stability-patch.js', '/diagnostics-patch.js', '/exit-plan-patch.js',
      '/bid-checklist-patch.js', '/final-summary-patch.js', '/api-guide-patch.js'
    ];
    return expected.map((src) => ({ src, loaded: srcs.some((s) => s.includes(src)) }));
  }

  function detectGlobals() {
    return [
      ['GM 코어', Boolean(window.GM?.core?.version)],
      ['일괄조회 함수', typeof window.runBulkFetch === 'function'],
      ['관심사건 목록 함수', typeof window.renderWatchlist === 'function'],
      ['상세분석 다시 열기', typeof window.openWatchCase === 'function'],
      ['시세 시나리오 계산', typeof window.updateMarketScenarios === 'function'],
      ['실거래가 조회', typeof window.lookupMolitTrades === 'function'],
      ['실거래가 시나리오 반영', typeof window.applyMolitToScenario === 'function'],
      ['자금 가능성 계산', typeof window.updateCapitalCheck === 'function'],
      ['현금흐름 계산', typeof window.updateCashflow === 'function'],
      ['지도 초기화', typeof window.initAuctionMap === 'function'],
      ['엑시트 전략 계산', typeof window.updateExitPlan === 'function'],
      ['입찰 체크리스트', typeof window.updateBidChecklist === 'function'],
      ['API 가이드 새로고침', typeof window.refreshApiGuide === 'function'],
    ];
  }

  function countStorageItems() {
    const keys = [
      'gm_watchlist_v1', 'gm_capital_profile_v1', 'gm_cashflow_profile_v1', 'gm_molit_scenario_prices_v1',
      'gm_exit_plan_profile_v1', 'gm_bid_checklist_v1', 'gm_runtime_errors_v1'
    ];
    return keys.map((key) => {
      let value = '';
      try { value = localStorage.getItem(key) || ''; } catch {}
      return { key, exists: Boolean(value), size: value.length };
    });
  }

  function getGmCoreInfo() {
    const core = window.GM?.core || null;
    const patchStatus = window.GM?.patches?.status?.() || window.__gmPatchStatus || {};
    const patches = Object.entries(patchStatus).map(([name, meta]) => ({ name, ...meta }));
    const errors = window.GM?.utils?.recentErrors?.() || [];
    return {
      loaded: Boolean(core?.version),
      version: core?.version || '',
      loadedAt: core?.loadedAt || '',
      patchCount: patches.length,
      patches,
      runtimeErrors: errors.slice(0, 10),
      lastError: window.__gmLastError || null,
    };
  }

  function row(name, status, detail) {
    return `<tr><td>${esc(name)}</td><td>${statusPill(status)}</td><td>${detail}</td></tr>`;
  }

  function renderPatchList(gmInfo) {
    if (!gmInfo.patches.length) return '<div class="diag-note">등록된 GM 패치 상태가 아직 없습니다.</div>';
    return `<ul class="diag-list">${gmInfo.patches
      .sort((a, b) => String(a.loadedAt || '').localeCompare(String(b.loadedAt || '')))
      .map((p) => `<li><b>${esc(p.name)}</b> · ${esc(p.loadedAt || '-')} ${p.version ? `· ${esc(p.version)}` : ''}</li>`)
      .join('')}</ul>`;
  }

  function renderErrorList(gmInfo) {
    if (!gmInfo.runtimeErrors.length) return '<div class="diag-note">최근 브라우저 오류 기록이 없습니다.</div>';
    return `<ul class="diag-list">${gmInfo.runtimeErrors.slice(0, 5).map((e) => `<li><b>${esc(e.at || '-')}</b> · ${esc(e.message || '-')}${e.context?.source ? ` · ${esc(e.context.source)}` : ''}</li>`).join('')}</ul>`;
  }

  window.toggleDiagnosticsPanel = function(open) {
    ensurePanel();
    const panel = document.getElementById('diagPanel');
    const shouldOpen = typeof open === 'boolean' ? open : !panel.classList.contains('open');
    panel.classList.toggle('open', shouldOpen);
    if (shouldOpen) window.runDiagnostics();
  };

  window.runDiagnostics = async function() {
    ensurePanel();
    const result = document.getElementById('diagResult');
    const raw = document.getElementById('diagRaw');
    result.innerHTML = '진단 중...';
    raw.style.display = 'none';

    const [health, config, courts] = await Promise.all([
      fetchJson('/api/health'),
      fetchJson('/api/config'),
      fetchJson('/api/courts'),
    ]);

    const scripts = detectLoadedScripts();
    const globals = detectGlobals();
    const storageOk = canUseLocalStorage();
    const storageItems = countStorageItems();
    const gmInfo = getGmCoreInfo();
    const missingScripts = scripts.filter((x) => !x.loaded);
    const missingGlobals = globals.filter(([, ok]) => !ok);

    const rows = [];
    rows.push(row('서버 /api/health', health.ok ? '정상' : '위험', `${esc(health.status)} · ${health.ms}ms`));
    rows.push(row('설정 /api/config', config.ok ? '정상' : '위험', `${esc(config.status)} · ${config.ms}ms`));
    rows.push(row('법원 목록 /api/courts', courts.ok ? '정상' : '위험', courts.ok ? `${(courts.data?.courts || []).length}개 · ${courts.ms}ms` : `${esc(courts.status)} · ${courts.ms}ms`));
    rows.push(row('GM 코어', gmInfo.loaded ? '정상' : '위험', gmInfo.loaded ? `${esc(gmInfo.version)} · 패치등록 ${gmInfo.patchCount}개` : 'window.GM 미로드'));
    rows.push(row('브라우저 오류', gmInfo.runtimeErrors.length ? '주의' : '정상', gmInfo.runtimeErrors.length ? `최근 ${gmInfo.runtimeErrors.length}건 기록` : '최근 오류 없음'));
    rows.push(row('Kakao 지도 키', config.data?.hasKakaoMap ? '정상' : '주의', config.data?.hasKakaoMap ? 'KAKAO_JS_KEY 설정됨' : '키 없음: 지도 안내만 표시'));
    rows.push(row('국토부 실거래가 키', config.data?.hasMolit ? '정상' : '주의', config.data?.hasMolit ? 'MOLIT_API_KEY 설정됨' : '키 없음: 조회 시 안내 표시'));
    rows.push(row('localStorage', storageOk ? '정상' : '위험', storageOk ? '저장 가능' : '저장 불가'));
    rows.push(row('패치 스크립트 로딩', missingScripts.length ? '주의' : '정상', missingScripts.length ? `누락: ${missingScripts.map((x) => esc(x.src)).join(', ')}` : `${scripts.length}개 로드 확인`));
    rows.push(row('주요 기능 함수', missingGlobals.length ? '주의' : '정상', missingGlobals.length ? `미확인: ${missingGlobals.map(([n]) => esc(n)).join(', ')}` : `${globals.length}개 확인`));
    rows.push(row('저장 데이터', '정상', storageItems.map((x) => `${esc(x.key)} ${x.exists ? `${x.size}자` : '없음'}`).join('<br>')));

    const overallDanger = !health.ok || !config.ok || !courts.ok || !storageOk || !gmInfo.loaded;
    const overallWarn = missingScripts.length || missingGlobals.length || !config.data?.hasKakaoMap || !config.data?.hasMolit || gmInfo.runtimeErrors.length;
    const overall = overallDanger ? '위험' : overallWarn ? '주의' : '정상';

    result.innerHTML = `
      <div class="diag-note"><b>전체 상태: ${statusPill(overall)}</b><br>API 키가 없는 항목은 기능이 꺼진 상태로 안내만 나오는 것이 정상입니다.</div>
      <table class="diag-table">
        <thead><tr><th>항목</th><th>상태</th><th>상세</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
      <div class="diag-section-title">등록된 GM 패치</div>
      ${renderPatchList(gmInfo)}
      <div class="diag-section-title">최근 브라우저 오류</div>
      ${renderErrorList(gmInfo)}
      <div class="diag-note">문제가 있으면 “결과 복사”를 눌러 그대로 붙여넣으면 원인 추적이 빨라집니다.</div>
    `;

    const payload = { checkedAt: new Date().toISOString(), health, config, courtsCount: courts.data?.courts?.length || 0, scripts, globals: globals.map(([name, ok]) => ({ name, ok })), storageOk, storageItems, gmInfo, overall };
    raw.textContent = JSON.stringify(payload, null, 2);
    window.__gmDiagnosticsLast = payload;
  };

  window.copyDiagnostics = async function() {
    const payload = window.__gmDiagnosticsLast || {};
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      alert('진단 결과를 복사했습니다.');
    } catch {
      const raw = document.getElementById('diagRaw');
      raw.style.display = 'block';
      raw.textContent = text;
      alert('자동 복사는 실패했습니다. 아래 원문을 직접 복사하세요.');
    }
  };

  window.showDiagnosticsRaw = function() {
    const raw = document.getElementById('diagRaw');
    if (!raw) return;
    raw.style.display = raw.style.display === 'block' ? 'none' : 'block';
  };

  document.addEventListener('DOMContentLoaded', ensurePanel);
  if (document.body) ensurePanel();
})();
