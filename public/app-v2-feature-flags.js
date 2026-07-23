(function () {
  const CONFIG_GLOBAL = '__NAKCHALNOTE_REMOTE_CONFIG';
  const CONFIG_EVENT = 'nakchalnote:remote-config';
  const NOTICE_ID = 'v2FeatureFlagNotice';
  const TAB_FLAGS = {
    search: 'search',
    bulk: 'bulkLookup',
    date: 'dateRecommendations',
    saved: 'savedCandidates',
    onbid: 'onbid',
  };
  const TAB_LABELS = {
    search: '물건 검색',
    bulk: '여러 사건 일괄조회',
    date: '매각기일 추천',
    saved: '저장 후보 TOP 5',
    onbid: '온비드 공매',
  };

  function remoteConfig() {
    return window[CONFIG_GLOBAL] || {};
  }

  function flags() {
    return remoteConfig().flags || {};
  }

  function isFeatureEnabled(tab) {
    const key = TAB_FLAGS[tab];
    if (!key) return true;
    return flags()[key] !== false;
  }

  function injectStyles() {
    if (document.getElementById('v2FeatureFlagStyles')) return;
    const style = document.createElement('style');
    style.id = 'v2FeatureFlagStyles';
    style.textContent = `
      .v2-tab.v2-tab-feature-disabled {
        opacity:.48;
        cursor:not-allowed;
        box-shadow:none;
      }
      .v2-tab.v2-tab-feature-disabled .v2-tab-status {
        display:block;
        margin-top:2px;
        font-size:10px;
        font-weight:900;
        line-height:1;
      }
      .v2-feature-flag-notice {
        max-width:920px;
        margin:0 auto 12px;
        padding:12px 14px;
        border:1px solid rgba(11,61,46,.16);
        border-radius:14px;
        background:#fff;
        color:var(--ink);
        box-shadow:0 12px 28px rgba(11,15,20,.08);
      }
      .v2-feature-flag-notice strong {
        display:block;
        font-size:14px;
        font-weight:950;
      }
      .v2-feature-flag-notice span {
        display:block;
        margin-top:4px;
        color:var(--ink-3);
        font-size:12px;
        line-height:1.5;
      }
      @media (max-width:720px) {
        .v2-tab.v2-tab-feature-disabled .v2-tab-status { font-size:9px; }
        .v2-feature-flag-notice { margin:0 0 10px; }
      }
    `;
    document.head.appendChild(style);
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function showNotice(tab) {
    const heroInner = document.querySelector('.hero-inner');
    if (!heroInner) return;
    let notice = document.getElementById(NOTICE_ID);
    if (!notice) {
      notice = document.createElement('div');
      notice.id = NOTICE_ID;
      notice.className = 'v2-feature-flag-notice';
      notice.setAttribute('role', 'status');
      heroInner.insertBefore(notice, heroInner.firstChild);
    }
    const label = TAB_LABELS[tab] || '선택한 기능';
    notice.innerHTML = `
      <strong>${esc(label)} 기능을 잠시 중지했습니다.</strong>
      <span>운영 설정으로 비활성화된 기능입니다. 다른 탭은 계속 사용할 수 있습니다.</span>
    `;
  }

  function hideNotice() {
    document.getElementById(NOTICE_ID)?.remove();
  }

  function decorateTab(button) {
    const tab = button?.dataset?.tab || '';
    const enabled = isFeatureEnabled(tab);
    if (button.disabled !== !enabled) button.disabled = !enabled;
    const ariaDisabled = String(!enabled);
    if (button.getAttribute('aria-disabled') !== ariaDisabled) button.setAttribute('aria-disabled', ariaDisabled);
    button.classList.toggle('v2-tab-feature-disabled', !enabled);
    const nextTitle = enabled ? '' : '운영 설정으로 일시 중지된 기능입니다.';
    if (button.title !== nextTitle) button.title = nextTitle;
    const currentStatus = button.querySelector('.v2-tab-status');
    if (enabled) {
      currentStatus?.remove();
    } else if (!currentStatus) {
      const status = document.createElement('span');
      status.className = 'v2-tab-status';
      status.textContent = '점검중';
      button.appendChild(status);
    }
  }

  function decorateTabs() {
    document.querySelectorAll('.v2-tab[data-tab]').forEach(decorateTab);
  }

  function activeTab() {
    return window.__auctionV2?.state?.activeTab || 'search';
  }

  function moveToSearch() {
    const searchButton = document.querySelector('.v2-tab[data-tab="search"]');
    if (searchButton && !searchButton.disabled) {
      searchButton.click();
      return;
    }
    if (window.__auctionV2?.state) {
      window.__auctionV2.state.activeTab = 'search';
      window.__auctionV2.syncTabResultsVisibility?.();
    }
  }

  function enforceActiveTab() {
    const tab = activeTab();
    if (isFeatureEnabled(tab)) return false;
    moveToSearch();
    showNotice(tab);
    return true;
  }

  function applyFeatureFlags() {
    injectStyles();
    decorateTabs();
    const redirected = enforceActiveTab();
    if (redirected) return;
    if (isFeatureEnabled(activeTab())) hideNotice();
  }

  function observeTabs() {
    if (!window.MutationObserver) return;
    const target = document.querySelector('.header-inner') || document.body;
    const observer = new MutationObserver(() => applyFeatureFlags());
    observer.observe(target, { childList: true, subtree: true });
  }

  function boot() {
    applyFeatureFlags();
    observeTabs();
  }

  document.addEventListener(CONFIG_EVENT, applyFeatureFlags);
  document.addEventListener('DOMContentLoaded', boot, { once: true });
  if (document.readyState !== 'loading') boot();

  window.__nakchalnoteFeatureFlags = {
    apply: applyFeatureFlags,
    enabled: isFeatureEnabled,
    flags,
  };
})();
