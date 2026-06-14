(() => {
  const CARD_ID = 'v2RiskBriefCard';
  const CHANGE_EVENT = 'auction:result-card-change';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function app() {
    return window.__auctionV2 || null;
  }

  function state() {
    return app()?.state || null;
  }

  function numberValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
    const digits = clean(value).replace(/[^0-9]/g, '');
    return digits ? Math.max(0, Number(digits)) : 0;
  }

  function esc(value) {
    return clean(value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
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

  function unique(items) {
    return Array.from(new Set(items.map(clean).filter(Boolean)));
  }

  function riskReasons(report) {
    const reasons = [];
    const tenants = Array.isArray(report?.tenants) ? report.tenants : [];
    const rights = Array.isArray(report?.rights) ? report.rights : [];
    const flags = Array.isArray(report?.risk?.flags) ? report.risk.flags : [];
    const inheritedTotal = numberValue(report?.inherited?.total);

    if (!report?.malso) {
      reasons.push('말소기준권리가 확정되지 않아 권리 소멸·인수 판단이 불안정합니다.');
    }

    tenants.forEach((tenant) => {
      const name = clean(tenant.name || tenant['임차인']) || '임차인';
      if (tenant.daehang === '있음') {
        reasons.push(`${name}은 전입일이 말소기준권리보다 앞선 대항력 임차인으로 추정됩니다.`);
      }
      if (tenant.daehang === '?' || tenant.daehang === '확인필요') {
        reasons.push(`${name}의 대항력 판단이 불명확합니다. 전입일·점유 여부 확인이 필요합니다.`);
      }
      if (!numberValue(tenant.deposit)) {
        reasons.push(`${name}의 보증금이 비어 있거나 0원입니다. 실제 보증금 확인이 필요합니다.`);
      }
    });

    rights.forEach((right) => {
      const type = clean(right.type || right['권리종류']);
      const holder = clean(right.holder || right['권리자']);
      if (right.status === '인수') {
        reasons.push(`${type || '특수권리'}${holder ? `(${holder})` : ''}가 인수 가능 권리로 분류되었습니다.`);
      }
      if (right.dateValid === false) {
        reasons.push(`${type || '권리'}의 접수일자가 유효하지 않습니다. 원본 등기부 기준 재확인이 필요합니다.`);
      }
    });

    flags.forEach((flag) => {
      const msg = clean(flag.msg || flag.message || flag.reason);
      if (msg) reasons.push(msg);
    });

    if (inheritedTotal > 0) {
      reasons.push(`현재 입력값 기준 인수 추정금액이 ${inheritedTotal.toLocaleString('ko-KR')}원입니다.`);
    }

    if (!reasons.length) {
      reasons.push('현재 입력값 기준 큰 인수 위험은 낮게 보이나, 원본 서류 확인은 필요합니다.');
    }

    return unique(reasons).slice(0, 6);
  }

  function actionLevel(report) {
    const level = report?.risk?.level || 'ok';
    if (level === 'danger') return '입찰 보류 또는 원본 서류 재검토 우선';
    if (level === 'warn') return '확인 필요 항목 보완 후 재판단';
    return '원본 서류 최종 확인 후 가격 검토 가능';
  }

  function signature(report, reasons) {
    const inheritedTotal = numberValue(report?.inherited?.total);
    const minBid = numberValue(report?.basic?.['최저매각가격'] || report?.basic?.['최저가']);
    return [
      report?.risk?.level || 'ok',
      actionLevel(report),
      inheritedTotal,
      minBid,
      ...reasons,
    ].map(clean).join('|');
  }

  function renderRiskBriefHtml(report, reasons) {
    const level = report?.risk?.level || 'ok';
    const inheritedTotal = numberValue(report?.inherited?.total);
    const minBid = numberValue(report?.basic?.['최저매각가격'] || report?.basic?.['최저가']);
    const practicalBurden = minBid + inheritedTotal;
    return `
      <span class="v2-badge">판단 근거</span>
      <h3>위험 판단 근거</h3>
      <p class="v2-note">권리분석 결과에서 입찰 전 확인해야 할 리스크만 추렸습니다.</p>
      <div class="v2-grid compact">
        <div class="v2-info-box"><span>권리 위험도</span><strong>${esc(riskLabel(level))}</strong></div>
        <div class="v2-info-box"><span>인수 추정금액</span><strong>${esc(money(inheritedTotal))}</strong></div>
        <div class="v2-info-box"><span>최저가 기준 실질부담</span><strong>${esc(money(practicalBurden))}</strong></div>
        <div class="v2-info-box"><span>현재 권장 조치</span><strong>${esc(actionLevel(report))}</strong></div>
      </div>
      <ul class="v2-list">
        ${reasons.map((reason) => `<li>${esc(reason)}</li>`).join('')}
      </ul>
    `;
  }

  function notifyResultChange() {
    document.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { id: CARD_ID } }));
    window.__auctionResultOrder?.schedule?.(CARD_ID);
  }

  function upsertRiskBrief() {
    const report = state()?.report;
    const summary = document.getElementById('v2BiddingSummaryCard');
    if (!report || !summary) {
      document.getElementById(CARD_ID)?.remove();
      return;
    }

    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('section');
      card.id = CARD_ID;
      card.className = 'v2-result-card v2-risk-brief-card';
      card.dataset.workflowStep = 'risk';
      summary.parentNode.insertBefore(card, summary.nextSibling);
    }

    const reasons = riskReasons(report);
    const nextSignature = signature(report, reasons);
    card.className = 'v2-result-card v2-risk-brief-card';
    card.dataset.workflowStep = 'risk';
    if (card.dataset.signature !== nextSignature) {
      card.innerHTML = renderRiskBriefHtml(report, reasons);
      card.dataset.signature = nextSignature;
      notifyResultChange();
    }
  }

  setInterval(upsertRiskBrief, 500);
})();
