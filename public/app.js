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
      <p class="muted">최대 30초 소요</p>
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
    renderReport(data.report);
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
      <h4>🔍 디버그 정보 (이 내용을 복사해서 Claude에게 주세요)</h4>
      <div style="background:#0B0F14; color:#E8F3EC; padding:20px; border-radius:10px; font-family:monospace; font-size:12px; line-height:1.6; overflow:auto; max-height:400px;">
        <div><b style="color:#F4E9C7">최종 URL:</b> ${dbg.finalUrl || '-'}</div>
        <div><b style="color:#F4E9C7">페이지 제목:</b> ${dbg.pageTitle || '-'}</div>
        <div><b style="color:#F4E9C7">HTML 크기:</b> ${dbg.htmlLength || 0} 바이트</div>
        <div><b style="color:#F4E9C7">테이블 개수:</b> ${dbg.tableCount || 0}</div>
        <div><b style="color:#F4E9C7">소요시간:</b> ${data.elapsed || '-'}</div>
        <div style="margin-top:14px"><b style="color:#F4E9C7">진행 단계:</b></div>
        <pre style="margin:6px 0; color:#D1CFC5; white-space:pre-wrap;">${(dbg.steps || []).map(s => '  ' + s).join('\n')}</pre>
      </div>

      ${dbg.htmlSample ? `
        <details style="margin-top:16px">
          <summary style="cursor:pointer; font-weight:600; padding:10px; background:var(--bg); border-radius:8px;">
            📄 실제 페이지 HTML 샘플 (클릭해서 펼치기)
          </summary>
          <pre style="background:#0B0F14; color:#E8F3EC; padding:20px; border-radius:10px; font-family:monospace; font-size:11px; line-height:1.5; overflow:auto; max-height:500px; white-space:pre-wrap; word-break:break-all;">${escapeHtml(dbg.htmlSample)}</pre>
        </details>
      ` : ''}

      <button class="btn-copy" onclick="copyDebug()" style="margin-top:14px; padding:10px 20px; background:var(--accent); color:var(--accent-ink); border:none; border-radius:8px; cursor:pointer; font-weight:600;">
        📋 디버그 정보 전체 복사
      </button>
    </div>
  `;

  window._lastDebug = { error: data.error, debug: dbg };
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

window.copyDebug = function() {
  const d = window._lastDebug;
  if (!d) return;
  const text = `
== 디버그 정보 ==
에러: ${d.error}
최종 URL: ${d.debug.finalUrl}
페이지 제목: ${d.debug.pageTitle}
HTML 크기: ${d.debug.htmlLength}
테이블 개수: ${d.debug.tableCount}

== 진행 단계 ==
${(d.debug.steps || []).join('\n')}

== HTML 샘플 ==
${d.debug.htmlSample || '(없음)'}
`.trim();
  navigator.clipboard.writeText(text).then(() => alert('복사됐습니다! Claude에게 붙여넣기 하세요.'));
};

function renderReport(report) {
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
        <div class="stat"><div class="k">인수 권리</div><div class="v ${inheritCount > 0 ? 'danger' : ''}">${inheritCount}건</div></div>
        <div class="stat"><div class="k">소멸 권리</div><div class="v">${extinctCount}건</div></div>
        <div class="stat"><div class="k">대항력 임차인</div><div class="v ${daehang > 0 ? 'danger' : ''}">${daehang}명</div></div>
        <div class="stat"><div class="k">낙찰자 인수금액</div><div class="v ${report.inherited.total > 0 ? 'danger' : 'ok'}">${formatMoney(report.inherited.total)}</div></div>
      </div>
    </div>

    ${Object.keys(report.basic).length > 0 ? `
      <div class="subcard">
        <h4>📋 물건 기본정보</h4>
        <table class="basic-table"><tbody>
          ${Object.entries(report.basic).map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}
        </tbody></table>
      </div>
    ` : ''}

    ${report.malso ? `
      <div class="subcard">
        <h4>⚖ 말소기준권리</h4>
        <p><b>${report.malso.type}</b> · ${report.malso.holder} · 접수 ${report.malso.date} · ${formatMoney(report.malso.amount)}</p>
        <div class="note">이 날짜(<b>${report.malso.date}</b>) 이후에 설정된 권리는 매각으로 소멸됩니다.</div>
      </div>
    ` : ''}

    <div class="subcard">
      <h4>📜 권리 분석 (${report.rights.length}건)</h4>
      <table class="rights-table">
        <thead><tr><th>접수일</th><th>종류</th><th>권리자</th><th style="text-align:right">금액</th><th style="text-align:center">판정</th></tr></thead>
        <tbody>
          ${report.rights.map(r => `
            <tr class="${r.isMalso ? 'malso-row' : ''}">
              <td>${r.date}</td>
              <td>${r.type}${r.isMalso ? '<span class="tag malso"> 말소기준</span>' : ''}</td>
              <td>${r.holder}</td>
              <td style="text-align:right">${formatMoney(r.amount)}</td>
              <td style="text-align:center"><span class="tag ${r.status === '인수' ? 'inherit' : 'extinct'}">${r.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    ${report.tenants.length > 0 ? `
      <div class="subcard">
        <h4>🏠 임차인 대항력 (${report.tenants.length}명)</h4>
        <table class="rights-table">
          <thead><tr><th>이름</th><th>전입일</th><th>확정일자</th><th style="text-align:right">보증금</th><th style="text-align:center">대항력</th></tr></thead>
          <tbody>
            ${report.tenants.map(t => `
              <tr>
                <td>${t.name}</td>
                <td>${t.moveIn}</td>
                <td>${t.fixed || '-'}</td>
                <td style="text-align:right">${formatMoney(t.deposit)}</td>
                <td style="text-align:center"><span class="tag ${t.daehang === '있음' ? 'inherit' : 'extinct'}">${t.daehang}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}

    <div class="subcard">
      <h4>🚨 위험 요소</h4>
      ${report.risk.flags.map(f => `
        <div class="note ${f.sev === 'danger' ? 'danger-note' : f.sev === 'warn' ? 'warn-note' : ''}">
          ${f.sev === 'danger' ? '🚨' : f.sev === 'warn' ? '⚠️' : '✓'} ${f.msg}
        </div>
      `).join('')}
    </div>

    <div class="subcard">
      <h4>💰 배당 시뮬레이션 (최저가 기준)</h4>
      <table class="rights-table">
        <thead><tr><th>순위</th><th>항목</th><th style="text-align:right">배당액</th></tr></thead>
        <tbody>
          ${report.baedang.allocations.map(a => `<tr><td>${a.order}순위</td><td>${a.label}</td><td style="text-align:right">${formatMoney(a.amount)}</td></tr>`).join('')}
          ${report.baedang.surplus > 0 ? `<tr><td></td><td><b>잉여</b></td><td style="text-align:right"><b>${formatMoney(report.baedang.surplus)}</b></td></tr>` : ''}
        </tbody>
      </table>
    </div>

    ${report.bidRec ? `
      <div class="bid-rec">
        <h4>🤖 AI 예상 입찰가 구간</h4>
        <div class="range">${formatMoney(report.bidRec.lower)} <span class="sep">—</span> ${formatMoney(report.bidRec.upper)}</div>
        <p>기준 시세 ${formatMoney(report.bidRec.base)} · 인수금액 ${formatMoney(report.inherited.total)} · 부대비용 5.6% 반영</p>
      </div>
    ` : ''}

    <div class="subcard">
      <h4>💡 쉬운 말 해설</h4>
      ${report.explanation}
    </div>

    <p class="muted">원본: <a href="${report.url}" target="_blank">대법원 경매정보 보기</a></p>
  `;
}
