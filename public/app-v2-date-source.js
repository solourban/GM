(() => {
  const STORAGE_KEY = 'auction-note:v2:selected-date-candidate';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function appState() {
    return window.__auctionV2?.state || null;
  }

  function compact(value) {
    return clean(value).replace(/\s+/g, '').replace(/[^0-9가-힣A-Za-z]/g, '');
  }

  function digits(value) {
    return clean(value).replace(/[^0-9]/g, '');
  }

  function moneyNumber(value) {
    const n = Number(digits(value));
    return Number.isFinite(n) ? n : 0;
  }

  function formatMoney(value) {
    const n = moneyNumber(value);
    return n ? `${n.toLocaleString('ko-KR')}원` : '-';
  }

  function getFetchedCase() {
    const raw = appState()?.raw;
    if (!raw) return null;
    const basic = raw.basic || {};
    return {
      caseNo: clean(raw.caseNo || basic['사건번호']),
      saleDate: clean(basic['매각기일']),
      usage: clean(basic['물건종별']),
      minBid: clean(basic['최저매각가격']),
      appraisal: clean(basic['감정평가액']),
    };
  }

  function compareCandidate(candidate, fetched) {
    if (!candidate?.caseNo || !fetched?.caseNo) {
      return { level: 'info', title: '조회 전', text: '물건 기본정보 조회 후 선택 후보와 실제 조회 결과를 비교합니다.' };
    }

    const issues = [];
    if (compact(candidate.caseNo) && compact(fetched.caseNo) && compact(candidate.caseNo) !== compact(fetched.caseNo)) {
      issues.push('사건번호가 다릅니다.');
    }

    const candidateMinBid = moneyNumber(candidate.minBid);
    const fetchedMinBid = moneyNumber(fetched.minBid);
    if (candidateMinBid && fetchedMinBid && candidateMinBid !== fetchedMinBid) {
      issues.push(`최저가가 다릅니다. 후보 ${formatMoney(candidate.minBid)} / 조회 ${formatMoney(fetched.minBid)}`);
    }

    const candidateAppraisal = moneyNumber(candidate.appraisal);
    const fetchedAppraisal = moneyNumber(fetched.appraisal);
    if (candidateAppraisal && fetchedAppraisal && candidateAppraisal !== fetchedAppraisal) {
      issues.push(`감정가가 다릅니다. 후보 ${formatMoney(candidate.appraisal)} / 조회 ${formatMoney(fetched.appraisal)}`);
    }

    const candidateDate = digits(candidate.saleDate);
    const fetchedDate = digits(fetched.saleDate);
    if (candidateDate && fetchedDate && candidateDate !== fetchedDate) {
      issues.push(`매각기일이 다릅니다. 후보 ${esc(candidate.saleDate)} / 조회 ${esc(fetched.saleDate)}`);
    }

    if (issues.length) {
      return {
        level: 'warn',
        title: '선택 후보와 조회 결과 차이 있음',
        text: issues.join(' '),
      };
    }

    return {
      level: 'ok',
      title: '선택 후보와 조회 결과가 대체로 일치',
      text: '사건번호와 주요 금액 정보가 선택 후보와 조회 결과 기준으로 일치합니다.',
    };
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

  function renderComparison(candidate) {
    const fetched = getFetchedCase();
    const result = compareCandidate(candidate, fetched);
    const badgeClass = result.level === 'ok' ? 'ok' : result.level === 'warn' ? 'warn' : 'unknown';
    return `
      <div class="v2-info wide">
        <div class="k">선택 후보-조회 결과 확인</div>
        <div class="v"><span class="v2-pill ${badgeClass}">${esc(result.title)}</span></div>
        <p class="v2-note">${esc(result.text)}</p>
      </div>
    `;
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
          ${renderComparison(candidate)}
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
