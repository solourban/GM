function formatMoney(n) {
  if (!n) return '-';
  const 억 = Math.floor(n / 100_000_000);
  const 만 = Math.floor((n % 100_000_000) / 10_000);
  const parts = [];
  if (억) parts.push(`${억}억`);
  if (만) parts.push(`${만.toLocaleString('ko-KR')}만`);
  return (parts.join(' ') || '0') + '원';
}

document.getElementById('btnAnalyze').onclick = async () => {
  const saYear = document.getElementById('saYear').value.trim();
  const saSer = document.getElementById('saSer').value.trim();
  const jiwonNm = document.getElementById('jiwonNm').value;
  const region = document.getElementById('region').value;
  const rs = document.getElementById('resultsSection');

  if (!saSer) { alert('사건번호를 입력하세요'); return; }

  rs.innerHTML = `
    <div class="loading-card">
      <div class="spinner"></div>
      <p>대법원 경매정보에서 데이터를 가져오는 중...</p>
      <p class="muted">보통 2~5초</p>
    </div>`;

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saYear, saSer, jiwonNm, region })
    });
    const data = await res.json();
    if (!res.ok) {
      renderError(data);
      return;
    }
    renderReport(data.report, data.elapsed);
  } catch (e) {
    rs.innerHTML = `<div class="error-card"><h3>❌ 요청 실패</h3><p>${e.message}</p></div>`;
  }
};

document.getElementById('saSer').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btnAnalyze').click();
});

function renderError(data) {
  const rs = document.getElementById('resultsSection');
  const dbg = data.debug || {};
  rs.innerHTML = `
    <div class="error-card">
      <h3>❌ 분석 실패</h3>
      <p>${data.error || '알 수 없는 에러'}</p>
    </div>
    <div class="subcard">
      <h4>🔍 디버그 정보</h4>
      <pre style="background:#0B0F14; color:#E8F3EC; padding:20px; border-radius:10px; font-size:12px; overflow:auto;">${(dbg.steps || []).join('\n')}</pre>
    </div>
  `;
}

function renderReport(report, elapsed) {
  const rs = document.getElementById('resultsSection');
  const verdictLabel = { ok: '양호', warn: '주의', danger: '위험' }[report.risk.level];
  const verdictDesc = {
    ok: '권리관계가 깨끗한 물건입니다.',
    warn: '주의해야 할 요소가 있습니다.',
    danger: '입찰 전 반드시 전문가 검토가 필요합니다.',
  }[report.risk.level];

  const daehang = report.tenants.filter(t => t.daehang === '있음').length;
  const inheritCount = report.rights.filter(r => r.status === '인수').length;
  const extinctCount = report.rights.filter(r => r.status === '소멸').length;

  rs.innerHTML = `
    <div class="verdict ${report.risk.level}">
      <span class="verdict-badge">${report.risk.level === 'ok' ? '✓' : '⚠'} 종합 · ${verdictLabel}</span>
      <h3>${report.basic['소재지'] || report.case}</h3>
      <p>${verdictDesc}</p>
      <div class="verdict-stats">
        <div class="stat"><div class="k">감정가</div><div class="v">${report.basic['감정평가액'] || '-'}</div></div>
        <div class="stat"><div class="k">최저매각가</div><div class="v">${report.basic['최저매각가격'] || '-'}</div></div>
        <div class="stat"><div class="k">유찰</div><div class="v">${report.basic['유찰횟수'] || '-'}</div></div>
        <div class="stat"><div class="k">매각기일</div><div class="v" style="font-size:16px">${report.basic['매각기일'] || '-'}</div></div>
      </div>
      <p class="muted" style="margin-top:12px">데이터 수집 소요: ${elapsed}</p>
    </div>

    ${Object.keys(report.basic).length > 0 ? `
      <div class="subcard">
        <h4>📋 사건 기본정보</h4>
        <table class="basic-table"><tbody>
          ${Object.entries(report.basic).filter(([k,v]) => v).map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}
        </tbody></table>
      </div>
    ` : ''}

    ${report.interested && report.interested.length > 0 ? `
      <div class="subcard">
        <h4>👥 이해관계인 (${report.interested.length}명)</h4>
        <table class="rights-table">
          <thead><tr><th>구분</th><th>이름</th></tr></thead>
          <tbody>
            ${report.interested.map(p => `
              <tr>
                <td><span class="tag ${
                  p.type === '채권자' ? 'malso' :
                  p.type === '임차인' ? 'inherit' :
                  p.type === '채무자겸소유자' || p.type === '채무자' ? 'warn-tag' :
                  'extinct'
                }">${p.type}</span></td>
                <td>${p.name}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}

    ${report.schedule && report.schedule.length > 0 ? `
      <div class="subcard">
        <h4>📅 기일 내역 (${report.schedule.length}건)</h4>
        <table class="rights-table">
          <thead><tr><th>기일</th><th>시간</th><th>장소</th><th>종류</th><th>결과</th><th style="text-align:right">최저가</th></tr></thead>
          <tbody>
            ${report.schedule.map(row => `
              <tr>
                <td>${row[0] || '-'}</td>
                <td>${row[1] || '-'}</td>
                <td>${row[2] || '-'}</td>
                <td>${row[3] || '-'}</td>
                <td><span class="tag ${row[4] === '유찰' ? 'warn-tag' : row[4] === '매각' ? 'malso' : 'extinct'}">${row[4] || '-'}</span></td>
                <td style="text-align:right">${row[5] || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}

    <div class="subcard note warn-note">
      <b>⚠️ 제한사항 안내</b><br>
      현재 대법원 API에서 기본정보·기일·이해관계인까지만 자동 조회됩니다.<br>
      <b>말소기준권리·대항력·배당 분석</b>은 등기부등본과 매각물건명세서 정보가 필요합니다 (추후 연동 예정).<br>
      전체 분석은 <a href="https://www.courtauction.go.kr/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ159M00.xml" target="_blank">대법원 경매정보</a>의 매각물건명세서·감정평가서를 직접 확인하세요.
    </div>
  `;
}
