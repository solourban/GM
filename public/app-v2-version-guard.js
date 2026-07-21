(function () {
  const VERSION_ENDPOINT = '/api/version';
  const CONFIG_GLOBAL = '__NAKCHALNOTE_REMOTE_CONFIG';
  const DISMISS_KEY = 'nakchalnote.dismissedBuildId';
  const html = document.documentElement;
  const CLIENT_VERSION = html?.dataset?.appVersion || '2.0.0';
  const CLIENT_BUILD_ID = html?.dataset?.appBuild || 'static';
  let intervalId = null;

  function compareVersion(left, right) {
    const a = String(left || '').split('.').map((part) => Number(part) || 0);
    const b = String(right || '').split('.').map((part) => Number(part) || 0);
    const length = Math.max(a.length, b.length, 3);
    for (let i = 0; i < length; i += 1) {
      const diff = (a[i] || 0) - (b[i] || 0);
      if (diff !== 0) return diff > 0 ? 1 : -1;
    }
    return 0;
  }

  function safeSessionGet(key) {
    try { return window.sessionStorage.getItem(key); } catch (_) { return ''; }
  }

  function safeSessionSet(key, value) {
    try { window.sessionStorage.setItem(key, value); } catch (_) {}
  }

  function removeExistingBanner() {
    document.getElementById('v2VersionBanner')?.remove();
  }

  function createButton(label, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  function renderUpdateBanner({ force, buildId, version }) {
    removeExistingBanner();
    const banner = document.createElement('div');
    banner.id = 'v2VersionBanner';
    banner.className = `v2-version-banner${force ? ' force' : ''}`;
    banner.setAttribute('role', force ? 'alert' : 'status');
    banner.innerHTML = `
      <div>
        <strong>${force ? '필수 업데이트가 있습니다.' : '새 버전이 준비됐습니다.'}</strong>
        <span>${version ? `v${version}` : '최신 배포'} 화면으로 새로고침하세요.</span>
      </div>
    `;
    const actions = document.createElement('div');
    actions.className = 'v2-version-actions';
    actions.appendChild(createButton('새로고침', 'v2-version-refresh', () => window.location.reload()));
    if (!force) {
      actions.appendChild(createButton('나중에', 'v2-version-dismiss', () => {
        if (buildId) safeSessionSet(DISMISS_KEY, buildId);
        removeExistingBanner();
      }));
    }
    banner.appendChild(actions);
    document.body.prepend(banner);
  }

  function shouldShowUpdate(payload) {
    const remote = payload?.remoteConfig || {};
    const policy = remote.updatePolicy || {};
    const buildId = String(payload?.buildId || '').trim();
    const version = String(payload?.version || '').trim();
    const minimumVersion = String(policy.minimumClientVersion || version || '').trim();
    const mode = String(policy.mode || 'soft').toLowerCase();
    const force = mode === 'force' || (minimumVersion && compareVersion(CLIENT_VERSION, minimumVersion) < 0);
    const buildChanged = buildId && CLIENT_BUILD_ID && CLIENT_BUILD_ID !== 'static' && buildId !== CLIENT_BUILD_ID;
    if (mode === 'silent' && !force) return null;
    if (!force && !buildChanged) return null;
    if (!force && buildId && safeSessionGet(DISMISS_KEY) === buildId) return null;
    return { force, buildId, version };
  }

  function scheduleNextCheck(payload) {
    if (intervalId) return;
    const seconds = Number(payload?.remoteConfig?.updatePolicy?.checkIntervalSeconds || 300);
    const intervalMs = Math.max(60, Math.min(3600, seconds)) * 1000;
    intervalId = window.setInterval(checkVersion, intervalMs);
  }

  async function checkVersion() {
    try {
      const res = await fetch(VERSION_ENDPOINT, { cache: 'no-store' });
      const payload = await res.json();
      if (!payload?.ok) return;
      window[CONFIG_GLOBAL] = payload.remoteConfig || {};
      const update = shouldShowUpdate(payload);
      if (update) renderUpdateBanner(update);
      scheduleNextCheck(payload);
    } catch (_) {
      // Version checks must never block the auction workflow.
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkVersion, { once: true });
  } else {
    checkVersion();
  }
})();
