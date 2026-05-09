(() => {
  function esc(v) {
    return String(v || '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }
  function tx(el) { return String(el?.textContent || '').replace(/\s+/g, ' ').trim(); }
  function rs() { return document.getElementById('resultsSection'); }
  function isLoading() { return /대법원 경매정보에서 기본정보를 가져오는 중|조회 중|수집 중/.test(tx(rs())); }

  function injectStyles() {
    let s = document.getElementById('stepflowPatchStyles');
    if (!s) { s = document.createElement('style'); s.id = 'stepflowPatchStyles'; document.head.appendChild(s); }
    s.textContent = `
      .results-section { display:block !important; min-height:120px !important; scroll-margin-top:96px; padding-top:0; }
      .results-section.has-results { padding-top:32px; }
      .step-nav { display:flex; gap:8px; flex-wrap:wrap; margin:0 0 18px; position:sticky; top:82px; z-index:20; background:var(--bg); padding:10px 0; }
      .step-chip { border:1px solid var(--line); background:#fff; color:var(--ink-2); border-radius:999px; padding:8px 12px; font-size:12px; font-weight:800; cursor:pointer; }
      .step-chip.active { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
      .step1-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px; }
      .info-mini { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:14px; }
      .info-mini .k { color:var(--ink-3); font-size:12px; margin-bottom:4px; }
      .info-mini .v { font-family:var(--font-serif); font-size:18px; font-weight:800; line-height:1.45; }
      body.step-mode-step1 .step2-divider, body.step-mode-step1 .input-card, body.step-mode-step1 .btn-analyze-wrap { display:none !important; }
      body.step-mode-step2 .step1-extra-card, body.step-mode-step2 .basic-info-card, body.step-mode-step2 .interested-card, body.step-mode-step2 .verdict.step1-verdict { display:none !important; }
      .source-badge { display:inline-flex; border-radius:999px; background:var(--accent-soft); color:var(--accent); padding:5px 10px; font-size:11px; font-weight:800; margin-bottom:10px; }
      .step2-toggle-card { background:#fff; border:1px solid var(--line); border-radius:var(--radius); padding:22px; margin:18px 0; text-align:center; box-shadow:0 10px 24px rgba(0,0,0,.04); }
      .step2-toggle-card button { background:var(--accent); color:var(--accent-ink); border:none; border-radius:10px; padding:12px 18px; font-weight:900; cursor:pointer; }
    `;
  }

  function markCards() {
    const root = rs();
    if (!root || !tx(root)) return;
    root.classList.add('has-results');
    root.querySelector('.verdict')?.classList.add('step1-verdict');
    [...root.querySelectorAll('.subcard h4')].forEach(h => {
      const c = h.closest('.subcard');
      if (/자동\s*수집된\s*사건\s*정보/.test(tx(h))) c?.classList.add('basic-info-card');
      if (/이해관계인/.test(tx(h))) c?.classList.add('interested-card');
    });
    root.querySelector('.btn-analyze')?.parentElement?.classList.add('btn-analyze-wrap');
  }

  function addNav() {
    const root = rs();
    if (!root || root.querySelector('.step-nav') || !tx(root) || isLoading()) return;
    root.insertAdjacentHTML('afterbegin', `
      <div class="step-nav">
        <button type="button" class="step-chip active" data-step-chip="1" onclick="showStepMode('step1')">1 기본정보·현황</button>
        <button type="button" class="step-chip" data-step-chip="2" onclick="showStepMode('step2')">2 명세서 입력</button>
        <button type="button" class="step-chip" data-step-chip="3" onclick="showStepMode('step2', true)">3 권리분석 실행</button>
      </div>`);
  }

  function cardHtml(raw) {
    const b = raw.basic || {};
    const interested = Array.isArray(raw.interested) ? raw.interested : [];
    const tenants = interested.filter(x => x.type === '임차인').length;
    const address = b['소재지'] || '';
    return `
      <div class="subcard step1-extra-card">
        <span class="source-badge">Step 1 · 진행일정</span>
        <h4>📅 진행일정 / 매각기일</h4>
        <div class="note warn-note">기일내역은 원문에서 재확인하세요. 현재는 자동 수집된 매각기일만 요약에 반영했습니다.</div>
      </div>
      <div class="subcard step1-extra-card">
        <span class="source-badge">Step 1 · 현황요약</span>
        <h4>🏚 물건·현황 요약</h4>
        <div class="step1-grid">
          <div class="info-mini"><div class="k">물건종별</div><div class="v">${esc(b['물건종별'] || '-')}</div></div>
          <div class="info-mini"><div class="k">매각기일</div><div class="v">${esc(b['매각기일'] || '-')}</div></div>
          <div class="info-mini"><div class="k">배당요구종기</div><div class="v">${esc(b['배당요구종기'] || '-')}</div></div>
          <div class="info-mini"><div class="k">입찰보증금률</div><div class="v">${esc(b['입찰보증금률'] || '-')}</div></div>
          <div class="info-mini"><div class="k">물건 수</div><div class="v">${(raw.objects || []).length || 1}개</div></div>
          <div class="info-mini"><div class="k">임차인 / 이해관계인</div><div class="v">${tenants}명 / ${interested.length}명</div></div>
        </div>
      </div>
      <div class="subcard step1-extra-card">
        <span class="source-badge">Step 1 · 입지/시세 준비</span>
        <h4>🗺 입지분석 / 시세 검증</h4>
        <div class="step1-grid">
          <div class="info-mini"><div class="k">주소</div><div class="v">${esc(address || '-')}</div></div>
          <div class="info-mini"><div class="k">지도 연동</div><div class="v">Kakao API 키 필요</div></div>
          <div class="info-mini"><div class="k">실거래가</div><div class="v">국토부 API 연동 필요</div></div>
        </div>
      </div>`;
  }

  function addStep2Toggle() {
    const root = rs();
    if (!root || root.querySelector('.step2-toggle-card')) return;
    const divider = root.querySelector('.step2-divider');
    if (!divider) return;
    divider.insertAdjacentHTML('beforebegin', `<div class="step2-toggle-card"><h4>다음 단계가 필요하면 Step 2로 이동하세요</h4><p>매각물건명세서의 최선순위 설정·임차인·특수권리를 입력해 권리분석을 실행합니다.</p><button onclick="showStepMode('step2')">Step 2 입력으로 이동</button></div>`);
  }

  window.showStepMode = function(mode, goAnalyze = false) {
    if (isLoading()) return;
    document.body.classList.toggle('step-mode-step1', mode === 'step1');
    document.body.classList.toggle('step-mode-step2', mode === 'step2');
    document.querySelectorAll('[data-step-chip]').forEach(chip => chip.classList.toggle('active', chip.dataset.stepChip === (mode === 'step2' ? (goAnalyze ? '3' : '2') : '1')));
  };

  function enrich(raw) {
    try {
      injectStyles();
      const root = rs();
      if (!root || isLoading() || root.querySelector('.step1-extra-card') || !tx(root)) return;
      markCards();
      addNav();
      const anchor = root.querySelector('.basic-info-card') || root.querySelector('.verdict');
      if (anchor) anchor.insertAdjacentHTML('afterend', cardHtml(raw));
      addStep2Toggle();
      window.showStepMode('step1');
    } catch (e) { console.warn('[stepflow hotfix] failed:', e); }
  }

  const wait = setInterval(() => {
    if (typeof window.renderStep1 !== 'function') return;
    clearInterval(wait);
    const original = window.renderStep1;
    window.renderStep1 = function(raw, elapsed) {
      document.body.classList.remove('step-mode-step1', 'step-mode-step2');
      original(raw, elapsed);
      if (tx(rs())) rs().classList.add('has-results');
      enrich(raw);
    };
    window.GM?.patches?.register?.('stepflow', { version:'v4-hotfix-no-hide-results' });
  }, 50);

  document.addEventListener('DOMContentLoaded', injectStyles);
  injectStyles();
})();
