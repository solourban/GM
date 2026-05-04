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
      .fetch-fail-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin:14px 0; }
      .fetch-fail-box { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:12px; }
      .fetch-fail-box .k { color:var(--ink-3); font-size:12px; }
      .fetch-fail-box .v { font-weight:800; margin-top:3px; }
      .fetch-hints { margin:12px 0 0; padding-left:20px; color:var(--ink-2); }
      .fetch-hints li { margin:5px 0; }
      .debug-toggle { margin-top:12px; }
      .debug-toggle summary { cursor:pointer; font-weight:800; color:var(--ink-3); }
      .debug-steps { background:#111; color:#f4e9c7; border-radius:10px; padding:12px; overflow-x:auto; font-size:12px; white-space:pre-wrap; }
    `;
    document.head.appendChild(style);
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

    return `
      <div class="error-card fetch-fail-card">
        <h3>❌ 법원경매정보 조회 실패</h3>
        <p>${esc(data?.error || '사건 정보를 가져오지 못했습니다.')}</p>
        <div class="fetch-fail-grid">
          <div class="fetch-fail-box"><div class="k">확인한 법원</div><div class="v">${esc(diagnosis.courtName || '-')}</div></div>
          <div class="fetch-fail-box"><div class="k">사건번호</div><div class="v">${esc(diagnosis.csNo || '-')}</div></div>
          <div class="fetch-fail-box"><div class="k">법원코드</div><div class="v">${esc(diagnosis.cortOfcCd || '-')}</div></div>
          <div class="fetch-fail-box"><div class="k">소요시간</div><div class="v">${esc(data?.elapsed || '-')}</div></div>
        </div>
        <div class="note warn-note">
          <b>가능한 원인</b>
          <ol class="fetch-hints">
            ${hints.map((h) => `<li>${esc(h)}</li>`).join('')}
          </ol>
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
            if (rs && currentError) rs.innerHTML = renderFetchError(data);
          }, 0);
        }
      }
    } catch (_) {}
    return res;
  };
})();
