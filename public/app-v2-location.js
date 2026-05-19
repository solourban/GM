(() => {
  const CARD_ID = 'v2LocationCard';
  const LOCATION_STORAGE_KEY = 'auction-note:v2:location-geocode';
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

  function rawCaseKey() {
    const state = appState();
    const raw = state?.raw || {};
    return clean(raw.caseNo || basicInfo()['사건번호'] || 'unknown');
  }

  function extractAddress() {
    const basic = basicInfo();
    const raw = clean(basic['소재지'] || basic['주소'] || basic['물건소재지'] || '');
    if (!raw) return '';

    return raw
      .replace(/\([^()]*\)\s*$/g, '')
      .split(',')[0]
      .replace(/\s+외\s*\d+.*$/g, '')
      .trim();
  }

  async function fetchGeocode(address) {
    const res = await fetch(`/api/location/geocode?address=${encodeURIComponent(address)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const error = new Error(data.error || data.detail || '주소 좌표 변환에 실패했습니다.');
      error.response = data;
      error.status = res.status;
      throw error;
    }
    return data;
  }

  function findAnchor() {
    const cards = Array.from(document.querySelectorAll('.v2-result-card'));
    return cards.find((card) => card.textContent.includes('물건 기본정보')) || cards[0] || null;
  }

  function info(k, v, extra = '') {
    return `<div class="v2-info ${extra}"><div class="k">${esc(k)}</div><div class="v">${esc(clean(v) || '-')}</div></div>`;
  }

  function mapSearchUrl(doc, address) {
    const query = clean(doc?.roadAddress || doc?.addressName || address);
    return `https://map.kakao.com/link/search/${encodeURIComponent(query)}`;
  }

  function mapCoordUrl(doc, address) {
    const x = clean(doc?.x);
    const y = clean(doc?.y);
    const label = encodeURIComponent(clean(doc?.buildingName || doc?.roadAddress || doc?.addressName || address || '경매 물건 위치'));
    if (!x || !y) return mapSearchUrl(doc, address);
    return `https://map.kakao.com/link/map/${label},${y},${x}`;
  }

  function saveLocationResult(address, doc) {
    try {
      if (!doc) return;
      sessionStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({
        caseKey: rawCaseKey(),
        queryAddress: address,
        addressName: clean(doc.addressName),
        roadAddress: clean(doc.roadAddress),
        buildingName: clean(doc.buildingName),
        x: clean(doc.x),
        y: clean(doc.y),
        region1: clean(doc.region1),
        region2: clean(doc.region2),
        region3: clean(doc.region3),
        bCode: clean(doc.bCode),
        hCode: clean(doc.hCode),
        zoneNo: clean(doc.zoneNo),
        kakaoMapUrl: mapCoordUrl(doc, address),
        kakaoSearchUrl: mapSearchUrl(doc, address),
        savedAt: new Date().toISOString(),
      }));
    } catch (_) {}
  }

  function clearLocationResult() {
    try {
      sessionStorage.removeItem(LOCATION_STORAGE_KEY);
    } catch (_) {}
  }

  function renderLoading(address) {
    return `
      <section class="v2-result-card" id="${CARD_ID}" data-case-key="${esc(rawCaseKey())}">
        <div class="v2-loading"><span class="v2-spinner"></span><div><h3>입지 기초정보 조회 중</h3><p class="v2-note">카카오 주소검색 API로 좌표를 확인하고 있습니다. API 키는 서버에서만 사용됩니다.</p></div></div>
        <p class="v2-note">조회 주소: ${esc(address)}</p>
      </section>
    `;
  }

  function renderSetupHint(message) {
    const text = clean(message);
    const needsKey = text.includes('환경설정') || text.includes('KAKAO_REST_API_KEY') || text.includes('키가 없습니다');
    if (!needsKey) return '';
    return `
      <div class="v2-info wide">
        <div class="k">필요 조치</div>
        <div class="v">Railway Variables에 KAKAO_REST_API_KEY 추가</div>
        <p class="v2-note">KAKAO_JS_KEY는 지도 표시용이고, 주소검색 프록시는 별도의 REST API 키를 사용합니다.</p>
      </div>
    `;
  }

  function renderUpstreamHint(message) {
    const text = clean(message);
    if (text.includes('환경설정') || text.includes('KAKAO_REST_API_KEY')) return '';
    if (!text.includes('카카오') && !text.includes('좌표') && !text.includes('주소')) return '';
    return `
      <div class="v2-info wide">
        <div class="k">확인 방향</div>
        <div class="v">키는 인식됐고, 카카오 주소검색 응답 또는 주소 원문 확인이 필요합니다.</div>
        <p class="v2-note">REST 키 값, 카카오 앱 사용 상태, 검색 주소 축약 여부를 확인하세요. 이 카드가 실패하면 실거래가 카드는 법정동코드가 없어 대기 상태가 됩니다.</p>
      </div>
    `;
  }

  function renderError(address, message) {
    return `
      <section class="v2-result-card" id="${CARD_ID}" data-case-key="${esc(rawCaseKey())}">
        <span class="v2-badge">입지 기초정보</span>
        <h3>좌표 변환 확인 필요</h3>
        <p class="v2-note">${esc(message)}</p>
        <div class="v2-grid compact">
          ${info('조회 주소', address)}
          ${info('API 상태', '확인 필요')}
          ${info('보안 구조', '서버 프록시 사용')}
          ${renderSetupHint(message)}
          ${renderUpstreamHint(message)}
        </div>
      </section>
    `;
  }

  function renderSuccess(address, data) {
    const doc = Array.isArray(data.documents) ? data.documents[0] : null;
    if (!doc) return renderError(address, '해당 주소로 변환 가능한 좌표를 찾지 못했습니다. 소재지 표기를 확인해주세요.');

    saveLocationResult(address, doc);
    const kakaoMapUrl = mapCoordUrl(doc, address);
    const kakaoSearchUrl = mapSearchUrl(doc, address);

    return `
      <section class="v2-result-card" id="${CARD_ID}" data-case-key="${esc(rawCaseKey())}">
        <div class="v2-result-head">
          <div>
            <span class="v2-badge">입지 기초정보</span>
            <h3>주소 좌표 변환 완료</h3>
            <p class="v2-note">카카오 REST API를 서버 프록시로 호출했습니다. API 키는 브라우저에 노출되지 않습니다.</p>
          </div>
          <div class="v2-cta-row" style="margin-top:0;">
            <a class="v2-secondary-btn" href="${esc(kakaoMapUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;text-decoration:none;">카카오맵에서 보기</a>
            <a class="v2-small-btn" href="${esc(kakaoSearchUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;text-decoration:none;">주소 검색</a>
          </div>
        </div>
        <div class="v2-grid">
          ${info('조회 주소', address, 'wide')}
          ${info('지번주소', doc.addressName)}
          ${info('도로명주소', doc.roadAddress || '-')}
          ${info('건물명', doc.buildingName || '-')}
          ${info('좌표 X', doc.x)}
          ${info('좌표 Y', doc.y)}
          ${info('시도', doc.region1)}
          ${info('시군구', doc.region2)}
          ${info('읍면동', doc.region3)}
          ${info('법정동코드', doc.bCode)}
          ${info('행정동코드', doc.hCode)}
          ${info('우편번호', doc.zoneNo || '-')}
        </div>
        <p class="v2-note">지도 링크는 API 키 없이 외부 카카오맵 페이지를 여는 방식입니다. 다음 단계에서 주변시설·실거래가 보조 검토를 연결합니다.</p>
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

  async function upsertLocationCard() {
    const state = appState();
    const address = extractAddress();
    const key = `${rawCaseKey()}::${address}`;
    const existing = document.getElementById(CARD_ID);

    if (!state?.raw || !address) {
      existing?.remove();
      clearLocationResult();
      lastKey = '';
      return;
    }

    if (key === lastKey || key === pendingKey) return;
    pendingKey = key;
    insertAfterAnchor(renderLoading(address));

    try {
      const data = await fetchGeocode(address);
      if (pendingKey !== key) return;
      insertAfterAnchor(renderSuccess(address, data));
      lastKey = key;
    } catch (e) {
      if (pendingKey !== key) return;
      clearLocationResult();
      insertAfterAnchor(renderError(address, e.message || String(e)));
      lastKey = key;
    } finally {
      if (pendingKey === key) pendingKey = '';
    }
  }

  setInterval(upsertLocationCard, 1200);
})();