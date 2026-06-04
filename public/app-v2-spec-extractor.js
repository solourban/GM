(() => {
  const MOUNT_ID = 'v2SpecExtractorMount';
  const SOURCE_ID = 'v2SpecSourceText';
  const REVIEW_ID = 'v2SpecReviewPane';
  const STORAGE_PREFIX = 'auction-note:v2:spec-extraction:';
  const MAX_DRAFTS = 10;
  const MAX_TEXT_LENGTH = 100_000;
  const MAX_REVIEW_ITEMS = 80;
  const SPECIAL_TYPES = ['유치권', '법정지상권', '분묘기지권', '예고등기', '가처분', '가압류', '기타'];
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
  let activeCaseKey = '';
  let activeDraft = emptyDraft();
  let mountTimer = 0;
  let saveTimer = 0;

  function emptyDraft() {
    return { version: 1, rawText: '', result: null, selected: {}, replace: {}, lastApply: null, savedAt: '' };
  }

  function defaultSpecReview() {
    return { occupants: [], specialRights: [], takeoverNotes: [] };
  }

  function parser() {
    return window.__auctionSpecParser || null;
  }

  function app() {
    return window.__auctionV2 || null;
  }

  function state() {
    return app()?.state || null;
  }

  function currentCaseKey() {
    return window.__auctionCaseScope?.currentCaseKey?.() || '';
  }

  function storageKey(caseKey = currentCaseKey()) {
    return caseKey ? `${STORAGE_PREFIX}${caseKey}` : '';
  }

  function safeFlags(value) {
    const flags = {};
    Object.entries(value && typeof value === 'object' ? value : {})
      .slice(0, 300)
      .forEach(([key, enabled]) => {
        if (clean(key) && enabled === true) flags[clean(key)] = true;
      });
    return flags;
  }

  function selectorEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function safeDraft(value) {
    const rawText = typeof value?.rawText === 'string' && value.rawText.length <= MAX_TEXT_LENGTH
      ? value.rawText
      : '';
    const result = value?.result && typeof value.result === 'object' ? value.result : null;
    const lastApply = value?.lastApply && typeof value.lastApply === 'object' ? value.lastApply : null;
    return {
      version: 1,
      rawText,
      result,
      selected: safeFlags(value?.selected),
      replace: safeFlags(value?.replace),
      lastApply,
      savedAt: typeof value?.savedAt === 'string' ? value.savedAt : '',
    };
  }

  function loadDraft(caseKey = currentCaseKey()) {
    const key = storageKey(caseKey);
    if (!key) return emptyDraft();
    try {
      return safeDraft(JSON.parse(sessionStorage.getItem(key) || 'null') || {});
    } catch (_) {
      return emptyDraft();
    }
  }

  function draftEntries() {
    const entries = [];
    try {
      for (let index = 0; index < sessionStorage.length; index += 1) {
        const key = sessionStorage.key(index);
        if (!key?.startsWith(STORAGE_PREFIX)) continue;
        const parsed = JSON.parse(sessionStorage.getItem(key) || 'null') || {};
        const savedTime = parsed.savedAt ? new Date(parsed.savedAt).getTime() : 0;
        entries.push({ key, savedTime: Number.isFinite(savedTime) ? savedTime : 0 });
      }
    } catch (_) {}
    return entries;
  }

  function pruneDrafts() {
    try {
      draftEntries()
        .sort((left, right) => right.savedTime - left.savedTime)
        .slice(MAX_DRAFTS)
        .forEach(({ key }) => sessionStorage.removeItem(key));
    } catch (_) {}
  }

  function draftSignature(caseKey = activeCaseKey || currentCaseKey()) {
    const selected = Object.keys(activeDraft.selected || {}).sort().join(',');
    const replace = Object.keys(activeDraft.replace || {}).sort().join(',');
    return `${caseKey}:${activeDraft.rawText.length}:${activeDraft.result?.rawHash || ''}:${selected}:${replace}:${activeDraft.savedAt}:${activeDraft.lastApply?.at || ''}`;
  }

  function saveDraft(draft = activeDraft, caseKey = activeCaseKey || currentCaseKey()) {
    const key = storageKey(caseKey);
    if (!key || String(draft?.rawText ?? '').length > MAX_TEXT_LENGTH) return false;
    const safe = safeDraft({ ...draft, savedAt: new Date().toISOString() });
    try {
      sessionStorage.setItem(key, JSON.stringify(safe));
      pruneDrafts();
      if (caseKey === activeCaseKey) {
        activeDraft = safe;
        const mount = document.getElementById(MOUNT_ID);
        const status = mount?.querySelector('[data-spec-state]');
        if (mount) mount.dataset.specSignature = draftSignature(caseKey);
        if (status) status.textContent = '세션 초안 저장됨';
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveDraft(), 120);
  }

  function clearDraft(caseKey = activeCaseKey || currentCaseKey()) {
    const key = storageKey(caseKey);
    if (!key) return false;
    try {
      sessionStorage.removeItem(key);
    } catch (_) {}
    if (caseKey === activeCaseKey) activeDraft = emptyDraft();
    return true;
  }

  function money(value) {
    if (value === '' || value === null || value === undefined) return '';
    const number = Number(value);
    if (!Number.isFinite(number)) return clean(value);
    return `${number.toLocaleString('ko-KR')}원`;
  }

  function moneyInput(value) {
    if (value === '' || value === null || value === undefined) return '';
    const number = Number(value);
    if (!Number.isFinite(number)) return clean(value);
    return number.toLocaleString('ko-KR');
  }

  function fieldValue(key, value) {
    if (['deposit', 'rent', 'amount'].includes(key)) return money(value);
    return String(value ?? '');
  }

  function confidenceLabel(value) {
    if (value === 'explicit') return '명시';
    if (value === 'context') return '문맥';
    return '확인 필요';
  }

  function issueLabel(value) {
    const labels = {
      unresolved_tenantName: '임차인명 확인 필요',
      unresolved_occupantName: '점유자명 확인 필요',
      unresolved_moveIn: '전입일 확인 필요',
      unresolved_fixed: '확정일자 확인 필요',
      unresolved_claimDate: '배당요구일 확인 필요',
      unresolved_deposit: '보증금 확인 필요',
      unresolved_rent: '차임 확인 필요',
      unresolved_occupiedPart: '점유부분 확인 필요',
      unresolved_date: '신고·접수일 확인 필요',
      unresolved_amount: '금액 확인 필요',
    };
    return labels[value] || '원문 확인 필요';
  }

  function warningLabel(warning) {
    const labels = {
      empty_text: '원문이 비어 있습니다.',
      text_too_long: '원문이 100,000자를 초과해 추출하지 않았습니다.',
      duplicate_occupant_removed: '중복 임차인·점유자 후보를 정리했습니다.',
      duplicate_special_right_removed: '중복 특수권리 후보를 정리했습니다.',
      duplicate_takeover_phrase_removed: '중복 인수 문구를 정리했습니다.',
    };
    return labels[warning?.code] || '원문 확인이 필요한 항목이 있습니다.';
  }

  function ensureManual() {
    const s = state();
    if (!s) return null;
    if (!s.manual || typeof s.manual !== 'object') s.manual = {};
    if (!s.manual.malso || typeof s.manual.malso !== 'object') {
      s.manual.malso = { date: '', type: '근저당권', holder: '', amount: '' };
    }
    if (!Array.isArray(s.manual.tenants) || !s.manual.tenants.length) {
      s.manual.tenants = [{ name: '', moveIn: '', fixed: '', deposit: '' }];
    }
    if (!Array.isArray(s.manual.specials)) s.manual.specials = [];
    s.manual.specReview = safeSpecReview(s.manual.specReview);
    return s.manual;
  }

  function safeSpecReview(value) {
    const src = value && typeof value === 'object' ? value : {};
    return {
      occupants: Array.isArray(src.occupants) ? src.occupants.map((item) => ({
        tenantName: clean(item?.tenantName),
        occupantName: clean(item?.occupantName),
        moveIn: clean(item?.moveIn),
        fixed: clean(item?.fixed),
        claimDate: clean(item?.claimDate),
        deposit: clean(item?.deposit),
        rent: clean(item?.rent),
        occupiedPart: clean(item?.occupiedPart),
        sourceId: clean(item?.sourceId),
        confirmedAt: clean(item?.confirmedAt),
      })).filter((item) => Object.values(item).some(clean)).slice(-MAX_REVIEW_ITEMS) : [],
      specialRights: Array.isArray(src.specialRights) ? src.specialRights.map((item) => ({
        typeCandidate: clean(item?.typeCandidate),
        holder: clean(item?.holder),
        date: clean(item?.date),
        amount: clean(item?.amount),
        phrase: clean(item?.phrase),
        sourceId: clean(item?.sourceId),
        confirmedAt: clean(item?.confirmedAt),
      })).filter((item) => Object.values(item).some(clean)).slice(-MAX_REVIEW_ITEMS) : [],
      takeoverNotes: Array.isArray(src.takeoverNotes) ? src.takeoverNotes.map((item) => ({
        kind: clean(item?.kind),
        phrase: clean(item?.phrase),
        sourceId: clean(item?.sourceId),
        confirmedAt: clean(item?.confirmedAt),
      })).filter((item) => Object.values(item).some(clean)).slice(-MAX_REVIEW_ITEMS) : [],
    };
  }

  function addUnique(list, item, keys) {
    if (!Object.values(item).some(clean)) return false;
    const signature = keys.map((key) => clean(item[key])).join('|');
    if (!signature.replace(/\|/g, '')) return false;
    if (list.some((existing) => keys.map((key) => clean(existing[key])).join('|') === signature)) return false;
    list.push(item);
    if (list.length > MAX_REVIEW_ITEMS) list.splice(0, list.length - MAX_REVIEW_ITEMS);
    return true;
  }

  function candidateEntries(result = activeDraft.result) {
    const candidates = result?.candidates || {};
    const occupants = Array.isArray(candidates.occupants) ? candidates.occupants : [];
    const specialRights = Array.isArray(candidates.specialRights) ? candidates.specialRights : [];
    const takeoverPhrases = Array.isArray(candidates.takeoverPhrases) ? candidates.takeoverPhrases : [];
    return [
      ...occupants.map((candidate, index) => ({ type: 'occupant', candidate, index, id: candidateId(candidate, 'occupant', index) })),
      ...specialRights.map((candidate, index) => ({ type: 'special', candidate, index, id: candidateId(candidate, 'special', index) })),
      ...takeoverPhrases.map((candidate, index) => ({ type: 'takeover', candidate, index, id: candidateId(candidate, 'takeover', index) })),
    ];
  }

  function candidateId(candidate, type, index) {
    return clean(candidate?.id) || `${type}-${index}`;
  }

  function selectedCount(result = activeDraft.result) {
    const ids = new Set(candidateEntries(result).map(({ id }) => id));
    return Object.keys(activeDraft.selected || {}).filter((id) => ids.has(id) && activeDraft.selected[id]).length;
  }

  function selectionSet(values, fallbackFlags) {
    if (Array.isArray(values)) return new Set(values.map(clean).filter(Boolean));
    return new Set(Object.entries(fallbackFlags || {}).filter(([, enabled]) => enabled).map(([id]) => id));
  }

  function tenantHasValue(tenant) {
    return ['name', 'moveIn', 'fixed', 'deposit'].some((key) => clean(tenant?.[key]));
  }

  function occupantAnalysis(candidate) {
    const values = candidate?.values || {};
    return {
      name: clean(values.tenantName),
      moveIn: clean(values.moveIn),
      fixed: clean(values.fixed),
      deposit: moneyInput(values.deposit),
    };
  }

  function occupantReview(candidate, id, confirmedAt) {
    const values = candidate?.values || {};
    const review = {
      tenantName: clean(values.tenantName),
      occupantName: clean(values.occupantName),
      moveIn: clean(values.moveIn),
      fixed: clean(values.fixed),
      claimDate: clean(values.claimDate),
      deposit: moneyInput(values.deposit),
      rent: moneyInput(values.rent),
      occupiedPart: clean(values.occupiedPart),
      sourceId: id,
      confirmedAt,
    };
    const hasReference = ['occupantName', 'claimDate', 'rent', 'occupiedPart'].some((key) => clean(review[key]));
    return hasReference ? review : null;
  }

  function findTenantByName(tenants, name) {
    const target = clean(name);
    if (!target) return -1;
    return tenants.findIndex((tenant) => clean(tenant?.name) === target);
  }

  function tenantConflict(candidate, manual = ensureManual()) {
    if (!manual) return null;
    const incoming = occupantAnalysis(candidate);
    const index = findTenantByName(manual.tenants, incoming.name);
    if (index < 0) return null;
    const existing = manual.tenants[index] || {};
    const fields = ['moveIn', 'fixed', 'deposit'];
    const differing = fields.filter((key) => clean(incoming[key]) && clean(existing[key]) && clean(incoming[key]) !== clean(existing[key]));
    return differing.length ? { index, differing } : null;
  }

  function mergeTenant(existing, incoming, force = false) {
    ['name', 'moveIn', 'fixed', 'deposit'].forEach((key) => {
      const value = clean(incoming[key]);
      if (!value) return;
      if (force || !clean(existing[key]) || clean(existing[key]) === value) existing[key] = value;
    });
  }

  function applyOccupant(candidate, id, replaceIds, summary, confirmedAt) {
    const manual = ensureManual();
    if (!manual) {
      summary.missingState = true;
      return;
    }
    const review = occupantReview(candidate, id, confirmedAt);
    if (review && addUnique(manual.specReview.occupants, review, ['tenantName', 'occupantName', 'moveIn', 'fixed', 'claimDate', 'deposit', 'rent', 'occupiedPart'])) {
      summary.reviewAdded += 1;
    }

    const incoming = occupantAnalysis(candidate);
    if (!Object.values(incoming).some(clean)) {
      summary.reviewOnly += review ? 1 : 0;
      return;
    }

    const conflict = tenantConflict(candidate, manual);
    if (conflict && !replaceIds.has(id)) {
      summary.conflictsKept += 1;
      return;
    }

    if (conflict && replaceIds.has(id)) {
      mergeTenant(manual.tenants[conflict.index], incoming, true);
      summary.tenantsUpdated += 1;
      return;
    }

    const sameNameIndex = findTenantByName(manual.tenants, incoming.name);
    if (sameNameIndex >= 0) {
      const before = JSON.stringify(manual.tenants[sameNameIndex]);
      mergeTenant(manual.tenants[sameNameIndex], incoming, false);
      if (JSON.stringify(manual.tenants[sameNameIndex]) === before) summary.tenantsUnchanged += 1;
      else summary.tenantsUpdated += 1;
      return;
    }

    const blankIndex = manual.tenants.findIndex((tenant) => !tenantHasValue(tenant));
    if (blankIndex >= 0) {
      manual.tenants[blankIndex] = { name: '', moveIn: '', fixed: '', deposit: '', ...incoming };
      summary.tenantsUpdated += 1;
      return;
    }

    manual.tenants.push({ name: '', moveIn: '', fixed: '', deposit: '', ...incoming });
    summary.tenantsAdded += 1;
  }

  function specialAnalysis(candidate) {
    const type = SPECIAL_TYPES.includes(clean(candidate?.typeCandidate)) ? clean(candidate?.typeCandidate) : '';
    return {
      type,
      holder: clean(candidate?.holder),
      date: clean(candidate?.date),
      amount: moneyInput(candidate?.amount),
    };
  }

  function specialReview(candidate, id, confirmedAt) {
    return {
      typeCandidate: clean(candidate?.typeCandidate),
      holder: clean(candidate?.holder),
      date: clean(candidate?.date),
      amount: moneyInput(candidate?.amount),
      phrase: clean(candidate?.phrase),
      sourceId: id,
      confirmedAt,
    };
  }

  function specialDuplicate(specials, incoming) {
    return specials.some((special) => (
      clean(special?.type) === clean(incoming.type)
      && clean(special?.holder) === clean(incoming.holder)
      && clean(special?.date) === clean(incoming.date)
      && clean(special?.amount) === clean(incoming.amount)
    ));
  }

  function applySpecial(candidate, id, summary, confirmedAt) {
    const manual = ensureManual();
    if (!manual) {
      summary.missingState = true;
      return;
    }
    const review = specialReview(candidate, id, confirmedAt);
    if (addUnique(manual.specReview.specialRights, review, ['typeCandidate', 'holder', 'date', 'amount', 'phrase'])) {
      summary.reviewAdded += 1;
    }

    const incoming = specialAnalysis(candidate);
    const hasDetails = ['holder', 'date', 'amount'].some((key) => clean(incoming[key]));
    if (!incoming.type || !hasDetails) {
      summary.reviewOnly += 1;
      return;
    }
    if (specialDuplicate(manual.specials, incoming)) {
      summary.specialsUnchanged += 1;
      return;
    }
    manual.specials.push(incoming);
    summary.specialsAdded += 1;
  }

  function applyTakeover(candidate, id, summary, confirmedAt) {
    const manual = ensureManual();
    if (!manual) {
      summary.missingState = true;
      return;
    }
    const note = {
      kind: clean(candidate?.kind),
      phrase: clean(candidate?.phrase),
      sourceId: id,
      confirmedAt,
    };
    if (addUnique(manual.specReview.takeoverNotes, note, ['kind', 'phrase'])) {
      summary.reviewAdded += 1;
      summary.takeoverNotesAdded += 1;
    } else {
      summary.reviewOnly += 1;
    }
  }

  function applyCandidates(options = {}) {
    const result = options.result || activeDraft.result;
    const selectedIds = selectionSet(options.selectedIds, activeDraft.selected);
    const replaceIds = selectionSet(options.replaceIds, activeDraft.replace);
    const summary = {
      selected: 0,
      tenantsAdded: 0,
      tenantsUpdated: 0,
      tenantsUnchanged: 0,
      specialsAdded: 0,
      specialsUnchanged: 0,
      takeoverNotesAdded: 0,
      reviewAdded: 0,
      reviewOnly: 0,
      conflictsKept: 0,
      missingState: false,
      at: new Date().toISOString(),
    };
    if (!result) return summary;

    candidateEntries(result).forEach(({ type, candidate, id }) => {
      if (!selectedIds.has(id)) return;
      summary.selected += 1;
      if (type === 'occupant') applyOccupant(candidate, id, replaceIds, summary, summary.at);
      if (type === 'special') applySpecial(candidate, id, summary, summary.at);
      if (type === 'takeover') applyTakeover(candidate, id, summary, summary.at);
    });

    if (!options.result) {
      activeDraft = { ...activeDraft, lastApply: summary };
      saveDraft();
    }

    if (options.render !== false && !summary.missingState) {
      app()?.renderResults?.({ keepScroll: true });
      window.setTimeout(() => renderMount(true), 0);
    }
    return summary;
  }

  function evidenceHtml(candidate) {
    const evidence = Array.isArray(candidate?.evidence) ? candidate.evidence : [];
    if (!evidence.length) return '';
    return `
      <div class="v2-spec-evidence">
        <span>원문 근거</span>
        ${evidence.map((item) => `<blockquote>${esc(item.text || '')}</blockquote>`).join('')}
      </div>
    `;
  }

  function issuesHtml(candidate) {
    const issues = Array.isArray(candidate?.issues) ? candidate.issues : [];
    if (!issues.length) return '';
    return `<div class="v2-spec-issues">${issues.map((issue) => `<span>${esc(issueLabel(issue))}</span>`).join('')}</div>`;
  }

  function valuesHtml(values, confidence, definitions) {
    const rows = definitions
      .map(([key, label]) => ({ key, label, value: fieldValue(key, values?.[key]) }))
      .filter(({ value }) => value !== '');
    if (!rows.length) return '<p class="v2-note">구조화된 값이 없어 원문 근거만 확인하세요.</p>';
    return `
      <dl class="v2-spec-values">
        ${rows.map(({ key, label, value }) => `
          <div>
            <dt>${esc(label)} <span>${esc(confidenceLabel(confidence?.[key]))}</span></dt>
            <dd>${esc(value)}</dd>
          </div>
        `).join('')}
      </dl>
    `;
  }

  function conflictHtml(entry) {
    if (entry.type !== 'occupant') return '';
    const conflict = tenantConflict(entry.candidate);
    if (!conflict) return '';
    const checked = activeDraft.replace?.[entry.id] ? 'checked' : '';
    const disabled = activeDraft.selected?.[entry.id] ? '' : 'disabled';
    return `
      <div class="v2-spec-conflict">
        <strong>기존 임차인 값과 다릅니다.</strong>
        <span>기본값은 기존 입력 유지입니다. 교체할 때만 체크하세요.</span>
        <label><input type="checkbox" data-spec-replace="${esc(entry.id)}" ${checked} ${disabled}> 후보 값으로 교체</label>
      </div>
    `;
  }

  function candidateShell(label, tone, body, entry) {
    const checked = activeDraft.selected?.[entry.id] ? 'checked' : '';
    return `
      <article class="v2-spec-candidate ${tone}">
        <div class="v2-spec-candidate-head">
          <label class="v2-spec-select"><input type="checkbox" data-spec-select="${esc(entry.id)}" ${checked}> <strong>${esc(label)}</strong></label>
          <span>검토 후보</span>
        </div>
        ${body}
        ${conflictHtml(entry)}
        ${issuesHtml(entry.candidate)}
        ${evidenceHtml(entry.candidate)}
      </article>
    `;
  }

  function occupantHtml(candidate, index) {
    const definitions = [
      ['tenantName', '임차인명'],
      ['occupantName', '점유자명'],
      ['moveIn', '전입일'],
      ['fixed', '확정일자'],
      ['claimDate', '배당요구일'],
      ['deposit', '보증금'],
      ['rent', '차임'],
      ['occupiedPart', '점유부분'],
    ];
    const entry = { type: 'occupant', candidate, index, id: candidateId(candidate, 'occupant', index) };
    return candidateShell(
      `임차·점유 후보 ${index + 1}`,
      'occupant',
      valuesHtml(candidate.values, candidate.confidence, definitions),
      entry,
    );
  }

  function specialRightHtml(candidate, index) {
    const values = {
      typeCandidate: candidate.typeCandidate,
      holder: candidate.holder,
      date: candidate.date,
      amount: candidate.amount,
    };
    const entry = { type: 'special', candidate, index, id: candidateId(candidate, 'special', index) };
    return candidateShell(
      `특수권리 의심 문구 ${index + 1}`,
      'special',
      valuesHtml(values, {
        typeCandidate: 'explicit',
        holder: candidate.holder ? 'explicit' : '',
        date: candidate.date ? 'explicit' : '',
        amount: candidate.amount !== '' ? 'explicit' : '',
      }, [
        ['typeCandidate', '권리 유형 후보'],
        ['holder', '권리자·신고인 후보'],
        ['date', '신고·접수일 후보'],
        ['amount', '금액 후보'],
      ]),
      entry,
    );
  }

  function takeoverHtml(candidate, index) {
    const labels = {
      no_takeover: '인수 없음 문구',
      possible_takeover: '인수 가능 의심 문구',
      ambiguous: '인수 여부 확인 문구',
    };
    const entry = { type: 'takeover', candidate, index, id: candidateId(candidate, 'takeover', index) };
    return candidateShell(
      `${labels[candidate.kind] || '인수 관련 문구'} ${index + 1}`,
      candidate.kind === 'no_takeover' ? 'no-takeover' : 'takeover',
      `<p class="v2-spec-phrase">${esc(candidate.phrase || '')}</p>`,
      entry,
    );
  }

  function lastApplyHtml() {
    const summary = activeDraft.lastApply;
    if (!summary) return '';
    const manualCount = Number(summary.tenantsAdded || 0) + Number(summary.tenantsUpdated || 0) + Number(summary.specialsAdded || 0);
    const kept = Number(summary.conflictsKept || 0);
    return `
      <div class="v2-spec-apply-result">
        <strong>선택 후보 반영 완료</strong>
        <span>Step 2 ${manualCount}건, 참고정보 ${Number(summary.reviewAdded || 0)}건 저장</span>
        ${kept ? `<em>충돌 ${kept}건은 기존 입력값을 유지했습니다.</em>` : ''}
      </div>
    `;
  }

  function confirmedReviewHtml() {
    const manual = ensureManual();
    if (!manual) return '';
    const review = safeSpecReview(manual.specReview);
    const count = review.occupants.length + review.specialRights.length + review.takeoverNotes.length;
    if (!count) return '';
    return `
      <div class="v2-spec-confirmed">
        <strong>확인 저장된 참고정보</strong>
        <span>임차·점유 ${review.occupants.length}건 · 특수권리 문구 ${review.specialRights.length}건 · 인수 문구 ${review.takeoverNotes.length}건</span>
      </div>
    `;
  }

  function renderReview(result) {
    const candidates = result?.candidates || {};
    const occupants = Array.isArray(candidates.occupants) ? candidates.occupants : [];
    const specialRights = Array.isArray(candidates.specialRights) ? candidates.specialRights : [];
    const takeoverPhrases = Array.isArray(candidates.takeoverPhrases) ? candidates.takeoverPhrases : [];
    const warnings = Array.isArray(result?.warnings) ? result.warnings : [];
    const count = occupants.length + specialRights.length + takeoverPhrases.length;

    if (result?.stats?.rejected) {
      return `<div class="v2-spec-empty warn"><strong>추출하지 않았습니다.</strong><p>${esc(warningLabel(warnings[0]))}</p></div>`;
    }
    if (!count) {
      return `
        ${confirmedReviewHtml()}
        <div class="v2-spec-empty">
          <strong>표시할 후보가 없습니다.</strong>
          <p>라벨이 포함된 원문인지 확인하고 직접 입력 항목과 함께 검토하세요.</p>
        </div>
        ${warnings.length ? `<div class="v2-spec-warnings">${warnings.map((warning) => `<span>${esc(warningLabel(warning))}</span>`).join('')}</div>` : ''}
      `;
    }

    return `
      ${lastApplyHtml()}
      ${confirmedReviewHtml()}
      <div class="v2-spec-review-summary">
        <strong>후보 ${count}건</strong>
        <span>임차·점유 ${occupants.length} · 특수권리 ${specialRights.length} · 인수 문구 ${takeoverPhrases.length}</span>
      </div>
      ${warnings.length ? `<div class="v2-spec-warnings">${warnings.map((warning) => `<span>${esc(warningLabel(warning))}</span>`).join('')}</div>` : ''}
      <div class="v2-spec-candidate-list">
        ${occupants.map(occupantHtml).join('')}
        ${specialRights.map(specialRightHtml).join('')}
        ${takeoverPhrases.map(takeoverHtml).join('')}
      </div>
    `;
  }

  function reviewPaneHtml() {
    if (activeDraft.result) return renderReview(activeDraft.result);
    return `
      ${confirmedReviewHtml()}
      <div class="v2-spec-empty">
        <strong>${activeDraft.rawText ? '원문이 변경되었습니다.' : '원문을 붙여넣어 주세요.'}</strong>
        <p>${activeDraft.rawText ? '후보 추출을 눌러 현재 원문 기준 후보를 다시 확인하세요.' : '추출 전에는 Step 2 입력값과 권리분석 결과가 바뀌지 않습니다.'}</p>
      </div>
    `;
  }

  function updateApplyControls() {
    const mount = document.getElementById(MOUNT_ID);
    const selected = selectedCount();
    const apply = mount?.querySelector('[data-spec-action="apply"]');
    const count = mount?.querySelector('[data-spec-selected-count]');
    if (apply) apply.disabled = !selected;
    if (count) count.textContent = selected ? `${selected.toLocaleString('ko-KR')}건 선택` : '미선택';
  }

  function injectStyles() {
    if (document.getElementById('v2SpecExtractorStyles')) return;
    const style = document.createElement('style');
    style.id = 'v2SpecExtractorStyles';
    style.textContent = `
      .v2-spec-extractor { margin-top:18px; padding:18px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
      .v2-spec-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
      .v2-spec-head h4 { margin:4px 0 3px; font-size:16px; letter-spacing:0; }
      .v2-spec-head p { margin:0; color:var(--ink-3); font-size:12px; line-height:1.55; }
      .v2-spec-state { flex:0 0 auto; padding:5px 8px; border:1px solid var(--line); border-radius:6px; color:var(--ink-3); background:var(--bg); font-size:11px; font-weight:800; }
      .v2-spec-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:14px 0 12px; }
      .v2-spec-actions .v2-note { margin:0 auto 0 0; }
      .v2-spec-actions [data-spec-selected-count] { color:var(--ink-3); font-size:11px; font-weight:850; }
      .v2-spec-workspace { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); border:1px solid var(--line); border-radius:8px; overflow:hidden; background:#fff; }
      .v2-spec-pane { min-width:0; }
      .v2-spec-pane + .v2-spec-pane { border-left:1px solid var(--line); }
      .v2-spec-pane-head { min-height:44px; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border-bottom:1px solid var(--line); background:var(--bg); }
      .v2-spec-pane-head strong { font-size:12px; }
      .v2-spec-pane-head span { color:var(--ink-3); font-size:11px; }
      .v2-spec-pane-head span.warn { color:var(--danger); font-weight:850; }
      .v2-spec-source { display:block; width:100%; min-height:430px; max-height:620px; resize:vertical; border:0; padding:14px; outline:none; background:#fff; color:var(--ink); font:500 13px/1.65 var(--font-body); }
      .v2-spec-source:focus { box-shadow:inset 0 0 0 2px rgba(11,61,46,.2); }
      .v2-spec-review { min-height:430px; max-height:620px; overflow:auto; padding:12px; }
      .v2-spec-review-summary, .v2-spec-confirmed, .v2-spec-apply-result { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px; border:1px solid var(--line); border-radius:6px; background:var(--bg); }
      .v2-spec-review-summary { margin-bottom:10px; }
      .v2-spec-confirmed, .v2-spec-apply-result { margin-bottom:8px; }
      .v2-spec-review-summary strong, .v2-spec-confirmed strong, .v2-spec-apply-result strong { font-size:12px; }
      .v2-spec-review-summary span, .v2-spec-confirmed span, .v2-spec-apply-result span { color:var(--ink-3); font-size:11px; text-align:right; }
      .v2-spec-apply-result { border-color:rgba(11,61,46,.22); background:#f4faf7; }
      .v2-spec-apply-result em { color:var(--warn); font-style:normal; font-size:11px; font-weight:850; }
      .v2-spec-empty { min-height:180px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px; text-align:center; color:var(--ink-3); }
      .v2-spec-empty strong { color:var(--ink-2); font-size:13px; }
      .v2-spec-empty p { max-width:320px; margin:5px 0 0; font-size:12px; line-height:1.6; }
      .v2-spec-empty.warn { background:var(--warn-bg); color:var(--warn); }
      .v2-spec-warnings { display:flex; flex-wrap:wrap; gap:6px; margin:10px 0; }
      .v2-spec-warnings span, .v2-spec-issues span { padding:4px 7px; border-radius:5px; background:var(--warn-bg); color:var(--warn); font-size:10px; font-weight:800; }
      .v2-spec-candidate-list { display:flex; flex-direction:column; }
      .v2-spec-candidate { padding:13px 0 14px 10px; border-bottom:1px solid var(--line); border-left:3px solid var(--accent); }
      .v2-spec-candidate:last-child { border-bottom:0; }
      .v2-spec-candidate.special, .v2-spec-candidate.takeover { border-left-color:var(--warn); }
      .v2-spec-candidate.no-takeover { border-left-color:var(--ok); }
      .v2-spec-candidate-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
      .v2-spec-select { display:flex; align-items:center; gap:7px; min-width:0; font-size:12px; font-weight:850; }
      .v2-spec-select input, .v2-spec-conflict input { width:16px; height:16px; flex:0 0 auto; }
      .v2-spec-candidate-head span { color:var(--ink-3); font-size:10px; font-weight:800; }
      .v2-spec-values { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin:10px 0 0; }
      .v2-spec-values div { min-width:0; padding:8px; background:var(--bg); border:1px solid var(--line); border-radius:6px; }
      .v2-spec-values dt { color:var(--ink-3); font-size:10px; }
      .v2-spec-values dt span { margin-left:3px; color:var(--accent); font-weight:800; }
      .v2-spec-values dd { margin:2px 0 0; font-size:12px; font-weight:850; overflow-wrap:anywhere; }
      .v2-spec-phrase { margin:9px 0 0; padding:9px; background:var(--bg); border:1px solid var(--line); border-radius:6px; font-size:12px; line-height:1.6; }
      .v2-spec-conflict { display:grid; gap:4px; margin-top:9px; padding:9px; border:1px solid rgba(143,86,10,.24); border-radius:6px; background:var(--warn-bg); }
      .v2-spec-conflict strong { color:var(--warn); font-size:11px; }
      .v2-spec-conflict span, .v2-spec-conflict label { color:var(--ink-3); font-size:11px; line-height:1.45; }
      .v2-spec-conflict label { display:flex; align-items:center; gap:7px; font-weight:850; }
      .v2-spec-issues { display:flex; flex-wrap:wrap; gap:5px; margin-top:8px; }
      .v2-spec-evidence { margin-top:8px; }
      .v2-spec-evidence > span { display:block; margin-bottom:4px; color:var(--ink-3); font-size:10px; font-weight:800; }
      .v2-spec-evidence blockquote { margin:4px 0 0; padding:7px 9px; border-left:2px solid var(--line-2); background:#fff; color:var(--ink-2); font-size:11px; line-height:1.55; overflow-wrap:anywhere; }
      @media (max-width:760px) {
        .v2-spec-head { flex-direction:column; gap:8px; }
        .v2-spec-workspace { grid-template-columns:1fr; }
        .v2-spec-pane + .v2-spec-pane { border-left:0; border-top:1px solid var(--line); }
        .v2-spec-source, .v2-spec-review { min-height:300px; max-height:480px; }
        .v2-spec-values { grid-template-columns:1fr; }
        .v2-spec-actions .v2-secondary-btn, .v2-spec-actions .v2-btn { flex:1 1 auto; }
        .v2-spec-review-summary, .v2-spec-confirmed, .v2-spec-apply-result { flex-direction:column; align-items:flex-start; }
        .v2-spec-review-summary span, .v2-spec-confirmed span, .v2-spec-apply-result span { text-align:left; }
      }
    `;
    document.head.appendChild(style);
  }

  function renderMount(force = false) {
    const mount = document.getElementById(MOUNT_ID);
    if (!mount) return false;
    const caseKey = currentCaseKey();
    if (!caseKey) {
      mount.innerHTML = '';
      return false;
    }
    if (activeCaseKey !== caseKey) {
      activeCaseKey = caseKey;
      activeDraft = loadDraft(caseKey);
    }
    const signature = draftSignature(caseKey);
    if (!force && document.activeElement?.id === SOURCE_ID) {
      mount.dataset.specSignature = signature;
      return false;
    }
    if (!force && mount.dataset.specSignature === signature) return false;
    mount.dataset.specSignature = signature;
    const selected = selectedCount();
    mount.innerHTML = `
      <section class="v2-spec-extractor" aria-labelledby="v2SpecExtractorTitle">
        <div class="v2-spec-head">
          <div>
            <span class="v2-badge">명세서 후보 검토</span>
            <h4 id="v2SpecExtractorTitle">매각물건명세서 원문 후보 추출</h4>
            <p>원문과 후보는 브라우저의 현재 사건 초안에만 저장됩니다. 체크한 후보만 Step 2나 참고정보에 반영됩니다.</p>
          </div>
          <span class="v2-spec-state" data-spec-state>${activeDraft.rawText.length > MAX_TEXT_LENGTH ? '글자 수 초과 · 미저장' : activeDraft.savedAt ? '세션 초안 저장됨' : '미작성'}</span>
        </div>
        <div class="v2-spec-actions">
          <p class="v2-note">후보 추출만으로는 Step 2 입력값이나 권리분석 결과가 바뀌지 않습니다.</p>
          <span data-spec-selected-count>${selected ? `${selected.toLocaleString('ko-KR')}건 선택` : '미선택'}</span>
          <button type="button" class="v2-secondary-btn" data-spec-action="clear" ${activeDraft.rawText ? '' : 'disabled'}>초안 지우기</button>
          <button type="button" class="v2-secondary-btn" data-spec-action="extract" ${activeDraft.rawText.trim() ? '' : 'disabled'}>후보 추출</button>
          <button type="button" class="v2-btn" data-spec-action="apply" ${selected ? '' : 'disabled'}>선택 후보 Step 2 반영</button>
        </div>
        <div class="v2-spec-workspace">
          <div class="v2-spec-pane">
            <div class="v2-spec-pane-head"><strong>원문</strong><span data-spec-count class="${activeDraft.rawText.length > MAX_TEXT_LENGTH ? 'warn' : ''}">${activeDraft.rawText.length.toLocaleString('ko-KR')} / ${MAX_TEXT_LENGTH.toLocaleString('ko-KR')}자</span></div>
            <textarea id="${SOURCE_ID}" class="v2-spec-source" placeholder="매각물건명세서 원문을 붙여넣으세요.">${esc(activeDraft.rawText)}</textarea>
          </div>
          <div class="v2-spec-pane">
            <div class="v2-spec-pane-head"><strong>추출 후보</strong><span>확인 전 미반영</span></div>
            <div id="${REVIEW_ID}" class="v2-spec-review">${reviewPaneHtml()}</div>
          </div>
        </div>
      </section>
    `;
    return true;
  }

  function updateInputDraft(input) {
    activeDraft = {
      version: 1,
      rawText: input.value,
      result: null,
      selected: {},
      replace: {},
      lastApply: null,
      savedAt: '',
    };
    const mount = document.getElementById(MOUNT_ID);
    const count = mount?.querySelector('[data-spec-count]');
    const extract = mount?.querySelector('[data-spec-action="extract"]');
    const clear = mount?.querySelector('[data-spec-action="clear"]');
    const status = mount?.querySelector('[data-spec-state]');
    const review = document.getElementById(REVIEW_ID);
    if (mount) mount.dataset.specSignature = draftSignature();
    if (count) {
      count.textContent = `${activeDraft.rawText.length.toLocaleString('ko-KR')} / ${MAX_TEXT_LENGTH.toLocaleString('ko-KR')}자`;
      count.classList.toggle('warn', activeDraft.rawText.length > MAX_TEXT_LENGTH);
    }
    if (extract) extract.disabled = !activeDraft.rawText.trim();
    if (clear) clear.disabled = !activeDraft.rawText;
    if (status) status.textContent = activeDraft.rawText.length > MAX_TEXT_LENGTH ? '글자 수 초과 · 미저장' : '저장 대기';
    if (review) review.innerHTML = reviewPaneHtml();
    updateApplyControls();
    scheduleSave();
  }

  function extractCurrent() {
    const api = parser();
    const input = document.getElementById(SOURCE_ID);
    if (!api || !input) return false;
    activeDraft = {
      version: 1,
      rawText: input.value,
      result: api.parse(input.value),
      selected: {},
      replace: {},
      lastApply: null,
      savedAt: activeDraft.savedAt,
    };
    saveDraft();
    renderMount(true);
    return true;
  }

  function scheduleMount(delay = 0) {
    window.clearTimeout(mountTimer);
    mountTimer = window.setTimeout(() => renderMount(), delay);
  }

  function observeResults() {
    const root = document.getElementById('resultsSection');
    if (!root || !window.MutationObserver) return;
    const observer = new MutationObserver(() => scheduleMount(0));
    observer.observe(root, { childList: true, subtree: true });
  }

  document.addEventListener('input', (event) => {
    if (event.target?.id === SOURCE_ID) updateInputDraft(event.target);
  });

  document.addEventListener('change', (event) => {
    const select = event.target?.closest?.('[data-spec-select]');
    if (select) {
      const id = clean(select.dataset.specSelect);
      if (select.checked) activeDraft.selected[id] = true;
      else {
        delete activeDraft.selected[id];
        delete activeDraft.replace[id];
        const replace = document.querySelector(`[data-spec-replace="${selectorEscape(id)}"]`);
        if (replace) {
          replace.checked = false;
          replace.disabled = true;
        }
      }
      document.querySelectorAll(`[data-spec-replace="${selectorEscape(id)}"]`).forEach((input) => {
        input.disabled = !select.checked;
      });
      activeDraft.lastApply = null;
      updateApplyControls();
      scheduleSave();
      return;
    }

    const replace = event.target?.closest?.('[data-spec-replace]');
    if (replace) {
      const id = clean(replace.dataset.specReplace);
      if (replace.checked) activeDraft.replace[id] = true;
      else delete activeDraft.replace[id];
      activeDraft.lastApply = null;
      scheduleSave();
    }
  });

  document.addEventListener('focusout', (event) => {
    if (event.target?.id === SOURCE_ID) scheduleMount(0);
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-spec-action]');
    if (!button) {
      if (event.target.closest?.('[data-action="open-step2"]')) scheduleMount(0);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (button.dataset.specAction === 'extract') extractCurrent();
    if (button.dataset.specAction === 'apply') applyCandidates();
    if (button.dataset.specAction === 'clear') {
      clearDraft();
      renderMount(true);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    observeResults();
    scheduleMount(0);
  });

  window.__auctionSpecExtractor = {
    STORAGE_PREFIX,
    MAX_DRAFTS,
    defaultSpecReview,
    safeSpecReview,
    storageKey,
    loadDraft,
    saveDraft,
    clearDraft,
    renderReview,
    renderMount,
    draftSignature,
    candidateEntries,
    applyCandidates,
    tenantConflict,
  };
})();
