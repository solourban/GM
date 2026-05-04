(() => {
  let configPromise = null;
  let sdkPromise = null;

  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function injectStyles() {
    if (document.getElementById('kakaoMapPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'kakaoMapPatchStyles';
    style.textContent = `
      .kakao-map-card .map-shell { margin-top:14px; height:320px; border:1px solid var(--line); border-radius:14px; overflow:hidden; background:var(--bg); display:grid; place-items:center; color:var(--ink-3); }
      .kakao-map-card .map-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
      .kakao-map-card .map-actions a, .kakao-map-card .map-actions button { border:none; border-radius:10px; padding:10px 13px; font-weight:800; text-decoration:none; cursor:pointer; background:var(--accent); color:var(--accent-ink); }
      .kakao-map-card .map-actions .secondary { background:var(--bg); color:var(--ink-2); border:1px solid var(--line); }
      .map-mini-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-top:12px; }
      .map-mini { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:12px; }
      .map-mini .k { color:var(--ink-3); font-size:12px; }
      .map-mini .v { font-weight:900; margin-top:3px; }
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
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
      script.onload = () => window.kakao.maps.load(resolve);
      script.onerror = () => reject(new Error('Kakao Maps SDK 로드 실패'));
      document.head.appendChild(script);
    });
    return sdkPromise;
  }

  function findAddress() {
    const text = document.querySelector('.info-mini .v')?.textContent || '';
    const rows = [...document.querySelectorAll('.basic-table tr')];
    const row = rows.find((tr) => tr.querySelector('th')?.textContent?.includes('소재지'));
    return (row?.querySelector('td')?.textContent || text || '').trim();
  }

  function renderEmptyCard(address, reason) {
    const encoded = encodeURIComponent(address || '');
    return `
      <div class="subcard kakao-map-card">
        <span class="source-badge">Step 1 · 지도 연동</span>
        <h4>🗺 Kakao 지도 / 입지 분석</h4>
        <p class="muted">주소를 기준으로 지도, 주변시설, 역세권/생활권 분석을 붙일 준비 영역입니다.</p>
        <div class="map-shell">${esc(reason || 'Kakao 지도 API 키가 설정되면 이 자리에 지도가 표시됩니다.')}</div>
        <div class="map-mini-grid">
          <div class="map-mini"><div class="k">지도 상태</div><div class="v">API 키 필요</div></div>
          <div class="map-mini"><div class="k">주변분석</div><div class="v">다음 단계</div></div>
          <div class="map-mini"><div class="k">실거래가</div><div class="v">국토부 API 분리 예정</div></div>
        </div>
        <div class="map-actions">
          ${address ? `<a href="https://map.kakao.com/link/search/${encoded}" target="_blank" rel="noopener">카카오맵에서 열기</a>` : ''}
          <button class="secondary" onclick="alert('Railway 환경변수에 KAKAO_MAP_KEY를 추가하고, Kakao Developers에서 도메인 제한을 설정하세요.')">API 키 설정 안내</button>
        </div>
      </div>`;
  }

  async function renderMap(card, address, key) {
    const shell = card.querySelector('.map-shell');
    if (!shell || !address) return;
    shell.textContent = '지도 로딩 중...';
    try {
      await loadKakaoSdk(key);
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.addressSearch(address, (result, status) => {
        if (status !== window.kakao.maps.services.Status.OK || !result?.[0]) {
          shell.textContent = '주소 좌표 변환 실패 · 카카오맵에서 직접 확인하세요.';
          return;
        }
        shell.innerHTML = '';
        const coords = new window.kakao.maps.LatLng(result[0].y, result[0].x);
        const map = new window.kakao.maps.Map(shell, { center: coords, level: 3 });
        new window.kakao.maps.Marker({ map, position: coords });
      });
    } catch (e) {
      shell.textContent = e.message || '지도 로드 실패';
    }
  }

  async function injectMapCard() {
    injectStyles();
    const rs = document.getElementById('resultsSection');
    if (!rs || rs.querySelector('.kakao-map-card')) return;
    const address = findAddress();
    if (!address) return;
    const locationCard = [...rs.querySelectorAll('.subcard h4')]
      .find((h) => h.textContent.includes('입지분석'))?.closest('.subcard');
    const anchor = locationCard || [...rs.querySelectorAll('.subcard h4')]
      .find((h) => h.textContent.includes('물건·현황'))?.closest('.subcard');
    if (!anchor) return;

    const cfg = await getConfig();
    const key = cfg?.kakaoMapKey || '';
    anchor.insertAdjacentHTML('afterend', renderEmptyCard(address, key ? '지도 준비 중...' : 'KAKAO_MAP_KEY 환경변수가 아직 설정되지 않았습니다.'));
    const card = rs.querySelector('.kakao-map-card');
    if (key && card) renderMap(card, address, key);
  }

  const observer = new MutationObserver(() => injectMapCard());
  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    const target = document.getElementById('resultsSection') || document.body;
    observer.observe(target, { childList: true, subtree: true });
    injectMapCard();
  });
})();
