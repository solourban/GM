// ── 전역 상태 ──
let currentRaw = null;

// ── 유틸 ──
function formatMoney(n) {
  const num = Number(n || 0);
  if (!num) return '-';
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(Math.round(num));
  const eok = Math.floor(abs / 100_000_000);
  const man = Math.floor((abs % 100_000_000) / 10_000);
  const parts = [];
  if (eok) parts.push(`${eok}억`);
  if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
  return sign + (parts.join(' ') || '0') + '원';
}

function parseKrw(v) {
  if (v == null) return 0;
  const digits = String(v).replace(/[^0-9.-]/g, '');
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderAddressTitle(value) {
  const address = String(value || '').trim();
  if (!address) return '';
  const match = address.match(/^(.*?(?:로|길)\s*\d+(?:-\d+)?)(.*)$/);
  if (!match || !match[2].trim()) return escapeHtml(address);
  return `<span class="property-address-main">${escapeHtml(match[1].trim())}</span><span class="property-address-detail">${escapeHtml(match[2].trim())}</span>`;
}

function sumDaehangTenantDeposit(report) {
  return (report.tenants || [])
    .filter(t => t.daehang === '있음')
    .reduce((sum, t) => sum + (Number(t.deposit) || 0), 0);
}

function readRows(listId) {
  const rows = document.getElementById(listId).children;
  const result = [];
  for (const r of rows) {
    const obj = {};
    r.querySelectorAll('[data-k]').forEach(el => { obj[el.dataset.k] = el.value.trim(); });
    if (Object.values(obj).some(v => v)) result.push(obj);
  }
  return result;
}

// ── Step 1: 기본정보 가져오기 ──
document.getElementById('btnFetch').onclick = async () => {
  const saYear = document.getElementById('saYear').value.trim();
  const saSer = document.getElementById('saSer').value.trim();
  const jiwonNm = document.getElementById('jiwonNm').value;
  const rs = document.getElementById('resultsSection');

  if (!/^\d{4}$/.test(saYear)) { alert('사건연도는 4자리 숫자로 입력하세요'); return; }
  if (!/^\d+$/.test(saSer)) { alert('사건번호는 숫자만 입력하세요'); return; }

  rs.innerHTML = `<div class="loading-card"><div class="spinner"></div><p>대법원 경매정보에서 기본정보를 가져오는 중...</p></div>`;

  try {
    const res = await fetch('/api/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saYear, saSer, jiwonNm })
    });
    const data = await res.json();
    if (!res.ok) {
      rs.innerHTML = `<div class="error-card"><h3>❌ ${escapeHtml(data.error)}</h3></div>`;
      return;
    }
    currentRaw = data.raw;
    renderStep1(data.raw, data.elapsed);
  } catch (e) {
    rs.innerHTML = `<div class="error-card"><h3>❌ 요청 실패</h3><p>${escapeHtml(e.message)}</p></div>`;
  }
};

document.getElementById('saSer').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btnFetch').click();
});

function renderStep1(raw, elapsed) {
  const rs = document.getElementById('resultsSection');
  const basic = raw.basic || {};
  const interested = raw.interested || [];
  const tenantCandidates = interested.filter(p => p.type === '임차인');

  rs.innerHTML = `
    <div class="verdict ok" style="margin-bottom:20px">
      <span class="verdict-badge">✓ Step 1 완료 · 기본정보 수집</span>
      <h3>${renderAddressTitle(basic['소재지'] || raw.caseNo)}</h3>
      <p>대법원 법원경매정보에서 ${elapsed}만에 수집 완료</p>
      <div class="verdict-stats">
        <div class="stat"><div class="k">감정가</div><div class="v">${basic['감정평가액'] || '-'}</div></div>
        <div class="stat"><div class="k">최저매각가</div><div class="v">${basic['최저매각가격'] || '-'}</div></div>
        <div class="stat"><div class="k">유찰</div><div class="v">${basic['유찰횟수'] || '-'}</div></div>
        <div class="stat"><div class="k">이해관계인</div><div class="v">${interested.length}명</div></div>
      </div>
    </div>

    <div class="subcard">
      <h4>📋 자동 수집된 사건 정보</h4>
      <table class="basic-table"><tbody>
        ${Object.entries(basic).filter(([,v]) => v).map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join('')}
      </tbody></table>
    </div>

    ${interested.length > 0 ? `
      <div class="subcard">
        <h4>👥 이해관계인 (${interested.length}명)</h4>
        <table class="rights-table">
          <thead><tr><th>구분</th><th>이름</th></tr></thead>
          <tbody>${interested.map(p => `
            <tr>
              <td><span class="tag ${p.type === '채권자' ? 'malso' : p.type === '임차인' ? 'inherit' : p.type === '채무자겸소유자' || p.type === '채무자' ? 'warn-tag' : 'extinct'}">${escapeHtml(p.type)}</span></td>
              <td>${escapeHtml(p.name)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

    <div class="step2-divider">
      <div class="step2-label">📝 Step 2 — 매각물건명세서를 보고 입력하세요</div>
      <p class="muted">권리분석을 위해 매각물건명세서에 표시된 정보가 필요합니다.<br>대법원 경매정보 페이지에서 <b>매각물건명세서</b>를 열어서 보시면 다음 값이 있어요.</p>
    </div>

    <div class="subcard input-card">
      <h4>⚖ 최선순위 설정 (말소기준권리)</h4>
      <p class="muted">매각물건명세서 상단에 "최선순위 설정"으로 적힌 값</p>
      <div class="input-row">
        <label>접수일 <input type="date" id="malsoDate" required></label>
        <label>권리종류 <select id="malsoType"><option>근저당</option><option>저당</option><option>가압류</option><option>압류</option><option>담보가등기</option><option>경매개시결정</option></select></label>
        <label>권리자 <input type="text" id="malsoHolder" placeholder="예: OO은행"></label>
        <label>채권최고액 <input type="number" id="malsoAmount" placeholder="숫자만 (원 단위)"></label>
      </div>
    </div>

    <div class="subcard input-card">
      <h4>📜 등기부 기타 권리 (선택)</h4>
      <p class="muted">말소기준 외 다른 근저당·가압류·압류·가등기 등 (없으면 비워두기)</p>
      <div id="rightsList"></div>
      <button type="button" class="btn-add" onclick="addRight()">+ 권리 추가</button>
    </div>

    <div class="subcard input-card">
      <h4>🏠 임차인 정보</h4>
      <p class="muted">매각물건명세서 하단 "조사된 임차내역"에서 확인</p>
      <div id="tenantsList"></div>
      <button type="button" class="btn-add" onclick="addTenant()">+ 임차인 추가</button>
      ${tenantCandidates.length > 0 ? `<p class="muted" style="margin-top:10px"><b>참고:</b> 자동 조회된 임차인 — ${tenantCandidates.map(t => escapeHtml(t.name)).join(', ')}</p>` : ''}
    </div>

    <div class="subcard input-card">
      <h4>🚨 특수권리 (선택)</h4>
      <p class="muted">매각물건명세서 "비고"란의 유치권·법정지상권·분묘기지권 등</p>
      <div id="specialsList"></div>
      <button type="button" class="btn-add" onclick="addSpecial()">+ 특수권리 추가</button>
    </div>

    <div class="subcard input-card">
      <h4>📍 소액임차인 기준 지역</h4>
      <select id="region" style="max-width:420px; width:100%">
        <option value="seoul">서울특별시 (1억6,500만원 이하 → 5,500만원 보호)</option>
        <option value="overcrowded">과밀억제권역·세종·용인·화성·김포 (1억4,500만원 / 4,800만원)</option>
        <option value="metro">광역시·안산·광주·파주·이천·평택 (8,500만원 / 2,800만원)</option>
        <option value="other" selected>그 외 지역 (7,500만원 / 2,500만원)</option>
      </select>
    </div>

    <div style="text-align:center; margin: 30px 0;"><button class="btn-analyze" onclick="runAnalysis()">🤖 권리분석 실행</button></div>`;

  tenantCandidates.forEach((t) => addTenant(t.name));
}

// ── 동적 행 추가 ──
window.addRight = function() {
  const list = document.getElementById('rightsList');
  const div = document.createElement('div');
  div.className = 'input-row';
  div.innerHTML = `<label>접수일 <input type="date" data-k="date"></label><label>종류 <select data-k="type"><option>근저당</option><option>저당</option><option>가압류</option><option>압류</option><option>가등기</option><option>전세권</option></select></label><label>권리자 <input type="text" data-k="holder"></label><label>금액 <input type="number" data-k="amount" placeholder="원"></label><button type="button" class="btn-remove" onclick="this.parentElement.remove()">×</button>`;
  list.appendChild(div);
};

window.addTenant = function(prefillName = '') {
  const list = document.getElementById('tenantsList');
  const div = document.createElement('div');
  div.className = 'input-row';
  div.innerHTML = `<label>이름 <input type="text" data-k="name" value="${escapeHtml(prefillName)}"></label><label>전입신고일 <input type="date" data-k="moveIn"></label><label>확정일자 <input type="date" data-k="fixed"></label><label>보증금 <input type="number" data-k="deposit" placeholder="원"></label><button type="button" class="btn-remove" onclick="this.parentElement.remove()">×</button>`;
  list.appendChild(div);
};

window.addSpecial = function() {
  const list = document.getElementById('specialsList');
  const div = document.createElement('div');
  div.className = 'input-row';
  div.innerHTML = `<label>종류 <select data-k="type"><option>유치권</option><option>법정지상권</option><option>분묘기지권</option></select></label><label>접수일 <input type="date" data-k="date"></label><label>권리자 <input type="text" data-k="holder" placeholder="있으면"></label><label>금액 <input type="number" data-k="amount" placeholder="원 (없으면 0)"></label><button type="button" class="btn-remove" onclick="this.parentElement.remove()">×</button>`;
  list.appendChild(div);
};

// ── Step 2: 분석 실행 ──
window.runAnalysis = async function() {
  const malsoDate = document.getElementById('malsoDate').value;
  const malsoType = document.getElementById('malsoType').value;
  const malsoHolder = document.getElementById('malsoHolder').value.trim();
  const malsoAmount = document.getElementById('malsoAmount').value;
  const region = document.getElementById('region').value;

  if (!malsoDate) {
    alert('말소기준권리의 접수일을 입력하세요.\n매각물건명세서 상단에 "최선순위 설정"으로 나와있습니다.');
    return;
  }

  const manual = { malso: { date: malsoDate, type: malsoType, holder: malsoHolder || '-', amount: malsoAmount || '0' }, rights: readRows('rightsList'), tenants: readRows('tenantsList'), specials: readRows('specialsList') };
  const rs = document.getElementById('resultsSection');
  const oldContent = rs.innerHTML;
  rs.innerHTML = `<div class="loading-card"><div class="spinner"></div><p>권리분석을 실행하는 중...</p></div>`;

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: currentRaw, manual, region })
    });
    const data = await res.json();
    if (!res.ok) {
      rs.innerHTML = oldContent + `<div class="error-card"><h3>❌ ${escapeHtml(data.error)}</h3></div>`;
      return;
    }
    renderReport(data.report);
  } catch (e) {
    rs.innerHTML = oldContent + `<div class="error-card"><h3>❌ ${escapeHtml(e.message)}</h3></div>`;
  }
};

// ── 엑시트 시뮬레이터 ──
function getExitInputs() {
  const bid = parseKrw(document.getElementById('exitBid')?.value);
  const deposit = parseKrw(document.getElementById('exitDeposit')?.value);
  const sale = parseKrw(document.getElementById('exitSale')?.value);
  const acquireRate = Number(document.getElementById('exitAcquireRate')?.value || 0) / 100;
  const sellRate = Number(document.getElementById('exitSellRate')?.value || 0) / 100;
  const taxRate = Number(document.getElementById('exitTaxRate')?.value || 0) / 100;
  const targetProfit = parseKrw(document.getElementById('exitTargetProfit')?.value);
  return { bid, deposit, sale, acquireRate, sellRate, taxRate, targetProfit };
}

function calcExit({ bid, deposit, sale, acquireRate, sellRate, taxRate }) {
  const acquisitionCost = Math.round(bid * acquireRate);
  const saleCost = Math.round(sale * sellRate);
  const economicCost = bid + deposit + acquisitionCost;
  const taxableGainApprox = Math.max(0, sale - economicCost - saleCost);
  const taxApprox = Math.round(taxableGainApprox * taxRate);
  const netProfit = sale - economicCost - saleCost - taxApprox;
  const cashFromBuyer = sale - deposit;
  const initialCashNeeded = bid + acquisitionCost;
  const cashAfterExit = cashFromBuyer - initialCashNeeded - saleCost - taxApprox;
  return { acquisitionCost, saleCost, economicCost, taxableGainApprox, taxApprox, netProfit, cashFromBuyer, initialCashNeeded, cashAfterExit };
}

function saleForTarget(baseInputs, targetProfit) {
  let lo = 0;
  let hi = Math.max(baseInputs.sale || 0, baseInputs.bid + baseInputs.deposit + targetProfit + 100_000_000);
  for (let i = 0; i < 80; i++) {
    const mid = Math.round((lo + hi) / 2);
    const profit = calcExit({ ...baseInputs, sale: mid }).netProfit;
    if (profit >= targetProfit) hi = mid;
    else lo = mid;
  }
  return hi;
}

function applyExitPreset() {
  const mode = document.getElementById('exitMode')?.value;
  const holding = document.getElementById('exitHolding')?.value;
  const sellRateEl = document.getElementById('exitSellRate');
  const taxRateEl = document.getElementById('exitTaxRate');

  if (sellRateEl) {
    if (mode === 'tenant') sellRateEl.value = '0.1';
    if (mode === 'market') sellRateEl.value = '0.8';
    if (mode === 'hold') sellRateEl.value = '0.8';
  }
  if (taxRateEl) {
    if (holding === 'under1') taxRateEl.value = '77';
    if (holding === 'under2') taxRateEl.value = '66';
    if (holding === 'over2') taxRateEl.value = '25';
  }
  updateExitSimulator();
}

function renderExitSimulator(report) {
  const bidPrice = report.baedang?.bidPrice || parseKrw(report.basic?.['최저매각가격']) || parseKrw(report.basic?.['감정평가액']);
  const appraisal = parseKrw(report.basic?.['감정평가액']);
  const tenantDeposit = sumDaehangTenantDeposit(report) || report.inherited?.total || 0;
  const defaultSale = Math.max(appraisal, bidPrice + tenantDeposit);

  return `
    <div class="subcard input-card exit-card">
      <h4>📈 엑시트·실질수익 시뮬레이션</h4>
      <p class="muted">대항력 임차인을 안고 되팔거나, 기존 임차인에게 바로 매도하는 경우의 돈 흐름을 계산합니다.</p>
      <div class="input-row exit-input-row">
        <label>매도 방식
          <select id="exitMode" onchange="applyExitPreset()">
            <option value="market">일반 매도</option>
            <option value="tenant">기존 임차인에게 매도</option>
            <option value="hold">보유 후 매도</option>
          </select>
        </label>
        <label>보유기간/세율 프리셋
          <select id="exitHolding" onchange="applyExitPreset()">
            <option value="under1">1년 미만 단기</option>
            <option value="under2">1년 이상 2년 미만</option>
            <option value="over2">2년 이상/직접 조정</option>
          </select>
        </label>
        <label>낙찰가 <input type="number" id="exitBid" value="${bidPrice}" oninput="updateExitSimulator()"></label>
        <label>인수 보증금 <input type="number" id="exitDeposit" value="${tenantDeposit}" oninput="updateExitSimulator()"></label>
        <label>예상 매도가 <input type="number" id="exitSale" value="${defaultSale}" oninput="updateExitSimulator()"></label>
        <label>세후 목표수익 <input type="number" id="exitTargetProfit" value="10000000" oninput="updateExitSimulator()"></label>
        <label>취득·기타비용 % <input type="number" id="exitAcquireRate" value="5.6" step="0.1" oninput="updateExitSimulator()"></label>
        <label>매도비용 % <input type="number" id="exitSellRate" value="0.8" step="0.1" oninput="updateExitSimulator()"></label>
        <label>양도세율 % <input type="number" id="exitTaxRate" value="77" step="1" oninput="updateExitSimulator()"></label>
      </div>
      <div id="exitResult" class="exit-result"></div>
      <div class="note warn-note">간이 계산입니다. 실제 세금, 필요경비 인정 범위, 대출, 계약갱신청구권, 명도 조건은 별도 확인이 필요합니다.</div>
    </div>`;
}

window.applyExitPreset = applyExitPreset;
window.updateExitSimulator = function() {
  const result = document.getElementById('exitResult');
  if (!result) return;

  const inputs = getExitInputs();
  const out = calcExit(inputs);
  const targetSale = saleForTarget(inputs, inputs.targetProfit || 0);
  const breakEvenSale = saleForTarget(inputs, 0);
  const marginRate = inputs.sale ? (out.netProfit / inputs.sale) * 100 : 0;
  const isProfit = out.netProfit > 0;
  const tenantCashLabel = document.getElementById('exitMode')?.value === 'tenant' ? '임차인이 추가로 마련할 현금' : '매수자가 추가 지급할 현금';

  result.innerHTML = `
    <div class="note ${isProfit ? '' : 'danger-note'}">
      ${isProfit ? '✓' : '🚨'} 현재 입력값 기준 최종 순수익은 <b>${formatMoney(out.netProfit)}</b>입니다. 매도가 대비 순마진율은 <b>${marginRate.toFixed(1)}%</b>입니다.
    </div>
    <div class="verdict-stats exit-stats">
      <div class="stat"><div class="k">경제적 총매수원가</div><div class="v">${formatMoney(out.economicCost)}</div></div>
      <div class="stat"><div class="k">${tenantCashLabel}</div><div class="v">${formatMoney(out.cashFromBuyer)}</div></div>
      <div class="stat"><div class="k">초기 필요 현금</div><div class="v">${formatMoney(out.initialCashNeeded)}</div></div>
      <div class="stat"><div class="k">세금 추정</div><div class="v ${out.taxApprox > 0 ? 'danger' : ''}">${formatMoney(out.taxApprox)}</div></div>
      <div class="stat"><div class="k">최종 순수익 추정</div><div class="v ${isProfit ? 'ok' : 'danger'}">${formatMoney(out.netProfit)}</div></div>
      <div class="stat"><div class="k">세후 손익분기 매도가</div><div class="v">${formatMoney(breakEvenSale)}</div></div>
      <div class="stat"><div class="k">목표수익 필요 매도가</div><div class="v ${targetSale > inputs.sale ? 'danger' : 'ok'}">${formatMoney(targetSale)}</div></div>
      <div class="stat"><div class="k">목표 대비 부족/여유</div><div class="v ${inputs.sale >= targetSale ? 'ok' : 'danger'}">${formatMoney(inputs.sale - targetSale)}</div></div>
    </div>
    <div class="note">
      구조: 예상 매도가 ${formatMoney(inputs.sale)} - 낙찰가 ${formatMoney(inputs.bid)} - 인수 보증금 ${formatMoney(inputs.deposit)} - 비용 ${formatMoney(out.acquisitionCost + out.saleCost)} - 세금 추정 ${formatMoney(out.taxApprox)} = 최종 순수익 ${formatMoney(out.netProfit)}
    </div>`;
};

// ── 최종 리포트 ──
function renderReport(report) {
  const rs = document.getElementById('resultsSection');
  const verdictLabel = { ok: '양호', warn: '주의', danger: '위험' }[report.risk.level];
  const verdictDesc = { ok: '입력값 기준으로 큰 인수 위험은 뚜렷하게 보이지 않습니다.', warn: '주의해야 할 요소가 있습니다. 실질 투자비를 재계산하세요.', danger: '입찰 전 반드시 원본 서류와 전문가 검토가 필요합니다.' }[report.risk.level];
  const daehang = report.tenants.filter(t => t.daehang === '있음').length;
  const inheritCount = report.rights.filter(r => r.status === '인수').length;
  const extinctCount = report.rights.filter(r => r.status === '소멸').length;

  rs.innerHTML = `
    <div style="text-align:right; margin-bottom:16px"><button class="btn-back" onclick="location.reload()">← 새 사건 분석</button></div>
    <div class="verdict ${report.risk.level}">
      <span class="verdict-badge">${report.risk.level === 'ok' ? '✓' : '⚠'} 종합 · ${verdictLabel}</span>
      <h3>${renderAddressTitle(report.basic['소재지'] || report.case)}</h3>
      <p>${verdictDesc}</p>
      <div class="verdict-stats">
        <div class="stat"><div class="k">인수 권리</div><div class="v ${inheritCount > 0 ? 'danger' : ''}">${inheritCount}건</div></div>
        <div class="stat"><div class="k">소멸 권리</div><div class="v">${extinctCount}건</div></div>
        <div class="stat"><div class="k">대항력 임차인</div><div class="v ${daehang > 0 ? 'danger' : ''}">${daehang}명</div></div>
        <div class="stat"><div class="k">낙찰자 인수금액</div><div class="v ${report.inherited.total > 0 ? 'danger' : 'ok'}">${formatMoney(report.inherited.total)}</div></div>
      </div>
    </div>

    ${report.malso ? `<div class="subcard"><h4>⚖ 말소기준권리</h4><p><b>${escapeHtml(report.malso.type)}</b> · ${escapeHtml(report.malso.holder)} · 접수 ${escapeHtml(report.malso.date)} · ${formatMoney(report.malso.amount)}</p><div class="note">이 날짜(<b>${escapeHtml(report.malso.date)}</b>) 이후의 권리는 소멸되는 것으로 추정합니다. 원본 서류 확인은 필요합니다.</div></div>` : ''}

    <div class="subcard">
      <h4>📜 권리 분석 (${report.rights.length}건)</h4>
      ${report.rights.length === 0 ? '<p class="muted">등록된 권리가 없습니다</p>' : `<table class="rights-table"><thead><tr><th>접수일</th><th>종류</th><th>권리자</th><th style="text-align:right">금액</th><th style="text-align:center">판정</th></tr></thead><tbody>${report.rights.map(r => `<tr class="${r.isMalso ? 'malso-row' : ''}"><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.type)}${r.isMalso ? '<span class="tag malso"> 말소기준</span>' : ''}</td><td>${escapeHtml(r.holder)}</td><td style="text-align:right">${formatMoney(r.amount)}</td><td style="text-align:center"><span class="tag ${r.status === '인수' ? 'inherit' : 'extinct'}">${escapeHtml(r.status)}</span></td></tr>`).join('')}</tbody></table>`}
    </div>

    ${report.tenants.length > 0 ? `<div class="subcard"><h4>🏠 임차인 대항력 (${report.tenants.length}명)</h4><table class="rights-table"><thead><tr><th>이름</th><th>전입일</th><th>확정일자</th><th style="text-align:right">보증금</th><th style="text-align:center">대항력</th></tr></thead><tbody>${report.tenants.map(t => `<tr><td>${escapeHtml(t.name)}</td><td>${escapeHtml(t.moveIn || '-')}</td><td>${escapeHtml(t.fixed || '-')}</td><td style="text-align:right">${formatMoney(t.deposit)}</td><td style="text-align:center"><span class="tag ${t.daehang === '있음' ? 'inherit' : 'extinct'}">${escapeHtml(t.daehang)}</span></td></tr>`).join('')}</tbody></table></div>` : ''}

    <div class="subcard"><h4>🚨 위험 요소</h4>${report.risk.flags.map(f => `<div class="note ${f.sev === 'danger' ? 'danger-note' : f.sev === 'warn' ? 'warn-note' : ''}">${f.sev === 'danger' ? '🚨' : f.sev === 'warn' ? '⚠️' : '✓'} ${escapeHtml(f.msg)}</div>`).join('')}</div>

    <div class="subcard">
      <h4>💰 배당 시뮬레이션 (최저가 기준)</h4>
      <table class="rights-table"><thead><tr><th>순위</th><th>항목</th><th style="text-align:right">배당액</th></tr></thead><tbody>${report.baedang.allocations.map(a => `<tr><td>${a.order}순위</td><td>${escapeHtml(a.label)}</td><td style="text-align:right">${formatMoney(a.amount)}</td></tr>`).join('')}${report.baedang.surplus > 0 ? `<tr><td></td><td><b>잉여</b></td><td style="text-align:right"><b>${formatMoney(report.baedang.surplus)}</b></td></tr>` : ''}</tbody></table>
    </div>

    ${renderExitSimulator(report)}

    ${report.bidRec ? `<div class="bid-rec"><h4>🤖 예상 입찰가 구간</h4><div class="range">${formatMoney(report.bidRec.lower)} <span class="sep">—</span> ${formatMoney(report.bidRec.upper)}</div><p>기준 시세 ${formatMoney(report.bidRec.base)} · 인수금액 ${formatMoney(report.inherited.total)} · 부대비용 5.6% 반영</p></div>` : ''}

    <div class="subcard"><h4>💡 쉬운 말 해설</h4>${report.explanation}</div>`;

  updateExitSimulator();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
