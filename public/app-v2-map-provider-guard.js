(() => {
  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }

  function removeGoogleMapPreview() {
    const card = document.getElementById('v2LocationCard');
    if (!card) return;
    card.querySelectorAll('iframe[src*="maps.google.com"], iframe[src*="google.com/maps"]').forEach((frame) => {
      const wrap = frame.closest('.v2-map-card') || frame;
      wrap.remove();
    });
    const note = Array.from(card.querySelectorAll('.v2-note')).find((node) => clean(node.textContent).includes('지도 미리보기는 좌표 확인용'));
    if (note) note.textContent = '좌표는 카카오 주소검색 REST API로 확인했습니다. 지도 확인은 카카오맵에서 보기 또는 주소 검색 버튼을 사용하세요.';
  }

  document.addEventListener('DOMContentLoaded', removeGoogleMapPreview);
  setInterval(removeGoogleMapPreview, 1000);
  window.__auctionMapProviderGuard = { removeGoogleMapPreview };
})();
