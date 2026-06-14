(() => {
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));
  }

  function app() {
    return window.__auctionV2 || null;
  }

  function state() {
    return app()?.state || null;
  }

  function normalizeDate(value) {
    const text = clean(value).replace(/\s+/g, '');
    if (!text) return '';

    const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;

    const separated = text.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\.?$/);
    if (separated) {
      return `${separated[1]}-${String(separated[2]).padStart(2, '0')}-${String(separated[3]).padStart(2, '0')}`;
    }

    return text;
  }

  function isValidDate(value) {
    if (!value) return true;
    const text = normalizeDate(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    const [y, m, d] = text.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }

  function parseMoney(value) {
    const text = clean(value).replace(/\s+/g, '');
    if (!text) return 0;
    if (/[억만천]/.test(text)) {
      let total = 0;
      const eok = text.match(/([0-9,]+(?:\.\d+)?)억/);
      const man = text.match(/([0-9,]+(?:\.\d+)?)만/);
      const cheon = text.match(/([0-9,]+(?:\.\d+)?)천/);
      if (eok) total += Math.round(Number(eok[1].replace(/,/g, '')) * 100000000);
      if (man) total += Math.round(Number(man[1].replace(/,/g, '')) * 10000);
      if (!man && cheon) total += Math.round(Number(cheon[1].replace(/,/g, '')) * 10000000);
      return Number.isFinite(total) ? Math.max(0, total) : 0;
    }
    const digits = text.replace(/[^0-9]/g, '');
    return digits ? Number(digits) : 0;
  }

  function normalizeManual() {
    const s = state();
    if (!s?.manual) return;

    const malso = s.manual.malso || {};
    malso.date = normalizeDate(malso.date);
    malso.holder = clean(malso.holder);
    malso.amount = clean(malso.amount);
    malso.type = clean(malso.type) || '근저당권';
    s.manual.malso = malso;

    s.manual.tenants = Array.isArray(s.manual.tenants) ? s.manual.tenants.map((tenant) => ({
      name: clean(tenant?.name),
      moveIn: normalizeDate(tenant?.moveIn),
      fixed: normalizeDate(tenant?.fixed),
      deposit: clean(tenant?.deposit),
    })) : [{ name: '', moveIn: '', fixed: '', deposit: '' }];

    if (!s.manual.tenants.length) {
      s.manual.tenants = [{ name: '', moveIn: '', fixed: '', deposit: '' }];
    }

    s.manual.specials = Array.isArray(s.manual.specials) ? s.manual.specials.map((special) => ({
      type: clean(special?.type) || '유치권',
      holder: clean(special?.holder),
      date: normalizeDate(special?.date),
      amount: clean(special?.amount),
    })) : [];
  }

  function tenantHasAnyValue(tenant) {
    return [tenant?.name, tenant?.moveIn, tenant?.fixed, tenant?.deposit].some(clean);
  }

  function filledTenants() {
    const s = state();
    if (!s?.manual?.tenants) return [];
    return s.manual.tenants.filter(tenantHasAnyValue);
  }

  function validateAnalyzeInput() {
    normalizeManual();
    const s = state();
    const errors = [];
    const warnings = [];
    if (!s?.manual) return { ok: false, errors: ['화면 상태를 확인할 수 없습니다. 새로고침 후 다시 시도하세요.'], warnings };

    const malso = s.manual.malso || {};
    const malsoHasAny = [malso.date, malso.holder, malso.amount].some(clean);
    if (malsoHasAny && !clean(malso.date)) errors.push('최선순위 권리의 접수일자를 입력해주세요.');
    if (malso.date && !isValidDate(malso.date)) errors.push('최선순위 권리 접수일자 형식이 올바르지 않습니다. 예: 2020.05.01 또는 20200501');

    (s.manual.tenants || []).forEach((tenant, index) => {
      if (!tenantHasAnyValue(tenant)) return;
      const label = `임차인 ${index + 1}`;
      const hasIdentity = clean(tenant.name) || parseMoney(tenant.deposit) || clean(tenant.fixed);
      if (hasIdentity && !clean(tenant.moveIn)) errors.push(`${label} 전입일을 입력해주세요.`);
      else if (tenant.moveIn && !isValidDate(tenant.moveIn)) errors.push(`${label} 전입일 형식이 올바르지 않습니다. 예: 2023.01.15 또는 20230115`);
      if (tenant.fixed && !isValidDate(tenant.fixed)) errors.push(`${label} 확정일자 형식이 올바르지 않습니다. 예: 2023.01.16 또는 20230116`);
      if (!parseMoney(tenant.deposit)) warnings.push(`${label} 보증금이 없거나 0원입니다. 인수금액 계산이 제한될 수 있습니다.`);
    });

    (s.manual.specials || []).forEach((special, index) => {
      if (!clean(special.date)) return;
      if (!isValidDate(special.date)) errors.push(`특수권리 ${index + 1} 날짜 형식이 올바르지 않습니다.`);
    });

    return { ok: errors.length === 0, errors, warnings };
  }

  function showStep2Message(messages, type = 'error') {
    const card = document.getElementById('step2InputCard');
    if (!card) return;
    let box = document.getElementById('v2Step2GuardMessage');
    if (!box) {
      box = document.createElement('div');
      box.id = 'v2Step2GuardMessage';
      box.className = 'v2-form-message show';
      const firstNote = card.querySelector('.v2-note');
      if (firstNote?.nextSibling) card.insertBefore(box, firstNote.nextSibling);
      else card.prepend(box);
    }
    box.className = `v2-form-message show ${type}`;
    box.innerHTML = messages.map((msg) => `<div>• ${esc(msg)}</div>`).join('');
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function clearStep2Message() {
    const box = document.getElementById('v2Step2GuardMessage');
    if (box) box.remove();
  }

  function setPersistedWarnings(warnings) {
    const s = state();
    if (!s) return;
    s.validationWarnings = Array.isArray(warnings) ? warnings.filter(clean) : [];
  }

  function clearPersistedWarnings() {
    const s = state();
    if (s) s.validationWarnings = [];
    document.getElementById('v2AnalyzeWarningKeepMessage')?.remove();
  }

  function renderPersistedWarnings() {
    const s = state();
    const warnings = Array.isArray(s?.validationWarnings) ? s.validationWarnings.filter(clean) : [];
    const old = document.getElementById('v2AnalyzeWarningKeepMessage');
    if (!warnings.length) {
      old?.remove();
      return;
    }

    const analysis = document.getElementById('analysisCard');
    if (!analysis) return;

    if (old) {
      old.innerHTML = `<h3>입력값 경고</h3><p class="v2-note">분석은 실행했지만 아래 항목은 결과 신뢰도에 영향을 줄 수 있습니다.</p><ul class="v2-analysis-list">${warnings.map((msg) => `<li>${esc(msg)}</li>`).join('')}</ul>`;
      return;
    }

    const box = document.createElement('section');
    box.id = 'v2AnalyzeWarningKeepMessage';
    box.className = 'v2-result-card';
    box.style.borderLeft = '4px solid #d97706';
    box.innerHTML = `<h3>입력값 경고</h3><p class="v2-note">분석은 실행했지만 아래 항목은 결과 신뢰도에 영향을 줄 수 있습니다.</p><ul class="v2-analysis-list">${warnings.map((msg) => `<li>${esc(msg)}</li>`).join('')}</ul>`;
    analysis.parentNode.insertBefore(box, analysis);
  }

  function preservePreviousAnalysisOnFailure() {
    const s = state();
    const api = app();
    if (!s?.analyzeError || !s?.report || !api?.renderResults) return;

    const message = clean(s.analyzeError);
    s.analyzeError = '';
    api.renderResults({ keepScroll: true });

    setTimeout(() => {
      const analysis = document.getElementById('analysisCard');
      if (!analysis || document.getElementById('v2AnalyzeFailureKeepMessage')) return;
      const box = document.createElement('section');
      box.id = 'v2AnalyzeFailureKeepMessage';
      box.className = 'v2-result-card v2-error';
      box.innerHTML = `<h3>최근 권리분석 실패</h3><p>${esc(message)}</p><p class="v2-note">기존 권리분석 결과는 유지했습니다. 입력값을 확인한 뒤 다시 실행하세요.</p>`;
      analysis.parentNode.insertBefore(box, analysis);
    }, 0);
  }

  function patchNextStepTenantCount() {
    const s = state();
    if (!s?.manual) return;
    const actualCount = filledTenants().length;

    document.querySelectorAll('.v2-result-card').forEach((card) => {
      const title = card.querySelector('h3');
      if (!title || title.textContent.trim() !== '다음 단계') return;
      card.querySelectorAll('.v2-info').forEach((info) => {
        const key = info.querySelector('.k')?.textContent?.trim();
        const value = info.querySelector('.v');
        if (key === '임차인 입력' && value) value.textContent = `${actualCount}명`;
      });
    });
  }

  function patchStateBeforeAnalyze() {
    const s = state();
    if (!s?.manual) return;
    normalizeManual();
    const nonEmpty = filledTenants();
    s.manual.tenants = nonEmpty.length ? nonEmpty : [{ name: '', moveIn: '', fixed: '', deposit: '' }];
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action="analyze"]');
    if (!target) return;

    const result = validateAnalyzeInput();
    if (!result.ok) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setPersistedWarnings([]);
      showStep2Message(result.errors, 'error');
      patchNextStepTenantCount();
      return;
    }

    patchStateBeforeAnalyze();
    setPersistedWarnings(result.warnings);

    if (result.warnings.length) {
      showStep2Message(result.warnings, 'warn');
    } else {
      clearStep2Message();
    }
  }, true);

  document.addEventListener('input', (event) => {
    if (!event.target.closest('[data-manual-path]')) return;
    clearStep2Message();
    clearPersistedWarnings();
    setTimeout(patchNextStepTenantCount, 0);
  }, true);

  document.addEventListener('change', (event) => {
    if (!event.target.closest('[data-manual-path]')) return;
    setTimeout(() => {
      normalizeManual();
      patchNextStepTenantCount();
    }, 0);
  }, true);

  setInterval(() => {
    preservePreviousAnalysisOnFailure();
    patchNextStepTenantCount();
    renderPersistedWarnings();
  }, 400);
})();
