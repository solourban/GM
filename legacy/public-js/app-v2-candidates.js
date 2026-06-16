(() => {
  const STORAGE_KEY = 'auction-note:v2:candidates';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function app() {
    return window.__auctionV2 || null;
  }

  function state() {
    return app()?.state || null;
  }

  function readCandidates() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeCandidates(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 20)));
    } catch (_) {}
  }

  function getCaseIdentity(report) {
    const s = state();
    const caseNo = clean(report?.case || s?.caseNo || s?.caseData?.caseNo || s?.caseData?.case);
    const court = clean(report?.court || s?.court || s?.caseData?.court || '');
    const yearMatch = caseNo.match(/^(\d{4})/);
    const year = clean(s?.year || s?.caseData?.year || yearMatch?.[1] || '');
    if (!caseNo) return null;
    return { court, year, caseNo, key: `${court}:${year}:${caseNo}` };
  }

  function getBasic(report, key) {
    return clean(report?.basic?.[key] || report?.basic?.[key.replace(/ /g, '')] || '');
  }

  function makeCandidate(report) {
    const identity = getCaseIdentity(report);
    if (!identity) return null;
    return {
      ...identity,
      savedAt: new Date().toISOString(),
      title: getBasic(report, '소재지') || getBasic(report, '사건명') || identity.caseNo,
      useType: getBasic(report, '물건종별') || getBasic(report, '용도') || '',
      appraisal: getBasic(report, '감정평가액') || getBasic(report, '감정가') || '',
      minBid: getBasic(report, '최저매각가격') || getBasic(report, '최저가') || '',
      saleDate: getBasic(report, '매각기일') || '',
      riskLevel: clean(report?.risk?.level || ''),
      inheritedTotal: Number(report?.inherited?.total || 0),
      daehangCount: Array.isArray(report?.tenants) ? report.tenants.filter((t) => t?.daehang === '있음').length : 0,
    };
  }

  function saveCurrentCandidate() {
    const s = state();
    const report = s?.report;
    if (!report) return false;
    const item = makeCandidate(report);
    if (!item) return false;

    const items = readCandidates().filter((candidate) => candidate.key !== item.key);
    items.unshift(item);
    writeCandidates(items);
    renderCandidatePanel(true);
    return true;
  }

  function removeCandidate(key) {
    writeCandidates(readCandidates().filter((item) => item.key !== key));
    renderCandidatePanel(true);
  }

  function formatWon(value) {
    if (!value && value !== 0) return '-';
    if (typeof value === 'number') return `${Math.max(0, value).toLocaleString('ko-KR')}원`;
    const text = clean(value);
    return text || '-';
  }

  function riskLabel(level) {
    if (level === 'danger') return '위험 높음';
    if (level === 'warn') return '주의';
    if (level === 'ok') return '위험 낮음';
    return '미분석';
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function injectSaveButton() {
    const s = state();
    if (!s?.report) {
      document.getElementById('v2CandidateSaveBtn')?.remove();
      return;
    }

    const nextCard = Array.from(document.querySelectorAll('.v2-result-card')).find((card) => card.querySelector('h3')?.textContent?.trim() === '다음 단계');
    const target = nextCard || document.getElementById('analysisCard');
    if (!target || document.getElementById('v2CandidateSaveBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'v2CandidateSaveBtn';
    btn.type = 'button';
    btn.className = 'v2-btn';
    btn.textContent = '현재 물건 후보 저장';
    btn.addEventListener('click', () => {
      const ok = saveCurrentCandidate();
      btn.textContent = ok ? '후보 저장 완료' : '후보 저장 실패';
      setTimeout(() => { btn.textContent = '현재 물건 후보 저장'; }, 1600);
    });

    const actions = target.querySelector('.v2-actions') || target;
    actions.appendChild(btn);
  }

  function setMainForm(candidate) {
    const courtSelect = document.querySelector('select[name="court"], select[data-field="court"], #court');
    const yearInput = document.querySelector('input[name="year"], input[data-field="year"], #year');
    const caseInput = document.querySelector('input[name="caseNo"], input[data-field="caseNo"], #caseNo');

    if (courtSelect && candidate.court) courtSelect.value = candidate.court;
    if (yearInput && candidate.year) yearInput.value = candidate.year;
    if (caseInput && candidate.caseNo) caseInput.value = candidate.caseNo.replace(/^\d{4}타경/, '');

    const s = state();
    if (s) {
      if (candidate.court) s.court = candidate.court;
      if (candidate.year) s.year = candidate.year;
      if (candidate.caseNo) s.caseNo = candidate.caseNo;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderCandidatePanel(force = false) {
    const results = document.getElementById('resultsSection');
    if (!results) return;

    let panel = document.getElementById('candidateTopPanel');
    if (!panel && !force) return;
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'candidateTopPanel';
      panel.className = 'v2-result-card';
      results.prepend(panel);
    }

    const items = readCandidates().slice(0, 5);
    if (!items.length) {
      panel.innerHTML = `
        <span class="v2-badge">저장 후보</span>
        <h3>저장 후보 TOP 5</h3>
        <p class="v2-note">아직 저장된 후보가 없습니다. 사건 조회 후 “현재 물건 후보 저장”을 누르면 여기에 표시됩니다.</p>
      `;
      return;
    }

    panel.innerHTML = `
      <div class="v2-card-head">
        <div>
          <span class="v2-badge">저장 후보</span>
          <h3>저장 후보 TOP 5</h3>
          <p class="v2-note">최근 저장한 물건 5개입니다. 후보를 눌러 조회 입력값으로 다시 불러올 수 있습니다.</p>
        </div>
      </div>
      <div class="v2-detail-table-wrap">
        <table class="v2-detail-table">
          <thead>
            <tr><th>사건</th><th>소재/용도</th><th>최저가</th><th>위험</th><th>인수추정</th><th>관리</th></tr>
          </thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td><button type="button" class="v2-link-btn" data-candidate-load="${esc(item.key)}">${esc(item.caseNo)}</button></td>
                <td>${esc(item.title || '-')}<br><span class="v2-note">${esc(item.useType || '')}</span></td>
                <td>${esc(formatWon(item.minBid))}</td>
                <td>${esc(riskLabel(item.riskLevel))}</td>
                <td>${esc(formatWon(item.inheritedTotal))}</td>
                <td><button type="button" class="v2-btn ghost" data-candidate-remove="${esc(item.key)}">삭제</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function hookTopButton() {
    document.querySelectorAll('button, a').forEach((el) => {
      if (el.dataset.candidateHooked) return;
      if (!clean(el.textContent).includes('저장 후보 TOP 5')) return;
      el.dataset.candidateHooked = '1';
      el.addEventListener('click', (event) => {
        event.preventDefault();
        renderCandidatePanel(true);
        setTimeout(() => document.getElementById('candidateTopPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
      });
    });
  }

  document.addEventListener('click', (event) => {
    const loadBtn = event.target.closest('[data-candidate-load]');
    if (loadBtn) {
      const key = loadBtn.getAttribute('data-candidate-load');
      const item = readCandidates().find((candidate) => candidate.key === key);
      if (item) setMainForm(item);
      return;
    }

    const removeBtn = event.target.closest('[data-candidate-remove]');
    if (removeBtn) {
      removeCandidate(removeBtn.getAttribute('data-candidate-remove'));
    }
  });

  setInterval(() => {
    injectSaveButton();
    hookTopButton();
  }, 700);
})();
