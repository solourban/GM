(() => {
  const CARD_ID = 'v2LocationCard';
  const LOCATION_STORAGE_KEY = 'auction-note:v2:location-geocode';
  const CHANGE_EVENT = 'auction:result-card-change';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const NEARBY_CATEGORIES = [
    { id: 'subway', code: 'SW8', label: '지하철역', radius: 1500 },
    { id: 'school', code: 'SC4', label: '학교', radius: 1000 },
    { id: 'hospital', code: 'HP8', label: '병원', radius: 1000 },
    { id: 'convenience', code: 'CS2', label: '편의점', radius: 500 },
  ];

  function ensureLocationStyles() {
    if (document.getElementById('v2LocationStabilityStyles')) return;
    const style = document.createElement('style');
    style.id = 'v2LocationStabilityStyles';
    style.textContent = `
      #${CARD_ID} { overflow-anchor:none; }
      #${CARD_ID}.v2-location-loading { min-height:1040px; }
      #${CARD_ID} .v2-location-map-reserve { min-height:820px; margin-top:14px; border:1px solid var(--line); border-radius:18px; background:var(--bg); }
      #${CARD_ID} [data-nearby-summary] { min-height:142px; align-content:start; }
      @media (max-width:720px) {
        #${CARD_ID}.v2-location-loading { min-height:1460px; }
        #${CARD_ID} .v2-location-map-reserve { min-height:1240px; }
        #${CARD_ID} [data-nearby-summary] { min-height:400px; }
      }
    `;
    document.head.appendChild(style);
  }

  function notifyResultChange() {
    document.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { id: CARD_ID } }));
    window.__auctionResultOrder?.schedule?.(CARD_ID);
  }

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

  function rawAddressText() {
    const basic = basicInfo();
    return clean(basic['소재지'] || basic['주소'] || basic['물건소재지'] || '');
  }

  function extractAddress() {
    const raw = rawAddressText();
    if (!raw) return '';

    return raw
      .replace(/\([^()]*\)\s*$/g, '')
      .split(',')[0]
      .replace(/\s+외\s*\d+.*$/g, '')
      .trim();
  }

  function addCandidate(list, value) {
    const text = clean(value);
    if (!text) return;
    if (!list.includes(text)) list.push(text);
  }

  function extractParenTexts(raw) {
    const matches = [...String(raw || '').matchAll(/\(([^()]+)\)/g)];
    return matches.map((match) => clean(match[1])).filter(Boolean);
  }

  function addressCandidates() {
    const raw = rawAddressText();
    const base = extractAddress();
    const candidates = [];
    addCandidate(candidates, base);
    addCandidate(candidates, base.replace(/^서울특별시\s+/, '서울 '));
    addCandidate(candidates, base.replace(/^서울\s+/, '서울특별시 '));

    const roadMatch = base.match(/([가-힣A-Za-z0-9]+로)\s*(\d+(?:-\d+)?)/);
    if (roadMatch) {
      addCandidate(candidates, `서울 강남구 ${roadMatch[1]} ${roadMatch[2]}`);
      addCandidate(candidates, `서울특별시 강남구 ${roadMatch[1]} ${roadMatch[2]}`);
      addCandidate(candidates, `${roadMatch[1]} ${roadMatch[2]}`);
    }

    extractParenTexts(raw).forEach((text) => {
      addCandidate(candidates, text);
      addCandidate(candidates, `서울 강남구 ${text}`);
      addCandidate(candidates, `서울특별시 강남구 ${text}`);
    });

    const building = clean(basicInfo()['건물명'] || basicInfo()['아파트명'] || '');
    if (building) {
      addCandidate(candidates, building);
      addCandidate(candidates, `서울 강남구 ${building}`);
      addCandidate(candidates, `서울특별시 강남구 ${building}`);
    }

    return candidates.slice(0, 8);
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

  function hasDocuments(data) {
    return Array.isArray(data?.documents) && data.documents.length > 0;
  }

  async function fetchGeocodeWithFallbacks(candidates) {
    const attempts = [];
    let lastError = null;
    for (const address of candidates) {
      try {
        const data = await fetchGeocode(address);
        attempts.push({ address, ok: true, count: Array.isArray(data.documents) ? data.documents.length : 0 });
        if (hasDocuments(data)) return { address, data, attempts };
      } catch (error) {
        lastError = error;
        attempts.push({ address, ok: false, error: error.message || String(error) });
        if (/환경설정|KAKAO_REST_API_KEY|키가 없습니다/.test(error.message || '')) throw Object.assign(error, { attempts });
      }
    }
    const error = new Error(lastError?.message || '주소 후보 전체에서 변환 가능한 좌표를 찾지 못했습니다.');
    error.attempts = attempts;
    throw error;
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

  function kakaoMapPoint(doc) {
    const x = clean(doc?.x);
    const y = clean(doc?.y);
    if (!x || !y) return null;
    return { x, y };
  }

  let kakaoSdkPromise = null;
  let mapConfigPromise = null;

  function getMapConfig() {
    if (!mapConfigPromise) {
      mapConfigPromise = fetch('/api/config', { cache: 'no-store' })
        .then((res) => res.json())
        .catch(() => ({ ok: false }));
    }
    return mapConfigPromise;
  }

  async function mapFailureMessage() {
    const config = await getMapConfig();
    if (!config?.hasKakaoMap) return '지도 표시용 JavaScript 키가 설정되지 않았습니다.';
    return '카카오 지도 SDK 연결에 실패했습니다. Kakao Developers의 JavaScript SDK 도메인에 현재 배포 주소를 등록했는지 확인하세요.';
  }

  function renderMapFailure(target, message) {
    const title = clean(target?.dataset?.title);
    const searchUrl = title ? `https://map.kakao.com/link/search/${encodeURIComponent(title)}` : '';
    target.innerHTML = `
      <div style="max-width:520px;padding:24px;text-align:center;">
        <strong style="display:block;font-size:15px;">지도 연결 확인 필요</strong>
        <p class="v2-note" style="margin:8px 0 14px;">${esc(message)}</p>
        ${searchUrl ? `<a class="v2-secondary-btn" href="${esc(searchUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;text-decoration:none;">카카오맵에서 보기</a>` : ''}
      </div>
    `;
    target.style.display = 'grid';
    target.style.placeItems = 'center';
  }

  function distanceText(value) {
    const meters = Number(value || 0);
    if (!Number.isFinite(meters) || meters <= 0) return '-';
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  }

  function nearbySummaryNode(mapTarget) {
    return mapTarget.closest('.v2-map-card')?.querySelector('[data-nearby-summary]') || null;
  }

  function renderNearbyStatus(mapTarget, results) {
    const summary = nearbySummaryNode(mapTarget);
    if (!summary) return;
    summary.innerHTML = `
      <div style="grid-column:1/-1;background:#fff;padding:12px 14px;">
        <strong style="display:block;font-size:14px;">주변 생활편의 시설</strong>
        <span class="v2-note" style="display:block;margin-top:2px;">카카오 장소검색 기준 반경 내 시설과 가장 가까운 거리를 확인했습니다.</span>
      </div>
      ${results.map((result) => {
        if (result.error) {
          return `<div style="background:#fff;padding:12px 14px;"><strong style="display:block;font-size:13px;">${esc(result.label)}</strong><span class="v2-note">확인 실패</span></div>`;
        }
        const nearest = result.nearestName
          ? `${result.nearestName} · ${distanceText(result.nearestDistance)}`
          : `반경 ${distanceText(result.radius)} 내 없음`;
        return `<div style="background:#fff;padding:12px 14px;min-width:0;"><strong style="display:block;font-size:13px;">${esc(result.label)} ${Number(result.count || 0).toLocaleString('ko-KR')}곳</strong><span class="v2-note" style="display:block;overflow-wrap:anywhere;">${esc(nearest)}</span></div>`;
      }).join('')}
    `;
  }

  function renderNearbyFailure(mapTarget, message) {
    const summary = nearbySummaryNode(mapTarget);
    if (!summary) return;
    summary.innerHTML = `<div style="grid-column:1/-1;background:#fff;padding:12px 14px;"><strong style="display:block;font-size:14px;">주변 시설 확인 필요</strong><span class="v2-note" style="display:block;margin-top:2px;">${esc(message)}</span></div>`;
  }

  function searchNearbyCategory(places, category, coords) {
    return new Promise((resolve) => {
      places.categorySearch(category.code, (items, status, pagination) => {
        const statusApi = window.kakao.maps.services.Status;
        if (status === statusApi.OK) {
          const first = Array.isArray(items) ? items[0] : null;
          resolve({
            id: category.id,
            label: category.label,
            radius: category.radius,
            count: Number(pagination?.totalCount || items?.length || 0),
            nearestName: clean(first?.place_name),
            nearestDistance: Number(first?.distance || 0),
          });
          return;
        }
        if (status === statusApi.ZERO_RESULT) {
          resolve({ id: category.id, label: category.label, radius: category.radius, count: 0, nearestName: '', nearestDistance: 0 });
          return;
        }
        resolve({ id: category.id, label: category.label, radius: category.radius, count: 0, nearestName: '', nearestDistance: 0, error: true });
      }, {
        location: coords,
        radius: category.radius,
        sort: window.kakao.maps.services.SortBy.DISTANCE,
      });
    });
  }

  function saveNearbyResult(results) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(LOCATION_STORAGE_KEY) || 'null');
      if (!saved || saved.caseKey !== rawCaseKey()) return;
      saved.nearby = {
        complete: results.every((result) => !result.error),
        categories: results,
        analyzedAt: new Date().toISOString(),
      };
      sessionStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(saved));
    } catch (_) {}
  }

  async function analyzeNearby(mapTarget, coords) {
    if (!window.kakao?.maps?.services?.Places) {
      renderNearbyFailure(mapTarget, '카카오 장소검색 서비스를 불러오지 못했습니다.');
      return;
    }
    const places = new window.kakao.maps.services.Places();
    const results = await Promise.all(NEARBY_CATEGORIES.map((category) => searchNearbyCategory(places, category, coords)));
    renderNearbyStatus(mapTarget, results);
    saveNearbyResult(results);
  }

  function loadKakaoSdk() {
    if (window.kakao?.maps?.Map) return Promise.resolve();
    if (window.__kakaoMapsSdkLoader) return window.__kakaoMapsSdkLoader;
    if (kakaoSdkPromise) return kakaoSdkPromise;
    kakaoSdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/api/kakao/maps-sdk.js';
      script.async = true;
      script.dataset.kakaoMapsSdk = 'proxy';
      script.onload = () => {
        if (window.__kakaoMapsSdkLoader) window.__kakaoMapsSdkLoader.then(resolve, reject);
        else if (window.kakao?.maps?.load) window.kakao.maps.load(resolve);
        else reject(new Error('Kakao map SDK is unavailable.'));
      };
      script.onerror = () => reject(new Error('Kakao map SDK proxy load failed.'));
      document.head.appendChild(script);
    });
    return kakaoSdkPromise;
  }

  function renderMapPreview(doc, address) {
    const point = kakaoMapPoint(doc);
    if (!point) return '';
    const title = clean(doc?.buildingName || doc?.roadAddress || doc?.addressName || address || '경매 물건 위치');
    return `
      <div class="v2-map-card" style="margin-top:14px;border:1px solid var(--line);border-radius:18px;overflow:hidden;background:var(--bg);">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line);flex-wrap:wrap;">
          <div>
            <strong style="display:block;font-size:15px;">지도·주변시설 분석</strong>
            <span class="v2-note" style="margin-top:2px;display:block;">${esc(title)}</span>
          </div>
          <span class="v2-pill ok">좌표 확인</span>
        </div>
        <div
          class="v2-kakao-map-preview"
          data-x="${esc(point.x)}"
          data-y="${esc(point.y)}"
          data-title="${esc(title)}"
          style="height:320px;display:grid;place-items:center;color:var(--ink-3);">
          Kakao map loading...
        </div>
        <div
          data-nearby-summary
          aria-live="polite"
          style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:var(--line);border-top:1px solid var(--line);">
          <div style="grid-column:1/-1;background:#fff;padding:12px 14px;"><strong style="display:block;font-size:14px;">주변 생활편의 시설 확인 중</strong><span class="v2-note">지하철·학교·병원·편의점을 조회하고 있습니다.</span></div>
        </div>
      </div>
    `;
  }

  async function initKakaoMapPreviews(root = document) {
    const targets = Array.from(root.querySelectorAll?.('.v2-kakao-map-preview[data-x][data-y]') || []);
    if (!targets.length) return;

    try {
      await loadKakaoSdk();
    } catch (e) {
      const message = await mapFailureMessage();
      targets.forEach((target) => {
        renderMapFailure(target, message);
        renderNearbyFailure(target, '지도를 먼저 연결해야 주변 시설을 확인할 수 있습니다.');
      });
      return;
    }

    targets.forEach((target) => {
      if (target.dataset.ready === '1') return;
      try {
        const x = Number(target.dataset.x);
        const y = Number(target.dataset.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          renderMapFailure(target, '지도에 표시할 좌표가 올바르지 않습니다.');
          renderNearbyFailure(target, '유효한 좌표가 있어야 주변 시설을 확인할 수 있습니다.');
          return;
        }
        const coords = new window.kakao.maps.LatLng(y, x);
        target.innerHTML = '';
        target.style.display = 'block';
        const map = new window.kakao.maps.Map(target, { center: coords, level: 4 });
        new window.kakao.maps.Marker({ map, position: coords });
        window.setTimeout(() => map.relayout(), 0);
        target.dataset.ready = '1';
        analyzeNearby(target, coords).catch(() => renderNearbyFailure(target, '주변 시설 분석 중 오류가 발생했습니다.'));
      } catch (_) {
        renderMapFailure(target, '카카오 지도 렌더링에 실패했습니다. 잠시 후 다시 시도하세요.');
        renderNearbyFailure(target, '지도를 먼저 연결해야 주변 시설을 확인할 수 있습니다.');
      }
    });
  }

  function saveLocationResult(address, doc, attempts = []) {
    try {
      if (!doc) return;
      const previous = JSON.parse(sessionStorage.getItem(LOCATION_STORAGE_KEY) || 'null');
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
        attempts,
        kakaoMapUrl: mapCoordUrl(doc, address),
        kakaoSearchUrl: mapSearchUrl(doc, address),
        mapProvider: 'kakao',
        nearby: previous?.caseKey === rawCaseKey() ? previous.nearby : undefined,
        savedAt: new Date().toISOString(),
      }));
    } catch (_) {}
  }

  function loadCachedLocation() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(LOCATION_STORAGE_KEY) || 'null');
      if (!saved || saved.caseKey !== rawCaseKey() || !clean(saved.x) || !clean(saved.y)) return null;
      return {
        address: clean(saved.queryAddress || saved.roadAddress || saved.addressName),
        attempts: Array.isArray(saved.attempts) ? saved.attempts : [],
        data: {
          documents: [{
            addressName: saved.addressName,
            roadAddress: saved.roadAddress,
            buildingName: saved.buildingName,
            x: saved.x,
            y: saved.y,
            region1: saved.region1,
            region2: saved.region2,
            region3: saved.region3,
            bCode: saved.bCode,
            hCode: saved.hCode,
            zoneNo: saved.zoneNo,
          }],
        },
      };
    } catch (_) {
      return null;
    }
  }

  function clearLocationResult() {
    try {
      sessionStorage.removeItem(LOCATION_STORAGE_KEY);
    } catch (_) {}
  }

  function renderLoading(addresses) {
    return `
      <section class="v2-result-card v2-location-card v2-location-loading" id="${CARD_ID}" data-case-key="${esc(rawCaseKey())}" data-location-state="loading">
        <div class="v2-loading"><span class="v2-spinner"></span><div><h3>입지 기초정보 조회 중</h3><p class="v2-note">카카오 주소검색 API로 좌표를 확인하고 있습니다. API 키는 서버에서만 사용됩니다.</p></div></div>
        <p class="v2-note">조회 주소 후보: ${esc(addresses.join(' / '))}</p>
        <div class="v2-location-map-reserve" aria-hidden="true"></div>
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
        <p class="v2-note">지도 표시용 키와 주소검색 프록시의 REST 키는 별도로 설정됩니다.</p>
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

  function renderAttempts(attempts = []) {
    if (!attempts.length) return '';
    return `
      <div class="v2-info wide">
        <div class="k">주소 재검색 시도</div>
        <div class="v">${attempts.map((attempt) => `${clean(attempt.address)}: ${attempt.ok ? `${attempt.count || 0}건` : '실패'}`).join(' / ')}</div>
      </div>
    `;
  }

  function renderError(addresses, message, attempts = []) {
    const primaryAddress = Array.isArray(addresses) ? addresses[0] : addresses;
    return `
      <section class="v2-result-card v2-location-card" id="${CARD_ID}" data-case-key="${esc(rawCaseKey())}" data-location-state="error">
        <span class="v2-badge">입지 기초정보</span>
        <h3>좌표 변환 확인 필요</h3>
        <p class="v2-note">${esc(message)}</p>
        <div class="v2-grid compact">
          ${info('대표 조회 주소', primaryAddress)}
          ${info('API 상태', '확인 필요')}
          ${info('보안 구조', '서버 프록시 사용')}
          ${renderAttempts(attempts)}
          ${renderSetupHint(message)}
          ${renderUpstreamHint(message)}
        </div>
      </section>
    `;
  }

  function renderSuccess(address, data, attempts = []) {
    const doc = Array.isArray(data.documents) ? data.documents[0] : null;
    if (!doc) return renderError([address], '해당 주소로 변환 가능한 좌표를 찾지 못했습니다. 소재지 표기를 확인해주세요.', attempts);

    saveLocationResult(address, doc, attempts);
    const kakaoMapUrl = mapCoordUrl(doc, address);
    const kakaoSearchUrl = mapSearchUrl(doc, address);

    return `
      <section class="v2-result-card v2-location-card" id="${CARD_ID}" data-case-key="${esc(rawCaseKey())}" data-location-state="ready">
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
        ${renderMapPreview(doc, address)}
        <div class="v2-grid">
          ${info('성공 조회 주소', address, 'wide')}
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
          ${renderAttempts(attempts)}
        </div>
        <p class="v2-note">주변시설 결과는 카카오 장소검색 반경 기준 참고값입니다. 실제 동·호수, 출입구, 경사, 소음, 통학·보행 동선은 현장과 외부 지도로 다시 확인하세요.</p>
      </section>
    `;
  }

  function insertAfterAnchor(html) {
    const existing = document.getElementById(CARD_ID);
    const anchor = findAnchor();
    if (!existing && !anchor) return null;

    const template = document.createElement('template');
    template.innerHTML = html.trim();
    const next = template.content.firstElementChild;
    if (!next) return existing || null;

    let card = existing;
    if (card) {
      card.className = next.className;
      card.dataset.caseKey = next.dataset.caseKey || '';
      card.dataset.locationState = next.dataset.locationState || '';
      card.innerHTML = next.innerHTML;
    } else {
      card = next;
      anchor.insertAdjacentElement('afterend', card);
    }
    notifyResultChange();
    return card;
  }

  function commitWhenScrollIdle(html) {
    return new Promise((resolve) => {
      const commit = () => {
        if (window.__auctionResultOrder?.isUserScrolling?.()) {
          window.setTimeout(commit, 220);
          return;
        }
        resolve(insertAfterAnchor(html));
      };
      commit();
    });
  }

  let lastKey = '';
  let pendingKey = '';
  let upsertTimer = 0;

  async function upsertLocationCard() {
    const state = appState();
    const addresses = addressCandidates();
    const key = `${rawCaseKey()}::${addresses.join('|')}`;
    const existing = document.getElementById(CARD_ID);

    if (!state?.raw || !addresses.length) {
      existing?.remove();
      clearLocationResult();
      lastKey = '';
      return;
    }

    if (existing && key === lastKey) {
      initKakaoMapPreviews(existing);
      return;
    }
    if (key === pendingKey) return;

    const cached = loadCachedLocation();
    if (!existing && cached) {
      const card = await commitWhenScrollIdle(renderSuccess(cached.address, cached.data, cached.attempts));
      initKakaoMapPreviews(card || document);
      lastKey = key;
      return;
    }

    pendingKey = key;
    await commitWhenScrollIdle(renderLoading(addresses));

    try {
      const result = await fetchGeocodeWithFallbacks(addresses);
      if (pendingKey !== key) return;
      const card = await commitWhenScrollIdle(renderSuccess(result.address, result.data, result.attempts));
      initKakaoMapPreviews(card || document);
      lastKey = key;
    } catch (e) {
      if (pendingKey !== key) return;
      clearLocationResult();
      await commitWhenScrollIdle(renderError(addresses, e.message || String(e), e.attempts || []));
      lastKey = key;
    } finally {
      if (pendingKey === key) pendingKey = '';
    }
  }

  function scheduleUpsert(delay = 0) {
    window.clearTimeout(upsertTimer);
    upsertTimer = window.setTimeout(upsertLocationCard, delay);
  }

  function observeResults() {
    const root = document.getElementById('resultsSection');
    if (!root || !window.MutationObserver) return;
    const observer = new MutationObserver(() => scheduleUpsert(0));
    observer.observe(root, { childList: true });
  }

  ensureLocationStyles();
  observeResults();
  document.addEventListener('DOMContentLoaded', () => scheduleUpsert(0));
  scheduleUpsert(0);
})();
