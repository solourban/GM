(() => {
  const CARD_ID = 'v2EssentialDocumentsCard';
  const STYLE_ID = 'v2EssentialDocumentsStyles';
  const COPY_STATUS_ID = 'v2EssentialDocumentsCopyStatus';
  const CHANGE_EVENT = 'auction:result-card-change';
  const OFFICIAL_URL = 'https://www.courtauction.go.kr/';
  const DOCUMENTS = [
    {
      id: 'sale-spec',
      title: '매각물건명세서',
      checks: ['임차인·점유자', '배당요구일', '인수 문구·특별매각조건'],
    },
    {
      id: 'site-report',
      title: '현황조사보고서',
      checks: ['실제 점유자', '전입·점유 조사 내용', '조사 불능·미상 문구'],
    },
    {
      id: 'appraisal-report',
      title: '감정평가서',
      checks: ['면적·대지권', '구조·이용상태', '하자·감정 기준일'],
    },
  ];

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

  function appState() {
    return window.__auctionV2?.state || null;
  }

  function root() {
    return document.getElementById('resultsSection');
  }

  function hasCase() {
    return Boolean(appState()?.raw || document.getElementById('analysisCard'));
  }

  function anchor() {
    return document.getElementById('v2RiskBriefCard')
      || document.getElementById('analysisCard')
      || document.getElementById('step2InputCard')
      || root()?.querySelector('.v2-result-card:not(#v2WorkflowShell)');
  }

  function inputValue(id) {
    return clean(document.getElementById(id)?.value);
  }

  function caseInfo() {
    const state = appState();
    const raw = state?.raw || {};
    const basic = raw.basic || {};
    const formCase = [inputValue('saYearV2'), inputValue('saSerV2')].every(Boolean)
      ? `${inputValue('saYearV2')}타경${inputValue('saSerV2')}`
      : '';
    return {
      court: clean(raw.court || basic['법원'] || inputValue('jiwonNmV2')),
      caseNo: clean(raw.caseNo || basic['사건번호'] || formCase),
      saleDate: clean(basic['매각기일']),
    };
  }

  function searchCopyText(info = caseInfo()) {
    return [
      '법원경매정보 공식 문서 확인',
      `법원: ${info.court || '확인 필요'}`,
      `사건번호: ${info.caseNo || '확인 필요'}`,
      `매각기일: ${info.saleDate || '확인 필요'}`,
      '확인 문서: 매각물건명세서, 현황조사보고서, 감정평가서',
      OFFICIAL_URL,
    ].join('\n');
  }

  function renderCaseGuide(info = caseInfo()) {
    return `
      <div class="v2-grid compact v2-essential-search">
        <div class="v2-info"><div class="k">검색 법원</div><div class="v">${esc(info.court || '확인 필요')}</div></div>
        <div class="v2-info"><div class="k">사건번호</div><div class="v">${esc(info.caseNo || '확인 필요')}</div></div>
        <div class="v2-info"><div class="k">매각기일</div><div class="v">${esc(info.saleDate || '확인 필요')}</div></div>
      </div>
    `;
  }

  function renderDocumentRows() {
    return `
      <div class="v2-essential-doc-list">
        ${DOCUMENTS.map((doc) => `
          <div class="v2-essential-doc" data-document-kind="${esc(doc.id)}" data-document-status="확인 필요">
            <div>
              <strong>${esc(doc.title)}</strong>
              <span>공식 사이트에서 원문 확인</span>
            </div>
            <div><span class="v2-pill unknown">확인 필요</span></div>
            <ul>${doc.checks.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
          </div>
        `).join('')}
      </div>
    `;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .v2-essential-search { margin-top:14px; }
      .v2-essential-doc-list { display:grid; gap:10px; margin-top:14px; }
      .v2-essential-doc { display:grid; grid-template-columns:minmax(150px,.8fr) minmax(92px,.4fr) minmax(0,1.6fr); gap:12px; align-items:start; padding:12px; border:1px solid var(--line); border-radius:12px; background:var(--bg); }
      .v2-essential-doc strong, .v2-essential-doc span { display:block; }
      .v2-essential-doc strong { font-size:15px; }
      .v2-essential-doc span { margin-top:4px; color:var(--ink-3); font-size:12px; line-height:1.45; }
      .v2-essential-doc ul { margin:0; padding-left:18px; color:var(--ink-2); font-size:13px; line-height:1.55; }
      #${COPY_STATUS_ID} { align-self:center; min-height:20px; }
      @media (max-width: 720px) {
        .v2-essential-doc { grid-template-columns:1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function renderCard() {
    return `
      <span class="v2-badge">필수 문서</span>
      <h3>입찰 전 공식 문서 확인</h3>
      <p class="v2-note">법원경매정보에서 아래 사건을 다시 검색한 뒤, 문서 원문을 열어 확인하세요. 문서 존재 여부와 공개 상태는 자동 판정하지 않습니다.</p>
      ${renderCaseGuide()}
      ${renderDocumentRows()}
      <div class="v2-cta-row">
        <a class="v2-secondary-btn" href="${OFFICIAL_URL}" target="_blank" rel="noopener noreferrer">공식 사이트에서 사건 검색</a>
        <button type="button" class="v2-secondary-btn" data-essential-copy="search">검색값 복사</button>
        <span id="${COPY_STATUS_ID}" class="v2-note" aria-live="polite"></span>
      </div>
      <p class="v2-note">매각물건명세서의 임차인·배당요구·인수 문구, 현황조사보고서의 점유관계, 감정평가서의 면적·대지권·하자는 입찰 전 직접 확인 대상으로 남깁니다.</p>
    `;
  }

  async function copySearchText() {
    const text = searchCopyText();
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  }

  function setCopyStatus(message) {
    const status = document.getElementById(COPY_STATUS_ID);
    if (status) status.textContent = message || '';
  }

  function bindCard(card) {
    if (card.dataset.essentialDocsBound === '1') return;
    card.dataset.essentialDocsBound = '1';
    card.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-essential-copy]');
      if (!button) return;
      button.disabled = true;
      setCopyStatus('복사 중...');
      try {
        const ok = await copySearchText();
        setCopyStatus(ok ? '검색값을 복사했습니다.' : '복사를 완료하지 못했습니다.');
      } catch (_) {
        setCopyStatus('복사를 완료하지 못했습니다.');
      } finally {
        button.disabled = false;
      }
    });
  }

  function dispatchChange() {
    document.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { source: CARD_ID } }));
  }

  function upsert() {
    const resultRoot = root();
    if (!resultRoot) return;
    const existing = document.getElementById(CARD_ID);
    if (!hasCase()) {
      if (existing) {
        existing.remove();
        dispatchChange();
      }
      return;
    }

    const target = anchor();
    if (!target) return;
    injectStyles();
    const card = existing || document.createElement('section');
    const isNew = !existing;
    card.id = CARD_ID;
    card.className = 'v2-result-card';
    card.dataset.workflowStep = 'risk';
    card.innerHTML = renderCard();
    bindCard(card);

    if (isNew) {
      target.insertAdjacentElement('afterend', card);
      dispatchChange();
    } else if (card.previousElementSibling !== target && !card.dataset.resultOrderIndex) {
      target.insertAdjacentElement('afterend', card);
      dispatchChange();
    }
  }

  function observe() {
    const resultRoot = root();
    if (!resultRoot || resultRoot.dataset.essentialDocsObserved === '1' || !window.MutationObserver) return;
    resultRoot.dataset.essentialDocsObserved = '1';
    const observer = new MutationObserver((records) => {
      if (records.some((record) => record.type === 'childList')) upsert();
    });
    observer.observe(resultRoot, { childList: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    observe();
    upsert();
  });
  document.addEventListener(CHANGE_EVENT, upsert);
  window.__auctionEssentialDocuments = {
    upsert,
    CARD_ID,
    OFFICIAL_URL,
    DOCUMENTS: DOCUMENTS.map((doc) => ({ ...doc })),
    caseInfo,
    searchCopyText,
  };
})();
