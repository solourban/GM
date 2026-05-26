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

  function activeTab() {
    return window.__auctionV2?.state?.activeTab || document.querySelector('.v2-tab.active')?.dataset?.tab || 'search';
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

  function oneLineDecision(item, score) {
    const minBid = numberValue(item.minBid);
    const appraisal = numberValue(item.appraisal);
    const failCount = Number(item.failCount || 0);
    const hasMemo = clean(item.memo || loadMemo(item.caseNo)).length > 0;
    const rate = discountRate(item);

    if (score >= 70 && hasMemo) return '가격 조건과 검토 흔적이 모두 있어 우선 확인할 만한 후보입니다.';
    if (appraisal > 0 && minBid > 0 && rate <= 60) return '감정가 대비 최저가 비율이 낮아 가격 관점에서 먼저 볼 만합니다.';
    if (failCount >= 5) return '유찰 이력이 많아 가격 변동성과 사유 확인이 필요한 후보입니다.';
    if (isHousing(item)) return '주거형 후보로 권리관계와 점유자를 확인해볼 만합니다.';
    if (score >= 50) return '기초 조건이 비교 목록 안에서 상대적으로 양호한 후보입니다.';
    return '정보가 제한적이므로 원본 조회 후 판단해야 합니다.';
  }

  function topCandidates(items, limit = 3) {
    return [...items]
      .map((item) => ({ item, score: candidateScore(item), decision: oneLineDecision(item, candidateScore(item)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  function isSaved(caseNo) {
    const key = stackKey(caseNo);
    return loadSavedCandidates().some((item) => stackKey(item.caseNo) === key);
  }

  function panelByTab(tab) {
    const exact = document.querySelector(`.v2-panel[data-panel="${tab}"]`);
    if (exact) return exact;
    return Array.from(document.querySelectorAll('.v2-panel')).find((panel) => {
      if (tab === 'date') return panel.textContent.includes('매각기일 추천');
      if (tab === 'saved') return panel.textContent.includes('저장 후보');
      return false;
    }) || null;
  }

  function findDateAnchor() {
    const panel = panelByTab('date');
    if (!panel) return null;
    return panel.querySelector('#v2DateSourceCard') || panel.querySelector('.v2-card') || panel;
  }

  function parseCaseNo(value) {
    const text = clean(value);
    const match = text.match(/(\d{4})\s*타경\s*(\d+)/);
    if (match) return { year: match[1], serial: match[2] };
    const year = text.match(/\b(20\d{2})\b/)?.[1] || '';
    const digits = text.replace(/\D/g, '');
    const serial = year && digits.startsWith(year) ? digits.slice(4) : digits;
    return { year, serial };
  }

  function fillSearchFromCandidate(caseNo) {
    const parsed = parseCaseNo(caseNo);
    document.querySelector('[data-tab="search"]')?.click?.();
    window.setTimeout(() => {
      const year = document.getElementById('saYearV2');
      const serial = document.getElementById('saSerV2');
      if (year && parsed.year) year.value = parsed.year;
      if (serial && parsed.serial) {
        serial.value = parsed.serial;
        serial.focus();
      }
    }, 80);
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
          ${top.map(({ item, score, decision }) => `<li>${esc(item.caseNo || '-')} · 점수 ${score} · ${esc(decision)}</li>`).join('')}
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
                    <button type="button" class="v2-small-btn" data-search-candidate="${esc(item.caseNo || '')}">조회하기</button>
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

  function renderCard() {
    const items = loadStack();
    const savedCount = loadSavedCandidates().length;
    return `
      <section class="v2-card" id="v2CandidateStackCard">
        <div class="v2-result-head">
          <div>
            <span class="v2-badge">임시 비교 목록</span>
            <h3>매각기일 검토 후보</h3>
            <p class="v2-note">매각기일 추천 탭에서 눌러본 후보만 모아 비교합니다. 저장 후보로 승격할 수 있습니다.</p>
          </div>
          <button type="button" class="v2-small-btn" id="v2ClearCandidateStackBtn" ${items.length ? '' : 'disabled'}>매각기일 후보 초기화</button>
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
    `;
  }

  function removeRenderedCards() {
    document.getElementById('v2CandidateStackCard')?.remove();
    document.getElementById('v2CandidateRankingCard')?.remove();
    document.getElementById('v2SavedCandidateCard')?.remove();
    document.getElementById('v2SavedTopFiveCard')?.remove();
  }

  function upsertCard() {
    if (activeTab() !== 'date') {
      removeRenderedCards();
      return;
    }

    const anchor = findDateAnchor();
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

    document.querySelectorAll('[data-search-candidate]').forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', () => {
        fillSearchFromCandidate(button.dataset.searchCandidate);
      });
    });

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
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-date-search-case]');
    if (!button) return;
    const candidate = candidateFromButton(button);
    if (candidate?.caseNo) saveCandidate(candidate);
    window.setTimeout(upsertCard, 250);
  }, true);

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('.v2-tab, [data-tab], .brand')) return;
    window.setTimeout(upsertCard, 0);
    window.setTimeout(upsertCard, 120);
  }, true);

  setInterval(upsertCard, 1000);
  window.__auctionCandidateStack = { upsertCard, removeRenderedCards, loadStack };
})();
