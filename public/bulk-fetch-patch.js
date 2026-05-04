(() => {
  const KEY = 'gm_watchlist_v1';

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

  function parseFailCount(value) {
    const n = Number(String(value || '').replace(/[^0-9]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function shortAddress(value) {
    return String(value || '').replace(/\s+/g, ' ').replace(/^[,\s]+/, '').trim();
  }

  function loadCases() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
  function saveCases(items) { localStorage.setItem(KEY, JSON.stringify(items)); }
  function caseKey(item) { return `${item.court || ''}|${item.caseNo || ''}`; }

  function addWatchItem(item) {
    const items = loadCases();
    const key = caseKey(item);
    const idx = items.findIndex((x) => caseKey(x) === key);
    if (idx >= 0) {
      item.id = items[idx].id;
      item.memo = items[idx].memo || item.memo;
      items[idx] = { ...items[idx], ...item, savedAt: new Date().toISOString() };
    } else {
      items.unshift(item);
    }
    saveCases(items.slice(0, 150));
  }

  function isResidential(type) {
    return /아파트|다세대|연립|주거|오피스텔|단독|다가구/.test(String(type || ''));
  }

  function scoreBulkCandidate({ appraisal, minBid, marginRate, failCount, tenantCount, usage, scheduleCount }) {
    if (!appraisal || !minBid) {
      return { decision: '보류', cls: 'warn', memo: '감정가/최저가 확인 필요', score: 0 };
    }

    const bidRate = minBid / appraisal;
    let score = 0;
    const reasons = [];

    if (bidRate <= 0.55) { score += 34; reasons.push('최저가율 55% 이하'); }
    else if (bidRate <= 0.70) { score += 24; reasons.push('최저가율 70% 이하'); }
    else if (bidRate <= 0.85) { score += 12; reasons.push('최저가율 85% 이하'); }
    else { score -= 8; reasons.push('할인폭 작음'); }

    if (failCount >= 3) { score += 18; reasons.push('유찰 3회 이상'); }
    else if (failCount >= 2) { score += 12; reasons.push('유찰 2회 이상'); }
    else if (failCount === 0) { score -= 6; reasons.push('신건/유찰 적음'); }

    if (isResidential(usage)) { score += 10; reasons.push('주거형 물건'); }
    else if (usage) { score -= 4; reasons.push('비주거/용도 확인'); }

    if (tenantCount === 0) { score += 8; reasons.push('임차인 자동조회 없음'); }
    else if (tenantCount === 1) { score -= 6; reasons.push('임차인 1명'); }
    else { score -= 16; reasons.push(`임차인 ${tenantCount}명`); }

    if (!scheduleCount) { score -= 8; reasons.push('기일정보 확인 필요'); }
    if (marginRate <= 0.05) score -= 10;

    let decision = '보류';
    let cls = 'warn';
    if (score >= 48) { decision = '1차후보'; cls = 'good'; }
    else if (score >= 28) { decision = '검토'; cls = 'warn'; }
    else if (bidRate >= 0.92 || score < 8) { decision = '보류'; cls = 'warn'; }

    return { decision, cls, memo: reasons.slice(0, 4).join(' · '), score };
  }

  function summarizeRaw(raw, fallbackCourt) {
    const basic = raw.basic || {};
    const appraisal = parseKrw(basic['감정평가액'] || basic['감정가']);
    const minBid = parseKrw(basic['최저매각가격'] || basic['최저가']);
    const safetyMargin = appraisal && minBid ? appraisal - minBid : 0;
    const marginRate = appraisal ? safetyMargin / appraisal : 0;
    const failCountNumber = parseFailCount(basic['유찰횟수']);
    const tenantCount = (raw.tenants || []).length || 0;
    const usage = basic['물건종별'] || '';
    const scheduleCount = Array.isArray(raw.schedule) ? raw.schedule.length : 0;
    const scored = scoreBulkCandidate({ appraisal, minBid, marginRate, failCount: failCountNumber, tenantCount, usage, scheduleCount });

    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      savedAt: new Date().toISOString(),
      court: raw.court || basic['법원'] || fallbackCourt || '',
      caseNo: raw.caseNo || basic['사건번호'] || '',
      address: shortAddress(basic['소재지'] || ''),
      appraisal,
      minBid,
      failCount: basic['유찰횟수'] || '',
      inherited: 0,
      safetyMargin,
      marginRate,
      maxBid: minBid || 0,
      risk: 'basic',
      daehang: tenantCount,
      inheritCount: 0,
      decision: scored.decision,
      decisionClass: scored.cls,
      memo: `일괄 1차 · ${scored.memo}`,
      bulkScore: scored.score,
      raw,
      source: 'bulk-fetch',
    };
  }

  function normalizeCourtToken(token) {
    const t = String(token || '').trim();
    const map = {
      중앙: '서울중앙', 동부: '서울동부', 서부: '서울서부', 남부: '서울남부', 북부: '서울북부',
      서울중앙: '서울중앙', 서울동부: '서울동부', 서울서부: '서울서부', 서울남부: '서울남부', 서울북부: '서울북부',
      수원: '수원', 천안: '천안', 성남: '성남', 인천: '인천', 부천: '부천', 고양: '고양', 안산: '안산', 안양: '안양', 평택: '평택', 여주: '여주',
      의정부: '의정부', 남양주: '남양주', 대전: '대전', 청주: '청주', 부산: '부산', 부산동부: '부산동부', 부산서부: '부산서부',
      대구: '대구', 대구서부: '대구서부', 울산: '울산', 창원: '창원', 광주: '광주', 전주: '전주', 춘천: '춘천', 제주: '제주'
    };
    return map[t] || t;
  }

  function parseLine(line) {
    const cleaned = String(line || '').replace(/타경/g, ' ').replace(/[,:/|]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) return null;
    const parts = cleaned.split(' ');
    const yearIdx = parts.findIndex((p) => /^20\d{2}$/.test(p));
    if (yearIdx < 0 || yearIdx === 0 || !parts[yearIdx + 1]) return { error: '형식 인식 실패', raw: line };
    const court = normalizeCourtToken(parts.slice(0, yearIdx).join(''));
    const saYear = parts[yearIdx];
    const saSer = String(parts[yearIdx + 1]).replace(/[^0-9]/g, '');
    if (!court || !/^\d{4}$/.test(saYear) || !/^\d+$/.test(saSer)) return { error: '법원/연도/사건번호 확인 필요', raw: line };
    return { jiwonNm: court, saYear, saSer, raw: line };
  }

  function injectStyles() {
    if (document.getElementById('bulkFetchPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'bulkFetchPatchStyles';
    style.textContent = `
      .bulk-card { margin-top:18px; background:rgba(246,245,241,.08); border:1px solid rgba(246,245,241,.18); border-radius:18px; padding:18px; }
      .bulk-card h3 { margin:0 0 8px; color:var(--accent-ink); font-family:var(--font-serif); font-size:18px; }
      .bulk-card p { margin:0 0 12px; color:rgba(246,245,241,.7); font-size:13px; }
      .bulk-card textarea { width:100%; min-height:96px; resize:vertical; background:rgba(246,245,241,.12); border:1px solid rgba(246,245,241,.2); color:#F6F5F1; border-radius:12px; padding:12px; font-family:inherit; }
      .bulk-card textarea::placeholder { color:rgba(246,245,241,.45); }
      .bulk-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:10px; align-items:center; }
      .bulk-actions button { background:var(--accent-ink); color:var(--accent); border:none; border-radius:10px; padding:11px 16px; font-weight:900; cursor:pointer; }
      .bulk-actions .ghost { background:rgba(246,245,241,.1); color:#F6F5F1; border:1px solid rgba(246,245,241,.18); }
      .bulk-status { margin-top:12px; color:rgba(246,245,241,.8); font-size:13px; }
      .bulk-log { margin-top:10px; background:rgba(0,0,0,.18); border-radius:10px; padding:10px; max-height:170px; overflow:auto; font-size:12px; color:#F4E9C7; white-space:pre-wrap; }
    `;
    document.head.appendChild(style);
  }

  function injectBulkCard() {
    injectStyles();
    const box = document.querySelector('.search-box');
    if (!box || document.querySelector('.bulk-card')) return;
    box.insertAdjacentHTML('afterend', `
      <div class="bulk-card">
        <h3>📥 여러 사건번호 일괄 조회</h3>
        <p>여러 줄로 붙여넣으면 기본정보를 순서대로 조회해서 관심사건 비교표에 저장합니다. 판정은 할인폭·유찰·용도·임차인 여부를 보는 1차 필터입니다.</p>
        <textarea id="bulkCases" placeholder="서울중앙 2024 110754\n수원 2024 12345\n천안 2024 67890"></textarea>
        <div class="bulk-actions">
          <button onclick="runBulkFetch()">일괄 조회해서 저장</button>
          <button class="ghost" onclick="document.getElementById('bulkCases').value=''">비우기</button>
        </div>
        <div id="bulkStatus" class="bulk-status"></div>
        <div id="bulkLog" class="bulk-log" style="display:none"></div>
      </div>
    `);
  }

  function appendLog(text) {
    const log = document.getElementById('bulkLog');
    if (!log) return;
    log.style.display = 'block';
    log.textContent += `${text}\n`;
    log.scrollTop = log.scrollHeight;
  }

  window.runBulkFetch = async function() {
    const textarea = document.getElementById('bulkCases');
    const status = document.getElementById('bulkStatus');
    const log = document.getElementById('bulkLog');
    if (!textarea || !status || !log) return;
    log.textContent = '';
    log.style.display = 'none';

    const parsed = textarea.value.split('\n').map(parseLine).filter(Boolean);
    if (!parsed.length) { status.textContent = '붙여넣은 사건이 없습니다.'; return; }

    const valid = parsed.filter((x) => !x.error);
    const invalid = parsed.filter((x) => x.error);
    invalid.forEach((x) => appendLog(`형식 실패: ${x.raw} (${x.error})`));

    status.textContent = `총 ${parsed.length}건 중 ${valid.length}건 조회 시작...`;
    let ok = 0;
    let fail = 0;

    for (let i = 0; i < valid.length; i++) {
      const item = valid[i];
      status.textContent = `${i + 1}/${valid.length} 조회 중: ${item.jiwonNm} ${item.saYear}타경${item.saSer}`;
      try {
        const res = await fetch('/api/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          fail += 1;
          appendLog(`실패: ${item.raw} → ${data.error || '조회 실패'}`);
          continue;
        }
        const summarized = summarizeRaw(data.raw, item.jiwonNm);
        addWatchItem(summarized);
        ok += 1;
        appendLog(`저장: ${data.raw.court || item.jiwonNm} ${data.raw.caseNo} → ${summarized.decision} (${summarized.memo})`);
      } catch (e) {
        fail += 1;
        appendLog(`실패: ${item.raw} → ${e.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    status.textContent = `일괄 조회 완료: 저장 ${ok}건, 실패 ${fail + invalid.length}건`;
    if (typeof window.renderWatchlist === 'function') {
      const rs = document.getElementById('resultsSection');
      if (rs && !rs.innerHTML.trim()) rs.innerHTML = '<div class="subcard"><h4>📂 관심 사건 비교표</h4><p class="muted">일괄 조회 결과입니다.</p></div>';
      window.renderWatchlist();
      document.getElementById('resultsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  document.addEventListener('DOMContentLoaded', injectBulkCard);
  injectBulkCard();
})();
