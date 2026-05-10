(() => {
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function app() {
    return window.__auctionV2 || null;
  }

  function state() {
    return app()?.state || null;
  }

  function formatWon(value) {
    const n = Math.max(0, Number(value || 0));
    return `${n.toLocaleString('ko-KR')}원`;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function renderAllocations(report) {
    const allocations = Array.isArray(report?.baedang?.allocations) ? report.baedang.allocations : [];
    if (!allocations.length) {
      return '<p class="v2-note">배당 시뮬레이션 항목이 없습니다.</p>';
    }

    return `
      <div class="v2-detail-table-wrap">
        <table class="v2-detail-table">
          <thead>
            <tr><th>순서</th><th>배당 항목</th><th>추정 배당액</th></tr>
          </thead>
          <tbody>
            ${allocations.map((item) => `
              <tr>
                <td>${esc(item.order || '')}</td>
                <td>${esc(item.label || '-')}</td>
                <td>${formatWon(item.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderInheritedItems(report) {
    const items = Array.isArray(report?.inherited?.items) ? report.inherited.items : [];
    if (!items.length) {
      return '<p class="v2-note">현재 입력값 기준으로 인수 추정 항목은 없습니다.</p>';
    }

    return `
      <div class="v2-detail-table-wrap">
        <table class="v2-detail-table">
          <thead>
            <tr><th>인수 가능 항목</th><th>금액</th><th>비고</th></tr>
          </thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>${esc(item.label || '-')}</td>
                <td>${formatWon(item.amount)}</td>
                <td>${esc(item.note || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function tenantAllocationRows(report) {
    const tenants = Array.isArray(report?.tenants) ? report.tenants : [];
    return tenants
      .filter((tenant) => tenant?.daehang === '있음' && Number(tenant?.deposit || 0) > 0)
      .map((tenant) => {
        const deposit = Number(tenant.deposit || 0);
        const paid = Math.max(0, Number(tenant._choi || 0) + Number(tenant._baedang || 0));
        const unpaid = Math.max(0, deposit - paid);
        return { tenant, deposit, paid, unpaid };
      });
  }

  function renderFormula(report) {
    const rows = tenantAllocationRows(report);
    if (!rows.length) return '';

    return `
      <h4 class="v2-detail-title">임차인 인수 추정 계산식</h4>
      <div class="v2-detail-table-wrap">
        <table class="v2-detail-table">
          <thead>
            <tr><th>임차인</th><th>보증금</th><th>추정 배당액</th><th>인수 추정액</th><th>계산식</th></tr>
          </thead>
          <tbody>
            ${rows.map(({ tenant, deposit, paid, unpaid }) => `
              <tr>
                <td>${esc(tenant.name || '임차인')}</td>
                <td>${formatWon(deposit)}</td>
                <td>${formatWon(paid)}</td>
                <td>${formatWon(unpaid)}</td>
                <td>${formatWon(deposit)} - ${formatWon(paid)} = ${formatWon(unpaid)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPriorityNotes(report) {
    const rows = tenantAllocationRows(report);
    if (!rows.length) return '';

    return `
      <div class="v2-analysis-block">
        <h4>배당순위 해석</h4>
        <ul class="v2-analysis-list">
          ${rows.map(({ tenant }) => `
            <li>${esc(tenant.name || '임차인')}은 전입일(${esc(tenant.moveIn || '-')})이 말소기준권리(${esc(report?.malso?.date || '-')})보다 빨라 대항력 있는 임차인으로 추정됩니다.</li>
          `).join('')}
          <li>확정일자와 전입일이 선순위 권리보다 앞서는 경우, 배당 시뮬레이션에서 임차인 우선변제 항목이 먼저 반영될 수 있습니다.</li>
          <li>이 계산은 최저가 기준 단순 추정이며, 실제 배당표·집행비용·조세채권·임금채권 등 선순위 항목에 따라 달라질 수 있습니다.</li>
        </ul>
      </div>
    `;
  }

  function renderAllocationCard() {
    const s = state();
    const report = s?.report;
    if (!report) {
      document.getElementById('allocationExplainCard')?.remove();
      return;
    }

    const analysis = document.getElementById('analysisCard');
    if (!analysis) return;

    let card = document.getElementById('allocationExplainCard');
    if (!card) {
      card = document.createElement('section');
      card.id = 'allocationExplainCard';
      card.className = 'v2-result-card';
      analysis.parentNode.insertBefore(card, analysis.nextSibling);
    }

    const bidPrice = Number(report?.baedang?.bidPrice || 0);
    const surplus = Number(report?.baedang?.surplus || 0);
    const inheritedTotal = Number(report?.inherited?.total || 0);

    card.innerHTML = `
      <span class="v2-badge">계산 근거</span>
      <h3>배당·인수금액 계산 근거</h3>
      <p class="v2-note">현재 입력값과 최저가 기준으로 단순 시뮬레이션한 결과입니다. 실제 배당표, 집행비용, 배당순위에 따라 달라질 수 있습니다.</p>

      <div class="v2-grid compact">
        <div class="v2-info"><div class="k">배당 시뮬레이션 기준금액</div><div class="v">${formatWon(bidPrice)}</div></div>
        <div class="v2-info"><div class="k">배당 후 잔여액 추정</div><div class="v">${formatWon(surplus)}</div></div>
        <div class="v2-info"><div class="k">인수 추정 총액</div><div class="v">${formatWon(inheritedTotal)}</div></div>
      </div>

      ${renderPriorityNotes(report)}

      <h4 class="v2-detail-title">배당 시뮬레이션</h4>
      ${renderAllocations(report)}

      ${renderFormula(report)}

      <h4 class="v2-detail-title">인수 가능 항목</h4>
      ${renderInheritedItems(report)}

      <p class="v2-note">특히 대항력 있는 임차인은 배당에서 보증금 전액을 받지 못하면 미배당 잔액이 매수인에게 인수될 수 있습니다.</p>
    `;
  }

  setInterval(renderAllocationCard, 500);
})();
