(() => {
  const LAWD_CODES = [
    // 서울
    ['서울', '종로구', '11110'], ['서울', '중구', '11140'], ['서울', '용산구', '11170'], ['서울', '성동구', '11200'], ['서울', '광진구', '11215'],
    ['서울', '동대문구', '11230'], ['서울', '중랑구', '11260'], ['서울', '성북구', '11290'], ['서울', '강북구', '11305'], ['서울', '도봉구', '11320'],
    ['서울', '노원구', '11350'], ['서울', '은평구', '11380'], ['서울', '서대문구', '11410'], ['서울', '마포구', '11440'], ['서울', '양천구', '11470'],
    ['서울', '강서구', '11500'], ['서울', '구로구', '11530'], ['서울', '금천구', '11545'], ['서울', '영등포구', '11560'], ['서울', '동작구', '11590'],
    ['서울', '관악구', '11620'], ['서울', '서초구', '11650'], ['서울', '강남구', '11680'], ['서울', '송파구', '11710'], ['서울', '강동구', '11740'],

    // 인천
    ['인천', '중구', '28110'], ['인천', '동구', '28140'], ['인천', '미추홀구', '28177'], ['인천', '연수구', '28185'], ['인천', '남동구', '28200'],
    ['인천', '부평구', '28237'], ['인천', '계양구', '28245'], ['인천', '서구', '28260'], ['인천', '강화군', '28710'], ['인천', '옹진군', '28720'],

    // 경기 주요 시군구
    ['경기', '수원시 장안구', '41111'], ['경기', '수원시 권선구', '41113'], ['경기', '수원시 팔달구', '41115'], ['경기', '수원시 영통구', '41117'],
    ['경기', '성남시 수정구', '41131'], ['경기', '성남시 중원구', '41133'], ['경기', '성남시 분당구', '41135'], ['경기', '의정부시', '41150'],
    ['경기', '안양시 만안구', '41171'], ['경기', '안양시 동안구', '41173'], ['경기', '광명시', '41210'], ['경기', '평택시', '41220'], ['경기', '동두천시', '41250'],
    ['경기', '안산시 상록구', '41271'], ['경기', '안산시 단원구', '41273'], ['경기', '고양시 덕양구', '41281'], ['경기', '고양시 일산동구', '41285'], ['경기', '고양시 일산서구', '41287'],
    ['경기', '과천시', '41290'], ['경기', '구리시', '41310'], ['경기', '남양주시', '41360'], ['경기', '오산시', '41370'], ['경기', '시흥시', '41390'],
    ['경기', '군포시', '41410'], ['경기', '의왕시', '41430'], ['경기', '하남시', '41450'], ['경기', '용인시 처인구', '41461'], ['경기', '용인시 기흥구', '41463'], ['경기', '용인시 수지구', '41465'],
    ['경기', '파주시', '41480'], ['경기', '이천시', '41500'], ['경기', '안성시', '41550'], ['경기', '김포시', '41570'], ['경기', '화성시', '41590'], ['경기', '광주시', '41610'],
    ['경기', '양주시', '41630'], ['경기', '포천시', '41650'], ['경기', '여주시', '41670'], ['경기', '연천군', '41800'], ['경기', '가평군', '41820'], ['경기', '양평군', '41830'],

    // 부산
    ['부산', '중구', '26110'], ['부산', '서구', '26140'], ['부산', '동구', '26170'], ['부산', '영도구', '26200'], ['부산', '부산진구', '26230'],
    ['부산', '동래구', '26260'], ['부산', '남구', '26290'], ['부산', '북구', '26320'], ['부산', '해운대구', '26350'], ['부산', '사하구', '26380'],
    ['부산', '금정구', '26410'], ['부산', '강서구', '26440'], ['부산', '연제구', '26470'], ['부산', '수영구', '26500'], ['부산', '사상구', '26530'], ['부산', '기장군', '26710'],

    // 대구
    ['대구', '중구', '27110'], ['대구', '동구', '27140'], ['대구', '서구', '27170'], ['대구', '남구', '27200'], ['대구', '북구', '27230'],
    ['대구', '수성구', '27260'], ['대구', '달서구', '27290'], ['대구', '달성군', '27710'],

    // 광주
    ['광주', '동구', '29110'], ['광주', '서구', '29140'], ['광주', '남구', '29155'], ['광주', '북구', '29170'], ['광주', '광산구', '29200'],

    // 대전
    ['대전', '동구', '30110'], ['대전', '중구', '30140'], ['대전', '서구', '30170'], ['대전', '유성구', '30200'], ['대전', '대덕구', '30230'],

    // 울산 / 세종
    ['울산', '중구', '31110'], ['울산', '남구', '31140'], ['울산', '동구', '31170'], ['울산', '북구', '31200'], ['울산', '울주군', '31710'],
    ['세종', '세종시', '36110'], ['세종특별자치시', '세종시', '36110'],
  ];

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

  function normalizeAddress(value) {
    return String(value || '')
      .replace(/서울특별시|서울시/g, '서울')
      .replace(/부산광역시|부산시/g, '부산')
      .replace(/대구광역시|대구시/g, '대구')
      .replace(/인천광역시|인천시/g, '인천')
      .replace(/광주광역시|광주시/g, '광주')
      .replace(/대전광역시|대전시/g, '대전')
      .replace(/울산광역시|울산시/g, '울산')
      .replace(/경기도/g, '경기')
      .replace(/세종특별자치시/g, '세종')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function guessLawdCd(raw) {
    const address = normalizeAddress(getAddress(raw));
    const sorted = [...LAWD_CODES].sort((a, b) => b[1].length - a[1].length);
    for (const [sido, sigungu, code] of sorted) {
      if (address.includes(sido) && address.includes(sigungu)) {
        return { code, label: `${sido} ${sigungu}` };
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
        <p class="muted">주소에서 시·군·구를 추정해 법정동코드 앞 5자리를 자동 입력합니다. 현재는 서울·수도권·광역시 주요 지역부터 지원합니다.</p>
        ${lawd.code ? `<div class="molit-autofill">자동 추정: <b>${esc(lawd.label)}</b> → LAWD_CD <b>${esc(lawd.code)}</b></div>` : `<div class="molit-autofill">자동 추정 실패: 아직 해당 지역 코드가 매핑되지 않았습니다. 법정동코드 앞 5자리를 직접 입력하세요.</div>`}
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
