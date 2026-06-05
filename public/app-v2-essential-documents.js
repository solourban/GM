(() => {
  const CARD_ID = 'v2EssentialDocumentsCard';
  const CHANGE_EVENT = 'auction:result-card-change';
  const OFFICIAL_URL = 'https://www.courtauction.go.kr/';

  function appState() {
    return window.__auctionV2?.state || null;
  }

  function root() {
    return document.getElementById('resultsSection');
  }

  function hasCase() {
    return Boolean(appState()?.raw || document.getElementById('analysisCard'));
  }

  function anchor() {
    return document.getElementById('v2RiskBriefCard')
      || document.getElementById('analysisCard')
      || document.getElementById('step2InputCard')
      || root()?.querySelector('.v2-result-card:not(#v2WorkflowShell)');
  }

  function renderCard() {
    return `
      <span class="v2-badge">필수 문서</span>
      <h3>입찰 전 공식 문서 확인</h3>
      <p class="v2-note">매각물건명세서, 현황조사보고서, 감정평가서는 사건별 공개 상태를 공식 법원경매정보에서 다시 확인하세요.</p>
      <div class="v2-grid three">
        <div class="v2-info"><div class="k">매각물건명세서</div><div class="v">확인 필요</div></div>
        <div class="v2-info"><div class="k">현황조사보고서</div><div class="v">확인 필요</div></div>
        <div class="v2-info"><div class="k">감정평가서</div><div class="v">확인 필요</div></div>
      </div>
      <div class="v2-cta-row">
        <a class="v2-secondary-btn" href="${OFFICIAL_URL}" target="_blank" rel="noopener noreferrer">법원경매정보 열기</a>
      </div>
      <p class="v2-note">문서 공개 여부는 사건 진행 상태와 공식 사이트 접근 정책에 따라 달라질 수 있습니다. 자동 판정하지 않고 직접 확인 대상으로 남깁니다.</p>
    `;
  }

  function dispatchChange() {
    document.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { source: CARD_ID } }));
  }

  function upsert() {
    const resultRoot = root();
    if (!resultRoot) return;
    const existing = document.getElementById(CARD_ID);
    if (!hasCase()) {
      if (existing) {
        existing.remove();
        dispatchChange();
      }
      return;
    }

    const target = anchor();
    if (!target) return;
    const card = existing || document.createElement('section');
    const isNew = !existing;
    card.id = CARD_ID;
    card.className = 'v2-result-card';
    card.dataset.workflowStep = 'risk';
    card.innerHTML = renderCard();

    if (isNew) {
      target.insertAdjacentElement('afterend', card);
      dispatchChange();
    } else if (card.previousElementSibling !== target && !card.dataset.resultOrderIndex) {
      target.insertAdjacentElement('afterend', card);
      dispatchChange();
    }
  }

  function observe() {
    const resultRoot = root();
    if (!resultRoot || resultRoot.dataset.essentialDocsObserved === '1' || !window.MutationObserver) return;
    resultRoot.dataset.essentialDocsObserved = '1';
    const observer = new MutationObserver((records) => {
      if (records.some((record) => record.type === 'childList')) upsert();
    });
    observer.observe(resultRoot, { childList: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    observe();
    upsert();
  });
  document.addEventListener(CHANGE_EVENT, upsert);
  window.__auctionEssentialDocuments = { upsert, CARD_ID, OFFICIAL_URL };
})();
