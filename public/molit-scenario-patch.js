(() => {
  const STORAGE_KEY = 'gm_molit_scenario_prices_v1';

  function parseAmountToWon(value) {
    const n = Number(String(value || '').replace(/[^0-9]/g, ''));
    return Number.isFinite(n) && n > 0 ? n * 10000 : 0;
  }

  function formatWon(n) {
    const num = Number(n || 0);
    if (!num) return '-';
    const eok = Math.floor(num / 100000000);
    const man = Math.floor((num % 100000000) / 10000);
    const parts = [];
    if (eok) parts.push(`${eok}억`);
    if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
    return `${parts.join(' ') || '0'}원`;
  }

  function injectStyles() {
    if (document.getElementById('molitScenarioPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'molitScenarioPatchStyles';
    style.textContent = `
      .molit-apply-box { margin-top:12px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
      .molit-apply-box button { background:var(--accent); color:var(--accent-ink); border:none; border-radius:10px; padding:11px 14px; font-weight:900; cursor:pointer; }
      .molit-apply-box span { color:var(--ink-3); font-size:12.5px; }
    `;
    document.head.appendChild(style);
  }

  function getTradeAmountsFromTable() {
    const rows = [...document.querySelectorAll('#molitResult .molit-table tbody tr')];
    return rows
      .map((row) => parseAmountToWon(row.children?.[4]?.textContent || ''))
      .filter((n) => n > 0);
  }

  function calcScenarioFromTrades() {
    const amounts = getTradeAmountsFromTable();
    if (!amounts.length) return null;
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const avg = Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length / 10000) * 10000;
    return { conservative: min, neutral: avg, aggressive: max, count: amounts.length, savedAt: new Date().toISOString() };
  }

  function saveScenario(scenario) {
    window.__molitScenarioPrices = scenario;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(scenario)); } catch (_) {}
  }

  function loadScenario() {
    if (window.__molitScenarioPrices) return window.__molitScenarioPrices;
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (parsed?.conservative) return parsed;
    } catch (_) {}
    return null;
  }

  function fillScenarioInputs(scenario) {
    const conservative = document.getElementById('scenarioConservative');
    const neutral = document.getElementById('scenarioNeutral');
    const aggressive = document.getElementById('scenarioAggressive');
    if (!conservative || !neutral || !aggressive) return false;

    conservative.value = Math.round(Number(scenario.conservative || 0));
    neutral.value = Math.round(Number(scenario.neutral || 0));
    aggressive.value = Math.round(Number(scenario.aggressive || 0));
    if (typeof window.updateMarketScenarios === 'function') window.updateMarketScenarios();
    return true;
  }

  function addApplyButton() {
    injectStyles();
    const result = document.getElementById('molitResult');
    if (!result || result.querySelector('.molit-apply-box')) return;
    const scenario = calcScenarioFromTrades();
    if (!scenario) return;

    result.insertAdjacentHTML('afterbegin', `
      <div class="molit-apply-box">
        <button type="button" onclick="applyMolitToScenario()">시세 3단 시나리오에 반영</button>
        <span>보수 ${formatWon(scenario.conservative)} · 중립 ${formatWon(scenario.neutral)} · 공격 ${formatWon(scenario.aggressive)}</span>
      </div>
    `);
  }

  window.applyMolitToScenario = function() {
    const scenario = calcScenarioFromTrades() || loadScenario();
    if (!scenario) return alert('반영할 실거래가 결과가 없습니다. 먼저 실거래가를 조회하세요.');
    saveScenario(scenario);

    const applied = fillScenarioInputs(scenario);
    if (applied) {
      document.querySelector('.scenario-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    alert('실거래가 시세를 저장했습니다. 권리분석을 실행하면 시세 3단 시나리오에 자동 반영됩니다.');
  };

  function tryAutoApplyStoredScenario() {
    const scenario = loadScenario();
    if (!scenario) return;
    fillScenarioInputs(scenario);
  }

  const observer = new MutationObserver(() => {
    addApplyButton();
    tryAutoApplyStoredScenario();
  });

  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    observer.observe(document.body, { childList: true, subtree: true });
    addApplyButton();
    tryAutoApplyStoredScenario();
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
