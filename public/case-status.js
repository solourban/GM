(() => {
  let latestRaw = null;

  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function parseKrw(value) {
    const digits = String(value || '').replace(/[^0-9.-]/g, '');
    const n = digits ? Number(digits) : 0;
    return Number.isFinite(n) ? n : 0;
  }

  function krw(n) {
    const num = Number(n || 0);
    if (!num) return '-';
    return `${Math.round(num).toLocaleString('ko-KR')}원`;
  }

  function pct(n) {
    if (!Number.isFinite(n)) return '-';
    return `${n.toFixed(1)}%`;
  }

  function cleanAddress(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/,\s*/g, ', ')
      .trim();
  }

  function shortAddress(value) {
    return cleanAddress(value).replace(/\s*\((.*)\)\s*$/, '');
  }

  function getBasic(raw) {
    return raw?.basic || {};
  }

  function injectStyles() {
    if (document.getElementById('caseStatusStyles')) return;
    const style = document.createElement('style');
    style.id = 'caseStatusStyles';
    style.textContent = `
      .brand { cursor:pointer; }
      .case-quick-nav { position:sticky; top:0; z-index:20; display:flex; gap:8px; flex-wrap:wrap; padding:10px 0; margin:8px 0 16px; background:rgba(246,245,241,.94); backdrop-filter:blur(10px); }
      .case-quick-nav a { text-decoration:none; border:1px solid var(--line); background:#fff; color:var(--ink-2); padding:8px 11px; border-radius:999px; font-size:12.5px; font-weight:700; }
      .case-dashboard { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin:16px 0; }
      .case-panel { border:1px solid var(--line); border-radius:14px; background:#fff; padding:16px; }
      .case-panel h4 { margin:0 0 10px; font-family:var(--font-serif); font-size:16px; }
      .case-panel .main-value { font-family:var(--font-serif); font-weight:800; font-size:24px; }
      .case-panel .sub-value { color:var(--ink-3); font-size:12.5px; margin-top:4px; }
      .case-mini-list { display:grid; gap:8px; margin-top:8px; }
      .case-mini-row { display:flex; justify-content:space-between; gap:12px; border-top:1px solid var(--line); padding-top:8px; font-size:13px; }
      .case-mini-row:first-child { border-top:none; padding-top:0; }
      .case-mini-row span:first-child { color:var(--ink-3); }
      .map-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
      .map-actions a { text-decoration:none; background:var(--accent-soft); color:var(--accent); border:1px solid rgba(11,61,46,.16); border-radius:9px; padding:8px 10px; font-weight:800; font-size:12.5px; }
      .status-pill-soft { display:inline-flex; padding:4px 8px; border-radius:999px; background:var(--accent-soft); color:var(--accent); font-size:11px; font-weight:800; }
      .status-pill-soft.warn { background:var(--warn-bg); color:var(--warn); }
      .status-pill-soft.danger { background:var(--danger-bg); color:var(--danger); }
      .collapse-card { position:relative; }
      .collapse-card.is-collapsed .collapse-body { display:none; }
      .collapse-toggle { float:right; border:1px solid var(--line); background:#fff; border-radius:8px; padding:5px 9px; font-size:12px; cursor:pointer; }
      .virtual-bid-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-top:12px; }
      .virtual-bid-grid label { display:flex; flex-direction:column; gap:5px; color:var(--ink-3); font-size:12px; font-weight:700; }
      .virtual-bid-grid input { border:1px solid var(--line); border-radius:9px; padding:10px 12px; background:var(--bg); color:var(--ink); }
      .virtual-result { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-top:14px; }
      .virtual-result .mini-metric { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:12px; }
      .virtual-result .k { color:var(--ink-3); font-size:12px; }
      .virtual-result .v { font-family:var(--font-serif); font-weight:800; font-size:19px; }
      .danger-text { color:var(--danger); }
      .ok-text { color:var(--ok); }
      .print-bid { border:0; background:var(--ink); color:var(--accent-ink); border-radius:10px; padding:11px 16px; font-weight:800; cursor:pointer; margin-top:12px; }
    `;
    document.head.appendChild(style);
  }

  function makeBrandHome() {
    const brand = document.querySelector('.brand');
    if (!brand || brand.dataset.homeReady) return;
    brand.dataset.homeReady = '1';
    brand.title = '홈으로 이동';
    brand.addEventListener('click', () => { window.location.href = '/'; });
  }

  function renderQuickNav() {
    return `
      <nav class="case-quick-nav" id="caseQuickNav">
        <a href="#caseStatusDashboard">현황요약</a>
        <a href="#virtualBidCard">가상입찰표</a>
        <a href="#rawCaseInfoCard">원본 기본정보</a>
        <a href="#interestedCard">이해관계인</a>
        <a href="#step2InputArea">Step 2 입력</a>
        <a href="#savedCasesBoard">관심비교</a>
      </nav>`;
  }

  function renderStatusDashboard(raw) {
    const basic = getBasic(raw);
    const address = cleanAddress(basic['소재지'] || '');
    const locationQ = encodeURIComponent(shortAddress(address) || address);
    const appraisal = parseKrw(basic['감정평가액'] || basic['감정가']);
    const minBid = parseKrw(basic['최저매각가격'] || basic['최저가']);
    const depositRate = parseKrw(basic['입찰보증금율'] || basic['입찰보증금']) || 10;
    const minBidRate = appraisal ? (minBid / appraisal) * 100 : 0;
    const downRate = appraisal ? ((appraisal - minBid) / appraisal) * 100 : 0;
    const bidDeposit = minBid ? Math.ceil((minBid * (depositRate / 100)) / 10000) * 10000 : 0;
    const failCount = String(basic['유찰횟수'] || '-');
    const finalResult = basic['종국결과'] || '진행중/미종국';
    const finalClass = /미종국|진행/.test(finalResult) ? 'warn' : '';

    return `
      <section class="subcard input-card case-status-card" id="caseStatusDashboard">
        <h4>🧾 사건 현황 요약</h4>
        <p class="muted">원본 기본정보를 그대로 길게 보여주기 전에, 입찰 판단에 필요한 현황만 먼저 요약합니다.</p>
        <div class="case-dashboard">
          <div class="case-panel">
            <h4>📍 지역·위치</h4>
            <div class="sub-value">${esc(address || '소재지 확인 필요')}</div>
            <div class="map-actions">
              <a href="https://map.kakao.com/link/search/${locationQ}" target="_blank" rel="noopener">카카오지도</a>
              <a href="https://map.naver.com/p/search/${locationQ}" target="_blank" rel="noopener">네이버지도</a>
            </div>
            <div class="sub-value">주변현황·상권·교통·현장답사는 지도에서 직접 확인하세요.</div>
          </div>
          <div class="case-panel">
            <h4>📅 진행 일정</h4>
            <div class="case-mini-list">
              <div class="case-mini-row"><span>접수일자</span><b>${esc(basic['접수일자'] || '-')}</b></div>
              <div class="case-mini-row"><span>경매개시일</span><b>${esc(basic['경매개시일'] || '-')}</b></div>
              <div class="case-mini-row"><span>매각기일</span><b>${esc(basic['매각기일'] || '-')}</b></div>
              <div class="case-mini-row"><span>배당요구종기</span><b>${esc(basic['배당요구종기'] || '-')}</b></div>
              <div class="case-mini-row"><span>진행상태</span><b><span class="status-pill-soft ${finalClass}">${esc(finalResult)}</span></b></div>
            </div>
          </div>
          <div class="case-panel">
            <h4>📉 가격·유찰</h4>
            <div class="main-value">${pct(minBidRate)}</div>
            <div class="sub-value">감정가 대비 최저가율</div>
            <div class="case-mini-list">
              <div class="case-mini-row"><span>감정가</span><b>${krw(appraisal)}</b></div>
              <div class="case-mini-row"><span>최저가</span><b>${krw(minBid)}</b></div>
              <div class="case-mini-row"><span>하락폭</span><b>${krw(appraisal - minBid)} (${pct(downRate)})</b></div>
              <div class="case-mini-row"><span>유찰횟수</span><b>${esc(failCount)}</b></div>
            </div>
          </div>
          <div class="case-panel">
            <h4>💳 입찰 준비</h4>
            <div class="main-value">${krw(bidDeposit)}</div>
            <div class="sub-value">최저가 기준 예상 보증금 (${depositRate || 10}%)</div>
            <div class="case-mini-list">
              <div class="case-mini-row"><span>담당계</span><b>${esc(basic['담당계'] || '-')}</b></div>
              <div class="case-mini-row"><span>집행관실</span><b>${esc(basic['집행관실전화'] || '-')}</b></div>
              <div class="case-mini-row"><span>물건종별</span><b>${esc(basic['물건종별'] || '-')}</b></div>
            </div>
          </div>
        </div>
      </section>`;
  }

  function renderVirtualBid(raw) {
    const basic = getBasic(raw);
    const minBid = parseKrw(basic['최저매각가격'] || basic['최저가']);
    const depositRate = parseKrw(basic['입찰보증금율'] || basic['입찰보증금']) || 10;
    const court = basic['법원'] || raw.court || '';
    const caseNo = basic['사건번호'] || raw.caseNo || '';
    return `
      <section class="subcard input-card" id="virtualBidCard">
        <h4>🖊 가상 입찰표 작성</h4>
        <p class="muted">실제 입찰표 제출 전 연습용입니다. 입찰가·보증금 부족 여부를 먼저 확인합니다.</p>
        <div class="virtual-bid-grid">
          <label>법원 <input id="bidCourt" value="${esc(court)}"></label>
          <label>사건번호 <input id="bidCaseNo" value="${esc(caseNo)}"></label>
          <label>입찰자명 <input id="bidderName" placeholder="성명/법인명"></label>
          <label>입찰가 <input type="number" id="virtualBidAmount" value="${minBid}" oninput="window.updateVirtualBid()"></label>
          <label>입찰보증금율 % <input type="number" id="virtualDepositRate" value="${depositRate}" oninput="window.updateVirtualBid()"></label>
          <label>준비한 보증금 <input type="number" id="virtualPreparedDeposit" placeholder="원" oninput="window.updateVirtualBid()"></label>
        </div>
        <div id="virtualBidResult" class="virtual-result"></div>
        <button class="print-bid" onclick="window.print()">입찰표 연습내용 인쇄</button>
        <div class="note warn-note">실제 입찰표 양식·보증금 기준·봉투 작성은 해당 법원 원본 안내를 반드시 확인하세요.</div>
      </section>`;
  }

  window.updateVirtualBid = function updateVirtualBid() {
    const amount = parseKrw(document.getElementById('virtualBidAmount')?.value);
    const rate = Number(document.getElementById('virtualDepositRate')?.value || 10) / 100;
    const prepared = parseKrw(document.getElementById('virtualPreparedDeposit')?.value);
    const required = Math.ceil((amount * rate) / 10000) * 10000;
    const gap = prepared ? prepared - required : 0;
    const result = document.getElementById('virtualBidResult');
    if (!result) return;
    result.innerHTML = `
      <div class="mini-metric"><div class="k">입찰가</div><div class="v">${krw(amount)}</div></div>
      <div class="mini-metric"><div class="k">필요 보증금</div><div class="v">${krw(required)}</div></div>
      <div class="mini-metric"><div class="k">준비 보증금 차이</div><div class="v ${prepared && gap < 0 ? 'danger-text' : 'ok-text'}">${prepared ? krw(gap) : '-'}</div></div>
      <div class="mini-metric"><div class="k">상태</div><div class="v ${prepared && gap < 0 ? 'danger-text' : ''}">${prepared ? (gap >= 0 ? '보증금 충족' : '보증금 부족') : '보증금 입력 필요'}</div></div>
    `;
  };

  function enhanceLongCards() {
    const cards = Array.from(document.querySelectorAll('.subcard'));
    cards.forEach((card) => {
      const h4 = card.querySelector('h4');
      if (!h4 || card.dataset.collapseReady) return;
      const title = h4.textContent || '';
      if (!/자동 수집된 사건 정보|이해관계인/.test(title)) return;
      card.dataset.collapseReady = '1';
      card.classList.add('collapse-card', 'is-collapsed');
      if (/자동 수집된 사건 정보/.test(title)) card.id = 'rawCaseInfoCard';
      if (/이해관계인/.test(title)) card.id = 'interestedCard';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'collapse-toggle';
      btn.textContent = '펼치기';
      btn.onclick = () => {
        card.classList.toggle('is-collapsed');
        btn.textContent = card.classList.contains('is-collapsed') ? '펼치기' : '접기';
      };
      h4.appendChild(btn);

      const body = document.createElement('div');
      body.className = 'collapse-body';
      const nodes = Array.from(card.childNodes).filter((node) => node !== h4);
      nodes.forEach((node) => body.appendChild(node));
      card.appendChild(body);
    });

    const step2 = Array.from(document.querySelectorAll('.step2-divider'))[0];
    if (step2 && !step2.id) step2.id = 'step2InputArea';
  }

  function injectAfterStep1(raw) {
    injectStyles();
    makeBrandHome();
    latestRaw = raw;
    const rs = document.getElementById('resultsSection');
    if (!rs || rs.querySelector('#caseStatusDashboard')) return;
    const firstVerdict = rs.querySelector('.verdict');
    if (!firstVerdict) return;
    firstVerdict.insertAdjacentHTML('beforebegin', renderQuickNav());
    firstVerdict.insertAdjacentHTML('afterend', renderStatusDashboard(raw) + renderVirtualBid(raw));
    enhanceLongCards();
    setTimeout(() => window.updateVirtualBid?.(), 0);
  }

  function boot() {
    injectStyles();
    makeBrandHome();
    enhanceLongCards();
  }

  const wait = setInterval(() => {
    if (typeof window.renderStep1 === 'function') {
      clearInterval(wait);
      const originalRenderStep1 = window.renderStep1;
      window.renderStep1 = function patchedRenderStep1(raw, elapsed) {
        originalRenderStep1(raw, elapsed);
        injectAfterStep1(raw);
      };
    }
  }, 50);

  const observer = new MutationObserver(() => {
    makeBrandHome();
    enhanceLongCards();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
