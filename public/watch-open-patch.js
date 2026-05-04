(() => {
  const KEY = 'gm_watchlist_v1';

  function loadCases() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  }

  function injectStyles() {
    if (document.getElementById('watchOpenPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'watchOpenPatchStyles';
    style.textContent = `
      .watch-detail-btn { margin-right:6px; background:var(--accent) !important; color:var(--accent-ink) !important; }
      .watch-action-cell { white-space:nowrap; }
    `;
    document.head.appendChild(style);
  }

  function parseCaseNo(caseNo) {
    const m = String(caseNo || '').match(/(20\d{2})\s*타경\s*(\d+)/);
    if (!m) return null;
    return { year: m[1], serial: m[2] };
  }

  window.openWatchCase = function(id) {
    const item = loadCases().find((x) => x.id === id);
    if (!item) return;
    const parsed = parseCaseNo(item.caseNo);
    if (!parsed) {
      alert('사건번호 형식을 인식하지 못했습니다.');
      return;
    }

    const courtSelect = document.getElementById('jiwonNm');
    const yearInput = document.getElementById('saYear');
    const serialInput = document.getElementById('saSer');
    const fetchBtn = document.getElementById('btnFetch');

    if (!courtSelect || !yearInput || !serialInput || !fetchBtn) return;

    const wantedCourt = item.court || '';
    const exact = [...courtSelect.options].find((o) => o.value === wantedCourt || o.textContent === wantedCourt);
    if (exact) courtSelect.value = exact.value;
    else {
      const compact = wantedCourt.replace(/\s+/g, '');
      const fuzzy = [...courtSelect.options].find((o) => o.textContent.replace(/\s+/g, '').includes(compact) || compact.includes(o.textContent.replace(/\s+/g, '')));
      if (fuzzy) courtSelect.value = fuzzy.value;
    }

    yearInput.value = parsed.year;
    serialInput.value = parsed.serial;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => fetchBtn.click(), 200);
  };

  function addOpenButtons() {
    injectStyles();
    document.querySelectorAll('.watchlist-table tbody tr').forEach((row) => {
      if (row.querySelector('.watch-detail-btn')) return;
      const deleteBtn = row.querySelector('button[onclick^="deleteWatchCase"]');
      if (!deleteBtn) return;
      const m = String(deleteBtn.getAttribute('onclick') || '').match(/deleteWatchCase\('([^']+)'\)/);
      if (!m) return;
      const id = m[1];
      const td = deleteBtn.closest('td');
      if (td) td.classList.add('watch-action-cell');
      deleteBtn.insertAdjacentHTML('beforebegin', `<button class="watch-btn watch-detail-btn" onclick="openWatchCase('${id}')">상세분석</button>`);
    });
  }

  const observer = new MutationObserver(addOpenButtons);
  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    addOpenButtons();
    const target = document.getElementById('resultsSection') || document.body;
    observer.observe(target, { childList: true, subtree: true });
  });
  setInterval(addOpenButtons, 1000);
})();
