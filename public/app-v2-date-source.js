(() => {
  const STORAGE_KEY = 'auction-note:v2:selected-date-candidate';
  const MEMO_PREFIX = 'auction-note:v2:date-candidate-memo:';
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

  function memoKey(candidate) {
    return `${MEMO_PREFIX}${compact(candidate?.caseNo || 'unknown')}`;
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

  function sourceLabel(candidate) {
    const source = clean(candidate?.source);
    if (source.includes('저장 후보')) return '저장 후보에서 불러옴';
    if (source.includes('임시 비교')) return '임시 비교 목록에서 불러옴';
    return '매각기일 선택 후보';
  }

  function sourceGuide(candidate) {
    const source = sourceLabel(candidate);
    if (source === '저장 후보에서 불러옴') return '저장 후보 목록 또는 TOP 5에서 다시 불러온 물건입니다. 기본정보 조회 후 권리분석으로 이어가세요.';
    if (source === '임시 비교 목록에서 불러옴') return '임시 비교 목록에서 다시 불러온 물건입니다. 기본정보 조회 후 권리분석으로 이어가세요.';
    return '매각기일 추천에서 선택한 후보입니다. 아래 물건 기본정보 조회 후 권리분석으로 이어가세요.';
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

  function loadMemo(candidate) {
    try {
      return sessionStorage.getItem(memoKey(candidate)) || localStorage.getItem(memoKey(candidate)) || candidate?.memo || '';
    } catch (_) {
      return candidate?.memo || '';
    }
  }

  function saveMemo(candidate, value) {
    try {
      const key = memoKey(candidate);
      const memo = String(value ?? '').slice(0, 500);
      if (memo.trim()) {
        sessionStorage.setItem(key, memo);
        if (sourceLabel(candidate) === '저장 후보에서 불러옴') localStorage.setItem(key, memo);
      } else {
        sessionStorage.removeItem(key);
      }
    } catch (_) {}
  }

  function clearMemo(candidate) {
    try {
      sessionStorage.removeItem(memoKey(candidate));
      if (sourceLabel(candidate) === '저장 후보에서 불러옴') localStorage.removeItem(memoKey(candidate));
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

  function renderMemo(candidate) {
    const memo = loadMemo(candidate);
    return `
      <div class="v2-info wide">
        <div class="k">후보 검토 메모</div>
        <textarea id="v2DateCandidateMemo" rows="3" maxlength="500" placeholder="예: 최저가는 낮지만 유찰 사유와 점유자 확인 필요" style="width:100%; margin-top:8px; border:1px solid var(--line-2); border-radius:12px; padding:12px; font:inherit; resize:vertical;">${esc(memo)}</textarea>
        <div class="v2-cta-row" style="margin-top:8px;">
          <span class="v2-note" id="v2DateCandidateMemoStatus">${memo ? '메모 저장됨' : '메모를 입력하면 세션에 자동 저장됩니다.'}</span>
          <button type="button" class="v2-small-btn" id="v2ClearDateCandidateMemoBtn">메모 삭제</button>
        </div>
      </div>
    `;
  }

  function renderCard(candidate) {
    const label = sourceLabel(candidate);
    return `
      <section class="v2-card" id="v2DateSourceCard">
        <div class="v2-result-head">
          <div>
            <span class="v2-badge">${esc(label)}</span>
            <h3>${esc(candidate.caseNo || '사건번호 미확인')}</h3>
            <p class="v2-note">${esc(sourceGuide(candidate))}</p>
          </div>
          <button type="button" class="v2-small-btn" id="v2ClearDateSourceBtn">안내 지우기</button>
        </div>
        <div class="v2-grid four">
          <div class="v2-info"><div class="k">출처</div><div class="v">${esc(label)}</div></div>
          <div class="v2-info"><div class="k">매각기일</div><div class="v">${esc(candidate.saleDate || '-')}</div></div>
          <div class="v2-info"><div class="k">용도</div><div class="v">${esc(candidate.usage || '-')}</div></div>
          <div class="v2-info"><div class="k">최저가</div><div class="v">${esc(candidate.minBid || '-')}</div></div>
          <div class="v2-info"><div class="k">감정가</div><div class="v">${esc(candidate.appraisal || '-')}</div></div>
          ${renderComparison(candidate)}
          ${renderMemo(candidate)}
        </div>
        <p class="v2-note">유찰 ${esc(candidate.failCount || '-')} · 할인율 ${esc(candidate.discount || '-')} · ${esc(candidate.reason || '후보 사유 없음')}</p>
      </section>
    `;
  }

  function bindMemo(candidate) {
    const memo = document.getElementById('v2DateCandidateMemo');
    const status = document.getElementById('v2DateCandidateMemoStatus');
    if (memo && !memo.dataset.bound) {
      memo.dataset.bound = '1';
      memo.addEventListener('input', () => {
        saveMemo(candidate, memo.value);
        if (status) status.textContent = memo.value.trim() ? '메모 저장됨' : '메모를 입력하면 세션에 자동 저장됩니다.';
      });
    }

    const clearMemoButton = document.getElementById('v2ClearDateCandidateMemoBtn');
    if (clearMemoButton && !clearMemoButton.dataset.bound) {
      clearMemoButton.dataset.bound = '1';
      clearMemoButton.addEventListener('click', () => {
        clearMemo(candidate);
        if (memo) memo.value = '';
        if (status) status.textContent = '메모가 삭제되었습니다.';
      });
    }
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

    const activeMemo = document.activeElement?.id === 'v2DateCandidateMemo';
    if (!existing) {
      searchCard.insertAdjacentHTML('afterend', renderCard(candidate));
    } else if (!activeMemo) {
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

    bindMemo(candidate);
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-date-search-case]');
    if (!button) return;
    saveCandidateFromButton(button);
    window.setTimeout(upsertSourceCard, 200);
  }, true);

  setInterval(upsertSourceCard, 700);
})();
