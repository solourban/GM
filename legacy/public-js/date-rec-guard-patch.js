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

  function injectGuardStyles() {
    if (document.getElementById('dateRecGuardPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'dateRecGuardPatchStyles';
    style.textContent = `
      .date-rec-actions button[disabled] { opacity:.55; cursor:not-allowed; }
      .date-rec-debug { max-height:300px; overflow:auto; }
      .date-rec-deploy-warn { margin-top:10px; padding:10px 12px; border-radius:12px; background:rgba(180,35,24,.16); border:1px solid rgba(180,35,24,.28); color:#fecaca; font-size:12.5px; line-height:1.55; }
      .date-rec-warn b, .date-rec-deploy-warn b { color:#fff2c7; }
    `;
    document.head.appendChild(style);
  }

  function resultItem(item, idx) {
    const caseNo = cleanCaseNo(item.caseNo);
    const court = stripHtml(item.court || '-');
    const cls = item.decision === '상위후보' ? 'good' : item.decision === '검토' ? 'warn' : 'basic';
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
          <div class="date-rec-score-note">점수근거: ${esc((item.reasons || []).slice(0, 4).join(' · ') || '최저가율·유찰횟수·용도 기준')}</div>
        </div>
        <button onclick="copyDateRecCase('${esc(court)}', '${esc(caseNo)}')">사건 복사</button>
      </div>
    `;
  }

  window.lookupDateRecommendations = async function guardedLookupDateRecommendations() {
    injectGuardStyles();
    const status = document.getElementById('dateRecStatus');
    const list = document.getElementById('dateRecList');
    const debug = document.getElementById('dateRecDebug');
    let btn = document.getElementById('dateRecLookupBtn');
    if (!btn) {
      btn = [...document.querySelectorAll('.date-rec-actions button')].find((b) => b.textContent.includes('추천 후보 조회'));
      if (btn) btn.id = 'dateRecLookupBtn';
    }

    const requestedCourt = document.getElementById('dateRecCourt')?.value || '서울중앙';
    const qs = new URLSearchParams({
      court: requestedCourt,
      start: document.getElementById('dateRecStart')?.value || '',
      end: document.getElementById('dateRecEnd')?.value || '',
      usage: document.getElementById('dateRecUsage')?.value || 'all',
      maxBidRate: document.getElementById('dateRecRate')?.value || '1',
      limit: '20',
      _: String(Date.now()),
    });

    if (status) status.textContent = '매각기일 목록 API 조회 중...';
    if (list) list.innerHTML = '';
    if (debug) debug.textContent = '';
    if (btn) btn.disabled = true;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);

    try {
      const res = await fetch(`/api/recommendations/by-date?${qs.toString()}`, { cache: 'no-store', signal: controller.signal });
      const data = await res.json();
      if (debug) debug.textContent = JSON.stringify(data, null, 2);

      const engine = data?.debug?.engine || 'unknown';
      if (!String(engine).includes('v4')) {
        if (status) {
          status.innerHTML = `서버 배포 확인 필요: 현재 매각기일 엔진이 <b>${esc(engine)}</b>입니다.<br>Railway에서 최신 배포/재시작 후 다시 조회하세요. 기대값은 <b>v4-court-filter-variants</b> 계열입니다.`;
        }
        if (list) {
          list.innerHTML = '<div class="date-rec-deploy-warn">프론트는 최신 보정 패치가 적용됐지만, 서버 API가 아직 구버전으로 응답 중입니다. Railway Deployments에서 최신 커밋 배포 성공 여부를 확인해야 합니다.</div>';
        }
        return;
      }

      if (!res.ok || !data.ok || data.verified === false) {
        const observed = data?.debug?.observedCourtCodes?.length ? `<br>응답 법원코드: <b>${esc(data.debug.observedCourtCodes.join(', '))}</b>` : '';
        if (status) status.innerHTML = `목록 조회 실패: ${esc(data.error || '검증 가능한 매각기일 목록이 없습니다.')}${observed}<br>진단 원문을 열어 rawCourtCodes / courtCodeMismatches를 확인하세요.`;
        return;
      }

      const safeItems = (data.items || []).filter((item) => cleanCaseNo(item.caseNo));
      if (status) status.textContent = `${data.court} · ${data.start}~${data.end} · 검증 후보 ${safeItems.length}건`;
      if (!safeItems.length) {
        if (list) list.innerHTML = '<div class="date-rec-warn">검증 가능한 후보가 없습니다. 법원명이 섞였거나 사건번호 형식이 불명확한 결과는 노출하지 않았습니다. 진단 원문을 확인하세요.</div>';
        return;
      }
      if (list) list.innerHTML = safeItems.map(resultItem).join('');
    } catch (e) {
      if (status) status.textContent = e.name === 'AbortError' ? '조회 시간이 길어 중단했습니다. 기간을 줄이거나 잠시 후 다시 시도하세요.' : `조회 중 오류: ${e.message}`;
    } finally {
      clearTimeout(timer);
      if (btn) btn.disabled = false;
    }
  };

  function markButton() {
    injectGuardStyles();
    const btn = [...document.querySelectorAll('.date-rec-actions button')].find((b) => b.textContent.includes('추천 후보 조회'));
    if (btn && !btn.id) btn.id = 'dateRecLookupBtn';
  }

  document.addEventListener('DOMContentLoaded', markButton);
  setTimeout(markButton, 500);
  window.GM?.patches?.register?.('date-rec-guard', { version: 'v1-deploy-diagnostics' });
})();
