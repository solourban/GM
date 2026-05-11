(() => {
  const STORAGE_KEY = 'auction-note:v2:selected-date-candidate';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function saveCandidateFromButton(button) {
    const row = button.closest('tr');
    if (!row) return;

    const cells = Array.from(row.children).map((cell) => clean(cell.textContent));
    const candidate = {
      caseNo: clean(button.dataset.dateSearchCase || cells[2]),
      saleDate: cells[3] || '',
      usage: cells[4] || '',
      minBid: cells[5] || '',
      appraisal: cells[6] || '',
      discount: cells[7] || '',
      failCount: cells[8] || '',
      reason: cells[9] || '',
      savedAt: new Date().toISOString(),
      source: '매각기일 추천',
    };

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(candidate));
    } catch (_) {}
  }

  function loadCandidate() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function clearCandidate() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  function findSearchPanel() {
    return document.querySelector('.v2-panel[data-panel="search"]');
  }

  function renderCard(candidate) {
    return `
      <section class="v2-card" id="v2DateSourceCard">
        <div class="v2-result-head">
          <div>
            <span class="v2-badge">매각기일 선택 후보</span>
            <h3>${esc(candidate.caseNo || '사건번호 미확인')}</h3>
            <p class="v2-note">매각기일 추천에서 선택한 후보입니다. 아래 물건 기본정보 조회 후 권리분석으로 이어가세요.</p>
          </div>
          <button type="button" class="v2-small-btn" id="v2ClearDateSourceBtn">안내 지우기</button>
        </div>
        <div class="v2-grid four">
          <div class="v2-info"><div class="k">매각기일</div><div class="v">${esc(candidate.saleDate || '-')}</div></div>
          <div class="v2-info"><div class="k">용도</div><div class="v">${esc(candidate.usage || '-')}</div></div>
          <div class="v2-info"><div class="k">최저가</div><div class="v">${esc(candidate.minBid || '-')}</div></div>
          <div class="v2-info"><div class="k">감정가</div><div class="v">${esc(candidate.appraisal || '-')}</div></div>
        </div>
        <p class="v2-note">유찰 ${esc(candidate.failCount || '-')} · 할인율 ${esc(candidate.discount || '-')} · ${esc(candidate.reason || '후보 사유 없음')}</p>
      </section>
    `;
  }

  function upsertSourceCard() {
    const panel = findSearchPanel();
    const searchCard = panel?.querySelector('.v2-card');
    if (!panel || !searchCard) return;

    const candidate = loadCandidate();
    const existing = document.getElementById('v2DateSourceCard');
    if (!candidate?.caseNo) {
      existing?.remove();
      return;
    }

    if (!existing) {
      searchCard.insertAdjacentHTML('afterend', renderCard(candidate));
    } else {
      existing.outerHTML = renderCard(candidate);
    }

    const clearButton = document.getElementById('v2ClearDateSourceBtn');
    if (clearButton && !clearButton.dataset.bound) {
      clearButton.dataset.bound = '1';
      clearButton.addEventListener('click', () => {
        clearCandidate();
        document.getElementById('v2DateSourceCard')?.remove();
      });
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-date-search-case]');
    if (!button) return;
    saveCandidateFromButton(button);
    window.setTimeout(upsertSourceCard, 200);
  }, true);

  setInterval(upsertSourceCard, 700);
})();
