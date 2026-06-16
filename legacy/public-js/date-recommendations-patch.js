(() => {
  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function stripHtml(value) {
    return String(value || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanCaseNo(value) {
    const m = stripHtml(value).match(/(20\d{2})\s*타경\s*(\d{1,10})/);
    return m ? `${m[1]}타경${m[2]}` : '';
  }

  function courtStem(value) {
    return stripHtml(value)
      .replace(/지방법원|지원|법원|본원|대한민국|서울특별시|경기도|충청남도|충청북도|전라남도|전라북도|경상남도|경상북도|강원도|특별자치도|특별자치시/g, '')
      .replace(/\s+/g, '')
      .trim();
  }

  function validClientItem(item, requestedCourt) {
    const caseNo = cleanCaseNo(item.caseNo);
    if (!caseNo) return false;
    const req = courtStem(requestedCourt || '');
    const got = courtStem(item.court || '');
    if (req && got && !req.includes(got) && !got.includes(req)) return false;
    return true;
  }

  function krw(n) {
    const num = Number(n || 0);
    if (!num) return '-';
    const eok = Math.floor(num / 100000000);
    const man = Math.floor((num % 100000000) / 10000);
    const parts = [];
    if (eok) parts.push(`${eok}억`);
    if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
    return `${parts.join(' ') || '0'}원`;
  }

  function ymdInput(days = 0) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function injectStyles() {
    if (document.getElementById('dateRecommendationsStyles')) return;
    const style = document.createElement('style');
    style.id = 'dateRecommendationsStyles';
    style.textContent = `
      .date-rec-card { margin:18px auto; border:1px solid rgba(246,245,241,.18); border-radius:20px; padding:18px; background:rgba(246,245,241,.08); color:#F6F5F1; max-width:920px; width:100%; }
      .date-rec-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; }
      .date-rec-head h3 { margin:0 0 6px; color:var(--accent-ink); font-family:var(--font-serif); font-size:21px; }
      .date-rec-head p { margin:0; color:rgba(246,245,241,.68); font-size:13px; line-height:1.55; }
      .date-score-help { margin-top:10px; padding:10px 12px; border-radius:12px; border:1px solid rgba(244,233,199,.22); background:rgba(244,233,199,.08); color:rgba(246,245,241,.82); font-size:12.5px; line-height:1.55; }
      .date-score-help b { color:var(--accent-ink); }
      .date-rec-form { display:grid; grid-template-columns:repeat(auto-fit,minmax(145px,1fr)); gap:10px; margin-top:14px; }
      .date-rec-form label { display:flex; flex-direction:column; gap:5px; color:rgba(246,245,241,.68); font-size:12px; font-weight:800; }
      .date-rec-form input, .date-rec-form select { background:rgba(246,245,241,.12); border:1px solid rgba(246,245,241,.2); color:#F6F5F1; border-radius:11px; padding:10px 11px; }
      .date-rec-form option { color:#1c1812; }
      .date-rec-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; align-items:center; }
      .date-rec-actions button { background:var(--accent-ink); color:var(--accent); border:none; border-radius:10px; padding:10px 13px; font-weight:900; cursor:pointer; }
      .date-rec-actions button.secondary { background:rgba(246,245,241,.1); color:#F6F5F1; border:1px solid rgba(246,245,241,.2); }
      .date-rec-status { margin-top:10px; color:rgba(246,245,241,.72); font-size:13px; line-height:1.55; }
      .date-rec-list { display:grid; gap:10px; margin-top:14px; }
      .date-rec-item { display:grid; grid-template-columns:102px 1fr auto; gap:12px; align-items:center; background:#fff; color:var(--ink); border:1px solid var(--line); border-radius:15px; padding:13px; }
      .date-rec-scorebox { text-align:center; }
      .date-rec-scorelabel { color:var(--ink-3); font-size:11px; font-weight:850; line-height:1.1; }
      .date-rec-score { font-family:var(--font-serif); font-size:27px; font-weight:900; line-height:1.05; margin-top:4px; }
      .date-rec-scoreunit { color:var(--ink-3); font-size:11px; font-weight:800; margin-top:2px; }
      .date-rec-title { font-weight:900; overflow-wrap:anywhere; }
      .date-rec-meta { color:var(--ink-3); font-size:12.5px; line-height:1.55; margin-top:3px; overflow-wrap:anywhere; }
      .date-rec-pills { display:flex; gap:6px; flex-wrap:wrap; margin-top:7px; }
      .date-rec-pill { display:inline-block; border-radius:999px; padding:4px 9px; font-size:11px; font-weight:900; white-space:nowrap; }
      .date-rec-pill.good { background:var(--ok-bg); color:var(--ok); }
      .date-rec-pill.warn { background:var(--warn-bg); color:var(--warn); }
      .date-rec-pill.danger { background:var(--danger-bg); color:var(--danger); }
      .date-rec-pill.basic { background:var(--bg); color:var(--ink-3); border:1px solid var(--line); }
      .date-rec-score-note { margin-top:7px; color:var(--ink-3); font-size:11.5px; line-height:1.45; }
      .date-rec-item button { background:var(--accent); color:var(--accent-ink); border:none; border-radius:10px; padding:10px 12px; font-weight:900; cursor:pointer; }
      .date-rec-debug { margin-top:10px; white-space:pre-wrap; overflow-wrap:anywhere; background:rgba(0,0,0,.2); color:#F4E9C7; border-radius:12px; padding:10px; font-size:11px; display:none; }
      .date-rec-warn { margin-top:10px; padding:10px 12px; border-radius:12px; background:rgba(245,158,11,.16); border:1px solid rgba(245,158,11,.28); color:#fde68a; font-size:12.5px; line-height:1.55; }
      @media (max-width:720px) { .date-rec-item { grid-template-columns:1fr; } .date-rec-scorebox { text-align:left; } .date-rec-actions button, .date-rec-item button { width:100%; } }
    `;
    document.head.appendChild(style);
  }

  function findMount() {
    return document.querySelector('.today-dashboard-card') || document.querySelector('.search-box') || document.querySelector('main') || document.body;
  }

  function renderDateRecommendationsCard() {
    injectStyles();
    if (document.querySelector('.date-rec-card')) return;
    const mount = findMount();
    if (!mount) return;
    mount.insertAdjacentHTML('afterend', `
      <div class="date-rec-card">
        <div class="date-rec-head">
          <div>
            <h3>📅 매각기일 기준 추천 후보</h3>
            <p>저장 전에도 법원·날짜 기준으로 오늘/이번 주 볼 만한 후보를 찾기 위한 실험 기능입니다. 대법원 목록 API 연결 상태를 함께 진단합니다.</p>
            <div class="date-score-help">
              <b>추천점수는 권리분석 전 1차 점수입니다.</b><br>
              감정가 대비 최저가율, 유찰횟수, 물건 용도만 반영합니다. 등기·임차인·인수권리·시세·자금은 사건 상세조회 후 별도로 확인해야 합니다.
            </div>
          </div>
        </div>
        <div class="date-rec-form">
          <label>법원 <input id="dateRecCourt" value="서울중앙" placeholder="예: 서울중앙, 수원, 천안"></label>
          <label>시작일 <input id="dateRecStart" type="date" value="${ymdInput(0)}"></label>
          <label>종료일 <input id="dateRecEnd" type="date" value="${ymdInput(7)}"></label>
          <label>용도 <select id="dateRecUsage"><option value="all">전체</option><option value="20100">주거형</option><option value="20104">아파트</option></select></label>
          <label>최저가율 상한 <select id="dateRecRate"><option value="1">전체</option><option value="0.85">85% 이하</option><option value="0.7" selected>70% 이하</option><option value="0.55">55% 이하</option></select></label>
        </div>
        <div class="date-rec-actions">
          <button onclick="lookupDateRecommendations()">추천 후보 조회</button>
          <button class="secondary" onclick="toggleDateRecDebug()">진단 원문</button>
        </div>
        <div id="dateRecStatus" class="date-rec-status">조건을 선택하고 추천 후보 조회를 누르세요.</div>
        <div id="dateRecList" class="date-rec-list"></div>
        <pre id="dateRecDebug" class="date-rec-debug"></pre>
      </div>
    `);
    window.GM?.patches?.register?.('date-recommendations-ui', { version: 'v3-validated-results' });
  }

  function scoreBreakdownText(item) {
    const reasons = item.reasons || [];
    if (reasons.length) return reasons.slice(0, 4).join(' · ');
    return '최저가율·유찰횟수·용도 기준';
  }

  function resultItem(item, idx) {
    const cls = item.decision === '상위후보' ? 'good' : item.decision === '검토' ? 'warn' : 'basic';
    const caseNo = cleanCaseNo(item.caseNo);
    const court = stripHtml(item.court || '-');
    return `
      <div class="date-rec-item">
        <div class="date-rec-scorebox">
          <div class="date-rec-scorelabel">추천점수</div>
          <div class="date-rec-score ${cls === 'good' ? 'ok' : ''}">${item.score || 0}</div>
          <div class="date-rec-scoreunit">점 / 100</div>
          <span class="date-rec-pill ${cls}" style="margin-top:7px">#${idx + 1} ${esc(item.decision || '보류')}</span>
        </div>
        <div>
          <div class="date-rec-title">${esc(court)} ${esc(caseNo || '사건번호 확인필요')}</div>
          <div class="date-rec-meta">${esc(stripHtml(item.address || '주소 정보 없음'))}</div>
          <div class="date-rec-meta">매각기일 ${esc(stripHtml(item.saleDate || '-'))} · ${esc(stripHtml(item.usage || '-'))} · 유찰 ${esc(item.failCount ?? '-')}회</div>
          <div class="date-rec-meta">감정가 ${krw(item.appraisal)} · 최저가 ${krw(item.minBid)} · 안전마진 ${krw(item.margin)} · 최저가율 ${item.bidRate ? Math.round(item.bidRate * 100) : '-'}%</div>
          <div class="date-rec-score-note">점수근거: ${esc(scoreBreakdownText(item))}</div>
          <div class="date-rec-pills">${(item.reasons || []).slice(0, 4).map((r) => `<span class="date-rec-pill basic">${esc(r)}</span>`).join('')}</div>
        </div>
        <button onclick="copyDateRecCase('${esc(court)}', '${esc(caseNo)}')">사건 복사</button>
      </div>
    `;
  }

  window.lookupDateRecommendations = async function() {
    const status = document.getElementById('dateRecStatus');
    const list = document.getElementById('dateRecList');
    const debug = document.getElementById('dateRecDebug');
    const requestedCourt = document.getElementById('dateRecCourt')?.value || '서울중앙';
    const qs = new URLSearchParams({
      court: requestedCourt,
      start: document.getElementById('dateRecStart')?.value || '',
      end: document.getElementById('dateRecEnd')?.value || '',
      usage: document.getElementById('dateRecUsage')?.value || 'all',
      maxBidRate: document.getElementById('dateRecRate')?.value || '1',
      limit: '20',
    });
    status.textContent = '매각기일 목록 API 조회 중...';
    list.innerHTML = '';
    debug.textContent = '';
    try {
      const res = await fetch(`/api/recommendations/by-date?${qs.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      debug.textContent = JSON.stringify(data, null, 2);
      if (!res.ok || !data.ok || data.verified === false) {
        status.innerHTML = `목록 조회 실패: ${esc(data.error || '검증 가능한 매각기일 목록이 없습니다.')}<br>진단 원문을 열어 대법원 목록 API 응답을 확인하세요.`;
        return;
      }
      const safeItems = (data.items || []).filter((item) => validClientItem(item, requestedCourt));
      const rejected = (data.items || []).length - safeItems.length;
      status.textContent = `${data.court} · ${data.start}~${data.end} · 검증 후보 ${safeItems.length}건${rejected ? ` · 제외 ${rejected}건` : ''}`;
      if (!safeItems.length) {
        list.innerHTML = '<div class="date-rec-warn">검증 가능한 후보가 없습니다. 법원명이 섞였거나 사건번호 형식이 불명확한 결과는 노출하지 않았습니다. 진단 원문을 확인하세요.</div>';
        return;
      }
      list.innerHTML = safeItems.map(resultItem).join('');
    } catch (e) {
      status.textContent = `조회 중 오류: ${e.message}`;
    }
  };

  window.toggleDateRecDebug = function() {
    const el = document.getElementById('dateRecDebug');
    if (!el) return;
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
  };

  window.copyDateRecCase = async function(court, caseNo) {
    const clean = cleanCaseNo(caseNo);
    if (!clean) return alert('검증된 사건번호가 없어 복사할 수 없습니다.');
    const text = `${stripHtml(court)} ${clean}`.trim();
    try {
      await navigator.clipboard.writeText(text);
      alert('사건번호를 복사했습니다. 단건 조회 또는 일괄조회에 붙여넣으세요.');
    } catch {
      prompt('아래 사건번호를 복사하세요.', text);
    }
  };

  document.addEventListener('DOMContentLoaded', renderDateRecommendationsCard);
  if (document.body) renderDateRecommendationsCard();
})();
