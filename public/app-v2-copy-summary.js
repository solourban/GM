(() => {
  const BID_PLAN_STORAGE_PREFIX = 'auction-note:v2.2:bid-plan:';
  const DATE_CANDIDATE_STORAGE_KEY = 'auction-note:v2:selected-date-candidate';
  const DATE_CANDIDATE_STACK_KEY = 'auction-note:v2:date-candidate-stack';
  const SAVED_CANDIDATES_KEY = 'auction-note:v2:saved-candidates';
  const DATE_CANDIDATE_MEMO_PREFIX = 'auction-note:v2:date-candidate-memo:';
  const LOCATION_STORAGE_KEY = 'auction-note:v2:location-geocode';
  const TRADE_STORAGE_KEY = 'auction-note:v2:molit-trades';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function app() {
    return window.__auctionV2 || null;
  }

  function state() {
    return app()?.state || null;
  }

  function compact(value) {
    return clean(value).replace(/\s+/g, '').replace(/[^0-9가-힣A-Za-z]/g, '');
  }

  function numberValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
    const digits = clean(value).replace(/[^0-9]/g, '');
    return digits ? Math.max(0, Number(digits)) : 0;
  }

  function money(value) {
    const n = numberValue(value);
    return n ? `${n.toLocaleString('ko-KR')}원` : '0원';
  }

  function won(value) {
    const n = Number(value || 0);
    return n ? `${Math.round(n).toLocaleString('ko-KR')}원` : '-';
  }

  function manwon(value) {
    const n = Number(value || 0);
    return n ? `${Math.round(n).toLocaleString('ko-KR')}만원` : '-';
  }

  function ratio(value) {
    const n = Number(value || 0);
    return n ? `${n.toFixed(1)}%` : '-';
  }

  function riskLabel(level) {
    if (level === 'danger') return '높음';
    if (level === 'warn') return '주의';
    return '낮음';
  }

  function caseLabel(report) {
    const court = clean(report?.court || report?.raw?.court || '');
    const caseNo = clean(report?.case || report?.caseNo || '');
    return [court, caseNo].filter(Boolean).join(' ');
  }

  function bidPlanStorageKey(report) {
    const court = clean(report?.court || report?.raw?.court || '');
    const caseNo = clean(report?.case || report?.caseNo || '');
    const key = [court, caseNo].filter(Boolean).join(':') || 'unknown';
    return `${BID_PLAN_STORAGE_PREFIX}${key}`;
  }

  function loadPlannedBid(report) {
    try {
      const inputValue = clean(document.getElementById('v2PlannedBidInput')?.value || '');
      if (inputValue) return numberValue(inputValue);
      return numberValue(localStorage.getItem(bidPlanStorageKey(report)) || '');
    } catch (_) {
      return 0;
    }
  }

  function loadDateCandidate() {
    try {
      const raw = sessionStorage.getItem(DATE_CANDIDATE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function loadDateCandidateStack() {
    try {
      const raw = sessionStorage.getItem(DATE_CANDIDATE_STACK_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function loadSavedCandidates() {
    try {
      const raw = localStorage.getItem(SAVED_CANDIDATES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function loadLocationBasics() {
    try {
      const raw = sessionStorage.getItem(LOCATION_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function loadMolitTradeBasics() {
    try {
      const raw = sessionStorage.getItem(TRADE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function loadDateCandidateMemo(candidate) {
    try {
      if (!candidate?.caseNo) return '';
      const key = `${DATE_CANDIDATE_MEMO_PREFIX}${compact(candidate.caseNo)}`;
      return clean(sessionStorage.getItem(key) || localStorage.getItem(key) || candidate.memo || '');
    } catch (_) {
      return clean(candidate?.memo || '');
    }
  }

  function discountRate(candidate) {
    const minBid = numberValue(candidate?.minBid);
    const appraisal = numberValue(candidate?.appraisal);
    return minBid && appraisal ? (minBid / appraisal) * 100 : 0;
  }

  function percent(value) {
    const n = Number(value || 0);
    return n > 0 ? `${n.toFixed(1)}%` : '-';
  }

  function isHousing(candidate) {
    return /주거|아파트|다세대|단독|연립|다가구|주택/i.test(clean(candidate?.usage));
  }

  function candidateScore(candidate) {
    let score = 0;
    const minBid = numberValue(candidate?.minBid);
    const appraisal = numberValue(candidate?.appraisal);
    const failCount = Number(candidate?.failCount || 0);
    const hasMemo = clean(candidate?.memo || loadDateCandidateMemo(candidate)).length > 0;

    if (minBid > 0) score += 20;
    if (appraisal > 0 && minBid > 0) score += Math.max(0, 40 - Math.round(discountRate(candidate) / 3));
    if (failCount > 0) score += Math.min(20, failCount * 2);
    if (isHousing(candidate)) score += 10;
    if (hasMemo) score += 10;
    return score;
  }

  function scoreReasons(candidate) {
    const reasons = [];
    const minBid = numberValue(candidate?.minBid);
    const appraisal = numberValue(candidate?.appraisal);
    const failCount = Number(candidate?.failCount || 0);
    if (minBid > 0) reasons.push(`가격: 최저가 ${clean(candidate.minBid)}로 비교 기준에 포함됩니다.`);
    if (appraisal > 0 && minBid > 0) reasons.push(`할인율: 감정가 대비 최저가 비율이 ${percent(discountRate(candidate))}입니다.`);
    if (failCount > 0) reasons.push(`유찰: ${failCount}회 유찰되어 가격 조정 이력이 있습니다.`);
    if (isHousing(candidate)) reasons.push('용도: 주거형으로 우선 검토군에 포함됩니다.');
    if (clean(candidate?.memo || loadDateCandidateMemo(candidate))) reasons.push('메모: 별도 검토 메모가 있어 추적 필요성이 있습니다.');
    return reasons;
  }

  function scoreReasonText(candidate) {
    const reasons = scoreReasons(candidate);
    return reasons.length ? reasons.join(' ') : '기초 정보가 부족해 점수 근거가 제한적입니다.';
  }

  function oneLineDecision(candidate, score) {
    const minBid = numberValue(candidate?.minBid);
    const appraisal = numberValue(candidate?.appraisal);
    const failCount = Number(candidate?.failCount || 0);
    const hasMemo = clean(candidate?.memo || loadDateCandidateMemo(candidate)).length > 0;
    const rate = discountRate(candidate);

    if (score >= 70 && hasMemo) return '가격 조건과 검토 흔적이 모두 있어 우선 확인할 만한 후보입니다.';
    if (appraisal > 0 && minBid > 0 && rate <= 60) return '감정가 대비 최저가 비율이 낮아 가격 관점에서 먼저 볼 만합니다.';
    if (failCount >= 5) return '유찰 이력이 많아 가격 변동성과 사유 확인이 필요한 후보입니다.';
    if (isHousing(candidate)) return '주거형 후보로 권리관계와 점유자를 확인해볼 만합니다.';
    if (score >= 50) return '기초 조건이 비교 목록 안에서 상대적으로 양호한 후보입니다.';
    return '정보가 제한적이므로 원본 조회 후 판단해야 합니다.';
  }

  function topSavedCandidates(limit = 5) {
    return loadSavedCandidates()
      .map((candidate) => {
        const score = candidateScore(candidate);
        return { candidate, score, reasons: scoreReasonText(candidate), decision: oneLineDecision(candidate, score) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  function plannedBidMessage({ plannedBid, minBid, upper, inheritedTotal, riskLevel }) {
    if (!plannedBid) return '';
    if (plannedBid < minBid) return '입찰 예정가가 최저가보다 낮아 실제 입찰 가능 여부 재확인이 필요합니다.';
    if (upper && plannedBid > upper) return '입찰 예정가가 검토상한가를 초과합니다. 과입찰 가능성을 주의해야 합니다.';
    if (riskLevel === 'danger' && inheritedTotal > 0) return '고위험 물건이므로 입찰가보다 인수금액 포함 실질 부담액을 우선 확인해야 합니다.';
    if (inheritedTotal > 0) return '인수 추정금액이 있으므로 낙찰가가 아니라 실질 부담액 기준으로 판단해야 합니다.';
    return '입력값 기준 검토 범위 안에 있으나 시세·명도비·수리비는 별도 반영이 필요합니다.';
  }

  function mainDecision(report, inheritedTotal, minBid) {
    const level = report?.risk?.level || 'ok';
    const tenants = Array.isArray(report?.tenants) ? report.tenants : [];
    const rights = Array.isArray(report?.rights) ? report.rights : [];
    const hasDaehangTenant = tenants.some((tenant) => tenant.daehang === '있음');
    const hasSpecialRight = rights.some((right) => right.status === '인수');

    if (level === 'danger' && hasDaehangTenant) return '대항력 임차인 또는 미배당 보증금 인수 가능성이 있어 단순 최저가 입찰은 위험합니다.';
    if (level === 'danger' && hasSpecialRight) return '인수 가능 권리가 있어 원본 서류 확인 전 입찰을 보류해야 합니다.';
    if (level === 'danger') return '고위험으로 분류되어 인수금액과 권리관계 재확인이 필요합니다.';
    if (level === 'warn') return '확인 필요 항목이 있어 입력값과 원본 서류를 대조해야 합니다.';
    if (inheritedTotal > 0) return '인수 추정금액이 있으므로 실질 부담액 기준으로 판단해야 합니다.';
    if (minBid > 0) return '현재 입력값 기준 큰 인수 위험은 낮으나, 원본 서류 최종 확인이 필요합니다.';
    return '최저가 또는 기본정보가 부족해 원본 서류 확인이 필요합니다.';
  }

  function importantChecks(report) {
    const checks = [];
    const tenants = Array.isArray(report?.tenants) ? report.tenants : [];
    const rights = Array.isArray(report?.rights) ? report.rights : [];

    checks.push('등기부등본 말소기준권리 접수일 재확인');
    checks.push('매각물건명세서 임차인·배당요구·인수권리 확인');
    checks.push('전입세대열람 또는 현장 확인으로 점유자 확인');

    if (!report?.malso) checks.push('말소기준권리 재정리');
    if (tenants.some((tenant) => tenant.daehang === '있음')) checks.push('대항력 임차인 미배당 보증금 인수 가능성 확인');
    if (tenants.some((tenant) => !numberValue(tenant.deposit))) checks.push('임차인 실제 보증금 확인');
    if (rights.some((right) => right.status === '인수')) checks.push('유치권·법정지상권 등 특수권리 원본 확인');

    return Array.from(new Set(checks)).slice(0, 6);
  }

  function appendDateCandidateSummary(lines) {
    const candidate = loadDateCandidate();
    if (!candidate?.caseNo) return;
    const memo = loadDateCandidateMemo(candidate);

    lines.push('');
    lines.push('매각기일 선택 후보:');
    lines.push(`- 사건번호: ${clean(candidate.caseNo)}`);
    if (candidate.saleDate) lines.push(`- 매각기일: ${clean(candidate.saleDate)}`);
    if (candidate.usage) lines.push(`- 용도: ${clean(candidate.usage)}`);
    if (candidate.minBid) lines.push(`- 후보 최저가: ${clean(candidate.minBid)}`);
    if (candidate.appraisal) lines.push(`- 후보 감정가: ${clean(candidate.appraisal)}`);
    if (candidate.failCount || candidate.discount) lines.push(`- 후보 조건: 유찰 ${clean(candidate.failCount || '-')} / 할인율 ${clean(candidate.discount || '-')}`);
    if (candidate.reason) lines.push(`- 후보 사유: ${clean(candidate.reason)}`);
    if (memo) lines.push(`- 검토 메모: ${memo}`);
  }

  function appendCandidateStackSummary(lines) {
    const stack = loadDateCandidateStack().slice(0, 5);
    if (!stack.length) return;

    lines.push('');
    lines.push(`임시 비교 후보: ${stack.length}건`);
    stack.forEach((candidate, index) => {
      const memo = loadDateCandidateMemo(candidate);
      lines.push(`${index + 1}. ${clean(candidate.caseNo || '사건번호 미확인')}`);
      if (candidate.saleDate) lines.push(`   - 매각기일: ${clean(candidate.saleDate)}`);
      if (candidate.usage) lines.push(`   - 용도: ${clean(candidate.usage)}`);
      if (candidate.minBid) lines.push(`   - 최저가: ${clean(candidate.minBid)}`);
      if (candidate.appraisal) lines.push(`   - 감정가: ${clean(candidate.appraisal)}`);
      if (candidate.failCount || candidate.discount) lines.push(`   - 조건: 유찰 ${clean(candidate.failCount || '-')} / 할인율 ${clean(candidate.discount || '-')}`);
      if (memo) lines.push(`   - 메모: ${memo}`);
    });
  }

  function appendSavedTopFiveSummary(lines) {
    const top = topSavedCandidates(5);
    if (!top.length) return;

    lines.push('');
    lines.push(`저장 후보 TOP 5: ${top.length}건`);
    top.forEach(({ candidate, score, reasons, decision }, index) => {
      const memo = loadDateCandidateMemo(candidate);
      lines.push(`${index + 1}. ${clean(candidate.caseNo || '사건번호 미확인')} / 점수 ${score}`);
      lines.push(`   - 한 줄 판단: ${decision}`);
      if (candidate.saleDate) lines.push(`   - 매각기일: ${clean(candidate.saleDate)}`);
      if (candidate.usage) lines.push(`   - 용도: ${clean(candidate.usage)}`);
      if (candidate.minBid) lines.push(`   - 최저가: ${clean(candidate.minBid)}`);
      if (candidate.appraisal) lines.push(`   - 감정가: ${clean(candidate.appraisal)}`);
      lines.push(`   - 근거 설명: ${reasons}`);
      if (memo) lines.push(`   - 메모: ${memo}`);
    });
  }

  function appendLocationSummary(lines) {
    const location = loadLocationBasics();
    if (!location?.queryAddress) return;

    lines.push('');
    lines.push('입지 기초정보:');
    lines.push(`- 조회 주소: ${clean(location.queryAddress)}`);
    if (location.addressName) lines.push(`- 지번주소: ${clean(location.addressName)}`);
    if (location.roadAddress) lines.push(`- 도로명주소: ${clean(location.roadAddress)}`);
    if (location.buildingName) lines.push(`- 건물명: ${clean(location.buildingName)}`);
    if (location.x && location.y) lines.push(`- 좌표: X ${clean(location.x)} / Y ${clean(location.y)}`);
    if (location.region1 || location.region2 || location.region3) lines.push(`- 행정구역: ${[location.region1, location.region2, location.region3].map(clean).filter(Boolean).join(' ')}`);
    if (location.bCode) lines.push(`- 법정동코드: ${clean(location.bCode)}`);
    if (location.hCode) lines.push(`- 행정동코드: ${clean(location.hCode)}`);
    if (location.kakaoMapUrl) lines.push(`- 카카오맵: ${clean(location.kakaoMapUrl)}`);
  }

  function tradeDate(trade) {
    const y = clean(trade?.dealYear);
    const m = clean(trade?.dealMonth).padStart(2, '0');
    const d = clean(trade?.dealDay).padStart(2, '0');
    return [y, m, d].filter(Boolean).join('.');
  }

  function appendMolitTradeSummary(lines) {
    const result = loadMolitTradeBasics();
    if (!result?.lawdCd) return;
    const trades = Array.isArray(result.trades) ? result.trades.slice(0, 5) : [];
    const stats = result.stats || {};
    const comparison = result.comparison || {};

    lines.push('');
    lines.push('실거래가 기초정보:');
    lines.push(`- LAWD_CD: ${clean(result.lawdCd)}`);
    if (result.dealYmd) lines.push(`- 조회 계약월: ${clean(result.dealYmd)}`);
    lines.push(`- 단지명 필터: ${clean(result.aptName || '미적용')}`);
    lines.push(`- 표시 결과: ${Number(result.count || 0)}건 / 원자료 ${Number(result.rawCount || 0)}건`);
    if (result.judgment) lines.push(`- 거래 판단: ${clean(result.judgment)}`);
    if (comparison.judgment) lines.push(`- 가격 비교 판단: ${clean(comparison.judgment)}`);
    if (comparison.minBidWon) lines.push(`- 경매 최저가: ${won(comparison.minBidWon)}`);
    if (comparison.avgTradeWon) lines.push(`- 평균 실거래가: ${won(comparison.avgTradeWon)}`);
    if (comparison.minTradeWon) lines.push(`- 최저 실거래가: ${won(comparison.minTradeWon)}`);
    if (comparison.avgRatio) lines.push(`- 최저가/평균가: ${ratio(comparison.avgRatio)}`);
    if (comparison.minRatio) lines.push(`- 최저가/최저실거래: ${ratio(comparison.minRatio)}`);
    if (stats.count !== undefined) lines.push(`- 거래 건수: ${Number(stats.count || 0)}건`);
    if (stats.minPrice) lines.push(`- 최저 거래금액: ${manwon(stats.minPrice)}`);
    if (stats.maxPrice) lines.push(`- 최고 거래금액: ${manwon(stats.maxPrice)}`);
    if (stats.avgPrice) lines.push(`- 평균 거래금액: ${manwon(stats.avgPrice)}`);
    if (stats.minArea && stats.maxArea) lines.push(`- 전용면적 범위: ${Number(stats.minArea).toFixed(2)}㎡ ~ ${Number(stats.maxArea).toFixed(2)}㎡`);
    if (Array.isArray(result.tradeTypes) && result.tradeTypes.length) {
      const typeSummary = result.tradeTypes.map((t) => `${clean(t.label || t.type)} ${Number(t.filteredCount || 0)}건`).join(' / ');
      lines.push(`- 유형별 결과: ${typeSummary}`);
    }

    if (!trades.length) {
      lines.push('- 거래 목록: 최근 조회 범위 내 표시 가능한 거래 없음');
      lines.push('- 확인 필요: 단지명 필터 해제, 계약월 확대, 동일 면적·층 여부 별도 확인');
      return;
    }

    lines.push('- 주요 거래:');
    trades.forEach((trade, index) => {
      const parts = [
        clean(trade.tradeTypeLabel || trade.tradeType || ''),
        clean(trade.aptName || ''),
        tradeDate(trade),
        clean(trade.dealAmount ? `${trade.dealAmount}만원` : ''),
        clean(trade.area ? `전용 ${trade.area}㎡` : ''),
        clean(trade.floor ? `${trade.floor}층` : ''),
      ].filter(Boolean);
      lines.push(`  ${index + 1}. ${parts.join(' / ')}`);
    });
    lines.push('- 주의: 실거래가는 참고용이며 동일 단지·동·층·면적, 계약해제 여부, 거래시점 차이를 별도 확인해야 합니다.');
  }

  function buildSummaryText(report) {
    const minBid = numberValue(report?.basic?.['최저매각가격'] || report?.basic?.['최저가']);
    const inheritedTotal = numberValue(report?.inherited?.total);
    const practicalBurden = minBid + inheritedTotal;
    const upper = numberValue(report?.bidRec?.upper);
    const upperTotal = upper ? upper + inheritedTotal : 0;
    const plannedBid = loadPlannedBid(report);
    const plannedBidDepositRate = numberValue(report?.basic?.['입찰보증금률']) || 10;
    const plannedBidDeposit = Math.round(plannedBid * plannedBidDepositRate / 100);
    const plannedTotal = plannedBid + inheritedTotal;
    const plannedMessage = plannedBidMessage({
      plannedBid,
      minBid,
      upper,
      inheritedTotal,
      riskLevel: report?.risk?.level || 'ok',
    });
    const lines = [];

    lines.push('[낙찰노트 입찰 검토 요약]');
    lines.push(`사건: ${caseLabel(report) || '미확인'}`);
    lines.push(`위험도: ${riskLabel(report?.risk?.level)}`);
    lines.push(`최저가: ${money(minBid)}`);
    lines.push(`인수 추정금액: ${money(inheritedTotal)}`);
    lines.push(`최저가 기준 실질 부담: ${money(practicalBurden)}`);
    if (upper) lines.push(`검토상한가 기준 실질 부담: ${money(upperTotal)}`);
    appendLocationSummary(lines);
    appendMolitTradeSummary(lines);
    appendDateCandidateSummary(lines);
    appendCandidateStackSummary(lines);
    appendSavedTopFiveSummary(lines);
    if (plannedBid) {
      lines.push('');
      lines.push('내 입찰가 시뮬레이션:');
      lines.push(`- 입찰 예정가: ${money(plannedBid)}`);
      lines.push(`- 입찰보증금(${plannedBidDepositRate}%): ${money(plannedBidDeposit)}`);
      lines.push(`- 입찰가+인수 추정금액: ${money(plannedTotal)}`);
      lines.push(`- 판단: ${plannedMessage}`);
    }
    lines.push(`핵심 판단: ${mainDecision(report, inheritedTotal, minBid)}`);
    lines.push('');
    lines.push('입찰 전 확인 필요:');
    importantChecks(report).forEach((item) => lines.push(`- ${item}`));
    lines.push('');
    lines.push('※ 본 요약은 입력값 기반 참고자료이며, 실제 입찰 전 등기부·매각물건명세서·전입세대열람·현장조사 재확인이 필요합니다.');
    return lines.join('\n');
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', 'readonly');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }

  function upsertCopyCard() {
    const report = state()?.report;
    const checklist = document.getElementById('v2PreBidChecklistCard');
    const funding = document.getElementById('v2FundingReviewCard');
    const summary = document.getElementById('v2BiddingSummaryCard');
    const anchor = checklist || funding || summary;

    if (!report || !anchor) {
      document.getElementById('v2CopySummaryCard')?.remove();
      return;
    }

    let card = document.getElementById('v2CopySummaryCard');
    if (!card) {
      card = document.createElement('section');
      card.id = 'v2CopySummaryCard';
      card.className = 'v2-card';
      anchor.parentNode.insertBefore(card, anchor.nextSibling);
    }

    if (card.previousElementSibling !== anchor) {
      anchor.parentNode.insertBefore(card, anchor.nextSibling);
    }

    card.innerHTML = `
      <span class="v2-badge">요약 복사</span>
      <h3>입찰 검토 요약 복사</h3>
      <p class="v2-note">현재 권리분석 결과를 메모장, 카톡, 노션 등에 붙여넣기 쉬운 형태로 복사합니다.</p>
      <div class="v2-actions">
        <button type="button" class="v2-btn primary" id="v2CopySummaryBtn">검토 요약 복사</button>
        <span class="v2-note" id="v2CopySummaryStatus"></span>
      </div>
    `;

    const button = card.querySelector('#v2CopySummaryBtn');
    const status = card.querySelector('#v2CopySummaryStatus');
    button?.addEventListener('click', async () => {
      try {
        await copyText(buildSummaryText(report));
        if (status) status.textContent = '복사되었습니다.';
      } catch (_) {
        if (status) status.textContent = '복사에 실패했습니다. 브라우저 권한을 확인해주세요.';
      }
    }, { once: true });
  }

  setInterval(upsertCopyCard, 700);
})();
