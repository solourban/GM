(() => {
  const MAP_ID = 'v2KakaoInlineMap';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

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

  function render(card) {
    if (!card || document.getElementById(MAP_ID)) return;
    const x = findValue(card, '좌표 X');
    const y = findValue(card, '좌표 Y');
    const title = findValue(card, '도로명주소') || findValue(card, '지번주소') || findValue(card, '성공 조회 주소');
    const url = mapUrl({ x, y, title });
    if (!url) return;

    const wrap = document.createElement('div');
    wrap.id = MAP_ID;
    wrap.className = 'v2-map-card';
    wrap.style.cssText = 'margin-top:14px;border:1px solid var(--line);border-radius:18px;overflow:hidden;background:var(--bg);';
    wrap.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line);flex-wrap:wrap;">
        <div>
          <strong style="display:block;font-size:15px;">카카오맵 바로보기</strong>
          <span class="v2-note" style="margin-top:2px;display:block;">${esc(title)}</span>
        </div>
        <span class="v2-pill ok">카카오맵</span>
      </div>
      <iframe
        title="${esc(title)} 카카오맵"
        src="${esc(url)}"
        width="100%"
        height="360"
        style="display:block;border:0;background:#f6f3ee;"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade">
      </iframe>
      <p class="v2-note" style="padding:10px 14px;margin:0;border-top:1px solid var(--line);">카카오맵이 브라우저 정책으로 표시되지 않으면 위의 ‘카카오맵에서 보기’ 버튼을 사용하세요.</p>
    `;

    const grid = card.querySelector('.v2-grid');
    if (grid) card.insertBefore(wrap, grid);
    else card.appendChild(wrap);
  }

  function run() {
    const card = document.getElementById('v2LocationCard');
    if (!card) return;
    render(card);
  }

  setInterval(run, 900);
  document.addEventListener('DOMContentLoaded', run);
  window.__auctionKakaoInlineMap = { run };
})();
