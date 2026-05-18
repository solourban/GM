(() => {
  const SAVED_KEY = 'auction-note:v2:saved-candidates';
  const MEMO_PREFIX = 'auction-note:v2:date-candidate-memo:';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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

  function percent(value) {
    const n = Number(value || 0);
    return n > 0 ? `${n.toFixed(1)}%` : '-';
  }

  function discountRate(item) {
    const minBid = numberValue(item?.minBid);
    const appraisal = numberValue(item?.appraisal);
    return minBid && appraisal ? (minBid / appraisal) * 100 : 0;
  }

  function memoKey(caseNo) {
    return `${MEMO_PREFIX}${compact(caseNo || 'unknown')}`;
  }

  function loadSavedCandidates() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveSavedCandidates(items) {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(items.slice(0, 50)));
    } catch (_) {}
  }

  function loadMemo(item) {
    try {
      return item?.memo || localStorage.getItem(memoKey(item?.caseNo)) || sessionStorage.getItem(memoKey(item?.caseNo)) || '';
    } catch (_) {
      return item?.memo || '';
    }
  }

  function isHousing(item) {
    return /주거|아파트|다세대|단독|연립|다가구|주택/i.test(clean(item?.usage));
  }

  function candidateScore(item) {
    let score = 0;
    const minBid = numberValue(item?.minBid);
    const appraisal = numberValue(item?.appraisal);
    const failCount = Number(item?.failCount || 0);
    const hasMemo = clean(loadMemo(item)).length > 0;

    if (minBid > 0) score += 20;
    if (appraisal > 0 && minBid > 0) score += Math.max(0, 40 - Math.round(discountRate(item) / 3));
    if (failCount > 0) score += Math.min(20, failCount * 2);
    if (isHousing(item)) score += 10;
    if (hasMemo) score += 10;
    return score;
  }

  function decision(item, score) {
    const rate = discountRate(item);
    const failCount = Number(item?.failCount || 0);
    if (score >= 70 && clean(loadMemo(item))) return '검토 흔적과 가격 조건이 있어 우선 확인 후보입니다.';
    if (rate && rate <= 60) return '감정가 대비 최저가 비율이 낮아 가격 관점에서 먼저 볼 만합니다.';
    if (failCount >= 5) return '유찰 이력이 많아 유찰 사유와 점유관계 확인이 필요합니다.';
    if (isHousing(item)) return '주거형 후보로 권리관계와 임차인 확인이 필요합니다.';
    return '기초 정보만으로는 제한적이므로 원본 조회 후 판단해야 합니다.';
  }

  function topCandidates(items, limit = 5) {
    return [...items]
      .map((item) => ({ item, score: candidateScore(item) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
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

  function findSavedPanel() {
    const panels = Array.from(document.querySelectorAll('.v2-panel'));
    return panels.find((panel) => panel.classList.contains('active') && panel.textContent.includes('저장 후보'))
      || panels.find((panel) => panel.textContent.includes('저장 후보'))
      || null;
  }

  function activeTab() {
    return window.__auctionV2?.state?.activeTab || '';
  }

  function renderEmpty() {
    return `
      <div class="v2-card" id="v2SavedTabRuntimeCard">
        <span class="v2-badge">저장 후보</span>
        <h3>저장 후보 TOP 5</h3>
        <p class="v2-note">아직 저장된 후보가 없습니다. 매각기일 추천 또는 임시 비교 목록에서 후보를 저장하면 이 탭에서 우선순위를 볼 수 있습니다.</p>
        <div class="v2-grid compact">
          <div class="v2-info"><div class="k">저장 후보</div><div class="v">0건</div></div>
          <div class="v2-info"><div class="k">보관 방식</div><div class="v">브라우저 localStorage</div></div>
        </div>
      </div>
    `;
  }

  function renderSaved(items) {
    const top = topCandidates(items, 5);
    return `
      <div class="v2-card" id="v2SavedTabRuntimeCard">
        <span class="v2-badge">저장 후보</span>
        <h3>저장 후보 TOP 5</h3>
        <p class="v2-note">저장 후보를 최저가, 감정가 대비 가격비율, 유찰횟수, 주거형 여부, 메모 여부 기준으로 단순 정렬합니다.</p>
        <div class="v2-grid compact">
          <div class="v2-info"><div class="k">저장 후보 수</div><div class="v">${items.length}건</div></div>
          <div class="v2-info"><div class="k">최근 저장</div><div class="v">${esc(items[0]?.caseNo || '-')}</div></div>
          <div class="v2-info"><div class="k">메모 보유</div><div class="v">${items.filter((item) => clean(loadMemo(item))).length}건</div></div>
          <div class="v2-info"><div class="k">주의</div><div class="v">원본 재확인</div></div>
        </div>
        <div class="v2-detail-table-wrap">
          <table class="v2-detail-table">
            <thead><tr><th>순위</th><th>사건번호</th><th>점수</th><th>최저가</th><th>감정가</th><th>가격비율</th><th>판단</th><th>관리</th></tr></thead>
            <tbody>
              ${top.map(({ item, score }, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${esc(item.caseNo || '-')}</td>
                  <td>${score}</td>
                  <td>${esc(item.minBid || formatWon(item.minBid))}</td>
                  <td>${esc(item.appraisal || formatWon(item.appraisal))}</td>
                  <td>${percent(discountRate(item))}</td>
                  <td>${esc(decision(item, score))}</td>
                  <td>
                    <button type="button" class="v2-small-btn" data-saved-tab-action="search" data-case-no="${esc(item.caseNo || '')}">조회하기</button>
                    <button type="button" class="v2-small-btn" data-saved-tab-action="remove" data-case-no="${esc(item.caseNo || '')}">삭제</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <p class="v2-note">이 순위는 후보 정리용입니다. 실제 입찰 판단은 권리분석, 실거래가, 현장조사, 원본 서류 확인 후 결정해야 합니다.</p>
      </div>
    `;
  }

  function render() {
    if (activeTab() !== 'saved') return;
    const panel = findSavedPanel();
    if (!panel) return;
    const items = loadSavedCandidates();
    const html = items.length ? renderSaved(items) : renderEmpty();
    const signature = `${items.length}:${items.map((item) => `${compact(item.caseNo)}:${candidateScore(item)}`).join('|')}`;
    if (panel.dataset.savedTabSignature === signature && panel.querySelector('#v2SavedTabRuntimeCard')) return;
    panel.dataset.savedTabSignature = signature;
    panel.innerHTML = html;
  }

  function removeSaved(caseNo) {
    const key = compact(caseNo);
    const next = loadSavedCandidates().filter((item) => compact(item.caseNo) !== key);
    saveSavedCandidates(next);
    const panel = findSavedPanel();
    if (panel) panel.dataset.savedTabSignature = '';
    render();
  }

  function searchCandidate(caseNo) {
    const parsed = parseCaseNo(caseNo);
    document.querySelector('[data-tab="search"]')?.click?.();
    setTimeout(() => {
      const year = document.getElementById('saYearV2');
      const serial = document.getElementById('saSerV2');
      if (year && parsed.year) year.value = parsed.year;
      if (serial && parsed.serial) {
        serial.value = parsed.serial;
        serial.focus();
      }
    }, 80);
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-saved-tab-action]');
    if (!button) return;
    const caseNo = button.dataset.caseNo;
    if (button.dataset.savedTabAction === 'remove') removeSaved(caseNo);
    if (button.dataset.savedTabAction === 'search') searchCandidate(caseNo);
  });

  function boot() {
    setInterval(render, 800);
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
