(() => {
  const SEOUL_LAWD_CODES = {
    '종로구': '11110', '중구': '11140', '용산구': '11170', '성동구': '11200', '광진구': '11215',
    '동대문구': '11230', '중랑구': '11260', '성북구': '11290', '강북구': '11305', '도봉구': '11320',
    '노원구': '11350', '은평구': '11380', '서대문구': '11410', '마포구': '11440', '양천구': '11470',
    '강서구': '11500', '구로구': '11530', '금천구': '11545', '영등포구': '11560', '동작구': '11590',
    '관악구': '11620', '서초구': '11650', '강남구': '11680', '송파구': '11710', '강동구': '11740',
  };

  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function parseAmount(value) {
    const n = Number(String(value || '').replace(/[^0-9]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function krwFromMan(value) {
    const man = parseAmount(value);
    if (!man) return '-';
    const eok = Math.floor(man / 10000);
    const rest = man % 10000;
    const parts = [];
    if (eok) parts.push(`${eok}억`);
    if (rest) parts.push(`${rest.toLocaleString('ko-KR')}만`);
    return parts.join(' ') + '원';
  }

  function getAddress(raw) {
    return raw?.basic?.['소재지'] || raw?.basic?.['주소'] || '';
  }

  function guessLawdCd(raw) {
    const address = getAddress(raw);
    for (const [district, code] of Object.entries(SEOUL_LAWD_CODES)) {
      if (String(address).includes(`서울`) && String(address).includes(district)) {
        return { code, label: `서울특별시 ${district}` };
      }
    }
    return { code: '', label: '' };
  }

  function guessAptName(raw) {
    const address = getAddress(raw);
    const m = String(address).match(/\(([^,()]+),\s*([^()]+)\)/);
    if (m?.[2]) return m[2].trim();
    const lastParen = String(address).match(/\(([^()]+)\)/);
    if (lastParen?.[1]?.includes(',')) return lastParen[1].split(',').pop().trim();
    return '';
  }

  function injectStyles() {
    if (document.getElementById('molitPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'molitPatchStyles';
    style.textContent = `
      .molit-card { margin-top:14px; border:1px solid var(--line); border-radius:14px; background:#fff; padding:16px; }
      .molit-form { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin-top:12px; }
      .molit-form label { display:flex; flex-direction:column; gap:4px; color:var(--ink-3); font-size:12px; font-weight:700; }
      .molit-form input { background:var(--bg); border:1px solid var(--line); border-radius:10px; padding:10px 12px; color:var(--ink); }
      .molit-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; align-items:center; }
      .molit-actions button { background:var(--accent); color:var(--accent-ink); border:none; border-radius:10px; padding:11px 14px; font-weight:900; cursor:pointer; }
      .molit-result { margin-top:12px; }
      .molit-table-wrap { overflow-x:auto; margin-top:10px; }
      .molit-table { width:100%; border-collapse:collapse; min-width:720px; font-size:13px; }
      .molit-table th { text-align:left; color:var(--ink-3); border-bottom:1px solid var(--line); padding:9px 8px; font-size:12px; }
      .molit-table td { border-bottom:1px solid var(--line); padding:10px 8px; }
      .molit-summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:10px; margin-top:10px; }
      .molit-summary .box { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:12px; }
      .molit-summary .k { color:var(--ink-3); font-size:12px; }
      .molit-summary .v { font-family:var(--font-serif); font-size:18px; font-weight:900; margin-top:3px; }
      .molit-autofill { margin-top:10px; font-size:12.5px; color:var(--ink-3); }
      .molit-autofill b { color:var(--accent); }
    `;
    document.head.appendChild(style);
  }

  function findLocationCard() {
    return [...document.querySelectorAll('.step1-extra-card h4')]
      .find((h) => h.textContent.includes('입지분석'))?.closest('.step1-extra-card');
  }

  function enhanceMolitCard(raw) {
    injectStyles();
    const card = findLocationCard();
    if (!card || card.dataset.molitEnhanced === '1') return;
    card.dataset.molitEnhanced = '1';
    const source = raw || window.currentRaw || {};
    const apt = guessAptName(source);
    const lawd = guessLawdCd(source);
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    card.insertAdjacentHTML('beforeend', `
      <div class="molit-card">
        <h4>🏢 국토부 아파트 실거래가 수동 조회</h4>
        <p class="muted">서울은 주소에서 구를 추정해 법정동코드 앞 5자리를 자동 입력합니다. 그 외 지역은 직접 입력하세요.</p>
        ${lawd.code ? `<div class="molit-autofill">자동 추정: <b>${esc(lawd.label)}</b> → LAWD_CD <b>${esc(lawd.code)}</b></div>` : `<div class="molit-autofill">자동 추정 실패: 현재는 서울 25개 구만 자동 입력됩니다.</div>`}
        <div class="molit-form">
          <label>법정동코드 5자리 <input id="molitLawdCd" value="${esc(lawd.code)}" placeholder="예: 11680"></label>
          <label>계약월 YYYYMM <input id="molitDealYmd" value="${ymd}" placeholder="예: 202501"></label>
          <label>아파트명 필터 <input id="molitAptName" value="${esc(apt)}" placeholder="예: 래미안"></label>
        </div>
        <div class="molit-actions">
          <button onclick="lookupMolitTrades()">실거래가 조회</button>
          <span class="muted">API 키: <span id="molitKeyState">확인 중</span></span>
        </div>
        <div id="molitResult" class="molit-result"></div>
      </div>
    `);
    checkMolitConfig();
  }

  async function checkMolitConfig() {
    const state = document.getElementById('molitKeyState');
    if (!state) return;
    try {
      const data = await fetch('/api/config').then((r) => r.json());
      state.textContent = data.hasMolit ? '설정됨' : 'MOLIT_API_KEY 필요';
    } catch {
      state.textContent = '확인 실패';
    }
  }

  window.lookupMolitTrades = async function() {
    const result = document.getElementById('molitResult');
    const lawdCd = document.getElementById('molitLawdCd')?.value.trim();
    const dealYmd = document.getElementById('molitDealYmd')?.value.trim();
    const aptName = document.getElementById('molitAptName')?.value.trim();
    if (!result) return;
    if (!/^\d{5}$/.test(lawdCd || '')) {
      result.innerHTML = '<div class="note warn-note">법정동코드 앞 5자리(LAWD_CD)를 입력하세요. 예: 강남구 11680</div>';
      return;
    }
    if (!/^\d{6}$/.test(dealYmd || '')) {
      result.innerHTML = '<div class="note warn-note">계약월은 YYYYMM 6자리로 입력하세요.</div>';
      return;
    }

    result.innerHTML = '<div class="note">국토부 실거래가 조회 중...</div>';
    try {
      const qs = new URLSearchParams({ lawdCd, dealYmd });
      if (aptName) qs.set('aptName', aptName);
      const res = await fetch(`/api/molit/apt-trades?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        result.innerHTML = `<div class="note danger-note">${esc(data.error || '조회 실패')}</div>`;
        return;
      }
      const trades = data.trades || [];
      if (!trades.length) {
        result.innerHTML = '<div class="note warn-note">조회된 거래가 없습니다. 계약월·법정동코드·아파트명을 바꿔보세요.</div>';
        return;
      }
      const amounts = trades.map((t) => parseAmount(t.dealAmount)).filter(Boolean);
      const avg = amounts.length ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : 0;
      const min = amounts.length ? Math.min(...amounts) : 0;
      const max = amounts.length ? Math.max(...amounts) : 0;
      result.innerHTML = `
        <div class="molit-summary">
          <div class="box"><div class="k">거래 수</div><div class="v">${trades.length}건</div></div>
          <div class="box"><div class="k">평균 거래금액</div><div class="v">${krwFromMan(avg)}</div></div>
          <div class="box"><div class="k">최저 거래금액</div><div class="v">${krwFromMan(min)}</div></div>
          <div class="box"><div class="k">최고 거래금액</div><div class="v">${krwFromMan(max)}</div></div>
        </div>
        <div class="molit-table-wrap">
          <table class="molit-table">
            <thead><tr><th>계약일</th><th>아파트</th><th>전용㎡</th><th>층</th><th>거래금액</th><th>동/도로명</th></tr></thead>
            <tbody>
              ${trades.slice(0, 30).map((t) => `
                <tr>
                  <td>${esc(t.dealYear)}.${esc(t.dealMonth)}.${esc(t.dealDay)}</td>
                  <td>${esc(t.aptName)}</td>
                  <td>${esc(t.area)}</td>
                  <td>${esc(t.floor)}</td>
                  <td><b>${esc(t.dealAmount)}만원</b>${t.cancelDate ? '<br><span class="watch-small">해제 가능</span>' : ''}</td>
                  <td>${esc(t.dong)} / ${esc(t.roadName)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      result.innerHTML = `<div class="note danger-note">실거래가 조회 실패: ${esc(e.message)}</div>`;
    }
  };

  const wait = setInterval(() => {
    if (typeof window.renderStep1 === 'function') {
      clearInterval(wait);
      const original = window.renderStep1;
      window.renderStep1 = function patchedMolitRenderStep1(raw, elapsed) {
        original(raw, elapsed);
        setTimeout(() => enhanceMolitCard(raw), 0);
      };
    }
  }, 50);
})();
