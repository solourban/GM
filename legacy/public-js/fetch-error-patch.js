(() => {
  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function injectStyles() {
    if (document.getElementById('fetchErrorPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'fetchErrorPatchStyles';
    style.textContent = `
      .fetch-fail-card { text-align:left; }
      .fetch-fail-card h3 { margin:0 0 8px; color:var(--danger); }
      .fetch-fail-lead { color:var(--ink-2); line-height:1.65; margin:0 0 12px; }
      .fetch-fail-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin:14px 0; }
      .fetch-fail-box { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:12px; }
      .fetch-fail-box .k { color:var(--ink-3); font-size:12px; }
      .fetch-fail-box .v { font-weight:800; margin-top:3px; }
      .fetch-hints { margin:12px 0 0; padding-left:20px; color:var(--ink-2); }
      .fetch-hints li { margin:5px 0; }
      .fetch-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
      .fetch-actions button { background:var(--accent); color:var(--accent-ink); border:none; border-radius:10px; padding:10px 13px; font-weight:900; cursor:pointer; }
      .fetch-actions button.secondary { background:var(--bg); color:var(--ink-2); border:1px solid var(--line); }
      .debug-toggle { margin-top:12px; }
      .debug-toggle summary { cursor:pointer; font-weight:800; color:var(--ink-3); }
      .debug-steps { background:#111; color:#f4e9c7; border-radius:10px; padding:12px; overflow-x:auto; font-size:12px; white-space:pre-wrap; }
    `;
    document.head.appendChild(style);
  }

  function reasonMessage(diagnosis) {
    const reason = diagnosis?.reason;
    const courtName = diagnosis?.courtName || '';
    if (reason === 'court_not_supported') return '현재 선택한 법원명이 시스템 법원목록과 매칭되지 않았습니다.';
    if (reason === 'case_not_found_or_empty') return `${courtName || '선택 법원'}은 지원되는 법원으로 보입니다. 다만 해당 사건번호가 대법원 단건 조회 API에서 빈 값으로 응답했습니다.`;
    if (reason === 'api_exception') return '대법원 조회 API 호출 중 예외가 발생했습니다. 일시적 응답 지연 또는 API 구조 차이일 수 있습니다.';
    return '사건 정보를 가져오지 못했습니다.';
  }

  function renderFetchError(data) {
    injectStyles();
    const diagnosis = data?.diagnosis || {};
    const debug = data?.debug || {};
    const hints = Array.isArray(diagnosis.hints) && diagnosis.hints.length
      ? diagnosis.hints
      : [
        '법원명, 사건연도, 사건번호가 맞는지 확인하세요.',
        '취하·정지·종국·매각완료 사건은 자동 조회가 실패할 수 있습니다.',
        '대법원 경매정보 사이트 응답 지연이면 잠시 후 다시 시도하세요.'
      ];
    const steps = Array.isArray(debug.steps) ? debug.steps.join('\n') : '';
    const isCourtSupported = Boolean(diagnosis.cortOfcCd);

    return `
      <div class="error-card fetch-fail-card">
        <h3>❌ 사건 정보를 찾지 못했습니다</h3>
        <p class="fetch-fail-lead">${esc(reasonMessage(diagnosis))}</p>
        <div class="fetch-fail-grid">
          <div class="fetch-fail-box"><div class="k">확인한 법원</div><div class="v">${esc(diagnosis.courtName || '-')}</div></div>
          <div class="fetch-fail-box"><div class="k">사건번호</div><div class="v">${esc(diagnosis.csNo || '-')}</div></div>
          <div class="fetch-fail-box"><div class="k">법원코드</div><div class="v">${esc(diagnosis.cortOfcCd || '-')}</div></div>
          <div class="fetch-fail-box"><div class="k">법원 지원 여부</div><div class="v">${isCourtSupported ? '지원됨' : '미지원/매칭실패'}</div></div>
        </div>
        <div class="note warn-note">
          <b>가능한 원인</b>
          <ol class="fetch-hints">
            ${hints.map((h) => `<li>${esc(h)}</li>`).join('')}
            ${isCourtSupported ? '<li>따라서 이번 실패는 “부산이라서 안 됨”보다는 사건번호·사건상태·대법원 응답 구조 문제일 가능성이 큽니다.</li>' : ''}
          </ol>
        </div>
        <div class="fetch-actions">
          <button type="button" onclick="document.querySelector(\'.search-box\')?.scrollIntoView({behavior:\'smooth\', block:\'center\'})">검색창으로 이동</button>
          <button type="button" class="secondary" onclick="document.querySelector(\'.bulk-card\')?.scrollIntoView({behavior:\'smooth\', block:\'center\'})">일괄조회로 이동</button>
        </div>
        ${steps ? `
          <details class="debug-toggle">
            <summary>개발용 조회 단계 보기</summary>
            <pre class="debug-steps">${esc(steps)}</pre>
          </details>
        ` : ''}
      </div>`;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function patchedFetch(input, init) {
    const res = await originalFetch(input, init);
    try {
      const url = typeof input === 'string' ? input : input?.url;
      if (url && url.includes('/api/fetch') && !res.ok) {
        const cloned = res.clone();
        const data = await cloned.json().catch(() => null);
        if (data) {
          setTimeout(() => {
            const rs = document.getElementById('resultsSection');
            const currentError = rs?.querySelector('.error-card');
            if (rs && currentError) {
              rs.innerHTML = renderFetchError(data);
              rs.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 0);
        }
      }
    } catch (_) {}
    return res;
  };
  window.GM?.patches?.register?.('fetch-error', { version: 'v2' });
})();
