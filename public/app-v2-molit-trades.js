(() => {
  const CARD_ID = 'v2MolitTradeCard';
  const LOCATION_STORAGE_KEY = 'auction-note:v2:location-geocode';
  const TRADE_STORAGE_KEY = 'auction-note:v2:molit-trades';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function appState() {
    return window.__auctionV2?.state || null;
  }

  function basicInfo() {
    return appState()?.raw?.basic || {};
  }

  function loadLocation() {
    try {
      const raw = sessionStorage.getItem(LOCATION_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function saveTradeResult(payload) {
    try {
      sessionStorage.setItem(TRADE_STORAGE_KEY, JSON.stringify({ ...payload, savedAt: new Date().toISOString() }));
    } catch (_) {}
  }

  function clearTradeResult() {
    try {
      sessionStorage.removeItem(TRADE_STORAGE_KEY);
    } catch (_) {}
  }

  function lawdCdFromLocation(location) {
    const digits = clean(location?.bCode).replace(/[^0-9]/g, '');
    return digits.length >= 5 ? digits.slice(0, 5) : '';
  }

  function candidateName(location) {
    const basic = basicInfo();
    return clean(location?.buildingName || basic['건물명'] || basic['아파트명'] || basic['물건명'] || '');
  }

  function monthCandidates(count = 6) {
    const now = new Date();
    const months = [];
    for (let i = 1; i <= count; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      months.push(`${y}${m}`);
    }
    return months;
  }

  async function fetchTrades({ lawdCd, dealYmd, aptName }) {
    const params = new URLSearchParams({ lawdCd, dealYmd, tradeType: 'auto' });
    if (aptName) params.set('aptName', aptName);
    const res = await fetch(`/api/molit/trades?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || data.detail || '국토부 실거래가 조회에 실패했습니다.');
    return data;
  }

  async function findRecentTrades(location) {
    const lawdCd = lawdCdFromLocation(location);
    if (!lawdCd) throw new Error('법정동코드가 없어 실거래가 조회를 할 수 없습니다.');

    const aptName = candidateName(location);
    const months = monthCandidates(6);
    const attempts = [];

    for (const dealYmd of months) {
      try {
        const data = await fetchTrades({ lawdCd, dealYmd, aptName });
        attempts.push({ dealYmd, ok: true, count: Number(data.count || 0), rawCount: Number(data.rawCount || 0) });
        if (Number(data.count || 0) > 0) return { data, lawdCd, dealYmd, aptName, attempts };
      } catch (e) {
        attempts.push({ dealYmd, ok: false, error: e.message || String(e) });
        if (/환경변수|API/.test(e.message || '')) throw e;
      }
    }

    return { data: { ok: true, count: 0, trades: [], tradeTypes: [], errors: [] }, lawdCd, dealYmd: months[0], aptName, attempts };
  }

  function findAnchor() {
    return document.getElementById('v2LocationCard')
      || Array.from(document.querySelectorAll('.v2-result-card')).find((card) => card.textContent.includes('물건 기본정보'))
      || null;
  }

  function info(k, v, extra = '') {
    return `<div class="v2-info ${extra}"><div class="k">${esc(k)}</div><div class="v">${esc(clean(v) || '-')}</div></div>`;
  }

  function renderLoading(location) {
    return `
      <section class="v2-result-card" id="${CARD_ID}">
        <div class="v2-loading"><span class="v2-spinner"></span><div><h3>실거래가 기초 조회 중</h3><p class="v2-note">법정동코드 기준으로 최근 계약월 실거래가를 확인하고 있습니다. API 키는 서버에서만 사용됩니다.</p></div></div>
        <p class="v2-note">법정동코드: ${esc(location?.bCode || '-')}</p>
      </section>
    `;
  }

  function renderError(message, location) {
    return `
      <section class="v2-result-card" id="${CARD_ID}">
        <span class="v2-badge">실거래가 기초조회</span>
        <h3>실거래가 조회 확인 필요</h3>
        <p class="v2-note">${esc(message)}</p>
        <div class="v2-grid compact">
          ${info('법정동코드', location?.bCode || '-')}
          ${info('LAWD_CD', lawdCdFromLocation(location) || '-')}
          ${info('보안 구조', '서버 프록시 사용')}
        </div>
      </section>
    `;
  }

  function tradeDate(trade) {
    const y = clean(trade.dealYear);
    const m = clean(trade.dealMonth).padStart(2, '0');
    const d = clean(trade.dealDay).padStart(2, '0');
    return [y, m, d].filter(Boolean).join('.');
  }

  function renderTradeRows(trades) {
    if (!trades.length) return '<p class="v2-note">최근 6개월 기준 표시 가능한 실거래가가 없습니다. 단지명 필터를 빼거나 계약월을 넓히는 보완이 필요합니다.</p>';
    return `
      <div class="v2-detail-table-wrap">
        <table class="v2-detail-table">
          <thead><tr><th>유형</th><th>단지/건물</th><th>거래일</th><th>거래금액</th><th>전용면적</th><th>층</th></tr></thead>
          <tbody>
            ${trades.slice(0, 10).map((trade) => `
              <tr>
                <td>${esc(trade.tradeTypeLabel || trade.tradeType || '-')}</td>
                <td>${esc(trade.aptName || '-')}</td>
                <td>${esc(tradeDate(trade) || '-')}</td>
                <td>${esc(trade.dealAmount || '-')}</td>
                <td>${esc(trade.area || '-')}</td>
                <td>${esc(trade.floor || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderTypeSummary(types = []) {
    if (!types.length) return '-';
    return types.map((t) => `${t.label || t.type}: ${Number(t.filteredCount || 0)}건`).join(' / ');
  }

  function renderSuccess(result, location) {
    const trades = Array.isArray(result.data?.trades) ? result.data.trades : [];
    saveTradeResult({
      lawdCd: result.lawdCd,
      dealYmd: result.dealYmd,
      aptName: result.aptName,
      location,
      count: Number(result.data?.count || 0),
      rawCount: Number(result.data?.rawCount || 0),
      tradeTypes: result.data?.tradeTypes || [],
      trades: trades.slice(0, 20),
      attempts: result.attempts || [],
    });

    return `
      <section class="v2-result-card" id="${CARD_ID}">
        <div class="v2-result-head">
          <div>
            <span class="v2-badge">실거래가 기초조회</span>
            <h3>국토부 실거래가 조회 결과</h3>
            <p class="v2-note">법정동코드 기준 최근 계약월을 순차 조회했습니다. API 키는 브라우저에 노출되지 않습니다.</p>
          </div>
        </div>
        <div class="v2-grid compact">
          ${info('LAWD_CD', result.lawdCd)}
          ${info('조회 계약월', result.dealYmd)}
          ${info('단지명 필터', result.aptName || '미적용')}
          ${info('표시 결과', `${trades.length}건`)}
          ${info('유형별 결과', renderTypeSummary(result.data?.tradeTypes), 'wide')}
        </div>
        ${renderTradeRows(trades)}
        <p class="v2-note">실거래가는 참고용입니다. 동일 단지·동·층·면적 여부, 계약해제 여부, 시점 차이를 별도 확인해야 합니다.</p>
      </section>
    `;
  }

  function insertAfterAnchor(html) {
    const anchor = findAnchor();
    if (!anchor) return;
    const existing = document.getElementById(CARD_ID);
    if (existing) existing.outerHTML = html;
    else anchor.insertAdjacentHTML('afterend', html);
  }

  let lastKey = '';
  let pendingKey = '';

  async function upsertMolitCard() {
    const state = appState();
    const location = loadLocation();
    const lawdCd = lawdCdFromLocation(location);
    const key = `${state?.raw?.caseNo || 'unknown'}::${lawdCd}::${candidateName(location)}`;
    const existing = document.getElementById(CARD_ID);

    if (!state?.raw || !location?.queryAddress) {
      existing?.remove();
      clearTradeResult();
      lastKey = '';
      return;
    }

    if (!lawdCd) {
      insertAfterAnchor(renderError('법정동코드가 없어 국토부 실거래가 조회를 할 수 없습니다.', location));
      return;
    }

    if (key === lastKey || key === pendingKey) return;
    pendingKey = key;
    insertAfterAnchor(renderLoading(location));

    try {
      const result = await findRecentTrades(location);
      if (pendingKey !== key) return;
      insertAfterAnchor(renderSuccess(result, location));
      lastKey = key;
    } catch (e) {
      if (pendingKey !== key) return;
      clearTradeResult();
      insertAfterAnchor(renderError(e.message || String(e), location));
      lastKey = key;
    } finally {
      if (pendingKey === key) pendingKey = '';
    }
  }

  setInterval(upsertMolitCard, 1600);
})();
