(() => {
  const MAP_ID = 'v2KakaoInlineMap';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  let sdkLoading = false;
  let sdkLoaded = false;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function findValue(card, label) {
    const infos = Array.from(card.querySelectorAll('.v2-info'));
    const target = infos.find((info) => clean(info.querySelector('.k')?.textContent) === label);
    return clean(target?.querySelector('.v')?.textContent || '');
  }

  function mapUrl({ x, y, title }) {
    const label = encodeURIComponent(clean(title || '경매 물건 위치'));
    if (!x || !y) return '';
    return `https://map.kakao.com/link/map/${label},${y},${x}`;
  }

  function ensureSdk(callback) {
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => {
        sdkLoaded = true;
        callback();
      });
      return;
    }
    if (sdkLoading) return;
    sdkLoading = true;
    const script = document.createElement('script');
    script.src = '/api/kakao/maps-sdk.js';
    script.async = true;
    script.onload = () => {
      sdkLoading = false;
      if (!window.kakao?.maps) return;
      window.kakao.maps.load(() => {
        sdkLoaded = true;
        callback();
      });
    };
    script.onerror = () => {
      sdkLoading = false;
      const wrap = document.getElementById(MAP_ID);
      const status = wrap?.querySelector('[data-kakao-map-status]');
      if (status) status.textContent = '카카오 지도 SDK를 불러오지 못했습니다. 카카오맵에서 보기 버튼을 사용하세요.';
    };
    document.head.appendChild(script);
  }

  function drawMap(target, x, y, title) {
    if (!window.kakao?.maps || !target || target.dataset.rendered === '1') return;
    const lat = Number(y);
    const lng = Number(x);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const center = new window.kakao.maps.LatLng(lat, lng);
    const map = new window.kakao.maps.Map(target, { center, level: 3 });
    const marker = new window.kakao.maps.Marker({ position: center });
    marker.setMap(map);
    const infowindow = new window.kakao.maps.InfoWindow({ content: `<div style="padding:6px 10px;font-size:12px;white-space:nowrap;">${esc(title)}</div>` });
    infowindow.open(map, marker);
    target.dataset.rendered = '1';
  }

  function render(card) {
    if (!card) return;
    const x = findValue(card, '좌표 X');
    const y = findValue(card, '좌표 Y');
    const title = findValue(card, '도로명주소') || findValue(card, '지번주소') || findValue(card, '성공 조회 주소');
    const url = mapUrl({ x, y, title });
    if (!url) return;

    let wrap = document.getElementById(MAP_ID);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = MAP_ID;
      wrap.className = 'v2-map-card';
      wrap.style.cssText = 'margin-top:14px;border:1px solid var(--line);border-radius:18px;overflow:hidden;background:var(--bg);';
      wrap.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line);flex-wrap:wrap;">
          <div>
            <strong style="display:block;font-size:15px;">카카오맵 바로보기</strong>
            <span class="v2-note" style="margin-top:2px;display:block;">${esc(title)}</span>
          </div>
          <a class="v2-small-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;text-decoration:none;">카카오맵 크게 보기</a>
        </div>
        <div data-kakao-map-canvas style="width:100%;height:360px;background:#f6f3ee;"></div>
        <p class="v2-note" data-kakao-map-status style="padding:10px 14px;margin:0;border-top:1px solid var(--line);">카카오 지도 SDK로 물건 위치를 표시합니다.</p>
      `;
      const grid = card.querySelector('.v2-grid');
      if (grid) card.insertBefore(wrap, grid);
      else card.appendChild(wrap);
    }

    const canvas = wrap.querySelector('[data-kakao-map-canvas]');
    ensureSdk(() => drawMap(canvas, x, y, title));
  }

  function run() {
    const card = document.getElementById('v2LocationCard');
    if (!card) return;
    render(card);
  }

  setInterval(run, 900);
  document.addEventListener('DOMContentLoaded', run);
  window.__auctionKakaoInlineMap = { run, sdkLoaded: () => sdkLoaded };
})();
