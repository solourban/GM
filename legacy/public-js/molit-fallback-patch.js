(() => {
  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function parseAmount(value) {
    const n = Number(String(value || '').replace(/[^0-9]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function parseNumber(value) {
    const n = Number(String(value || '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function krwFromMan(value) {
    const man = parseAmount(value);
    if (!man) return '-';
    const eok = Math.floor(man / 10000);
    const rest = man % 10000;
    const parts = [];
    if (eok) parts.push(`${eok}억`);
    if (rest) parts.push(`${rest.toLocaleString('ko-KR')}만`);
    return parts.join(' ') + '원';
  }

  function getRawAddress() {
    const raw = window.currentRaw || window.__lastAuctionRaw || {};
    return raw?.basic?.['소재지'] || raw?.basic?.['주소'] || document.querySelector('.property-address-main')?.textContent || '';
  }

  function getTargetArea() {
    const raw = window.currentRaw || window.__lastAuctionRaw || {};
    const texts = [
      raw?.basic?.['전용면적'],
      raw?.basic?.['면적'],
      raw?.basic?.['건물면적'],
      getRawAddress(),
      document.body?.innerText?.slice(0, 3000),
    ].filter(Boolean).join(' ');
    const m = String(texts).match(/전용\s*([0-9]+(?:\.[0-9]+)?)\s*(?:㎡|m²|m2)/i)
      || String(texts).match(/([0-9]+(?:\.[0-9]+)?)\s*(?:㎡|m²|m2)/i);
    return m ? Number(m[1]) : 0;
  }

  function addressTokens() {
    const address = getRawAddress();
    const dong = (address.match(/([가-힣0-9]+동)/) || [])[1] || '';
    const road = (address.match(/([가-힣0-9]+로\d*길?|[가-힣0-9]+길|[가-힣0-9]+로)/) || [])[1] || '';
    return { address, dong, road };
  }

  function scoreComparable(trade, targetArea, tokens) {
    let score = 0;
    const area = parseNumber(trade.area);
    if (targetArea && area) {
      const diff = Math.abs(area - targetArea) / targetArea;
      if (diff <= 0.1) score += 44;
      else if (diff <= 0.2) score += 32;
      else if (diff <= 0.35) score += 18;
      else score -= 10;
    }
    if (tokens.dong && String(trade.dong || '').includes(tokens.dong.replace(/동$/, ''))) score += 24;
    if (tokens.road && String(trade.roadName || '').includes(tokens.road.replace(/길$/, '').replace(/로$/, ''))) score += 20;
    if (/오피스텔|연립다세대/.test(String(trade.tradeTypeLabel || ''))) score += 8;
    return score;
  }

  function summarizeTrades(trades) {
    const amounts = trades.map((t) => parseAmount(t.dealAmount)).filter(Boolean);
    const avg = amounts.length ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : 0;
    const min = amounts.length ? Math.min(...amounts) : 0;
    const max = amounts.length ? Math.max(...amounts) : 0;
    return { avg, min, max };
  }

  function typePills(data) {
    return `<div class="molit-type-pills">${(data.tradeTypes || []).map((t) => `<span class="molit-pill">${esc(t.label)} ${t.filteredCount}/${t.rawCount}</span>`).join('')}</div>`;
  }

  function renderRows(trades, mode) {
    return trades.map((t) => `
      <tr>
        <td>${esc(t.tradeTypeLabel)}${mode === 'fallback' ? `<br><span class="watch-small">유사도 ${Math.max(0, t.__score || 0)}</span>` : ''}</td>
        <td>${esc(t.dealYear)}.${esc(t.dealMonth)}.${esc(t.dealDay)}</td>
        <td>${esc(t.aptName)}</td>
        <td>${esc(t.area)}</td>
        <td>${esc(t.floor)}</td>
        <td><b>${esc(t.dealAmount)}만원</b>${t.cancelDate ? '<br><span class="watch-small">해제 가능</span>' : ''}</td>
        <td>${esc(t.dong)} / ${esc(t.roadName)}</td>
      </tr>`).join('');
  }

  function renderTradeResult({ data, trades, mode, originalName }) {
    const targetArea = getTargetArea();
    const tokens = addressTokens();
    let sorted = [...trades];
    if (mode === 'fallback') {
      sorted = sorted
        .map((t) => ({ ...t, __score: scoreComparable(t, targetArea, tokens) }))
        .sort((a, b) => b.__score - a.__score || Math.abs(parseNumber(a.area) - targetArea) - Math.abs(parseNumber(b.area) - targetArea));
    }
    const top = sorted.slice(0, mode === 'fallback' ? 25 : 40);
    const summary = summarizeTrades(top);
    const warning = mode === 'exact'
      ? '<div class="molit-match-ok" data-molit-match="strong">정확 건물명 필터 결과입니다. 전용면적·층·도로명까지 확인하세요.</div>'
      : `<div class="molit-match-warning" data-molit-match="fallback">정확 건물명 거래가 없어 <b>주변 참고 거래</b>를 자동으로 보여줍니다. ${targetArea ? `전용 ${targetArea}㎡와 가까운 거래,` : ''} 같은 동/도로명 거래를 위로 정렬했습니다. 시세 3단 시나리오 자동반영은 막습니다.</div>`;
    const label = mode === 'exact' ? '정확 거래' : '주변 참고 거래';

    return `
      ${warning}
      ${typePills(data)}
      <div class="molit-summary">
        <div class="box"><div class="k">표시 기준</div><div class="v">${label}</div></div>
        <div class="box"><div class="k">거래 수</div><div class="v">${top.length}건</div></div>
        <div class="box"><div class="k">평균 거래금액</div><div class="v">${krwFromMan(summary.avg)}</div></div>
        <div class="box"><div class="k">최저 거래금액</div><div class="v">${krwFromMan(summary.min)}</div></div>
        <div class="box"><div class="k">최고 거래금액</div><div class="v">${krwFromMan(summary.max)}</div></div>
      </div>
      ${mode === 'fallback' ? `<div class="note warn-note" style="margin-top:10px">검색한 건물명: <b>${esc(originalName || '-')}</b>. 정확 거래가 없어서 건물명 필터를 제거하고 지역 거래를 비교 대상으로 정렬했습니다.</div>` : ''}
      <div class="molit-table-wrap">
        <table class="molit-table">
          <thead><tr><th>구분</th><th>계약일</th><th>건물명</th><th>전용㎡</th><th>층</th><th>거래금액</th><th>동/도로명</th></tr></thead>
          <tbody>${renderRows(top, mode)}</tbody>
        </table>
      </div>
    `;
  }

  async function fetchTrades({ lawdCd, dealYmd, tradeType, aptName }) {
    const qs = new URLSearchParams({ lawdCd, dealYmd, tradeType });
    if (aptName) qs.set('aptName', aptName);
    const res = await fetch(`/api/molit/trades?${qs.toString()}`);
    const data = await res.json();
    return { res, data };
  }

  window.lookupMolitTrades = async function() {
    const result = document.getElementById('molitResult');
    const lawdCd = document.getElementById('molitLawdCd')?.value.trim();
    const dealYmd = document.getElementById('molitDealYmd')?.value.trim();
    const aptName = document.getElementById('molitAptName')?.value.trim();
    const tradeType = document.getElementById('molitTradeType')?.value || 'auto';
    if (!result) return;
    if (!/^\d{5}$/.test(lawdCd || '')) return result.innerHTML = '<div class="note warn-note">법정동코드 앞 5자리(LAWD_CD)를 입력하세요. 예: 강남구 11680</div>';
    if (!/^\d{6}$/.test(dealYmd || '')) return result.innerHTML = '<div class="note warn-note">계약월은 YYYYMM 6자리로 입력하세요.</div>';

    result.innerHTML = '<div class="note">국토부 실거래가 조회 중... 정확 거래가 없으면 주변 참고 거래까지 자동 확인합니다.</div>';
    try {
      const exact = await fetchTrades({ lawdCd, dealYmd, tradeType, aptName });
      if (!exact.res.ok) return result.innerHTML = `<div class="note danger-note">${esc(exact.data.error || '조회 실패')}</div>`;
      if ((exact.data.trades || []).length) {
        const mode = exact.data.matchQuality === 'strong' ? 'exact' : 'fallback';
        result.innerHTML = renderTradeResult({ data: exact.data, trades: exact.data.trades || [], mode, originalName: aptName });
        return;
      }

      result.innerHTML = '<div class="note">정확 건물명 거래 0건. 같은 지역의 주변 참고 거래를 자동 조회 중...</div>';
      const fallback = await fetchTrades({ lawdCd, dealYmd, tradeType, aptName: '' });
      if (!fallback.res.ok) return result.innerHTML = `<div class="note danger-note">${esc(fallback.data.error || '주변 거래 조회 실패')}</div>`;
      const trades = fallback.data.trades || [];
      if (!trades.length) {
        const typeText = (fallback.data.tradeTypes || exact.data.tradeTypes || []).map((t) => `${t.label} ${t.filteredCount}/${t.rawCount}`).join(' · ');
        result.innerHTML = `<div class="note warn-note">정확 거래와 주변 거래 모두 없습니다. 계약월을 앞뒤로 바꾸거나 거래유형을 전체로 조회하세요.<br>${esc(typeText)}</div>`;
        return;
      }
      result.innerHTML = renderTradeResult({ data: fallback.data, trades, mode: 'fallback', originalName: aptName });
    } catch (e) {
      result.innerHTML = `<div class="note danger-note">실거래가 조회 실패: ${esc(e.message)}</div>`;
    }
  };

  window.GM?.patches?.register?.('molit-fallback', { version: 'v1' });
})();
