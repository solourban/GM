(() => {
  const ORDER = [
    'analysisCard',
    'v2RiskBriefCard',
    'v2BiddingSummaryCard',
    'v2FinalJudgmentCard',
    'v2ExternalVerificationCard',
    'v2DecisionConfidenceCard',
    'v2BidRangeCard',
    'v2FundingReviewCard',
    'v2PreBidChecklistCard',
    'v2CopySummaryCard',
    'v2BidPlanCard',
  ];

  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function appState() {
    return window.__auctionV2?.state || null;
  }

  function resultRoot() {
    return document.getElementById('resultsSection') || document.querySelector('.results-section') || document.body;
  }

  function node(id) {
    return document.getElementById(id);
  }

  function hasReport() {
    return Boolean(appState()?.report || node('analysisCard') || node('v2BiddingSummaryCard'));
  }

  function orderedNodes() {
    return ORDER.map((id) => node(id)).filter(Boolean);
  }

  function moveAfter(target, anchor) {
    if (!target || !anchor?.parentNode || target === anchor) return false;
    if (target.previousElementSibling === anchor) return false;
    anchor.parentNode.insertBefore(target, anchor.nextSibling);
    return true;
  }

  function moveIntoRoot(card, root) {
    if (!card || !root || card.parentNode === root) return false;
    root.appendChild(card);
    return true;
  }

  function applyOrder() {
    if (!hasReport()) return;
    const root = resultRoot();
    const cards = orderedNodes();
    if (!cards.length) return;

    cards.forEach((card) => moveIntoRoot(card, root));

    let anchor = cards[0];
    for (let i = 1; i < cards.length; i += 1) {
      const current = cards[i];
      moveAfter(current, anchor);
      anchor = current;
    }

    root.dataset.resultOrder = ORDER.filter((id) => node(id)).join('>');
  }

  function labelCards() {
    ORDER.forEach((id, index) => {
      const card = node(id);
      if (!card) return;
      card.dataset.resultOrderIndex = String(index + 1);
    });
  }

  function run() {
    applyOrder();
    labelCards();
  }

  document.addEventListener('click', () => window.setTimeout(run, 80), true);
  setInterval(run, 700);
  window.__auctionResultOrder = { ORDER: [...ORDER], applyOrder, current: () => clean(resultRoot()?.dataset?.resultOrder) };
})();
