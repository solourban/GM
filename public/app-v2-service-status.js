(() => {
  const CARD_ID = 'v2ServiceStatusCard';
  const HEALTH_ENDPOINT = '/api/health';
  const CONFIG_ENDPOINT = '/api/config';
  const VERSION_ENDPOINT = '/api/version';
  const DATA_SOURCES_ENDPOINT = '/api/data-sources';
  const FEATURE_LABELS = {
    search: '물건 검색',
    bulkLookup: '여러 사건 일괄조회',
    dateRecommendations: '매각기일 추천',
    savedCandidates: '저장 후보 TOP 5',
    onbid: '온비드 공매',
    dataSourceNotice: '데이터 출처 고지',
  };
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
    if (!config?.hasKakaoMap) {
      missing.push({
        label: '카카오맵',
        env: env.kakaoMap || 'KAKAO_JS_KEY',
        note: '지도 표시용 JavaScript 키를 추가하고 Kakao Developers에 현재 배포 주소를 JavaScript SDK 도메인으로 등록해야 합니다.',
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

  function featureEntries(version) {
    const flags = version?.remoteConfig?.flags;
    return Object.entries(FEATURE_LABELS).map(([key, label]) => ({
      key,
      label,
      known: Boolean(flags),
      enabled: flags ? flags[key] !== false : false,
    }));
  }

  function disabledFeatures(version) {
    return featureEntries(version).filter((feature) => feature.known && !feature.enabled);
  }

  function sourceCount(dataSources) {
    const summaryCount = Number(dataSources?.summary?.sources);
    if (Number.isFinite(summaryCount)) return summaryCount;
    return Array.isArray(dataSources?.sources) ? dataSources.sources.length : 0;
  }

  function summaryMessage(health, config, version) {
    if (!health?.ok) return '서버 상태 확인이 필요합니다.';
    const missing = missingServices(config).map((item) => item.label);
    const disabled = disabledFeatures(version).map((item) => item.label);
    const notices = [];
    if (missing.length) notices.push(`${missing.join(', ')} 설정 확인이 필요합니다.`);
    if (disabled.length) notices.push(`${disabled.join(', ')} 기능이 운영 설정으로 중지되어 있습니다.`);
    if (!notices.length) return '주요 외부 연동과 운영 설정이 준비되어 있습니다.';
    return notices.join(' ');
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

  function renderFeatureFlags(version) {
    const entries = featureEntries(version);
    return `
      <div class="v2-info wide">
        <div class="k">원격 기능 설정</div>
        <div class="v">Feature flags</div>
        <div class="v2-grid compact" style="margin-top:10px">
          ${entries.map((feature) => info(feature.label, statusPill(feature.known && feature.enabled, '사용', feature.known ? '중지' : '확인 전'))).join('')}
        </div>
        <p class="v2-note">서버 원격 설정 기준입니다. 중지된 탭은 홈 화면에서도 비활성화됩니다.</p>
      </div>
    `;
  }

  function renderVersionInfo(version) {
    const remoteConfig = version?.remoteConfig || {};
    const updatePolicy = remoteConfig.updatePolicy || {};
    const releaseChannel = clean(remoteConfig.releaseChannel || '-');
    return `
      ${info('배포 빌드', esc(clean(version?.buildId || '-')))}
      ${info('릴리스 채널', esc(releaseChannel))}
      ${info('업데이트 모드', esc(clean(updatePolicy.mode || '-')))}
      ${info('최소 클라이언트', esc(clean(updatePolicy.minimumClientVersion || '-')))}
    `;
  }

  function renderDataSources(dataSources) {
    const summary = dataSources?.summary || {};
    const count = sourceCount(dataSources);
    return `
      <div class="v2-info wide">
        <div class="k">데이터 출처 상태</div>
        <div class="v">${esc(count ? `${count}개 출처 공개` : '출처 확인 필요')}</div>
        <p class="v2-note">최종 검토일 ${esc(clean(summary.lastReviewed || '-'))} · ${esc(clean(summary.trainingUse || 'AI 학습 사용 없음'))}</p>
        <p class="v2-note"><a href="${DATA_SOURCES_ENDPOINT}" target="_blank" rel="noreferrer">/api/data-sources 원문 보기</a></p>
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

  function renderCard({ health, config, version, dataSources, error }) {
    const ok = !error && health?.ok;
    const message = error ? clean(error.message || String(error)) : summaryMessage(health, config, version);
    const requestId = clean(health?.requestId || config?.requestId || version?.requestId || dataSources?.requestId || '');
    return `
      <section class="v2-card" id="${CARD_ID}">
        <span class="v2-badge">연동 상태</span>
        <h3>서비스 운영 상태</h3>
        <p class="v2-note">서버, 외부 API, 원격 기능 설정, 데이터 출처 공개 상태를 확인합니다.</p>
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
          ${renderVersionInfo(version)}
          ${renderFeatureFlags(version)}
          ${renderDataSources(dataSources)}
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
      const [health, config, version, dataSources] = await Promise.all([
        getJson(HEALTH_ENDPOINT),
        getJson(CONFIG_ENDPOINT),
        getJson(VERSION_ENDPOINT),
        getJson(DATA_SOURCES_ENDPOINT),
      ]);
      upsert(renderCard({ health, config, version, dataSources }));
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
