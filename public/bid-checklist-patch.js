(() => {
  const KEY = 'gm_bid_checklist_v1';

  const ITEMS = [
    { id: 'registry', label: '등기부등본 확인', desc: '말소기준권리, 인수권리, 가압류·가처분·예고등기 등 확인' },
    { id: 'saleSpec', label: '매각물건명세서 확인', desc: '임차인, 대항력, 배당요구, 인수사항, 특별매각조건 확인' },
    { id: 'siteReport', label: '현황조사서 확인', desc: '점유자, 실제 사용상태, 조사일자, 미상 점유 여부 확인' },
    { id: 'appraisal', label: '감정평가서 확인', desc: '전용면적, 대지권, 구조, 하자, 감정 기준일 확인' },
    { id: 'residents', label: '전입세대/확정일자 확인', desc: '주민센터·정부24 등으로 실제 전입관계 재확인' },
    { id: 'arrears', label: '관리비·체납 가능성 확인', desc: '공용관리비, 수도·전기·가스, 장기수선충당금 등 확인' },
    { id: 'siteVisit', label: '현장답사', desc: '출입, 점유상태, 소음, 하자, 주변 시세, 매도 가능성 확인' },
    { id: 'loan', label: '대출 가능성 확인', desc: '낙찰가 기준 LTV, 대출 실행 가능일, 잔금기한 확인' },
    { id: 'cash', label: '잔금·취득비·예비비 확인', desc: '보증금, 잔금, 취득세, 수리비, 보유비까지 현금흐름 확인' },
    { id: 'exit', label: '엑시트 전략 확인', desc: '일반매도, 빠른정리, 전세세팅 중 현실적인 출구 확인' },
  ];

  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function caseKey() {
    const report = window.__lastAuctionReport || {};
    const raw = window.currentRaw || window.__lastAuctionRaw || {};
    return report.case || report.caseNo || raw.caseNo || raw.basic?.['사건번호'] || 'default';
  }

  function loadAll() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch { return {}; }
  }

  function saveAll(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function loadState() {
    const all = loadAll();
    return all[caseKey()] || {};
  }

  function saveState(state) {
    const all = loadAll();
    all[caseKey()] = state;
    saveAll(all);
  }

  function injectStyles() {
    if (document.getElementById('bidChecklistPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'bidChecklistPatchStyles';
    style.textContent = `
      .bid-check-card { margin-top:14px; }
      .bid-check-list { display:grid; gap:10px; margin-top:12px; }
      .bid-check-item { display:grid; grid-template-columns: 26px 1fr; gap:10px; align-items:start; border:1px solid var(--line); background:#fff; border-radius:12px; padding:12px; }
      .bid-check-item input { width:18px; height:18px; margin-top:2px; }
      .bid-check-item b { display:block; margin-bottom:3px; }
      .bid-check-item span { color:var(--ink-3); font-size:12.5px; line-height:1.5; }
      .bid-check-toolbar { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
      .bid-check-toolbar button { background:var(--accent); color:var(--accent-ink); border:none; border-radius:10px; padding:10px 13px; font-weight:900; cursor:pointer; }
      .bid-check-toolbar button.secondary { background:var(--bg); color:var(--ink-2); border:1px solid var(--line); }
      .bid-check-verdict { border-radius:14px; padding:14px; margin-top:12px; font-weight:800; }
      .bid-check-verdict.good { background:var(--ok-bg); color:var(--ok); }
      .bid-check-verdict.warn { background:var(--warn-bg); color:var(--warn); }
      .bid-check-verdict.danger { background:var(--danger-bg); color:var(--danger); }
      .bid-check-progress { margin-top:10px; height:9px; background:var(--bg); border-radius:999px; overflow:hidden; border:1px solid var(--line); }
      .bid-check-progress > div { height:100%; background:var(--accent); width:0%; transition:width .2s ease; }
    `;
    document.head.appendChild(style);
  }

  function getCheckedState() {
    const state = {};
    ITEMS.forEach((item) => {
      state[item.id] = Boolean(document.getElementById(`bidCheck_${item.id}`)?.checked);
    });
    return state;
  }

  function updateChecklist() {
    const state = getCheckedState();
    saveState(state);
    const checked = ITEMS.filter((item) => state[item.id]).length;
    const total = ITEMS.length;
    const pct = Math.round((checked / total) * 100);
    const missing = ITEMS.filter((item) => !state[item.id]);

    const progress = document.querySelector('#bidCheckProgress > div');
    if (progress) progress.style.width = `${pct}%`;

    const verdict = document.getElementById('bidCheckVerdict');
    if (!verdict) return;

    let cls = 'danger';
    let msg = `입찰 보류 권고 · ${checked}/${total}개 확인됨. 미확인: ${missing.slice(0, 4).map((x) => x.label).join(', ')}${missing.length > 4 ? ' 외' : ''}`;

    if (checked >= total) {
      cls = 'good';
      msg = '입찰 검토 가능 · 핵심 체크 항목이 모두 확인되었습니다. 최종 입찰가는 시세·자금·현금흐름 기준으로 다시 제한하세요.';
    } else if (checked >= Math.ceil(total * 0.7)) {
      cls = 'warn';
      msg = `경계 · ${checked}/${total}개 확인됨. 남은 항목을 확인하기 전에는 입찰가를 보수적으로 잡으세요.`;
    }

    verdict.className = `bid-check-verdict ${cls}`;
    verdict.textContent = msg;
  }

  function checkAll(value) {
    ITEMS.forEach((item) => {
      const el = document.getElementById(`bidCheck_${item.id}`);
      if (el) el.checked = value;
    });
    updateChecklist();
  }

  function renderChecklistCard() {
    injectStyles();
    const anchor = document.querySelector('.exit-plan-card') || document.querySelector('.cashflow-card') || document.querySelector('.capital-card') || document.querySelector('.scenario-card');
    if (!anchor || document.querySelector('.bid-check-card')) return;

    const state = loadState();
    anchor.insertAdjacentHTML('afterend', `
      <div class="subcard input-card platform-card bid-check-card">
        <h4>✅ 입찰 전 최종 체크리스트</h4>
        <p class="muted">계산값이 좋아도 서류·현장·자금 확인이 빠지면 입찰하면 안 됩니다. 사건별 체크 상태는 브라우저에 저장됩니다.</p>
        <div id="bidCheckProgress" class="bid-check-progress"><div></div></div>
        <div class="bid-check-list">
          ${ITEMS.map((item) => `
            <label class="bid-check-item">
              <input id="bidCheck_${esc(item.id)}" type="checkbox" ${state[item.id] ? 'checked' : ''} onchange="updateBidChecklist()">
              <div><b>${esc(item.label)}</b><span>${esc(item.desc)}</span></div>
            </label>
          `).join('')}
        </div>
        <div class="bid-check-toolbar">
          <button type="button" onclick="checkAllBidItems(true)">전부 확인 처리</button>
          <button type="button" class="secondary" onclick="checkAllBidItems(false)">전체 해제</button>
        </div>
        <div id="bidCheckVerdict" class="bid-check-verdict danger">입찰 보류 권고</div>
        <div class="note warn-note" style="margin-top:12px">이 체크리스트는 누락 방지용입니다. 실제 법률판단, 대출승인, 세금, 인도 절차는 사건별 전문가 확인이 필요할 수 있습니다.</div>
      </div>
    `);
    updateChecklist();
  }

  window.updateBidChecklist = updateChecklist;
  window.checkAllBidItems = checkAll;

  const observer = new MutationObserver(() => renderChecklistCard());
  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    observer.observe(document.body, { childList: true, subtree: true });
    renderChecklistCard();
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
})();
