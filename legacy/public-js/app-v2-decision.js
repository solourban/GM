(() => {
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function app() {
    return window.__auctionV2 || null;
  }

  function state() {
    return app()?.state || null;
  }

  function parseMoney(value) {
    if (typeof value === 'number') return Math.max(0, value);
    const text = clean(value).replace(/\s+/g, '');
    if (!text) return 0;
    const digits = text.replace(/[^0-9]/g, '');
    return digits ? Number(digits) : 0;
  }

  function formatWon(value) {
    const n = Math.max(0, Number(value || 0));
    return `${n.toLocaleString('ko-KR')}원`;
  }

  function getMinBid(report) {
    return parseMoney(
      report?.basic?.['최저매각가격'] ||
      report?.basic?.['최저가'] ||
      report?.minBid ||
      0
    );
  }

  function getAppraisal(report) {
    return parseMoney(
      report?.basic?.['감정평가액'] ||
      report?.basic?.['감정가'] ||
      report?.appraisal ||
      0
    );
  }

  function hasInheritableRight(report) {
    return Array.isArray(report?.rights) && report.rights.some((right) => right?.status === '인수');
  }

  function hasUnknownJudgement(report) {
    const unknownRight = Array.isArray(report?.rights) && report.rights.some((right) => ['?', '확인필요'].includes(right?.status));
    const unknownTenant = Array.isArray(report?.tenants) && report.tenants.some((tenant) => ['?', '확인필요'].includes(tenant?.daehang));
    return unknownRight || unknownTenant || !report?.malso;
  }

  function getDaehangTenants(report) {
    return Array.isArray(report?.tenants) ? report.tenants.filter((tenant) => tenant?.daehang === '있음') : [];
  }

  function makeDecision(report) {
    const minBid = getMinBid(report);
    const appraisal = getAppraisal(report);
    const inheritedTotal = Math.max(0, Number(report?.inherited?.total || 0));
    const estimatedBurden = minBid + inheritedTotal;
    const daehangTenants = getDaehangTenants(report);
    const daehangDeposit = daehangTenants.reduce((sum, tenant) => sum + Math.max(0, Number(tenant?.deposit || 0)), 0);
    const inheritableRight = hasInheritableRight(report);
    const unknown = hasUnknownJudgement(report);
    const riskLevel = report?.risk?.level || 'ok';

    const checks = [];
    let grade = '검토 가능';
    let tone = 'ok';
    let reason = '입력값 기준으로 큰 인수 위험은 보이지 않습니다. 다만 원본 서류 확인 전에는 입찰 판단을 확정하면 안 됩니다.';

    if (daehangTenants.length && daehangDeposit > 0) {
      grade = '고위험';
      tone = 'danger';
      reason = '대항력 있는 임차인이 있어 배당 부족 시 보증금 미배당액을 매수인이 인수할 수 있습니다.';
      checks.push('매각물건명세서 비고의 임차인 인수 문구 확인');
      checks.push('전입세대열람·주민등록 전입일 재확인');
      checks.push('배당요구 여부와 배당 가능액 확인');
    } else if (inheritableRight) {
      grade = '고위험';
      tone = 'danger';
      reason = '인수 가능 권리가 있습니다. 소멸되지 않는 권리가 있으면 낙찰 후 부담으로 이어질 수 있습니다.';
      checks.push('등기부 갑구·을구에서 선순위 및 특수권리 확인');
      checks.push('유치권·법정지상권 등 현장조사 필요 권리 확인');
    } else if (inheritedTotal > 0 && minBid > 0 && inheritedTotal >= minBid * 0.3) {
      grade = '고위험';
      tone = 'danger';
      reason = '인수 추정액이 최저가 대비 과도합니다. 최저가만 보고 입찰하면 실질 부담이 크게 늘어날 수 있습니다.';
      checks.push('인수 추정액 산정 근거 재확인');
      checks.push('입찰가에 인수 가능액을 더한 실질 부담액 확인');
    } else if (unknown) {
      grade = '보류';
      tone = 'warn';
      reason = '말소기준권리 또는 임차인 판단에 확인이 필요한 항목이 있습니다. 입력값이 불완전하면 입찰 판단도 불안정합니다.';
      checks.push('말소기준권리 접수일자와 권리종류 재확인');
      checks.push('임차인 전입일·확정일자·보증금 재확인');
    } else if (riskLevel === 'warn') {
      grade = '주의';
      tone = 'warn';
      reason = '일부 확인 필요 항목이 있습니다. 원본 서류와 현장 확인 후 입찰가를 다시 계산해야 합니다.';
      checks.push('매각물건명세서 원문 확인');
      checks.push('등기부 최신 발급본 확인');
    }

    if (!checks.includes('매각물건명세서 원문 확인')) checks.push('매각물건명세서 원문 확인');
    if (!checks.includes('등기부 최신 발급본 확인')) checks.push('등기부 최신 발급본 확인');
    if (!checks.includes('현장 점유자 및 실제 점유 상태 확인')) checks.push('현장 점유자 및 실제 점유 상태 확인');

    return {
      grade,
      tone,
      reason,
      minBid,
      appraisal,
      inheritedTotal,
      estimatedBurden,
      daehangCount: daehangTenants.length,
      checks: checks.slice(0, 6),
    };
  }

  function renderDecision() {
    const s = state();
    const report = s?.report;
    if (!report) {
      document.getElementById('bidDecisionCard')?.remove();
      return;
    }

    const analysis = document.getElementById('analysisCard');
    if (!analysis) return;

    const decision = makeDecision(report);
    s.bidDecision = decision;

    let card = document.getElementById('bidDecisionCard');
    if (!card) {
      card = document.createElement('section');
      card.id = 'bidDecisionCard';
      card.className = 'v2-result-card';
      analysis.parentNode.insertBefore(card, analysis);
    }

    const badgeClass = decision.tone === 'danger' ? 'danger' : decision.tone === 'warn' ? 'warn' : '';
    card.innerHTML = `
      <div class="v2-card-head">
        <div>
          <span class="v2-pill ${badgeClass}">입찰 판단 보조</span>
          <h3>입찰 판단 요약</h3>
          <p class="v2-note">입력값과 권리분석 결과를 바탕으로 한 1차 판단입니다. 최종 입찰 판단은 원본 서류와 현장 확인 후 결정해야 합니다.</p>
        </div>
        <span class="v2-pill ${badgeClass}">${decision.grade}</span>
      </div>
      <div class="v2-info-grid four">
        <div class="v2-info"><span class="k">현재 최저가</span><strong class="v">${formatWon(decision.minBid)}</strong></div>
        <div class="v2-info"><span class="k">인수 추정액</span><strong class="v">${formatWon(decision.inheritedTotal)}</strong></div>
        <div class="v2-info"><span class="k">실질 부담 추정</span><strong class="v">${formatWon(decision.estimatedBurden)}</strong></div>
        <div class="v2-info"><span class="k">대항력 임차인</span><strong class="v">${decision.daehangCount}명</strong></div>
      </div>
      <div class="v2-analysis-block">
        <h4>판단 사유</h4>
        <p>${decision.reason}</p>
      </div>
      <div class="v2-analysis-block">
        <h4>입찰 전 확인사항</h4>
        <ul class="v2-analysis-list">
          ${decision.checks.map((item) => `<li>${item}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  setInterval(renderDecision, 500);
})();
