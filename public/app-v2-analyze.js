(() => {
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  const state = {
    analyzing: false,
    error: '',
    report: null,
    lastRunAt: '',
  };

  function rootState() {
    return window.__auctionV2?.state || null;
  }

  function resultRoot() {
    return document.getElementById('resultsSection');
  }

  function ensureAnalyzeMount() {
    const root = resultRoot();
    if (!root) return null;
    let mount = document.getElementById('v2AnalyzeMount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'v2AnalyzeMount';
      root.appendChild(mount);
    }
    return mount;
  }

  function injectStyles() {
    if (document.getElementById('v2AnalyzeStyles')) return;
    const style = document.createElement('style');
    style.id = 'v2AnalyzeStyles';
    style.textContent = `
      .v2-analyze-ready { border-left:4px solid var(--accent); }
      .v2-analyze-result { border-left:4px solid var(--accent); }
      .v2-risk-badge { display:inline-flex; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:900; }
      .v2-risk-badge.ok { background:var(--ok-bg); color:var(--ok); }
      .v2-risk-badge.warn { background:var(--warn-bg); color:var(--warn); }
      .v2-risk-badge.danger { background:var(--danger-bg); color:var(--danger); }
      .v2-analyze-list { margin:10px 0 0; padding-left:18px; color:var(--ink-2); font-size:13px; line-height:1.7; }
      .v2-analyze-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }
    `;
    document.head.appendChild(style);
  }

  function safeManual(manual) {
    return {
      malso: { ...(manual?.malso || {}) },
      tenants: Array.isArray(manual?.tenants) ? manual.tenants.map((t) => ({ ...t })) : [],
      specials: Array.isArray(manual?.specials) ? manual.specials.map((s) => ({ ...s })) : [],
    };
  }

  function hasMeaningfulManual(app) {
    const m = app?.manual || {};
    const malso = m.malso || {};
    const hasMalso = [malso.date, malso.type, malso.holder, malso.amount].some(clean);
    const hasTenant = Array.isArray(m.tenants) && m.tenants.some((t) => [t.name, t.moveIn, t.fixed, t.deposit].some(clean));
    const hasSpecial = Array.isArray(m.specials) && m.specials.some((s) => [s.type, s.holder, s.date, s.amount].some(clean));
    return hasMalso || hasTenant || hasSpecial;
  }

  function riskLabel(level) {
    const value = clean(level || 'warn');
    if (value === 'ok') return { cls: 'ok', label: '낮음' };
    if (value === 'danger') return { cls: 'danger', label: '높음' };
    return { cls: 'warn', label: '주의' };
  }

  function summaryItems(report) {
    const items = [];
    const inherited = Number(report?.inherited?.total || 0);
    const tenants = Array.isArray(report?.tenants) ? report.tenants : [];
    const rights = Array.isArray(report?.rights) ? report.rights : [];
    const daehang = tenants.filter((t) => t.daehang === '있음').length;
    const unknown = tenants.filter((t) => !t.moveIn || t.daehang === '?' || t.daehang === '확인필요').length;
    const takeover = rights.filter((r) => r.status === '인수').length;

    items.push(`입력 임차인 ${tenants.length}명 기준으로 대항력 여부를 1차 판단했습니다.`);
    if (inherited > 0) items.push(`인수 가능 금액이 ${inherited.toLocaleString('ko-KR')}원으로 계산되었습니다.`);
    else items.push('현재 입력 기준으로 인수금액은 0원으로 계산되었습니다.');
    if (daehang) items.push(`대항력 있음으로 분류된 임차인이 ${daehang}명 있습니다.`);
    if (unknown) items.push(`전입일 등 확인이 필요한 임차인이 ${unknown}명 있습니다.`);
    if (takeover) items.push(`말소되지 않고 인수로 분류된 권리가 ${takeover}건 있습니다.`);
    if (!items.length) items.push('입력값 기준 중대 위험은 확인되지 않았습니다.');
    return items.slice(0, 6);
  }

  function renderAnalyzePanel() {
    injectStyles();
    const app = rootState();
    const mount = ensureAnalyzeMount();
    if (!mount || !app || app.status !== 'success' || !app.raw) return;

    const canAnalyze = hasMeaningfulManual(app);
    const report = state.report;
    const risk = riskLabel(report?.risk?.level);
    const body = [];

    body.push(`
      <section class="v2-result-card v2-analyze-ready">
        <h3>권리분석 실행</h3>
        <p class="v2-note">Step 2 입력값을 기준으로 1차 권리분석을 실행합니다. 실패해도 조회 결과와 입력값은 유지됩니다.</p>
        <div class="v2-analyze-actions">
          <button class="v2-btn" type="button" id="btnAnalyzeV2" ${state.analyzing || !canAnalyze ? 'disabled' : ''}>${state.analyzing ? '분석 중...' : '권리분석 실행'}</button>
          ${!canAnalyze ? '<span class="v2-note">최선순위 권리, 임차인, 특수권리 중 하나 이상 입력하면 실행할 수 있습니다.</span>' : ''}
        </div>
      </section>
    `);

    if (state.error) {
      body.push(`<section class="v2-result-card v2-error"><h3>권리분석 실패</h3><p>${esc(state.error)}</p><p class="v2-note">Step 2 입력값은 유지됩니다. 입력값을 확인한 뒤 다시 실행하세요.</p></section>`);
    }

    if (report) {
      body.push(`
        <section class="v2-result-card v2-analyze-result">
          <div class="v2-result-head">
            <div><span class="v2-risk-badge ${risk.cls}">위험도 ${esc(risk.label)}</span><h3>권리분석 결과</h3><p class="v2-note">${esc(state.lastRunAt)} 기준 실행 결과입니다.</p></div>
          </div>
          <div class="v2-grid compact">
            <div class="v2-info"><div class="k">위험 등급</div><div class="v">${esc(risk.label)}</div></div>
            <div class="v2-info"><div class="k">인수금액</div><div class="v">${Number(report?.inherited?.total || 0).toLocaleString('ko-KR')}원</div></div>
            <div class="v2-info"><div class="k">임차인</div><div class="v">${Array.isArray(report?.tenants) ? report.tenants.length : 0}명</div></div>
            <div class="v2-info"><div class="k">권리</div><div class="v">${Array.isArray(report?.rights) ? report.rights.length : 0}건</div></div>
          </div>
          <ul class="v2-analyze-list">${summaryItems(report).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
          <p class="v2-note">이 결과는 입력값 기반의 1차 판단입니다. 실제 입찰 전 등기부, 매각물건명세서, 전입세대열람, 현장조사를 다시 확인해야 합니다.</p>
        </section>
      `);
    }

    mount.innerHTML = body.join('');
    document.getElementById('btnAnalyzeV2')?.addEventListener('click', runAnalyze);
  }

  async function runAnalyze() {
    const app = rootState();
    if (!app?.raw || state.analyzing) return;
    state.analyzing = true;
    state.error = '';
    renderAnalyzePanel();

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw: app.raw,
          manual: safeManual(app.manual),
          region: 'other',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || data.detail || '권리분석에 실패했습니다.');
      state.report = data.report;
      state.lastRunAt = new Date().toLocaleString('ko-KR');
      state.error = '';
    } catch (err) {
      state.error = err.message || String(err);
    } finally {
      state.analyzing = false;
      renderAnalyzePanel();
      document.getElementById('v2AnalyzeMount')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const originalRenderResultsWait = setInterval(() => {
    if (!window.__auctionV2?.renderResults) return;
    clearInterval(originalRenderResultsWait);
    const originalRenderResults = window.__auctionV2.renderResults;
    window.__auctionV2.renderResults = function patchedRenderResults(...args) {
      originalRenderResults(...args);
      renderAnalyzePanel();
    };
    renderAnalyzePanel();
  }, 50);
})();
