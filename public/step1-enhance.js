(() => {
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

  function compactKrw(n) {
    const num = Number(n || 0);
    if (!num) return '-';
    const eok = Math.floor(num / 100000000);
    const man = Math.floor((num % 100000000) / 10000);
    const parts = [];
    if (eok) parts.push(`${eok}억`);
    if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
    return (parts.join(' ') || '0') + '원';
  }

  function injectStyles() {
    if (document.getElementById('step1EnhanceStyles')) return;
    const style = document.createElement('style');
    style.id = 'step1EnhanceStyles';
    style.textContent = `
      .brand { cursor:pointer; user-select:none; }
      .brand:hover .brand-text h1 { text-decoration: underline; text-underline-offset: 3px; }
      .step-dashboard { border-left: 3px solid var(--accent); }
      .dash-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:12px; margin-top:14px; }
      .dash-box { background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:14px; }
      .dash-box .k { color:var(--ink-3); font-size:12px; margin-bottom:4px; }
      .dash-box .v { font-family:var(--font-serif); font-size:18px; font-weight:800; line-height:1.35; }
      .dash-box .s { color:var(--ink-3); font-size:12px; margin-top:4px; }
      .dash-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
      .dash-link, .dash-button { display:inline-flex; align-items:center; justify-content:center; gap:6px; border:1px solid var(--line); background:#fff; color:var(--ink); border-radius:10px; padding:9px 12px; text-decoration:none; font-weight:700; font-size:13px; cursor:pointer; }
      .dash-link.primary, .dash-button.primary { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
      .auction-flow { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; align-items:stretch; }
      .flow-node { flex:1; min-width:160px; background:#fff; border:1px solid var(--line); border-radius:12px; padding:12px; }
      .flow-node .label { color:var(--ink-3); font-size:12px; }
      .flow-node .value { font-family:var(--font-serif); font-size:20px; font-weight:800; }
      .flow-arrow { display:flex; align-items:center; color:var(--ink-3); font-weight:800; }
      .virtual-bid-panel { display:none; margin-top:14px; background:#fff; border:1px solid var(--line); border-radius:12px; padding:14px; }
      .virtual-bid-panel.open { display:block; }
      .virtual-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:10px; align-items:end; }
      .virtual-row label { display:flex; flex-direction:column; gap:4px; color:var(--ink-3); font-size:12px; font-weight:600; }
      .virtual-row input { border:1px solid var(--line); border-radius:9px; padding:10px; color:var(--ink); background:var(--bg); }
      .virtual-result { margin-top:12px; }
      .collapse-toggle { float:right; border:1px solid var(--line); background:#fff; border-radius:8px; padding:5px 8px; font-size:12px; cursor:pointer; color:var(--ink-3); }
      .subcard.collapsed > :not(h4) { display:none !important; }
      .subcard.compact-list .rights-table tbody tr:nth-child(n+7) { display:none; }
      .subcard.compact-list.expanded .rights-table tbody tr { display:table-row; }
      .status-missing { color:var(--warn); font-weight:700; }
    `;
    document.head.appendChild(style);
  }

  function rowMapFromBasicCard() {
    const map = {};
    document.querySelectorAll('.basic-table tr').forEach((tr) => {
      const th = tr.querySelector('th')?.textContent?.trim();
      const td = tr.querySelector('td')?.textContent?.trim();
      if (th) map[th] = td || '';
    });
    return map;
  }

  function propertyAddress() {
    const h3 = document.querySelector('#resultsSection .verdict h3');
    return String(h3?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function mapLinks(address) {
    const q = encodeURIComponent(address);
    return `
      <a class="dash-link primary" target="_blank" rel="noopener" href="https://map.kakao.com/link/search/${q}">🗺 카카오지도</a>
      <a class="dash-link" target="_blank" rel="noopener" href="https://map.naver.com/p/search/${q}">네이버지도</a>
    `;
  }

  function renderDashboard(data) {
    const address = data['소재지'] || propertyAddress();
    const appraisal = parseKrw(data['감정평가액'] || data['감정가']);
    const minBid = parseKrw(data['최저매각가격'] || data['최저가']);
    const failCount = String(data['유찰횟수'] || '-').replace(/[^0-9]/g, '') || '-';
    const depositRateText = data['입찰보증금율'] || data['입찰보증금'] || '10%';
    const depositRate = Number(String(depositRateText).replace(/[^0-9.]/g, '')) || 10;
    const deposit = minBid ? Math.round(minBid * depositRate / 100) : 0;
    const bidRate = appraisal && minBid ? (minBid / appraisal * 100) : 0;
    const discount = appraisal && minBid ? appraisal - minBid : 0;
    const nextDate = data['매각기일'] || data['입찰기일'] || '-';
    const status = data['종국결과'] || data['진행상태'] || '-';

    return `
      <div class="subcard step-dashboard" id="stepStatusDashboard">
        <h4>📌 사건 현황 요약</h4>
        <p class="muted">기본정보를 그냥 표로만 보지 않고, 입찰 판단에 필요한 현재 상태·일정·가격흐름·현장확인 링크로 재정리했습니다.</p>
        <div class="dash-grid">
          <div class="dash-box"><div class="k">진행상태</div><div class="v">${esc(status)}</div><div class="s">종국/미종국 여부</div></div>
          <div class="dash-box"><div class="k">다음 매각기일</div><div class="v">${esc(nextDate)}</div><div class="s">입찰 일정 확인</div></div>
          <div class="dash-box"><div class="k">현재 최저가율</div><div class="v">${bidRate ? bidRate.toFixed(1) + '%' : '-'}</div><div class="s">감정가 대비 ${esc(failCount)}회 유찰</div></div>
          <div class="dash-box"><div class="k">필요 입찰보증금</div><div class="v">${compactKrw(deposit)}</div><div class="s">최저가 × ${esc(depositRateText)}</div></div>
        </div>
        <div class="auction-flow">
          <div class="flow-node"><div class="label">감정가</div><div class="value">${compactKrw(appraisal)}</div></div>
          <div class="flow-arrow">→</div>
          <div class="flow-node"><div class="label">현재 최저가</div><div class="value">${compactKrw(minBid)}</div></div>
          <div class="flow-arrow">→</div>
          <div class="flow-node"><div class="label">가격 하락폭</div><div class="value">${compactKrw(discount)}</div></div>
        </div>
        <div class="dash-actions">
          ${address ? mapLinks(address) : ''}
          <button class="dash-button" onclick="window.toggleVirtualBidPanel()">🧾 가상 입찰표 작성</button>
        </div>
        <div class="virtual-bid-panel" id="virtualBidPanel">
          <div class="virtual-row">
            <label>입찰자명 <input id="virtualBidder" placeholder="예: 홍길동"></label>
            <label>입찰금액 <input id="virtualBidAmount" type="number" value="${minBid}" oninput="window.updateVirtualBid()"></label>
            <label>보증금률 % <input id="virtualDepositRate" type="number" value="${depositRate}" step="1" oninput="window.updateVirtualBid()"></label>
            <label>예상 보증금 <input id="virtualDeposit" readonly></label>
          </div>
          <div class="virtual-result note" id="virtualBidResult"></div>
        </div>
      </div>
    `;
  }

  function renderAdditionalStatus(data) {
    const address = data['소재지'] || propertyAddress();
    const appraisal = parseKrw(data['감정평가액'] || data['감정가']);
    const minBid = parseKrw(data['최저매각가격'] || data['최저가']);
    const bidRate = appraisal && minBid ? (minBid / appraisal * 100) : 0;
    return `
      <div class="subcard" id="moreStatusCard">
        <h4>🏙 지역·물건 현황</h4>
        <div class="dash-grid">
          <div class="dash-box"><div class="k">주소</div><div class="v" style="font-size:15px">${esc(address || '-')}</div><div class="s">지도 링크로 주변 상권·도로·역세권 확인</div></div>
          <div class="dash-box"><div class="k">물건종별</div><div class="v">${esc(data['물건종별'] || '-')}</div><div class="s">주거/상가/토지 등</div></div>
          <div class="dash-box"><div class="k">담당계</div><div class="v">${esc(data['담당계'] || '-')}</div><div class="s">집행관실 전화: ${esc(data['집행관실전화'] || '-')}</div></div>
          <div class="dash-box"><div class="k">낙찰가율 참고</div><div class="v">${bidRate ? bidRate.toFixed(1) + '%' : '-'}</div><div class="s">실제 입찰자 수는 매각결과 후 별도 확인</div></div>
        </div>
        <div class="note warn-note">감정평가 세부내역·건축물대장·실거래가는 아직 자동 연동 전입니다. 다음 패치에서는 수동 입력형 시세검증 카드로 먼저 붙이는 게 안전합니다.</div>
      </div>
    `;
  }

  function makeCardCollapsible(card, collapsed = false, compactList = false) {
    if (!card || card.dataset.collapseReady) return;
    const h4 = card.querySelector('h4');
    if (!h4) return;
    card.dataset.collapseReady = '1';
    if (compactList) card.classList.add('compact-list');
    if (collapsed) card.classList.add('collapsed');
    const btn = document.createElement('button');
    btn.className = 'collapse-toggle';
    btn.type = 'button';
    btn.textContent = collapsed ? '펼치기' : '접기';
    btn.onclick = () => {
      if (compactList && !card.classList.contains('expanded') && !card.classList.contains('collapsed')) {
        card.classList.add('expanded');
        btn.textContent = '접기';
        return;
      }
      card.classList.toggle('collapsed');
      btn.textContent = card.classList.contains('collapsed') ? '펼치기' : '접기';
    };
    h4.appendChild(btn);
  }

  function enhanceStepOne() {
    injectStyles();
    const rs = document.getElementById('resultsSection');
    if (!rs || !rs.querySelector('.verdict.ok')) return;
    if (document.getElementById('stepStatusDashboard')) return;

    const data = rowMapFromBasicCard();
    const autoInfoCard = [...rs.querySelectorAll('.subcard')].find((card) => card.textContent.includes('자동 수집된 사건 정보'));
    if (autoInfoCard) {
      autoInfoCard.insertAdjacentHTML('beforebegin', renderDashboard(data) + renderAdditionalStatus(data));
    }

    const interestCard = [...rs.querySelectorAll('.subcard')].find((card) => card.textContent.includes('이해관계인'));
    makeCardCollapsible(autoInfoCard, false, false);
    makeCardCollapsible(interestCard, false, true);
    window.updateVirtualBid?.();
  }

  window.toggleVirtualBidPanel = function toggleVirtualBidPanel() {
    const panel = document.getElementById('virtualBidPanel');
    if (!panel) return;
    panel.classList.toggle('open');
    window.updateVirtualBid?.();
  };

  window.updateVirtualBid = function updateVirtualBid() {
    const amount = parseKrw(document.getElementById('virtualBidAmount')?.value);
    const rate = Number(document.getElementById('virtualDepositRate')?.value || 10);
    const deposit = Math.round(amount * rate / 100);
    const depositInput = document.getElementById('virtualDeposit');
    const result = document.getElementById('virtualBidResult');
    if (depositInput) depositInput.value = krw(deposit);
    if (result) {
      result.innerHTML = `입찰금액 <b>${krw(amount)}</b> 기준 입찰보증금은 <b>${krw(deposit)}</b>입니다. 실제 입찰표 작성 전 사건번호·법원·매각기일·보증금액을 원본 공고와 대조하세요.`;
    }
  };

  function boot() {
    injectStyles();
    document.querySelectorAll('.brand').forEach((brand) => {
      if (brand.dataset.homeReady) return;
      brand.dataset.homeReady = '1';
      brand.title = '홈으로';
      brand.addEventListener('click', () => { window.location.href = '/'; });
    });
    enhanceStepOne();
  }

  const observer = new MutationObserver(() => enhanceStepOne());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      boot();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    boot();
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
