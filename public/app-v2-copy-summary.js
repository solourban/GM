(() => {
  const BID_PLAN_STORAGE_PREFIX = 'auction-note:v2.2:bid-plan:';
  const DATE_CANDIDATE_STORAGE_KEY = 'auction-note:v2:selected-date-candidate';
  const DATE_CANDIDATE_MEMO_PREFIX = 'auction-note:v2:date-candidate-memo:';
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

  function loadDateCandidateMemo(candidate) {
    try {
      if (!candidate?.caseNo) return '';
      return clean(sessionStorage.getItem(`${DATE_CANDIDATE_MEMO_PREFIX}${compact(candidate.caseNo)}`) || '');
    } catch (_) {
      return '';
    }
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
    appendDateCandidateSummary(lines);
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
