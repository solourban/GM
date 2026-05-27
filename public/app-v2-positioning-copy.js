(() => {
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function app() {
    return window.__auctionV2 || null;
  }

  function activeTab() {
    return app()?.state?.activeTab || document.querySelector('.v2-tab.active')?.dataset?.tab || 'search';
  }

  function replaceTextByHeading(headingText, bodyText) {
    const cards = Array.from(document.querySelectorAll('#v2HomePanels .v2-card, .v2-panel .v2-card'));
    const card = cards.find((node) => clean(node.querySelector('h3')?.textContent) === headingText);
    const paragraph = card?.querySelector('p');
    if (!paragraph) return false;
    if (clean(paragraph.textContent) === bodyText) return true;
    paragraph.textContent = bodyText;
    return true;
  }

  function ensureDiscoveryNote() {
    const panels = document.getElementById('v2HomePanels');
    if (!panels) return;
    let note = document.getElementById('v2PositioningNote');
    if (!note) {
      note = document.createElement('p');
      note.id = 'v2PositioningNote';
      note.className = 'v2-note';
      note.style.maxWidth = '920px';
      note.style.margin = '14px auto 0';
      note.style.textAlign = 'center';
      panels.insertAdjacentElement('afterend', note);
    }

    const tab = activeTab();
    const copyByTab = {
      search: '단일 사건을 확인한 뒤 권리·입지·가격·자금 검토로 이어갑니다.',
      bulk: '여러 사건을 한 번에 훑어 입찰 검토할 만한 후보를 먼저 추립니다.',
      date: '매각기일 기준 후보를 모아 비교하고, 저장 후보로 넘겨 우선순위를 잡습니다.',
      saved: '저장 후보는 추천 확정이 아니라 추가 검토 순서를 정하는 참고 목록입니다.',
      onbid: '공매는 경매와 다른 흐름이므로 별도 후보 발굴 채널로 분리해 봅니다.',
    };
    note.textContent = copyByTab[tab] || copyByTab.search;
  }

  function alignCopy() {
    replaceTextByHeading('물건 검색', '사건번호로 대법원 경매정보의 기본정보를 조회하고, 입찰 전 검토 흐름으로 연결합니다.');
    replaceTextByHeading('여러 사건 일괄조회', '여러 사건번호를 한 번에 넣어 기본정보를 확인하고, 검토 후보를 빠르게 추립니다.');
    replaceTextByHeading('매각기일 추천', '법원과 기간을 기준으로 이번에 볼 만한 매각기일 후보를 조회합니다. 후보 선별용이며 입찰 판단을 보장하지 않습니다.');
    replaceTextByHeading('저장 후보 TOP 5', '저장한 후보를 기초 점수 기준으로 정렬해 다음 검토 순서를 확인합니다. 추천 확정이 아니라 참고 순위입니다.');
    replaceTextByHeading('온비드 공매', '공매는 경매와 다른 절차이므로 별도 후보 발굴 채널로 분리해 조회합니다.');
    ensureDiscoveryNote();
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('.brand, .v2-tab, [data-tab]')) return;
    window.setTimeout(alignCopy, 0);
    window.setTimeout(alignCopy, 120);
  }, true);

  setInterval(alignCopy, 1200);
  alignCopy();
  window.__auctionPositioningCopy = { alignCopy };
})();
