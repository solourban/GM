(() => {
  let configPromise = null;
  let sdkPromise = null;

  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function injectStyles() {
    if (document.getElementById('mapPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'mapPatchStyles';
    style.textContent = `
      .kakao-map-box { margin-top:14px; height:320px; border:1px solid var(--line); border-radius:14px; overflow:hidden; background:var(--bg); display:grid; place-items:center; color:var(--ink-3); }
      .kakao-map-box.ready { display:block; }
      .map-tools { display:flex; gap:10px; flex-wrap:wrap; margin-top:10px; }
      .map-tools a, .map-tools button { border:1px solid var(--line); background:#fff; color:var(--ink-2); border-radius:10px; padding:9px 12px; font-weight:800; font-size:13px; text-decoration:none; cursor:pointer; }
      .nearby-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:10px; margin-top:12px; }
      .nearby-card { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:12px; }
      .nearby-card .k { color:var(--ink-3); font-size:12px; }
      .nearby-card .v { font-family:var(--font-serif); font-size:17px; font-weight:800; margin-top:3px; }
    `;
    document.head.appendChild(style);
  }

  function getConfig() {
    if (!configPromise) {
      configPromise = fetch('/api/config').then((r) => r.json()).catch(() => ({ ok: false }));
    }
    return configPromise;
  }

  function loadKakaoSdk(key) {
    if (window.kakao?.maps?.services) return Promise.resolve();
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services`;
      script.async = true;
      script.onload = () => window.kakao.maps.load(resolve);
      script.onerror = () => reject(new Error('Kakao 지도 SDK 로드 실패'));
      document.head.appendChild(script);
    });
    return sdkPromise;
  }

  function findAddressCard() {
    return [...document.querySelectorAll('.step1-extra-card h4')]
      .find((h) => h.textContent.includes('입지분석'))?.closest('.step1-extra-card');
  }

  function getAddressFromRaw(raw) {
    return raw?.basic?.['소재지'] || raw?.basic?.['주소'] || '';
  }

  function enhanceLocationCard(raw) {
    injectStyles();
    const card = findAddressCard();
    if (!card || card.dataset.mapEnhanced === '1') return;
    const address = getAddressFromRaw(raw || window.currentRaw || window.__lastAuctionRaw || {});
    const encoded = encodeURIComponent(address || '');
    card.dataset.mapEnhanced = '1';

    card.insertAdjacentHTML('beforeend', `
      <div id="kakaoMapBox" class="kakao-map-box">지도 로딩 준비 중...</div>
      <div class="map-tools">
        ${address ? `<a href="https://map.kakao.com/link/search/${encoded}" target="_blank" rel="noopener">카카오맵 열기</a>` : ''}
        <button type="button" onclick="window.initAuctionMap?.()">지도 다시 불러오기</button>
      </div>
      <div class="nearby-grid">
        <div class="nearby-card"><div class="k">교통</div><div class="v">분석 예정</div></div>
        <div class="nearby-card"><div class="k">상권</div><div class="v">분석 예정</div></div>
        <div class="nearby-card"><div class="k">학군/생활</div><div class="v">분석 예정</div></div>
        <div class="nearby-card"><div class="k">실거래가</div><div class="v">다음 단계</div></div>
      </div>
    `);

    window.__auctionMapAddress = address;
    window.initAuctionMap?.();
  }

  window.initAuctionMap = async function() {
    const box = document.getElementById('kakaoMapBox');
    const address = window.__auctionMapAddress || getAddressFromRaw(window.currentRaw || {});
    if (!box) return;
    if (!address) {
      box.className = 'kakao-map-box';
      box.textContent = '주소가 없어 지도를 표시할 수 없습니다.';
      return;
    }

    const config = await getConfig();
    if (!config?.hasKakaoMap || !config?.kakaoJsKey) {
      box.className = 'kakao-map-box';
      box.innerHTML = `Kakao 지도 API 키가 필요합니다.<br><span class="muted">Railway 환경변수에 KAKAO_JS_KEY를 추가하세요.</span>`;
      return;
    }

    try {
      box.className = 'kakao-map-box';
      box.textContent = 'Kakao 지도 로딩 중...';
      await loadKakaoSdk(config.kakaoJsKey);
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.addressSearch(address, (result, status) => {
        if (status !== window.kakao.maps.services.Status.OK || !result?.length) {
          box.className = 'kakao-map-box';
          box.innerHTML = `주소 좌표 변환 실패<br><span class="muted">${esc(address)}</span>`;
          return;
        }
        const coords = new window.kakao.maps.LatLng(Number(result[0].y), Number(result[0].x));
        box.className = 'kakao-map-box ready';
        box.innerHTML = '';
        const map = new window.kakao.maps.Map(box, { center: coords, level: 3 });
        const marker = new window.kakao.maps.Marker({ map, position: coords });
        const infowindow = new window.kakao.maps.InfoWindow({ content: `<div style="padding:6px 10px;font-size:12px;">${esc(address)}</div>` });
        infowindow.open(map, marker);
      });
    } catch (e) {
      box.className = 'kakao-map-box';
      box.innerHTML = `지도 로딩 실패<br><span class="muted">${esc(e.message)}</span>`;
    }
  };

  const wait = setInterval(() => {
    if (typeof window.renderStep1 === 'function') {
      clearInterval(wait);
      const original = window.renderStep1;
      window.renderStep1 = function patchedMapRenderStep1(raw, elapsed) {
        window.__lastAuctionRaw = raw;
        original(raw, elapsed);
        setTimeout(() => enhanceLocationCard(raw), 0);
      };
    }
  }, 50);
})();
