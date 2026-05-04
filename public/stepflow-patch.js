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
      .step-nav { display:flex; gap:8px; flex-wrap:wrap; margin: 0 0 18px; }
      .step-chip { border:1px solid var(--line); background:#fff; color:var(--ink-2); border-radius:999px; padding:8px 12px; font-size:12px; font-weight:800; }
      .step-chip.active { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
      .step1-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:14px; }
      .info-mini { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:14px; }
      .info-mini .k { color:var(--ink-3); font-size:12px; margin-bottom:4px; }
      .info-mini .v { font-family:var(--font-serif); font-size:18px; font-weight:800; line-height:1.45; }
      .timeline-table { width:100%; border-collapse:collapse; font-size:13px; }
      .timeline-table th { text-align:left; color:var(--ink-3); border-bottom:1px solid var(--line); padding:9px 8px; font-size:12px; }
      .timeline-table td { border-bottom:1px solid var(--line); padding:10px 8px; }
      .step2-collapsed .input-card, .step2-collapsed .btn-analyze { display:none !important; }
      .step2-toggle-card { background:var(--accent); color:var(--accent-ink); border-radius:var(--radius); padding:24px; margin:18px 0; text-align:center; }
      .step2-toggle-card h4 { margin:0 0 8px; font-family:var(--font-serif); font-size:20px; }
      .step2-toggle-card p { margin:0 0 14px; color:rgba(244,233,199,.78); }
      .step2-toggle-card button { background:var(--accent-ink); color:var(--accent); border:none; border-radius:10px; padding:12px 18px; font-weight:900; cursor:pointer; }
      .source-badge { display:inline-flex; align-items:center; gap:6px; border-radius:999px; background:var(--accent-soft); color:var(--accent); padding:5px 10px; font-size:11px; font-weight:800; margin-bottom:10px; }
    `;
    document.head.appendChild(style);
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
    const creditors = interested.filter((x) => /채권|근저당|신청/.test(x.type || '')).length;

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
        <div class="note" style="margin-top:14px">등기현황·감정현황·현황조사 세부값은 원본 API/문서 연결을 추가로 붙여야 정확도가 올라갑니다. 현재는 법원 사건 기본정보 기준 요약입니다.</div>
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
          다음 단계에서 Kakao 지도 API 키와 국토부 실거래가 API 키를 붙이면, 지도·주변시설·실거래가·호가/전세가 입력 카드로 확장합니다.
          ${address ? `<br><a href="https://map.kakao.com/link/search/${encoded}" target="_blank" rel="noopener">카카오맵에서 주소 확인하기</a>` : ''}
        </div>
      </div>`;
  }

  function addStepNavigation() {
    const rs = document.getElementById('resultsSection');
    if (!rs || rs.querySelector('.step-nav')) return;
    rs.insertAdjacentHTML('afterbegin', `
      <div class="step-nav">
        <span class="step-chip active">1 기본정보·현황</span>
        <span class="step-chip">2 명세서 입력</span>
        <span class="step-chip">3 권리분석·수익</span>
        <span class="step-chip">4 관심사건 비교</span>
      </div>`);
  }

  function collapseStep2() {
    const rs = document.getElementById('resultsSection');
    if (!rs || rs.querySelector('.step2-toggle-card')) return;
    const divider = rs.querySelector('.step2-divider');
    if (!divider) return;

    document.body.classList.add('step2-collapsed');
    divider.insertAdjacentHTML('afterend', `
      <div class="step2-toggle-card">
        <h4>Step 2. 매각물건명세서 입력</h4>
        <p>Step 1의 일정·현황·입지 확인 후, 명세서 핵심값을 입력해 권리분석을 실행합니다.</p>
        <button onclick="openStep2Input()">Step 2 입력 열기</button>
      </div>`);
  }

  window.openStep2Input = function() {
    document.body.classList.remove('step2-collapsed');
    const card = document.querySelector('.step2-toggle-card');
    if (card) card.remove();
    document.querySelectorAll('.step-chip').forEach((x, idx) => {
      x.classList.toggle('active', idx === 1);
    });
    document.querySelector('.step2-divider')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  function enrichStep1(raw) {
    injectStyles();
    const rs = document.getElementById('resultsSection');
    if (!rs || rs.querySelector('.step1-extra-card')) return;
    addStepNavigation();

    const basicInfoCard = [...rs.querySelectorAll('.subcard h4')]
      .find((h) => h.textContent.includes('자동 수집된 사건 정보'))?.closest('.subcard');
    const anchor = basicInfoCard || rs.querySelector('.verdict');
    if (!anchor) return;

    anchor.insertAdjacentHTML('afterend', makeScheduleCard(raw) + makeStatusCard(raw) + makeLocationCard(raw));
    collapseStep2();
  }

  const wait = setInterval(() => {
    if (typeof window.renderStep1 === 'function') {
      clearInterval(wait);
      const original = window.renderStep1;
      window.renderStep1 = function patchedRenderStep1(raw, elapsed) {
        document.body.classList.remove('step2-collapsed');
        original(raw, elapsed);
        enrichStep1(raw);
      };
    }
  }, 50);

  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    document.querySelector('.brand')?.addEventListener('click', () => { location.href = '/'; });
  });
})();
