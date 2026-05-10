(() => {
  const COURT = '서울중앙';
  const LABEL = '서울중앙';

  function lockCourt() {
    const el = document.getElementById('dateCourtV2');
    if (!el) return;

    if (el.tagName === 'SELECT') {
      if (el.options.length !== 1 || el.value !== COURT) {
        el.innerHTML = `<option value="${COURT}" selected>${LABEL}</option>`;
      }
      el.value = COURT;
    } else {
      const select = document.createElement('select');
      select.id = 'dateCourtV2';
      select.className = el.className;
      select.innerHTML = `<option value="${COURT}" selected>${LABEL}</option>`;
      el.replaceWith(select);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    addNotice();
  }

  function addNotice() {
    if (document.getElementById('dateSeoulOnlyNotice')) return;
    const msg = document.getElementById('dateMessageV2');
    const wrap = msg?.parentElement || document.querySelector('.v2-panel.active .v2-card');
    if (!wrap) return;
    const note = document.createElement('p');
    note.id = 'dateSeoulOnlyNotice';
    note.className = 'v2-note';
    note.textContent = '현재 매각기일 추천은 서울중앙 기준으로만 검증 중입니다. 다른 법원은 조회 안정화 후 다시 개방합니다.';
    if (msg) wrap.insertBefore(note, msg);
    else wrap.appendChild(note);
  }

  setInterval(lockCourt, 400);
})();
