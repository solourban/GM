(() => {
  const SAVED_KEY = 'auction-note:v2:saved-candidates';
  const MEMO_PREFIX = 'auction-note:v2:date-candidate-memo:';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let selectedPropertyType = 'all';

  function propertyTypes() {
    return window.__auctionPropertyTypes || null;
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
    return /주거|아파트|다세대|단독|연립|다가구|주택/i.test(propertyTypes()?.usageOf(item) || clean(item?.usage));
  }

  function failCount(item) {
    const match = clean(item?.failCount).match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function hasRightsCheck(item) {
    return Boolean(item?.rightsChecked || item?.riskLevel || item?.riskGrade || item?.analysisDone || item?.analyzedAt);
  }

  function hasPriceCheck(item) {
    return Boolean(item?.priceChecked || (numberValue(item?.minBid) && numberValue(item?.appraisal)));
  }

  function statusLabel(value) {
    return value ? '확인' : '미확인';
  }

  function candidateScore(item) {
    let score = 0;
    const minBid = numberValue(item?.minBid);
    const appraisal = numberValue(item?.appraisal);
    const rate = discountRate(item);
    const fails = failCount(item);
    const hasMemo = clean(loadMemo(item)).length > 0;

    if (minBid > 0) score += 15;
    if (appraisal > 0 && minBid > 0) score += Math.max(0, 35 - Math.round(rate / 4));
    if (fails > 0) score += Math.min(15, fails * 3);
    if (isHousing(item)) score += 8;
    if (hasMemo) score += 10;
    if (hasRightsCheck(item)) score += 10;
    if (hasPriceCheck(item)) score += 7;
    return score;
  }

  function decision(item, score) {
    const rate = discountRate(item);
    const fails = failCount(item);
    const rights = hasRightsCheck(item);
    const price = hasPriceCheck(item);
    const memo = clean(loadMemo(item));
    if (rights && price && memo) return '권리·가격·메모가 있어 다음 검토 순서로 올릴 만합니다.';
    if (score >= 70) return '기초 참고지표가 비교적 많아 우선 검토 후보로 볼 수 있습니다.';
    if (rate && rate <= 60) return '가격비율은 낮지만 권리·점유·시세 확인이 먼저 필요합니다.';
    if (fails >= 5) return '유찰 이력이 많아 유찰 사유와 점유관계 확인이 필요합니다.';
    if (isHousing(item)) return '주거형 후보로 권리관계와 임차인 확인이 필요합니다.';
    return '현재 정보만으로는 제한적이므로 단일 조회 후 판단해야 합니다.';
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

  function resultRoot() {
    return window.__auctionV2?.tabResultsRoot?.() || document.getElementById('v2TabResultsSection');
  }

  function renderControls(items) {
    return `
      <div class="v2-card" id="v2SavedTabControlsCard">
        <span class="v2-badge">저장 후보</span>
        <h3>저장 후보 TOP 5</h3>
        <p class="v2-note">저장한 입찰 검토 후보를 물건종류별로 좁혀 확인합니다.</p>
        ${items.length ? propertyTypes()?.render(items, selectedPropertyType, 'data-saved-property-type') || '' : ''}
        <p class="v2-note">저장 후보는 현재 브라우저에 보관됩니다.</p>
      </div>
    `;
  }

  function renderEmpty() {
    return `
      <section class="v2-result-card" id="v2SavedTabRuntimeCard">
        <span class="v2-badge">검토 우선순위</span>
        <h3>저장 후보 검토 우선순위 TOP 5</h3>
        <p class="v2-note">아직 저장된 후보가 없습니다. 매각기일 추천 또는 임시 비교 목록에서 입찰 검토 후보를 저장하면 이 탭에서 다음 확인 순서를 볼 수 있습니다.</p>
        <div class="v2-grid compact">
          <div class="v2-info"><div class="k">저장 후보</div><div class="v">0건</div></div>
          <div class="v2-info"><div class="k">보관 방식</div><div class="v">브라우저 localStorage</div></div>
          <div class="v2-info"><div class="k">판단 기준</div><div class="v">참고지표</div></div>
        </div>
      </section>
    `;
  }

  function renderSavedMobileCards(top) {
    return `
      <div class="v2-mobile-card-list" id="v2SavedMobileCards">
        ${top.map(({ item, score }, index) => `
          <article class="v2-mobile-item-card">
            <div class="v2-mobile-item-head">
              <div>
                <span class="v2-badge">${index + 1}순위 · ${score}점</span>
                <h4>${esc(item.caseNo || '사건번호 확인 필요')}</h4>
              </div>
              <strong>${esc(item.saleDate || '-')}</strong>
            </div>
            <div class="v2-mobile-item-grid">
              <span><small>용도</small><b>${esc(propertyTypes()?.usageOf(item) || item.usage || '-')}</b></span>
              <span><small>가격비율</small><b>${percent(discountRate(item))}</b></span>
              <span><small>최저가</small><b>${esc(item.minBid || formatWon(item.minBid))}</b></span>
              <span><small>유찰</small><b>${failCount(item) || '-'}</b></span>
              <span><small>권리</small><b>${statusLabel(hasRightsCheck(item))}</b></span>
              <span><small>시세</small><b>${statusLabel(hasPriceCheck(item))}</b></span>
            </div>
            <p class="v2-note">${esc(decision(item, score))}</p>
            <div class="v2-mobile-actions">
              <button type="button" class="v2-small-btn" data-saved-tab-action="search" data-case-no="${esc(item.caseNo || '')}">조회하기</button>
              <button type="button" class="v2-small-btn" data-saved-tab-action="remove" data-case-no="${esc(item.caseNo || '')}">삭제</button>
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function renderSaved(items) {
    const filteredItems = propertyTypes()?.filter(items, selectedPropertyType) || [...items];
    const top = topCandidates(filteredItems, 5);
    const memoCount = filteredItems.filter((item) => clean(loadMemo(item))).length;
    const rightsCount = filteredItems.filter(hasRightsCheck).length;
    const priceCount = filteredItems.filter(hasPriceCheck).length;
    return `
      <section class="v2-result-card" id="v2SavedTabRuntimeCard">
        <span class="v2-badge">검토 우선순위</span>
        <h3>저장 후보 검토 우선순위 TOP 5</h3>
        <p class="v2-note">저장 후보를 감정가 대비 최저가 비율, 유찰횟수, 용도, 매각기일, 메모, 권리분석, 시세 확인 여부를 참고지표로 정렬합니다.</p>
        <div class="v2-grid compact">
          <div class="v2-info"><div class="k">표시 / 전체</div><div class="v">${filteredItems.length} / ${items.length}건</div></div>
          <div class="v2-info"><div class="k">메모 보유</div><div class="v">${memoCount}건</div></div>
          <div class="v2-info"><div class="k">권리분석 확인</div><div class="v">${rightsCount}건</div></div>
          <div class="v2-info"><div class="k">시세 확인</div><div class="v">${priceCount}건</div></div>
        </div>
        ${top.length ? '' : '<p class="v2-note">선택한 물건종류에 해당하는 저장 후보가 없습니다.</p>'}
        ${top.length ? renderSavedMobileCards(top) : ''}
        <div class="v2-detail-table-wrap v2-saved-table-wrap">
          <table class="v2-detail-table">
            <thead><tr><th>순위</th><th>사건번호</th><th>점수</th><th>용도</th><th>매각기일</th><th>최저가/감정가</th><th>가격비율</th><th>유찰</th><th>메모</th><th>권리</th><th>시세</th><th>판단</th><th>관리</th></tr></thead>
            <tbody>
              ${top.map(({ item, score }, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${esc(item.caseNo || '-')}</td>
                  <td>${score}</td>
                  <td>${esc(propertyTypes()?.usageOf(item) || item.usage || '-')}</td>
                  <td>${esc(item.saleDate || '-')}</td>
                  <td>${esc(item.minBid || formatWon(item.minBid))}<br><small>${esc(item.appraisal || formatWon(item.appraisal))}</small></td>
                  <td>${percent(discountRate(item))}</td>
                  <td>${failCount(item) || '-'}</td>
                  <td>${clean(loadMemo(item)) ? '있음' : '없음'}</td>
                  <td>${statusLabel(hasRightsCheck(item))}</td>
                  <td>${statusLabel(hasPriceCheck(item))}</td>
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
        <p class="v2-note">기초 정보 기준 검토 우선순위입니다. 입찰 적합 여부는 권리분석·시세·점유·자금 검토 후 판단해야 합니다.</p>
      </section>
    `;
  }

  function render() {
    if (activeTab() !== 'saved') return;
    const panel = findSavedPanel();
    if (!panel) return;
    const root = resultRoot();
    if (!root) return;
    const items = loadSavedCandidates();
    const signature = `${selectedPropertyType}:${items.length}:${items.map((item) => `${compact(item.caseNo)}:${candidateScore(item)}:${clean(loadMemo(item)).length}`).join('|')}`;
    if (
      panel.dataset.savedTabSignature === signature
      && root.dataset.savedTabSignature === signature
      && panel.querySelector('#v2SavedTabControlsCard')
      && root.querySelector('#v2SavedTabRuntimeCard')
    ) return;
    panel.dataset.savedTabSignature = signature;
    root.dataset.savedTabSignature = signature;
    panel.innerHTML = renderControls(items);
    root.innerHTML = items.length ? renderSaved(items) : renderEmpty();
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
    const propertyButton = event.target.closest('[data-saved-property-type]');
    if (propertyButton) {
      selectedPropertyType = propertyButton.dataset.savedPropertyType || 'all';
      const panel = findSavedPanel();
      if (panel) panel.dataset.savedTabSignature = '';
      render();
      return;
    }

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
