(() => {
  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function injectStyles() {
    if (document.getElementById('stepflowPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'stepflowPatchStyles';
    style.textContent = `
      .brand { cursor:pointer; }
      .results-section { scroll-margin-top: 24px; min-height:0 !important; padding-top:0; }
      .results-section:empty { display:none; }
      .results-section.has-results { display:block; padding-top:32px; }
      .step-nav { display:flex; gap:8px; flex-wrap:wrap; margin: 0 0 18px; position:sticky; top:0; z-index:20; background:var(--bg); padding:10px 0; }
      .step-chip { border:1px solid var(--line); background:#fff; color:var(--ink-2); border-radius:999px; padding:8px 12px; font-size:12px; font-weight:800; cursor:pointer; }
      .step-chip.active { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
      .step1-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:14px; }
      .info-mini { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:14px; }
      .info-mini .k { color:var(--ink-3); font-size:12px; margin-bottom:4px; }
      .info-mini .v { font-family:var(--font-serif); font-size:18px; font-weight:800; line-height:1.45; }
      .timeline-table { width:100%; border-collapse:collapse; font-size:13px; }
      .timeline-table th { text-align:left; color:var(--ink-3); border-bottom:1px solid var(--line); padding:9px 8px; font-size:12px; }
      .timeline-table td { border-bottom:1px solid var(--line); padding:10px 8px; }
      body.step-mode-step1 .step2-divider,
      body.step-mode-step1 .input-card,
      body.step-mode-step1 .btn-analyze-wrap { display:none !important; }
      body.step-mode-step2 .step1-extra-card,
      body.step-mode-step2 .basic-info-card,
      body.step-mode-step2 .interested-card,
      body.step-mode-step2 .verdict.step1-verdict { display:none !important; }
      .step2-toggle-card { background:#fff; color:var(--ink); border:1px solid var(--line); border-radius:var(--radius); padding:22px; margin:18px 0; text-align:center; box-shadow:0 10px 24px rgba(0,0,0,.04); }
      .step2-toggle-card h4 { margin:0 0 8px; font-family:var(--font-serif); font-size:20px; }
      .step2-toggle-card p { margin:0 0 14px; color:var(--ink-3); }
      .step2-toggle-card button { background:var(--accent); color:var(--accent-ink); border:none; border-radius:10px; padding:12px 18px; font-weight:900; cursor:pointer; }
      .source-badge { display:inline-flex; align-items:center; gap:6px; border-radius:999px; background:var(--accent-soft); color:var(--accent); padding:5px 10px; font-size:11px; font-weight:800; margin-bottom:10px; }
    `;
    document.head.appendChild(style);
  }

  function scrollResults() {
    setTimeout(() => document.getElementById('resultsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }

  function makeScheduleCard(raw) {
    const rows = Array.isArray(raw.schedule) ? raw.schedule : [];
    if (!rows.length) {
      return `
        <div class="subcard step1-extra-card">
          <span class="source-badge">Step 1 · 진행일정</span>
          <h4>📅 진행일정 / 매각기일</h4>
          <div class="note warn-note">기일내역이 자동 조회되지 않았습니다. 대법원 원본에서 매각기일·매각결정기일을 재확인하세요.</div>
        </div>`;
    }
    return `
      <div class="subcard step1-extra-card">
        <span class="source-badge">Step 1 · 진행일정</span>
        <h4>📅 진행일정 / 매각기일</h4>
        <table class="timeline-table">
          <thead><tr><th>일자</th><th>시간</th><th>장소</th><th>구분</th><th>결과</th><th style="text-align:right">최저가</th></tr></thead>
          <tbody>
            ${rows.slice(0, 12).map((r) => `
              <tr>
                <td>${esc(r[0])}</td>
                <td>${esc(r[1])}</td>
                <td>${esc(r[2])}</td>
                <td>${esc(r[3])}</td>
                <td>${esc(r[4])}</td>
                <td style="text-align:right">${esc(r[5])}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function makeStatusCard(raw) {
    const basic = raw.basic || {};
    const objects = Array.isArray(raw.objects) ? raw.objects : [];
    const interested = Array.isArray(raw.interested) ? raw.interested : [];
    const tenants = interested.filter((x) => x.type === '임차인').length;

    return `
      <div class="subcard step1-extra-card">
        <span class="source-badge">Step 1 · 현황요약</span>
        <h4>🏚 물건·현황 요약</h4>
        <div class="step1-grid">
          <div class="info-mini"><div class="k">물건종별</div><div class="v">${esc(basic['물건종별'] || '-')}</div></div>
          <div class="info-mini"><div class="k">매각기일</div><div class="v">${esc(basic['매각기일'] || '-')}</div></div>
          <div class="info-mini"><div class="k">배당요구종기</div><div class="v">${esc(basic['배당요구종기'] || '-')}</div></div>
          <div class="info-mini"><div class="k">입찰보증금률</div><div class="v">${esc(basic['입찰보증금률'] || '-')}</div></div>
          <div class="info-mini"><div class="k">물건 수</div><div class="v">${objects.length || 1}개</div></div>
          <div class="info-mini"><div class="k">임차인 / 이해관계인</div><div class="v">${tenants}명 / ${interested.length}명</div></div>
        </div>
      </div>`;
  }

  function makeLocationCard(raw) {
    const address = raw.basic?.['소재지'] || '';
    const encoded = encodeURIComponent(address);
    return `
      <div class="subcard step1-extra-card">
        <span class="source-badge">Step 1 · 입지/시세 준비</span>
        <h4>🗺 입지분석 / 시세 검증</h4>
        <div class="step1-grid">
          <div class="info-mini"><div class="k">주소</div><div class="v">${esc(address || '-')}</div></div>
          <div class="info-mini"><div class="k">지도 연동</div><div class="v">Kakao API 키 필요</div></div>
          <div class="info-mini"><div class="k">실거래가</div><div class="v">국토부 API 연동 필요</div></div>
        </div>
        <div class="note warn-note" style="margin-top:14px">
          ${address ? `<a href="https://map.kakao.com/link/search/${encoded}" target="_blank" rel="noopener">카카오맵에서 주소 확인하기</a>` : '주소 확인 후 지도와 실거래가를 검토하세요.'}
        </div>
      </div>`;
  }

  function addStepNavigation() {
    const rs = document.getElementById('resultsSection');
    if (!rs || rs.querySelector('.step-nav')) return;
    rs.insertAdjacentHTML('afterbegin', `
      <div class="step-nav">
        <button type="button" class="step-chip active" data-step-chip="1" onclick="showStepMode('step1')">1 기본정보·현황</button>
        <button type="button" class="step-chip" data-step-chip="2" onclick="showStepMode('step2')">2 명세서 입력</button>
        <button type="button" class="step-chip" data-step-chip="3" onclick="showStepMode('step2', true)">3 권리분석 실행</button>
      </div>`);
  }

  window.showStepMode = function(mode, goAnalyze = false) {
    document.body.classList.toggle('step-mode-step1', mode === 'step1');
    document.body.classList.toggle('step-mode-step2', mode === 'step2');
    document.querySelectorAll('[data-step-chip]').forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.stepChip === (mode === 'step2' ? (goAnalyze ? '3' : '2') : '1'));
    });
    const target = goAnalyze ? document.querySelector('.btn-analyze') : (mode === 'step2' ? document.querySelector('.step2-divider, .input-card') : document.getElementById('resultsSection'));
    setTimeout(() => target?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  function insertStep2Toggle() {
    const rs = document.getElementById('resultsSection');
    if (!rs || rs.querySelector('.step2-toggle-card')) return;
    const divider = rs.querySelector('.step2-divider');
    if (!divider) return;
    divider.insertAdjacentHTML('beforebegin', `
      <div class="step2-toggle-card">
        <h4>다음 단계가 필요하면 Step 2로 이동하세요</h4>
        <p>매각물건명세서의 최선순위 설정·임차인·특수권리를 입력해 권리분석을 실행합니다.</p>
        <button onclick="showStepMode('step2')">Step 2 입력으로 이동</button>
      </div>`);
  }

  function markCards() {
    const rs = document.getElementById('resultsSection');
    if (!rs) return;
    rs.classList.add('has-results');
    rs.querySelector('.verdict')?.classList.add('step1-verdict');
    [...rs.querySelectorAll('.subcard h4')].forEach((h) => {
      const card = h.closest('.subcard');
      if (h.textContent.includes('자동 수집된 사건 정보')) card?.classList.add('basic-info-card');
      if (h.textContent.includes('이해관계인')) card?.classList.add('interested-card');
    });
    rs.querySelector('.btn-analyze')?.parentElement?.classList.add('btn-analyze-wrap');
  }

  function enrichStep1(raw) {
    injectStyles();
    const rs = document.getElementById('resultsSection');
    if (!rs || rs.querySelector('.step1-extra-card')) return;
    rs.classList.add('has-results');
    addStepNavigation();
    markCards();

    const basicInfoCard = rs.querySelector('.basic-info-card');
    const anchor = basicInfoCard || rs.querySelector('.verdict');
    if (!anchor) return;

    anchor.insertAdjacentHTML('afterend', makeScheduleCard(raw) + makeStatusCard(raw) + makeLocationCard(raw));
    insertStep2Toggle();
    showStepMode('step1');
    scrollResults();
  }

  const wait = setInterval(() => {
    if (typeof window.renderStep1 === 'function') {
      clearInterval(wait);
      const original = window.renderStep1;
      window.renderStep1 = function patchedRenderStep1(raw, elapsed) {
        document.body.classList.remove('step-mode-step1', 'step-mode-step2');
        const rs = document.getElementById('resultsSection');
        rs?.classList.add('has-results');
        original(raw, elapsed);
        enrichStep1(raw);
      };
    }
  }, 50);

  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    const rs = document.getElementById('resultsSection');
    if (rs && !rs.innerHTML.trim()) rs.classList.remove('has-results');
    document.querySelector('.brand')?.addEventListener('click', () => { location.href = '/'; });
  });
})();
