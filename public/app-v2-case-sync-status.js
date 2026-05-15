(() => {
  const CARD_ID = 'v2CaseSyncStatusCard';
  const STORAGE_PREFIX = 'auction-note:v2.2:case:';
  const ACTIVE_CASE_KEY = 'auction-note:v2:active-case-key';
  const LOCATION_KEY = 'auction-note:v2:location-geocode';
  const TRADE_KEY = 'auction-note:v2:molit-trades';
  const FINAL_KEY = 'auction-note:v2:final-judgment';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function appState() {
    return window.__auctionV2?.state || null;
  }

  function normalizeCourt(value) {
    return clean(value).replace(/\s+/g, '').replace(/지방법원법원/g, '지방법원');
  }

  function normalizeCaseNo(value, yearHint = '') {
    const raw = clean(value).replace(/\s+/g, '');
    if (!raw) return '';
    const full = raw.match(/(20\d{2})타경(\d{1,10})/);
    if (full) return `${full[1]}타경${full[2]}`;
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    const year = clean(yearHint).match(/20\d{2}/)?.[0] || '';
    if (year && digitsOnly) return `${year}타경${digitsOnly}`;
    return raw;
  }

  function yearFromCaseNo(caseNo, fallback = '') {
    return clean(caseNo).match(/20\d{2}/)?.[0] || clean(fallback).match(/20\d{2}/)?.[0] || '';
  }

  function currentCaseKey() {
    const state = appState();
    if (!state?.raw) return '';
    const basic = state.raw.basic || {};
    const rawCaseNo = state.raw.caseNo || basic['사건번호'] || state.caseNo || state.form?.caseNo || '';
    const rawYear = state.year || state.form?.year || '';
    const caseNo = normalizeCaseNo(rawCaseNo, rawYear);
    const year = yearFromCaseNo(caseNo, rawYear);
    const court = normalizeCourt(state.raw.court || basic['법원'] || state.court || state.form?.court || '');
    if (!court || !caseNo) return '';
    return `${STORAGE_PREFIX}${court}:${year || 'no-year'}:${caseNo}`;
  }

  function readSession(key) {
    try {
      return sessionStorage.getItem(key) || '';
    } catch (_) {
      return '';
    }
  }

  function hasJson(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return false;
      JSON.parse(raw);
      return true;
    } catch (_) {
      return false;
    }
  }

  function shortKey(key) {
    return clean(key).replace(STORAGE_PREFIX, '').slice(0, 80) || '-';
  }

  function snapshot() {
    const key = currentCaseKey();
    const active = readSession(ACTIVE_CASE_KEY);
    const matched = Boolean(key && active && key === active);
    const hasActive = Boolean(active);
    const hasLocation = hasJson(LOCATION_KEY);
    const hasTrades = hasJson(TRADE_KEY);
    const hasFinal = hasJson(FINAL_KEY);
    let label = '정상';
    let tone = 'ok';
    let message = '현재 사건과 임시 데이터 기준 사건이 일치합니다.';

    if (!key) {
      label = '대기';
      tone = 'warn';
      message = '아직 사건 기본정보가 없어 동기화 상태를 판단하지 않습니다.';
    } else if (!hasActive) {
      label = '초기화 중';
      tone = 'warn';
      message = '현재 사건 기준 임시 데이터 기준값을 설정하는 중입니다.';
    } else if (!matched) {
      label = '확인 필요';
      tone = 'danger';
      message = '현재 사건과 임시 데이터 기준 사건이 다릅니다. 이전 사건 데이터가 섞이지 않도록 새로고침 또는 재조회가 필요합니다.';
    }

    return { key, active, matched, label, tone, message, hasLocation, hasTrades, hasFinal };
  }

  function pillClass(tone) {
    if (tone === 'ok') return 'ok';
    if (tone === 'danger') return 'danger';
    return 'warn';
  }

  function info(label, value) {
    return `<div class="v2-info"><div class="k">${esc(label)}</div><div class="v">${esc(value)}</div></div>`;
  }

  function statusInfo(label, ok) {
    return `<div class="v2-info"><div class="k">${esc(label)}</div><div class="v"><span class="v2-pill ${ok ? 'ok' : 'warn'}">${ok ? '있음' : '없음'}</span></div></div>`;
  }

  function findAnchor() {
    return document.getElementById('v2DecisionConfidenceCard')
      || document.getElementById('v2FinalJudgmentCard')
      || document.getElementById('v2MolitTradeCard')
      || null;
  }

  function renderCard(data) {
    return `
      <section class="v2-card" id="${CARD_ID}">
        <span class="v2-badge">안전 상태</span>
        <h3>사건 데이터 동기화 상태</h3>
        <p class="v2-note">현재 사건과 임시 저장값이 같은 사건 기준인지 확인합니다. 사건을 바꿨을 때 이전 사건의 입지·실거래가·판단이 섞이지 않도록 점검합니다.</p>
        <div class="v2-grid compact">
          <div class="v2-info wide">
            <div class="k">동기화 상태</div>
            <div class="v"><span class="v2-pill ${pillClass(data.tone)}">${esc(data.label)}</span></div>
            <p class="v2-note">${esc(data.message)}</p>
          </div>
          ${info('현재 사건 key', shortKey(data.key))}
          ${info('임시 기준 key', shortKey(data.active))}
          ${info('key 일치', data.matched ? '일치' : '-')}
          ${statusInfo('입지 임시값', data.hasLocation)}
          ${statusInfo('실거래가 임시값', data.hasTrades)}
          ${statusInfo('종합판단 임시값', data.hasFinal)}
        </div>
      </section>
    `;
  }

  function upsertCard() {
    const state = appState();
    const existing = document.getElementById(CARD_ID);
    if (!state?.report) {
      existing?.remove();
      return;
    }
    const anchor = findAnchor();
    if (!anchor) return;
    const html = renderCard(snapshot());
    if (existing) existing.outerHTML = html;
    else anchor.insertAdjacentHTML('afterend', html);
  }

  setInterval(upsertCard, 1200);
})();
