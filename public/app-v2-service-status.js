(() => {
  const CARD_ID = 'v2ServiceStatusCard';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  async function getJson(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || '상태 조회에 실패했습니다.');
    return data;
  }

  function statusPill(ok, readyLabel = '정상', failLabel = '확인 필요') {
    return `<span class="v2-pill ${ok ? 'ok' : 'warn'}">${esc(ok ? readyLabel : failLabel)}</span>`;
  }

  function info(label, value) {
    return `<div class="v2-info"><div class="k">${esc(label)}</div><div class="v">${value}</div></div>`;
  }

  function missingServices(config) {
    const env = config?.envNames || {};
    const missing = [];
    if (!config?.hasKakaoRest) {
      missing.push({
        label: '카카오 주소검색',
        env: env.kakaoRest || 'KAKAO_REST_API_KEY',
        note: '카카오맵 JS 키와 별개로 REST API 키가 필요합니다.',
      });
    }
    if (!config?.hasMolit) {
      missing.push({ label: '국토부 실거래가', env: env.molit || 'MOLIT_API_KEY', note: '공공데이터포털 실거래가 서비스키가 필요합니다.' });
    }
    if (!config?.hasOnbid) {
      missing.push({ label: '온비드 공매', env: env.onbid || 'ONBID_API_KEY', note: '공공데이터포털 온비드 서비스키가 필요합니다.' });
    }
    return missing;
  }

  function summaryMessage(health, config) {
    if (!health?.ok) return '서버 상태 확인이 필요합니다.';
    const missing = missingServices(config).map((item) => item.label);
    if (!missing.length) return '주요 외부 연동이 준비되어 있습니다.';
    return `${missing.join(', ')} 설정 확인이 필요합니다.`;
  }

  function renderChecklist(config) {
    const missing = missingServices(config);
    if (!missing.length) {
      return `
        <div class="v2-info wide">
          <div class="k">필요 조치</div>
          <div class="v">추가 설정 없음</div>
          <p class="v2-note">현재 등록된 외부 API 설정 기준으로 주요 기능을 사용할 수 있습니다.</p>
        </div>
      `;
    }
    return `
      <div class="v2-info wide">
        <div class="k">필요 조치</div>
        <div class="v">Railway Variables 확인</div>
        <ul class="v2-note" style="margin:8px 0 0 18px; line-height:1.7">
          ${missing.map((item) => `<li><b>${esc(item.env)}</b> 추가 필요 · ${esc(item.note)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  function renderLoading() {
    return `
      <section class="v2-card" id="${CARD_ID}">
        <span class="v2-badge">연동 상태</span>
        <h3>서비스 연동 상태</h3>
        <p class="v2-note">서버와 외부 API 설정 상태를 확인하고 있습니다.</p>
      </section>
    `;
  }

  function renderCard({ health, config, error }) {
    const ok = !error && health?.ok;
    const message = error ? clean(error.message || String(error)) : summaryMessage(health, config);
    const requestId = clean(health?.requestId || config?.requestId || '');
    return `
      <section class="v2-card" id="${CARD_ID}">
        <span class="v2-badge">연동 상태</span>
        <h3>서비스 연동 상태</h3>
        <p class="v2-note">서버, 카카오, 국토부 실거래가, 온비드 공매 연동 준비 상태를 확인합니다.</p>
        <div class="v2-grid compact">
          <div class="v2-info wide">
            <div class="k">현재 상태</div>
            <div class="v">${statusPill(ok, '운영 가능', '확인 필요')}</div>
            <p class="v2-note">${esc(message)}</p>
          </div>
          ${info('서버', statusPill(Boolean(health?.ok)))}
          ${info('카카오 주소검색', statusPill(Boolean(config?.hasKakaoRest), '설정됨', '미설정'))}
          ${info('카카오맵', statusPill(Boolean(config?.hasKakaoMap), '설정됨', '미설정'))}
          ${info('국토부 실거래가', statusPill(Boolean(config?.hasMolit), '설정됨', '미설정'))}
          ${info('온비드 공매', statusPill(Boolean(config?.hasOnbid), '설정됨', '미설정'))}
          ${renderChecklist(config)}
          ${info('서비스 버전', esc(clean(health?.version || '-')))}
          ${info('요청ID', esc(requestId || '-'))}
        </div>
      </section>
    `;
  }

  function findAnchor() {
    return document.getElementById('v2HomePanels') || document.querySelector('.hero-inner') || null;
  }

  function upsert(html) {
    const anchor = findAnchor();
    if (!anchor) return false;
    const existing = document.getElementById(CARD_ID);
    if (existing) existing.outerHTML = html;
    else anchor.insertAdjacentHTML('afterend', html);
    return true;
  }

  async function refreshStatus() {
    if (!upsert(renderLoading())) return;
    try {
      const [health, config] = await Promise.all([getJson('/api/health'), getJson('/api/config')]);
      upsert(renderCard({ health, config }));
    } catch (error) {
      upsert(renderCard({ error }));
    }
  }

  function boot() {
    setTimeout(refreshStatus, 0);
    setInterval(refreshStatus, 120000);
  }

  document.addEventListener('DOMContentLoaded', boot);
})();