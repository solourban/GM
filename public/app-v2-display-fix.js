(() => {
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function app() {
    return window.__auctionV2 || null;
  }

  function state() {
    return app()?.state || null;
  }

  function isManualMalsoAmountMissing() {
    const s = state();
    return !clean(s?.manual?.malso?.amount);
  }

  function replaceMalsoZeroAmountInAnalysis() {
    const s = state();
    if (!s?.report || !isManualMalsoAmountMissing()) return;

    document.querySelectorAll('.v2-detail-table').forEach((table) => {
      const headers = Array.from(table.querySelectorAll('thead th')).map((th) => clean(th.textContent));
      const amountIndex = headers.findIndex((h) => h === '금액');
      const judgementIndex = headers.findIndex((h) => h === '판단');
      const rightIndex = headers.findIndex((h) => h === '권리');
      if (amountIndex < 0 || judgementIndex < 0 || rightIndex < 0) return;

      table.querySelectorAll('tbody tr').forEach((row) => {
        const cells = Array.from(row.children);
        const amountCell = cells[amountIndex];
        const judgementCell = cells[judgementIndex];
        const rightCell = cells[rightIndex];
        if (!amountCell || !judgementCell || !rightCell) return;

        const isMalso = judgementCell.textContent.includes('말소기준') || row.textContent.includes('사용자가 입력한 말소기준권리');
        const isMortgage = rightCell.textContent.includes('근저당') || rightCell.textContent.includes('저당');
        const amountText = clean(amountCell.textContent);
        if (isMalso && isMortgage && amountText === '0원') {
          amountCell.textContent = '미입력';
        }
      });
    });
  }

  function addMissingAmountNotice() {
    const s = state();
    if (!s?.report || !isManualMalsoAmountMissing()) {
      document.getElementById('v2MissingAmountNotice')?.remove();
      return;
    }

    const analysis = document.getElementById('analysisCard');
    if (!analysis) return;

    if (document.getElementById('v2MissingAmountNotice')) return;
    const notice = document.createElement('p');
    notice.id = 'v2MissingAmountNotice';
    notice.className = 'v2-note';
    notice.textContent = '채권금액을 입력하지 않은 권리는 화면에 미입력으로 표시되며, 배당 계산에는 0원으로 처리됩니다.';
    analysis.appendChild(notice);
  }

  function run() {
    replaceMalsoZeroAmountInAnalysis();
    addMissingAmountNotice();
  }

  setInterval(run, 500);
})();
