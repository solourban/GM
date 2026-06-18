(() => {
  const TAB = 'onbid';
  const PANEL_ID = 'v2OnbidEntryPanel';
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const onbidState = {
    config: null,
    status: 'idle',
    error: '',
    items: [],
    totalCount: 0,
    requestId: '',
    diagnostic: null,
    upstream: null,
    filters: { lctnSdnm: '', lctnSggnm: '', keyword: '', bidPrdYmdStart: '', bidPrdYmdEnd: '' },
    detailStatus: 'idle',
    detailError: '',
    detail: null,
    detailRequestId: '',
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function state() {
    return window.__auctionV2?.state || null;
  }

  function resultRoot() {
    return window.__auctionV2?.tabResultsRoot?.() || document.getElementById('v2TabResultsSection');
  }

  function statusPill(ok, readyLabel = '준비됨', failLabel = '설정 필요') {
    return `<span class="v2-pill ${ok ? 'ok' : 'warn'}">${esc(ok ? readyLabel : failLabel)}</span>`;
  }

  function itemValue(item, keys) {
    for (const key of keys) {
      const value = clean(item?.[key]);
      if (value) return value;
    }
    return '';
  }

  function formatMoney(value) {
    const text = clean(value);
    if (!text) return '-';
    const numeric = text.replace(/[^0-9.-]/g, '');
    const number = Number(numeric);
    if (!Number.isFinite(number) || numeric === '') return text;
    return `${Math.round(number).toLocaleString('ko-KR')}원`;
  }

  function formatDate(value) {
    const text = clean(value);
    if (!text) return '';
    const digits = text.replace(/[^0-9]/g, '');
    if (digits.length >= 12) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)} ${digits.slice(8, 10)}:${digits.slice(10, 12)}`;
    if (digits.length >= 8) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
    return text;
  }

  function displayValue(value, fallback = '-') {
    const text = clean(value);
    return text || fallback;
  }

  function renderDiagnosticNote(diagnostic) {
    if (!diagnostic) return '';
    const filters = Array.isArray(diagnostic.appliedFilters) && diagnostic.appliedFilters.length
      ? `조건: ${diagnostic.appliedFilters.join(' / ')}`
      : '조건: 전체';
    return `<p class="v2-note">${esc(filters)} · ${esc(diagnostic.hint || '')}</p>`;
  }

  function renderUpstreamDiagnostic(upstream) {
    if (!upstream) return '';
    const parts = [
      upstream.status ? `HTTP ${upstream.status}` : '',
      upstream.resultCode ? `코드 ${upstream.resultCode}` : '',
      upstream.resultMsg ? `메시지 ${upstream.resultMsg}` : '',
    ].filter(Boolean).join(' / ');
    return `<p class="v2-note">${parts ? `온비드 응답: ${esc(parts)}. ` : ''}${esc(upstream.hint || '조회 조건을 줄여 다시 시도하세요.')}</p>`;
  }

  function statusLabel(value) {
    const text = clean(value);
    const map = {
      '0001': '입찰준비중',
      '0002': '입찰진행중',
      '0003': '입찰마감',
      '0006': '개찰중',
      '0009': '수의계약가능',
      '0010': '낙찰',
      '0011': '유찰',
      '0012': '취소',
    };
    return map[text] || text;
  }

  function formatArea(detail = {}) {
    const land = itemValue(detail, ['landArea', 'landSqms', 'LAND_SQMS']);
    const building = itemValue(detail, ['bldArea', 'bldSqms', 'BLD_SQMS']);
    const parts = [];
    if (land) parts.push(`토지 ${land}㎡`);
    if (building) parts.push(`건물 ${building}㎡`);
    return parts.join(' / ') || itemValue(detail, ['area', 'AREA', '면적']);
  }

  function copyText(value) {
    const text = clean(value);
    if (!text || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(text).catch(() => {});
  }

  function normalizeItem(item) {
    const name = itemValue(item, ['cltrNm', 'onbidCltrNm', 'CLTR_NM', 'ONBID_CLTR_NM', '물건명']);
    const address = itemValue(item, ['lctnFullAddr', 'ldnmAdrs', 'nmrdAdrs', 'lctnDtlAddr', 'addr', 'LCTN_FULL_ADDR', 'LDNM_ADRS', 'NMRD_ADRS', 'LCTN_DTL_ADDR', '소재지']);
    const price = itemValue(item, ['minBidPrc', 'lowstBidPrc', 'LOWST_BID_PRC', 'MIN_BID_PRC', '최저입찰가']);
    const appraisal = itemValue(item, ['apslAsesAvgAmt', 'appraisalAmt', 'APSL_ASES_AVG_AMT', '감정평가액', '감정가']);
    const bidStart = itemValue(item, ['bidStrtDtm', 'bidPrdYmdStart', 'BID_STRT_DTM', '입찰시작일']);
    const bidEnd = itemValue(item, ['bidEndDtm', 'bidPrdYmdEnd', 'BID_END_DTM', '입찰종료일']);
    const org = itemValue(item, ['pbctOrgNm', 'rqstOrgNm', 'PBCT_ORG_NM', 'RQST_ORG_NM', '공고기관']);
    const cltrMngNo = itemValue(item, ['cltrMngNo', 'cltrNo', 'CLTR_MNG_NO', 'CLTR_NO', '물건관리번호']);
    const pbctNo = itemValue(item, ['pbctNo', 'pbctCdtnNo', 'PBCT_NO', 'PBCT_CDTN_NO', '공고번호']);
    const method = itemValue(item, ['dspsMthodNm', 'dspsMthodCdNm', 'DSPS_MTHOD_NM', '처분방식']);
    const status = itemValue(item, ['bidStatNm', 'bidStatCdNm', 'BID_STAT_NM', '입찰상태']);
    const prptDiv = itemValue(item, ['prptDivNm', 'ctgrFullNm', 'PRPT_DIV_NM', 'CTGR_FULL_NM']);
    const onbidCltrno = itemValue(item, ['onbidCltrno', 'onbidCltrNo', 'ONBID_CLTRNO', 'ONBID_CLTR_NO']);
    const onbidPbancNo = itemValue(item, ['onbidPbancNo', 'ONBID_PBANC_NO']);
    return {
      name,
      address,
      price,
      appraisal,
      period: [formatDate(bidStart), formatDate(bidEnd)].filter(Boolean).join(' ~ '),
      org,
      cltrMngNo,
      cltrNo: cltrMngNo,
      pbctNo,
      pbctCdtnNo: pbctNo,
      method,
      status: statusLabel(status),
      prptDiv,
      onbidCltrno,
      onbidPbancNo,
    };
  }

  function normalizeDetail(detail = {}) {
    return {
      name: itemValue(detail, ['cltrNm', 'onbidCltrNm', 'CLTR_NM', 'ONBID_CLTR_NM', '물건명']),
      address: itemValue(detail, ['lctnFullAddr', 'ldnmAdrs', 'nmrdAdrs', 'lctnDtlAddr', 'addr', 'LCTN_FULL_ADDR', 'LDNM_ADRS', 'NMRD_ADRS', 'LCTN_DTL_ADDR', '소재지']),
      price: itemValue(detail, ['minBidPrc', 'lowstBidPrc', 'LOWST_BID_PRC', 'MIN_BID_PRC', '최저입찰가']),
      appraisal: itemValue(detail, ['apslAsesAvgAmt', 'appraisalAmt', 'APSL_ASES_AVG_AMT', '감정평가액', '감정가']),
      deposit: itemValue(detail, ['bidGrntAmt', 'bidDeposit', 'BID_GRNT_AMT', '입찰보증금']),
      area: formatArea(detail),
      use: itemValue(detail, ['prptDvsnNm', 'prptDivNm', 'usage', '용도', '물건구분']),
      method: itemValue(detail, ['dspsMthodNm', 'dspsMthodCdNm', 'DSPS_MTHOD_NM', '처분방식']),
      status: statusLabel(itemValue(detail, ['bidStatNm', 'bidStatCdNm', 'BID_STAT_NM', '입찰상태'])),
      org: itemValue(detail, ['pbctOrgNm', 'rqstOrgNm', 'PBCT_ORG_NM', 'RQST_ORG_NM', '공고기관']),
      cltrMngNo: itemValue(detail, ['cltrMngNo', 'cltrNo', 'CLTR_MNG_NO', 'CLTR_NO', '물건관리번호']),
      pbctNo: itemValue(detail, ['pbctNo', 'pbctCdtnNo', 'PBCT_NO', 'PBCT_CDTN_NO', '공고번호']),
      bidStart: itemValue(detail, ['bidStrtDtm', 'bidPrdYmdStart', 'BID_STRT_DTM', '입찰시작일']),
      bidEnd: itemValue(detail, ['bidEndDtm', 'bidPrdYmdEnd', 'BID_END_DTM', '입찰종료일']),
      prptDiv: itemValue(detail, ['prptDivNm', 'ctgrFullNm', 'PRPT_DIV_NM', 'CTGR_FULL_NM']),
    };
  }

  function renderMobileItems(items) {
    return `
      <div class="v2-mobile-card-list" id="v2OnbidMobileCards">
        ${items.map((item) => {
          const row = normalizeItem(item);
          const statusMethod = [row.status, row.method].filter(Boolean).join(' / ');
          const numbers = [row.cltrMngNo, row.pbctNo].filter(Boolean).join(' / ');
          const detailBtn = row.cltrMngNo
            ? `<button class="v2-small-btn" data-onbid-action="detail" data-cltr-mng-no="${esc(row.cltrMngNo)}" data-pbct-cdtn-no="${esc(row.pbctNo)}">상세조회</button>`
            : '<span class="v2-note">번호 없음</span>';
          const copyBtn = row.cltrMngNo
            ? `<button class="v2-small-btn" data-onbid-action="copy" data-copy-text="${esc(row.cltrMngNo)}">번호복사</button>`
            : '';
          return `
            <article class="v2-mobile-item-card">
              <div class="v2-mobile-item-head">
                <div>
                  <span class="v2-badge">${esc(row.status || '공매')}</span>
                  <h4>${esc(row.name || '물건명 확인 필요')}</h4>
                </div>
                <strong>${esc(row.method || '-')}</strong>
              </div>
              <div class="v2-mobile-item-grid">
                <span><small>최저입찰가</small><b>${esc(formatMoney(row.price))}</b></span>
                <span><small>감정가</small><b>${esc(formatMoney(row.appraisal))}</b></span>
                <span><small>입찰기간</small><b>${esc(row.period || '-')}</b></span>
                <span><small>공고기관</small><b>${esc(row.org || '-')}</b></span>
                <span><small>관리/공고번호</small><b>${esc(numbers || '-')}</b></span>
                <span><small>상태/방식</small><b>${esc(statusMethod || '-')}</b></span>
              </div>
              <p class="v2-note">${esc(row.address || '소재지 확인 필요')}</p>
              <div class="v2-mobile-actions">${detailBtn}${copyBtn}</div>
            </article>
          `;
        }).join('')}
      </div>
    `;
  }

  async function loadConfig() {
    try {
      const res = await fetch('/api/config', { headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || '설정 상태 조회 실패');
      return data;
    } catch (error) {
      return { ok: false, error: clean(error.message || String(error)) };
    }
  }

  function formValue(name) {
    return clean(document.querySelector(`[data-onbid-field="${name}"]`)?.value ?? onbidState.filters[name]);
  }

  function readFilters() {
    return {
      lctnSdnm: formValue('lctnSdnm'),
      lctnSggnm: formValue('lctnSggnm'),
      keyword: formValue('keyword'),
      bidPrdYmdStart: formValue('bidPrdYmdStart').replace(/[^0-9]/g, '').slice(0, 8),
      bidPrdYmdEnd: formValue('bidPrdYmdEnd').replace(/[^0-9]/g, '').slice(0, 8),
    };
  }

  function buildSearchParams(filters) {
    const params = new URLSearchParams();
    params.set('pageNo', '1');
    params.set('numOfRows', '10');
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params;
  }

  function buildDetailParams(cltrMngNo, pbctCdtnNo) {
    const params = new URLSearchParams();
    params.set('cltrNo', clean(cltrMngNo));
    if (clean(pbctCdtnNo)) params.set('pbctNo', clean(pbctCdtnNo));
    return params;
  }

  async function runSearch() {
    if (!onbidState.config?.hasOnbid) {
      onbidState.status = 'error';
      onbidState.error = 'ONBID_API_KEY 설정 후 검색할 수 있습니다.';
      renderIntoDom();
      return;
    }

    const filters = readFilters();
    const params = buildSearchParams(filters);
    onbidState.filters = filters;
    onbidState.status = 'loading';
    onbidState.error = '';
    onbidState.items = [];
    onbidState.diagnostic = null;
    onbidState.upstream = null;
    onbidState.detailStatus = 'idle';
    onbidState.detailError = '';
    onbidState.detail = null;
    renderIntoDom();

    try {
      const res = await fetch(`/api/onbid/items?${params.toString()}`, { headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        const apiError = new Error(data.error || '온비드 공매 물건 조회에 실패했습니다.');
        apiError.upstream = data.upstream || null;
        throw apiError;
      }
      onbidState.status = 'success';
      onbidState.items = Array.isArray(data.items) ? data.items : [];
      onbidState.totalCount = Number(data.totalCount || onbidState.items.length || 0);
      onbidState.requestId = clean(data.requestId || '');
      onbidState.diagnostic = data.diagnostic || null;
    } catch (error) {
      onbidState.status = 'error';
      onbidState.error = clean(error.message || String(error));
      onbidState.upstream = error.upstream || null;
    }
    renderIntoDom();
  }

  function resetSearchState(nextFilters = {}) {
    onbidState.filters = {
      lctnSdnm: clean(nextFilters.lctnSdnm),
      lctnSggnm: clean(nextFilters.lctnSggnm),
      keyword: clean(nextFilters.keyword),
      bidPrdYmdStart: clean(nextFilters.bidPrdYmdStart),
      bidPrdYmdEnd: clean(nextFilters.bidPrdYmdEnd),
    };
    onbidState.status = 'idle';
    onbidState.error = '';
    onbidState.items = [];
    onbidState.totalCount = 0;
    onbidState.requestId = '';
    onbidState.diagnostic = null;
    onbidState.upstream = null;
    onbidState.detailStatus = 'idle';
    onbidState.detailError = '';
    onbidState.detail = null;
    renderIntoDom();
  }

  function runSampleSearch() {
    resetSearchState({ lctnSdnm: '서울', keyword: '아파트' });
    runSearch();
  }

  async function runDetail(cltrMngNo, pbctCdtnNo) {
    if (!clean(cltrMngNo)) return;
    onbidState.detailStatus = 'loading';
    onbidState.detailError = '';
    onbidState.detail = null;
    renderIntoDom();

    try {
      const res = await fetch(`/api/onbid/detail?${buildDetailParams(cltrMngNo, pbctCdtnNo).toString()}`, { headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || '온비드 공매 상세 조회에 실패했습니다.');
      onbidState.detailStatus = 'success';
      onbidState.detail = data.detail || data.item || {};
      onbidState.detailRequestId = clean(data.requestId || '');
    } catch (error) {
      onbidState.detailStatus = 'error';
      onbidState.detailError = clean(error.message || String(error));
    }
    renderIntoDom();
    setTimeout(() => document.getElementById('v2OnbidDetailCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  }

  function renderResults() {
    if (onbidState.status === 'loading') {
      return `<div class="v2-info wide"><div class="k">조회 중</div><div class="v">온비드 공매 물건을 조회하고 있습니다.</div></div>`;
    }
    if (onbidState.status === 'error') {
      return `<div class="v2-info wide"><div class="k">조회 실패</div><div class="v">${esc(onbidState.error || '조회 실패')}</div>${renderUpstreamDiagnostic(onbidState.upstream)}<p class="v2-note">조건을 줄이거나 ONBID_API_KEY 설정 상태를 확인하세요.</p></div>`;
    }
    if (onbidState.status !== 'success') return '';
    if (!onbidState.items.length) {
      return `<div class="v2-info wide"><div class="k">조회 결과</div><div class="v">검색된 공매 물건이 없습니다.</div>${renderDiagnosticNote(onbidState.diagnostic)}<p class="v2-note">지역을 넓히거나 키워드·입찰기간 조건을 비워 다시 조회하세요.</p></div>`;
    }
    return `
      <div class="v2-info wide">
        <div class="k">조회 결과</div>
        <div class="v">${esc(String(onbidState.items.length))}건 표시 / 전체 ${esc(String(onbidState.totalCount || onbidState.items.length))}건</div>
        <p class="v2-note">상세 조회는 같은 온비드 탭 안에 표시합니다.${onbidState.requestId ? ` 요청ID: ${esc(onbidState.requestId)}` : ''}</p>
        ${renderDiagnosticNote(onbidState.diagnostic)}
      </div>
      ${renderMobileItems(onbidState.items)}
      <div class="v2-table-wrap v2-onbid-table-wrap" style="grid-column:1/-1">
        <table class="v2-table">
          <thead><tr><th>물건명</th><th>소재지</th><th>최저입찰가</th><th>감정가</th><th>입찰기간</th><th>상태/방식</th><th>공고기관</th><th>관리/공고번호</th><th>상세</th></tr></thead>
          <tbody>
            ${onbidState.items.map((item) => {
              const row = normalizeItem(item);
              const statusMethod = [row.status, row.method].filter(Boolean).join(' / ');
              const numbers = [row.cltrMngNo, row.pbctNo].filter(Boolean).join(' / ');
              const detailBtn = row.cltrMngNo
                ? `<button class="v2-small-btn" data-onbid-action="detail" data-cltr-mng-no="${esc(row.cltrMngNo)}" data-pbct-cdtn-no="${esc(row.pbctNo)}">상세조회</button>`
                : '<span class="v2-note">번호 없음</span>';
              const copyBtn = row.cltrMngNo
                ? `<button class="v2-small-btn" data-onbid-action="copy" data-copy-text="${esc(row.cltrMngNo)}">번호복사</button>`
                : '';
              const nameCell = [row.name, row.prptDiv].filter(Boolean).join(' · ');
              return `<tr><td>${esc(displayValue(nameCell))}</td><td>${esc(displayValue(row.address, '소재지 확인 필요'))}</td><td>${esc(formatMoney(row.price))}</td><td>${esc(formatMoney(row.appraisal))}</td><td>${esc(row.period || '-')}</td><td>${esc(statusMethod || '-')}</td><td>${esc(row.org || '-')}</td><td>${esc(numbers || '-')}</td><td><div class="v2-row-actions">${detailBtn}${copyBtn}</div></td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderDetail() {
    if (onbidState.detailStatus === 'idle') return '';
    if (onbidState.detailStatus === 'loading') {
      return `<section class="v2-result-card" id="v2OnbidDetailCard"><div class="v2-loading"><span class="v2-spinner"></span><div><h3>온비드 상세 조회 중...</h3><p class="v2-note">선택한 공매 물건의 상세 정보를 불러오고 있습니다.</p></div></div></section>`;
    }
    if (onbidState.detailStatus === 'error') {
      return `<section class="v2-result-card v2-error" id="v2OnbidDetailCard"><h3>온비드 상세 조회 실패</h3><p>${esc(onbidState.detailError || '상세 조회 실패')}</p><p class="v2-note">물건관리번호와 공고번호가 목록 응답에 포함되어 있는지 확인하세요.</p></section>`;
    }
    const detail = onbidState.detail || {};
    const row = normalizeDetail(detail);
    const rawEntries = Object.entries(detail)
      .filter(([, value]) => clean(value))
      .slice(0, 18);
    return `
      <section class="v2-result-card" id="v2OnbidDetailCard">
        <span class="v2-badge">온비드 상세</span>
        <h3>${esc(row.name || '공매 물건 상세')}</h3>
        <p class="v2-note">상세 원문 응답을 검토용 카드로 정리했습니다.${onbidState.detailRequestId ? ` 요청ID: ${esc(onbidState.detailRequestId)}` : ''}</p>
        <div class="v2-grid compact">
          <div class="v2-info wide"><div class="k">소재지</div><div class="v">${esc(displayValue(row.address, '소재지 확인 필요'))}</div></div>
          <div class="v2-info"><div class="k">최저입찰가</div><div class="v">${esc(formatMoney(row.price))}</div></div>
          <div class="v2-info"><div class="k">감정가</div><div class="v">${esc(formatMoney(row.appraisal))}</div></div>
          <div class="v2-info"><div class="k">입찰보증금</div><div class="v">${esc(formatMoney(row.deposit))}</div></div>
          <div class="v2-info"><div class="k">입찰기간</div><div class="v">${esc([formatDate(row.bidStart), formatDate(row.bidEnd)].filter(Boolean).join(' ~ ') || '-')}</div></div>
          <div class="v2-info"><div class="k">상태/방식</div><div class="v">${esc([row.status, row.method].filter(Boolean).join(' / ') || '-')}</div></div>
          <div class="v2-info"><div class="k">물건구분</div><div class="v">${esc(displayValue(row.use || row.prptDiv))}</div></div>
          <div class="v2-info"><div class="k">면적</div><div class="v">${esc(displayValue(row.area))}</div></div>
          <div class="v2-info"><div class="k">공고기관</div><div class="v">${esc(row.org || '-')}</div></div>
          <div class="v2-info"><div class="k">관리/공고번호</div><div class="v">${esc([row.cltrMngNo, row.pbctNo].filter(Boolean).join(' / ') || '-')}</div></div>
        </div>
        ${rawEntries.length ? `<div class="v2-table-wrap"><table class="v2-table"><thead><tr><th>원본 필드</th><th>값</th></tr></thead><tbody>${rawEntries.map(([key, value]) => `<tr><td>${esc(key)}</td><td>${esc(value)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="v2-note">표시할 상세 원본 필드가 없습니다.</p>'}
      </section>
    `;
  }

  function renderResultsArea() {
    return `
      <section class="v2-result-card" id="v2OnbidResultCard">
        <span class="v2-badge">온비드 결과</span>
        <h3>공매 물건 조회 결과</h3>
        <p class="v2-note">공매 결과와 상세정보는 법원경매 사건 결과와 분리해 표시합니다.</p>
        <div class="v2-grid compact" id="v2OnbidResultArea">${renderResults()}</div>
      </section>
      ${renderDetail()}
    `;
  }

  function renderPanel() {
    const config = onbidState.config || {};
    const ready = Boolean(config.hasOnbid);
    const requestId = clean(config.requestId || '');
    return `
      <section class="v2-panel ${state()?.activeTab === TAB ? 'active' : ''}" data-panel="${TAB}" id="${PANEL_ID}">
        <div class="v2-card">
          <div class="v2-onbid-head">
            <span class="v2-badge">공매 모드</span>
            <h3>온비드 공매</h3>
            <p>지역·키워드·입찰기간으로 공매 물건을 찾습니다.</p>
          </div>
          <div class="v2-onbid-status" aria-label="온비드 연동 상태">
            <span><b>API</b>${statusPill(ready)}</span>
            <span><b>데이터</b>경매와 분리</span>
            <span><b>요청ID</b>${esc(requestId || '-')}</span>
          </div>
          <div class="v2-step-section v2-onbid-search">
            <h4>검색 조건</h4>
            <div class="v2-input-grid">
              <label class="v2-field"><span>시·도</span><input data-onbid-field="lctnSdnm" value="${esc(onbidState.filters.lctnSdnm)}" placeholder="예: 충청남도"></label>
              <label class="v2-field"><span>시·군·구</span><input data-onbid-field="lctnSggnm" value="${esc(onbidState.filters.lctnSggnm)}" placeholder="예: 천안시"></label>
              <label class="v2-field"><span>키워드</span><input data-onbid-field="keyword" value="${esc(onbidState.filters.keyword)}" placeholder="예: 아파트, 토지"></label>
              <label class="v2-field"><span>입찰시작일</span><input data-onbid-field="bidPrdYmdStart" value="${esc(onbidState.filters.bidPrdYmdStart)}" placeholder="YYYYMMDD" inputmode="numeric"></label>
              <label class="v2-field"><span>입찰종료일</span><input data-onbid-field="bidPrdYmdEnd" value="${esc(onbidState.filters.bidPrdYmdEnd)}" placeholder="YYYYMMDD" inputmode="numeric"></label>
            </div>
            <div class="v2-cta-row">
              <button class="v2-btn" data-onbid-action="search" ${ready ? '' : 'disabled'}>${onbidState.status === 'loading' ? '조회 중...' : '온비드 물건 조회'}</button>
              <button class="v2-secondary-btn" data-onbid-action="sample-search" ${ready ? '' : 'disabled'}>서울 아파트 샘플</button>
              <button class="v2-secondary-btn" data-onbid-action="clear-filters">조건 초기화</button>
              ${ready ? '<span class="v2-note">기본 10건만 우선 조회합니다.</span>' : '<span class="v2-note">ONBID_API_KEY 설정 후 조회할 수 있습니다.</span>'}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function syncTab() {
    const nav = document.querySelector('.v2-tabs');
    if (!nav) return;
    let button = nav.querySelector('[data-tab="onbid"]');
    if (!button) {
      button = document.createElement('button');
      button.className = 'v2-tab';
      button.dataset.tab = TAB;
      button.type = 'button';
      button.textContent = '온비드 공매';
      nav.appendChild(button);
    }
    button.classList.toggle('active', state()?.activeTab === TAB);
  }

  function renderIntoDom() {
    const panels = document.getElementById('v2HomePanels');
    if (!panels) return;
    const old = document.getElementById(PANEL_ID);
    if (old) old.remove();
    panels.insertAdjacentHTML('beforeend', renderPanel());
    const root = resultRoot();
    if (root && state()?.activeTab === TAB) root.innerHTML = renderResultsArea();
  }

  async function syncPanel() {
    onbidState.config = await loadConfig();
    renderIntoDom();
  }

  let timer = null;
  function scheduleSync() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = null;
      syncTab();
      await syncPanel();
    }, 0);
  }

  function boot() {
    scheduleSync();
    document.addEventListener('click', (event) => {
      const onbidAction = event.target.closest('[data-onbid-action]');
      if (onbidAction?.dataset.onbidAction === 'search') {
        runSearch();
        return;
      }
      if (onbidAction?.dataset.onbidAction === 'sample-search') {
        runSampleSearch();
        return;
      }
      if (onbidAction?.dataset.onbidAction === 'clear-filters') {
        resetSearchState();
        return;
      }
      if (onbidAction?.dataset.onbidAction === 'detail') {
        runDetail(onbidAction.dataset.cltrMngNo, onbidAction.dataset.pbctCdtnNo);
        return;
      }
      if (onbidAction?.dataset.onbidAction === 'copy') {
        copyText(onbidAction.dataset.copyText);
        return;
      }
      const tab = event.target.closest('.v2-tab');
      if (!tab?.dataset?.tab) return;
      if (tab.dataset.tab === TAB && state()) state().activeTab = TAB;
      scheduleSync();
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
