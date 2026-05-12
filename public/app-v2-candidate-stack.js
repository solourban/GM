(() => {
  const STACK_KEY = 'auction-note:v2:date-candidate-stack';
  const SAVED_KEY = 'auction-note:v2:saved-candidates';
  const MEMO_PREFIX = 'auction-note:v2:date-candidate-memo:';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function compact(value) {
    return clean(value).replace(/\s+/g, '').replace(/[^0-9가-힣A-Za-z]/g, '');
  }

  function numberValue(value) {
    const digits = clean(value).replace(/[^0-9]/g, '');
    return digits ? Number(digits) : 0;
  }

  function formatWon(value) {
    const n = numberValue(value);
    return n ? `${n.toLocaleString('ko-KR')}원` : '-';
  }

  function stackKey(caseNo) {
    return compact(caseNo || 'unknown');
  }

  function memoKey(caseNo) {
    return `${MEMO_PREFIX}${stackKey(caseNo)}`;
  }

  function loadJsonList(storage, key) {
    try {
      const raw = storage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveJsonList(storage, key, items, limit) {
    try {
      storage.setItem(key, JSON.stringify(items.slice(0, limit)));
    } catch (_) {}
  }

  function loadStack() {
    return loadJsonList(sessionStorage, STACK_KEY);
  }

  function saveStack(items) {
    saveJsonList(sessionStorage, STACK_KEY, items, 20);
  }

  function loadSavedCandidates() {
    return loadJsonList(localStorage, SAVED_KEY);
  }

  function saveSavedCandidates(items) {
    saveJsonList(localStorage, SAVED_KEY, items, 50);
  }

  function loadMemo(caseNo) {
    try {
      return sessionStorage.getItem(memoKey(caseNo)) || localStorage.getItem(memoKey(caseNo)) || '';
    } catch (_) {
      return '';
    }
  }

  function saveCandidate(candidate) {
    const key = stackKey(candidate.caseNo);
    if (!key || key === 'unknown') return;

    const stack = loadStack();
    const filtered = stack.filter((item) => stackKey(item.caseNo) !== key);
    const next = [{ ...candidate, addedAt: new Date().toISOString() }, ...filtered];
    saveStack(next);
  }

  function promoteCandidate(caseNo) {
    const key = stackKey(caseNo);
    if (!key || key === 'unknown') return false;

    const stackItem = loadStack().find((item) => stackKey(item.caseNo) === key);
    if (!stackItem) return false;

    const memo = clean(loadMemo(stackItem.caseNo));
    const saved = loadSavedCandidates();
    const filtered = saved.filter((item) => stackKey(item.caseNo) !== key);
    const next = [{ ...stackItem, memo, savedAt: new Date().toISOString(), source: stackItem.source || '임시 비교 목록' }, ...filtered];
    saveSavedCandidates(next);
    return true;
  }

  function removeCandidate(caseNo) {
    const key = stackKey(caseNo);
    saveStack(loadStack().filter((item) => stackKey(item.caseNo) !== key));
  }

  function removeSavedCandidate(caseNo) {
    const key = stackKey(caseNo);
    saveSavedCandidates(loadSavedCandidates().filter((item) => stackKey(item.caseNo) !== key));
  }

  function clearStack() {
    try {
      sessionStorage.removeItem(STACK_KEY);
    } catch (_) {}
  }

  function candidateFromButton(button) {
    const row = button.closest('tr');
    if (!row) return null;
    const cells = Array.from(row.children).map((cell) => clean(cell.textContent));
    return {
      caseNo: clean(button.dataset.dateSearchCase || cells[2]),
      saleDate: cells[3] || '',
      usage: cells[4] || '',
      minBid: cells[5] || '',
      appraisal: cells[6] || '',
      discount: cells[7] || '',
      failCount: cells[8] || '',
      reason: cells[9] || '',
      source: '매각기일 추천',
    };
  }

  function discountRate(item) {
    const minBid = numberValue(item?.minBid);
    const appraisal = numberValue(item?.appraisal);
    return minBid && appraisal ? (minBid / appraisal) * 100 : 0;
  }

  function percent(value) {
    const n = Number(value || 0);
    return n > 0 ? `${n.toFixed(1)}%` : '-';
  }

  function pickLowest(items, getter) {
    return items.reduce((best, item) => {
      const value = getter(item);
      if (!value) return best;
      if (!best || value < best.value) return { item, value };
      return best;
    }, null);
  }

  function pickHighest(items, getter) {
    return items.reduce((best, item) => {
      const value = getter(item);
      if (!Number.isFinite(value)) return best;
      if (!best || value > best.value) return { item, value };
      return best;
    }, null);
  }

  function isHousing(item) {
    return /주거|아파트|다세대|단독|연립|다가구|주택/i.test(clean(item?.usage));
  }

  function candidateScore(item) {
    let score = 0;
    const minBid = numberValue(item.minBid);
    const appraisal = numberValue(item.appraisal);
    const failCount = Number(item.failCount || 0);
    const hasMemo = clean(item.memo || loadMemo(item.caseNo)).length > 0;

    if (minBid > 0) score += 20;
    if (appraisal > 0 && minBid > 0) score += Math.max(0, 40 - Math.round(discountRate(item) / 3));
    if (failCount > 0) score += Math.min(20, failCount * 2);
    if (isHousing(item)) score += 10;
    if (hasMemo) score += 10;
    return score;
  }

  function scoreReasons(item) {
    const reasons = [];
    const minBid = numberValue(item.minBid);
    const appraisal = numberValue(item.appraisal);
    const failCount = Number(item.failCount || 0);
    if (minBid > 0) reasons.push(`최저가 ${formatWon(item.minBid)}`);
    if (appraisal > 0 && minBid > 0) reasons.push(`최저가/감정가 ${percent(discountRate(item))}`);
    if (failCount > 0) reasons.push(`유찰 ${failCount}회`);
    if (isHousing(item)) reasons.push('주거형');
    if (clean(item.memo || loadMemo(item.caseNo))) reasons.push('메모 있음');
    return reasons.join(' · ') || '기초 정보 부족';
  }

  function topCandidates(items, limit = 3) {
    return [...items]
      .map((item) => ({ item, score: candidateScore(item), reasons: scoreReasons(item) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  function isSaved(caseNo) {
    const key = stackKey(caseNo);
    return loadSavedCandidates().some((item) => stackKey(item.caseNo) === key);
  }

  function findSearchPanel() {
    return document.querySelector('.v2-panel[data-panel="search"]');
  }

  function findAnchor() {
    const sourceCard = document.getElementById('v2DateSourceCard');
    if (sourceCard) return sourceCard;
    const panel = findSearchPanel();
    return panel?.querySelector('.v2-card') || null;
  }

  function renderRanking(items) {
    if (!items.length) return '';

    const lowestMinBid = pickLowest(items, (item) => numberValue(item.minBid));
    const bestDiscount = pickLowest(items, discountRate);
    const mostFailed = pickHighest(items, (item) => Number(item.failCount || 0));
    const memoCount = items.filter((item) => clean(loadMemo(item.caseNo))).length;
    const top = topCandidates(items, 3);

    return `
      <div class="v2-card" id="v2CandidateRankingCard">
        <span class="v2-badge">임시 후보 랭킹</span>
        <h3>우선 검토 후보 요약</h3>
        <p class="v2-note">현재 임시 비교 목록 기준의 단순 랭킹입니다. 실제 입찰 판단은 권리분석과 원본 서류 확인 후 결정해야 합니다.</p>
        <div class="v2-grid four">
          <div class="v2-info"><div class="k">최저가 최저</div><div class="v">${esc(lowestMinBid?.item?.caseNo || '-')}</div><small>${formatWon(lowestMinBid?.item?.minBid)}</small></div>
          <div class="v2-info"><div class="k">할인율 최대</div><div class="v">${esc(bestDiscount?.item?.caseNo || '-')}</div><small>최저가/감정가 ${percent(bestDiscount?.value)}</small></div>
          <div class="v2-info"><div class="k">유찰 최다</div><div class="v">${esc(mostFailed?.item?.caseNo || '-')}</div><small>${esc(mostFailed?.item?.failCount ?? '-')}회</small></div>
          <div class="v2-info"><div class="k">메모 있는 후보</div><div class="v">${memoCount}건</div><small>전체 ${items.length}건 중</small></div>
        </div>
        <h4>우선 검토 후보 1~3순위</h4>
        <ol class="v2-list">
          ${top.map(({ item, score }) => `<li>${esc(item.caseNo || '-')} · 점수 ${score} · ${esc(item.usage || '-')} · 최저가 ${esc(item.minBid || '-')}</li>`).join('')}
        </ol>
      </div>
    `;
  }

  function renderRows(items) {
    if (!items.length) {
      return '<p class="v2-note">아직 임시 비교 목록에 담긴 후보가 없습니다. 매각기일 추천에서 “이 사건 조회”를 누르면 여기에 쌓입니다.</p>';
    }

    return `
      <div class="v2-detail-table-wrap">
        <table class="v2-detail-table">
          <thead>
            <tr><th>사건번호</th><th>매각기일</th><th>용도</th><th>최저가</th><th>감정가</th><th>할인율</th><th>유찰</th><th>메모</th><th>관리</th></tr>
          </thead>
          <tbody>
            ${items.map((item) => {
              const memo = clean(loadMemo(item.caseNo));
              const saved = isSaved(item.caseNo);
              return `
                <tr>
                  <td>${esc(item.caseNo || '-')}</td>
                  <td>${esc(item.saleDate || '-')}</td>
                  <td>${esc(item.usage || '-')}</td>
                  <td>${esc(item.minBid || '-')}</td>
                  <td>${esc(item.appraisal || '-')}</td>
                  <td>${percent(discountRate(item))}</td>
                  <td>${esc(item.failCount || '-')}</td>
                  <td>${esc(memo || '-')}</td>
                  <td>
                    <button type="button" class="v2-small-btn" data-save-candidate="${esc(item.caseNo || '')}" ${saved ? 'disabled' : ''}>${saved ? '저장됨' : '저장 후보 추가'}</button>
                    <button type="button" class="v2-small-btn" data-remove-candidate="${esc(item.caseNo || '')}">삭제</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderSavedTopFive(saved) {
    if (!saved.length) return '';
    const top = topCandidates(saved, 5);
    return `
      <section class="v2-card" id="v2SavedTopFiveCard">
        <span class="v2-badge">TOP 5</span>
        <h3>저장 후보 TOP 5</h3>
        <p class="v2-note">저장 후보를 최저가, 감정가 대비 할인율, 유찰횟수, 주거형 여부, 메모 여부 기준으로 단순 점수화한 목록입니다.</p>
        <div class="v2-detail-table-wrap">
          <table class="v2-detail-table">
            <thead><tr><th>순위</th><th>사건번호</th><th>점수</th><th>용도</th><th>최저가</th><th>근거</th></tr></thead>
            <tbody>
              ${top.map(({ item, score, reasons }, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${esc(item.caseNo || '-')}</td>
                  <td>${score}</td>
                  <td>${esc(item.usage || '-')}</td>
                  <td>${esc(item.minBid || '-')}</td>
                  <td>${esc(reasons)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <p class="v2-note">이 점수는 기초 정렬용입니다. 권리위험, 자금계획, 시세 비교는 다음 단계에서 별도로 보강해야 합니다.</p>
      </section>
    `;
  }

  function renderSavedCandidates() {
    const saved = loadSavedCandidates();
    if (!saved.length) {
      return `
        <section class="v2-card" id="v2SavedCandidateCard">
          <span class="v2-badge">저장 후보</span>
          <h3>저장 후보 목록</h3>
          <p class="v2-note">아직 저장된 후보가 없습니다. 임시 비교 목록에서 “저장 후보 추가”를 누르면 여기에 보관됩니다.</p>
        </section>
      `;
    }

    return `
      ${renderSavedTopFive(saved)}
      <section class="v2-card" id="v2SavedCandidateCard">
        <span class="v2-badge">저장 후보</span>
        <h3>저장 후보 목록</h3>
        <p class="v2-note">브라우저 localStorage에 보관됩니다. TOP 5는 기초 점수 기준으로 별도 표시됩니다.</p>
        <div class="v2-grid four">
          <div class="v2-info"><div class="k">저장 후보 수</div><div class="v">${saved.length}건</div></div>
          <div class="v2-info"><div class="k">최근 저장</div><div class="v">${esc(saved[0]?.caseNo || '-')}</div></div>
          <div class="v2-info"><div class="k">메모 보유</div><div class="v">${saved.filter((item) => clean(item.memo || loadMemo(item.caseNo))).length}건</div></div>
          <div class="v2-info"><div class="k">보관 범위</div><div class="v">브라우저</div></div>
        </div>
        <div class="v2-detail-table-wrap">
          <table class="v2-detail-table">
            <thead><tr><th>사건번호</th><th>매각기일</th><th>용도</th><th>최저가</th><th>감정가</th><th>메모</th><th>관리</th></tr></thead>
            <tbody>
              ${saved.map((item) => `
                <tr>
                  <td>${esc(item.caseNo || '-')}</td>
                  <td>${esc(item.saleDate || '-')}</td>
                  <td>${esc(item.usage || '-')}</td>
                  <td>${esc(item.minBid || '-')}</td>
                  <td>${esc(item.appraisal || '-')}</td>
                  <td>${esc(clean(item.memo || loadMemo(item.caseNo)) || '-')}</td>
                  <td><button type="button" class="v2-small-btn" data-remove-saved-candidate="${esc(item.caseNo || '')}">저장 삭제</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderCard() {
    const items = loadStack();
    const savedCount = loadSavedCandidates().length;
    return `
      <section class="v2-card" id="v2CandidateStackCard">
        <div class="v2-result-head">
          <div>
            <span class="v2-badge">임시 비교 목록</span>
            <h3>매각기일 검토 후보</h3>
            <p class="v2-note">매각기일에서 눌러본 후보들을 세션 동안 임시로 모아 비교합니다. 저장 후보로 승격할 수 있습니다.</p>
          </div>
          <button type="button" class="v2-small-btn" id="v2ClearCandidateStackBtn" ${items.length ? '' : 'disabled'}>전체 초기화</button>
        </div>
        <div class="v2-grid four">
          <div class="v2-info"><div class="k">임시 후보 수</div><div class="v">${items.length}건</div></div>
          <div class="v2-info"><div class="k">저장 후보 수</div><div class="v">${savedCount}건</div></div>
          <div class="v2-info"><div class="k">최근 후보</div><div class="v">${esc(items[0]?.caseNo || '-')}</div></div>
          <div class="v2-info"><div class="k">보관 범위</div><div class="v">임시/브라우저</div></div>
        </div>
        ${renderRows(items)}
      </section>
      ${renderRanking(items)}
      ${renderSavedCandidates()}
    `;
  }

  function upsertCard() {
    const anchor = findAnchor();
    if (!anchor) return;

    const existing = document.getElementById('v2CandidateStackCard');
    document.getElementById('v2CandidateRankingCard')?.remove();
    document.getElementById('v2SavedCandidateCard')?.remove();
    document.getElementById('v2SavedTopFiveCard')?.remove();

    if (!existing) {
      anchor.insertAdjacentHTML('afterend', renderCard());
    } else {
      existing.outerHTML = renderCard();
    }

    bindCardEvents();
  }

  function bindCardEvents() {
    const clearButton = document.getElementById('v2ClearCandidateStackBtn');
    if (clearButton && !clearButton.dataset.bound) {
      clearButton.dataset.bound = '1';
      clearButton.addEventListener('click', () => {
        clearStack();
        upsertCard();
      });
    }

    document.querySelectorAll('[data-save-candidate]').forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', () => {
        promoteCandidate(button.dataset.saveCandidate);
        upsertCard();
      });
    });

    document.querySelectorAll('[data-remove-candidate]').forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', () => {
        removeCandidate(button.dataset.removeCandidate);
        upsertCard();
      });
    });

    document.querySelectorAll('[data-remove-saved-candidate]').forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', () => {
        removeSavedCandidate(button.dataset.removeSavedCandidate);
        upsertCard();
      });
    });
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-date-search-case]');
    if (!button) return;
    const candidate = candidateFromButton(button);
    if (candidate?.caseNo) saveCandidate(candidate);
    window.setTimeout(upsertCard, 250);
  }, true);

  setInterval(upsertCard, 1000);
})();
