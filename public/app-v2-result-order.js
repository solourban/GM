(() => {
  const ORDER = [
    'analysisCard',
    'v2RiskBriefCard',
    'v2EssentialDocumentsCard',
    'v2ExternalVerificationCard',
    'v2BiddingSummaryCard',
    'v2BidRangeCard',
    'v2FundingReviewCard',
    'v2PreBidChecklistCard',
    'v2BidPlanCard',
    'v2FinalJudgmentCard',
    'v2DecisionConfidenceCard',
    'v2CopySummaryCard',
  ];
  const CHANGE_EVENT = 'auction:result-card-change';
  const SCROLL_IDLE_MS = 220;
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  let lastScrollAt = 0;
  let timer = 0;

  function appState() {
    return window.__auctionV2?.state || null;
  }

  function resultRoot() {
    return document.getElementById('resultsSection') || document.querySelector('.results-section') || null;
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

  function isUserScrolling() {
    return Date.now() - lastScrollAt < SCROLL_IDLE_MS;
  }

  function hasFocusedControl(root) {
    const active = document.activeElement;
    return Boolean(root?.contains(active) && active?.matches?.('input, textarea, select, [contenteditable="true"]'));
  }

  function viewportAnchor(root) {
    return Array.from(root?.children || []).find((card) => {
      const rect = card.getBoundingClientRect?.();
      return rect && rect.bottom > 110;
    }) || null;
  }

  function preserveViewport(anchor, beforeTop) {
    if (!anchor || !Number.isFinite(beforeTop)) return;
    window.requestAnimationFrame(() => {
      if (isUserScrolling() || !anchor.isConnected) return;
      const afterTop = anchor.getBoundingClientRect().top;
      const delta = afterTop - beforeTop;
      if (Math.abs(delta) > 1) window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
    });
  }

  function labelCards(cards) {
    cards.forEach((card) => {
      card.dataset.resultOrderIndex = String(ORDER.indexOf(card.id) + 1);
    });
  }

  function currentOrderedIds(root) {
    return Array.from(root?.children || [])
      .map((card) => card.id)
      .filter((id) => ORDER.includes(id));
  }

  function alreadyOrdered(cards, root) {
    if (cards.some((card) => card.parentNode !== root)) return false;
    return currentOrderedIds(root).join('>') === cards.map((card) => card.id).join('>');
  }

  function applyOrder() {
    if (!hasReport()) return false;
    const root = resultRoot();
    const cards = orderedNodes();
    if (!root || !cards.length) return false;

    labelCards(cards);
    const signature = cards.map((card) => card.id).join('>');
    if (alreadyOrdered(cards, root)) {
      root.dataset.resultOrder = signature;
      return false;
    }

    const stableAnchor = viewportAnchor(root);
    const beforeTop = stableAnchor?.getBoundingClientRect?.().top;
    let moved = false;

    cards.forEach((card) => {
      if (card.parentNode === root) return;
      root.appendChild(card);
      moved = true;
    });

    let anchor = cards[0];
    for (let index = 1; index < cards.length; index += 1) {
      const card = cards[index];
      if (card.previousElementSibling !== anchor) {
        anchor.parentNode.insertBefore(card, anchor.nextSibling);
        moved = true;
      }
      anchor = card;
    }

    root.dataset.resultOrder = signature;
    if (moved) preserveViewport(stableAnchor, beforeTop);
    return moved;
  }

  function schedule(reason = 'unknown', delay = 120) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const root = resultRoot();
      if (isUserScrolling() || hasFocusedControl(root)) {
        schedule(reason, SCROLL_IDLE_MS);
        return;
      }
      applyOrder();
    }, delay);
  }

  function relevantIds(nodes) {
    const ids = [];
    Array.from(nodes || []).forEach((item) => {
      if (item.nodeType !== 1) return;
      if (ORDER.includes(item.id)) ids.push(item.id);
      item.querySelectorAll?.('[id]').forEach((child) => {
        if (ORDER.includes(child.id)) ids.push(child.id);
      });
    });
    return ids.sort();
  }

  function isSameCardReplacement(records) {
    const added = records.flatMap((record) => relevantIds(record.addedNodes)).sort();
    const removed = records.flatMap((record) => relevantIds(record.removedNodes)).sort();
    return added.length === 1 && removed.length === 1 && added[0] === removed[0];
  }

  function needsOrder(records) {
    const childRecords = records.filter((record) => record.type === 'childList');
    if (isSameCardReplacement(childRecords)) return false;
    return childRecords.some((record) => relevantIds(record.addedNodes).length > 0 || relevantIds(record.removedNodes).length > 0);
  }

  function observeResults() {
    const root = resultRoot();
    if (!root || !window.MutationObserver) return;
    const observer = new MutationObserver((records) => {
      if (needsOrder(records)) schedule('mutation');
    });
    observer.observe(root, { childList: true });
  }

  window.addEventListener('scroll', () => {
    lastScrollAt = Date.now();
  }, { passive: true });
  document.addEventListener('focusout', () => schedule('focusout'));
  document.addEventListener(CHANGE_EVENT, () => schedule(CHANGE_EVENT));
  document.addEventListener('DOMContentLoaded', () => schedule('dom-ready', 0));
  observeResults();
  schedule('startup', 0);

  window.__auctionResultOrder = {
    ORDER: [...ORDER],
    applyOrder,
    schedule,
    isUserScrolling,
    current: () => clean(resultRoot()?.dataset?.resultOrder),
  };
})();
