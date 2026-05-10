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

      <h4 class="v2-detail-title">배당 시뮬레이션</h4>
      ${renderAllocations(report)}

      <h4 class="v2-detail-title">인수 가능 항목</h4>
      ${renderInheritedItems(report)}

      <p class="v2-note">특히 대항력 있는 임차인은 배당에서 보증금 전액을 받지 못하면 미배당 잔액이 매수인에게 인수될 수 있습니다.</p>
    `;
  }

  setInterval(renderAllocationCard, 500);
})();
