(() => {
  const MOUNT_ID = 'v2SpecExtractorMount';
  const SOURCE_ID = 'v2SpecSourceText';
  const REVIEW_ID = 'v2SpecReviewPane';
  const STORAGE_PREFIX = 'auction-note:v2:spec-extraction:';
  const MAX_DRAFTS = 10;
  const MAX_TEXT_LENGTH = 100_000;
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
  let activeCaseKey = '';
  let activeDraft = emptyDraft();
  let mountTimer = 0;
  let saveTimer = 0;

  function emptyDraft() {
    return { version: 1, rawText: '', result: null, savedAt: '' };
  }

  function parser() {
    return window.__auctionSpecParser || null;
  }

  function currentCaseKey() {
    return window.__auctionCaseScope?.currentCaseKey?.() || '';
  }

  function storageKey(caseKey = currentCaseKey()) {
    return caseKey ? `${STORAGE_PREFIX}${caseKey}` : '';
  }

  function safeDraft(value) {
    const rawText = typeof value?.rawText === 'string' && value.rawText.length <= MAX_TEXT_LENGTH
      ? value.rawText
      : '';
    const result = value?.result && typeof value.result === 'object' ? value.result : null;
    return {
      version: 1,
      rawText,
      result,
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
    return `${Number(value).toLocaleString('ko-KR')}원`;
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

  function candidateShell(label, tone, body, candidate) {
    return `
      <article class="v2-spec-candidate ${tone}">
        <div class="v2-spec-candidate-head">
          <strong>${esc(label)}</strong>
          <span>검토만 가능</span>
        </div>
        ${body}
        ${issuesHtml(candidate)}
        ${evidenceHtml(candidate)}
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
    return candidateShell(
      `임차·점유 후보 ${index + 1}`,
      'occupant',
      valuesHtml(candidate.values, candidate.confidence, definitions),
      candidate,
    );
  }

  function specialRightHtml(candidate, index) {
    const values = {
      typeCandidate: candidate.typeCandidate,
      holder: candidate.holder,
      date: candidate.date,
      amount: candidate.amount,
    };
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
      candidate,
    );
  }

  function takeoverHtml(candidate, index) {
    const labels = {
      no_takeover: '인수 없음 문구',
      possible_takeover: '인수 가능 의심 문구',
      ambiguous: '인수 여부 확인 문구',
    };
    return candidateShell(
      `${labels[candidate.kind] || '인수 관련 문구'} ${index + 1}`,
      candidate.kind === 'no_takeover' ? 'no-takeover' : 'takeover',
      `<p class="v2-spec-phrase">${esc(candidate.phrase || '')}</p>`,
      candidate,
    );
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
        <div class="v2-spec-empty">
          <strong>표시할 후보가 없습니다.</strong>
          <p>라벨이 포함된 원문인지 확인하고 직접 입력 항목과 함께 검토하세요.</p>
        </div>
        ${warnings.length ? `<div class="v2-spec-warnings">${warnings.map((warning) => `<span>${esc(warningLabel(warning))}</span>`).join('')}</div>` : ''}
      `;
    }

    return `
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
      <div class="v2-spec-empty">
        <strong>${activeDraft.rawText ? '원문이 변경되었습니다.' : '원문을 붙여넣어 주세요.'}</strong>
        <p>${activeDraft.rawText ? '후보 추출을 눌러 현재 원문 기준 후보를 다시 확인하세요.' : '추출 전에는 Step 2 입력값과 권리분석 결과가 바뀌지 않습니다.'}</p>
      </div>
    `;
  }

  function draftSignature(caseKey = activeCaseKey || currentCaseKey()) {
    return `${caseKey}:${activeDraft.rawText.length}:${activeDraft.result?.rawHash || ''}:${activeDraft.savedAt}`;
  }

  function injectStyles() {
    if (document.getElementById('v2SpecExtractorStyles')) return;
    const style = document.createElement('style');
    style.id = 'v2SpecExtractorStyles';
    style.textContent = `
      .v2-spec-extractor { margin-top:18px; padding:18px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
      .v2-spec-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
      .v2-spec-head h4 { margin:4px 0 3px; font-size:16px; }
      .v2-spec-head p { margin:0; color:var(--ink-3); font-size:12px; line-height:1.55; }
      .v2-spec-state { flex:0 0 auto; padding:5px 8px; border:1px solid var(--line); border-radius:6px; color:var(--ink-3); background:var(--bg); font-size:11px; font-weight:800; }
      .v2-spec-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:14px 0 12px; }
      .v2-spec-actions .v2-note { margin:0 auto 0 0; }
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
      .v2-spec-review-summary { display:flex; align-items:center; justify-content:space-between; gap:10px; padding-bottom:10px; border-bottom:1px solid var(--line); }
      .v2-spec-review-summary strong { font-size:13px; }
      .v2-spec-review-summary span { color:var(--ink-3); font-size:11px; text-align:right; }
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
      .v2-spec-candidate-head strong { font-size:12px; }
      .v2-spec-candidate-head span { color:var(--ink-3); font-size:10px; font-weight:800; }
      .v2-spec-values { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin:10px 0 0; }
      .v2-spec-values div { min-width:0; padding:8px; background:var(--bg); border:1px solid var(--line); border-radius:6px; }
      .v2-spec-values dt { color:var(--ink-3); font-size:10px; }
      .v2-spec-values dt span { margin-left:3px; color:var(--accent); font-weight:800; }
      .v2-spec-values dd { margin:2px 0 0; font-size:12px; font-weight:850; overflow-wrap:anywhere; }
      .v2-spec-phrase { margin:9px 0 0; padding:9px; background:var(--bg); border:1px solid var(--line); border-radius:6px; font-size:12px; line-height:1.6; }
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
    mount.innerHTML = `
      <section class="v2-spec-extractor" aria-labelledby="v2SpecExtractorTitle">
        <div class="v2-spec-head">
          <div>
            <span class="v2-badge">명세서 후보 검토</span>
            <h4 id="v2SpecExtractorTitle">매각물건명세서 원문 후보 추출</h4>
            <p>원문과 후보는 이 브라우저 탭의 현재 사건 초안에만 저장되며 자동 확정되지 않습니다.</p>
          </div>
          <span class="v2-spec-state" data-spec-state>${activeDraft.rawText.length > MAX_TEXT_LENGTH ? '글자 수 초과 · 미저장' : activeDraft.savedAt ? '세션 초안 저장됨' : '미작성'}</span>
        </div>
        <div class="v2-spec-actions">
          <p class="v2-note">원문은 서버로 전송되지 않으며, 후보 추출만으로 Step 2 입력값이나 권리분석 결과가 바뀌지 않습니다.</p>
          <button type="button" class="v2-secondary-btn" data-spec-action="clear" ${activeDraft.rawText ? '' : 'disabled'}>초안 지우기</button>
          <button type="button" class="v2-btn" data-spec-action="extract" ${activeDraft.rawText.trim() ? '' : 'disabled'}>후보 추출</button>
        </div>
        <div class="v2-spec-workspace">
          <div class="v2-spec-pane">
            <div class="v2-spec-pane-head"><strong>원문</strong><span data-spec-count class="${activeDraft.rawText.length > MAX_TEXT_LENGTH ? 'warn' : ''}">${activeDraft.rawText.length.toLocaleString('ko-KR')} / ${MAX_TEXT_LENGTH.toLocaleString('ko-KR')}자</span></div>
            <textarea id="${SOURCE_ID}" class="v2-spec-source" placeholder="매각물건명세서 원문을 붙여넣으세요.">${esc(activeDraft.rawText)}</textarea>
          </div>
          <div class="v2-spec-pane">
            <div class="v2-spec-pane-head"><strong>추출 후보</strong><span>Step 2 미반영</span></div>
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
    storageKey,
    loadDraft,
    saveDraft,
    clearDraft,
    renderReview,
    renderMount,
    draftSignature,
  };
})();
