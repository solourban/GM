(() => {
  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function injectStyles() {
    if (document.getElementById('apiGuidePatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'apiGuidePatchStyles';
    style.textContent = `
      .api-guide-card { margin-top:18px; border:1px solid rgba(246,245,241,.18); border-radius:18px; padding:18px; background:rgba(246,245,241,.08); color:#F6F5F1; }
      .api-guide-card h3 { margin:0 0 8px; color:var(--accent-ink); font-family:var(--font-serif); font-size:18px; }
      .api-guide-card p { margin:0 0 12px; color:rgba(246,245,241,.7); font-size:13px; line-height:1.55; }
      .api-guide-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px; margin-top:12px; }
      .api-guide-box { border:1px solid rgba(246,245,241,.18); border-radius:14px; background:rgba(0,0,0,.16); padding:13px; }
      .api-guide-box .top { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px; }
      .api-guide-box b { color:#F6F5F1; }
      .api-guide-box code { display:block; margin-top:8px; padding:9px 10px; border-radius:10px; background:rgba(0,0,0,.26); color:#F4E9C7; font-size:12px; overflow-wrap:anywhere; }
      .api-guide-pill { display:inline-block; border-radius:999px; padding:4px 9px; font-size:11px; font-weight:900; white-space:nowrap; }
      .api-guide-pill.good { background:rgba(34,197,94,.18); color:#86efac; }
      .api-guide-pill.warn { background:rgba(245,158,11,.18); color:#fde68a; }
      .api-guide-steps { margin:12px 0 0; padding-left:18px; color:rgba(246,245,241,.76); font-size:13px; line-height:1.65; }
      .api-guide-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
      .api-guide-actions button { background:var(--accent-ink); color:var(--accent); border:none; border-radius:10px; padding:10px 14px; font-weight:900; cursor:pointer; }
      .api-guide-actions button.secondary { background:rgba(246,245,241,.1); color:#F6F5F1; border:1px solid rgba(246,245,241,.18); }
      .api-guide-small { color:rgba(246,245,241,.62); font-size:12px; line-height:1.55; margin-top:10px; }
    `;
    document.head.appendChild(style);
  }

  async function loadConfig() {
    try {
      return await fetch('/api/config', { cache: 'no-store' }).then((r) => r.json());
    } catch {
      return { ok: false };
    }
  }

  function configBox(title, ok, envNames, desc) {
    return `
      <div class="api-guide-box">
        <div class="top">
          <b>${esc(title)}</b>
          <span class="api-guide-pill ${ok ? 'good' : 'warn'}">${ok ? '설정됨' : '설정 필요'}</span>
        </div>
        <div class="api-guide-small">${esc(desc)}</div>
        <code>${envNames.map(esc).join('\n또는 ')}</code>
      </div>
    `;
  }

  async function renderApiGuide(forceOpen = false) {
    injectStyles();
    const searchBox = document.querySelector('.search-box');
    if (!searchBox) return;
    const existing = document.querySelector('.api-guide-card');
    const config = await loadConfig();
    const hasKakao = Boolean(config.hasKakaoMap);
    const hasMolit = Boolean(config.hasMolit);

    if (existing) existing.remove();
    if (hasKakao && hasMolit && !forceOpen) return;

    searchBox.insertAdjacentHTML('afterend', `
      <div class="api-guide-card">
        <h3>🔑 지도·실거래가 API 설정 가이드</h3>
        <p>지도와 실거래가 기능을 제대로 쓰려면 Railway 환경변수에 API 키를 넣어야 합니다. 키가 없어도 기본 사건조회·권리분석·비교표는 계속 사용할 수 있습니다.</p>
        <div class="api-guide-grid">
          ${configBox('Kakao 지도', hasKakao, ['KAKAO_JS_KEY'], 'Step 1 입지분석 지도 표시와 주소 좌표 변환에 사용합니다.')}
          ${configBox('국토부 실거래가', hasMolit, ['MOLIT_API_KEY', 'DATA_GO_KR_KEY'], '아파트 실거래가 조회와 시세 3단 시나리오 반영에 사용합니다.')}
        </div>
        <ol class="api-guide-steps">
          <li>Railway 프로젝트 접속</li>
          <li>Service 선택 → Variables 메뉴 이동</li>
          <li>위 환경변수 이름으로 키 추가</li>
          <li>Redeploy 후 우측 하단 <b>진단</b> 버튼으로 설정 여부 확인</li>
        </ol>
        <div class="api-guide-actions">
          <button type="button" onclick="refreshApiGuide()">설정 다시 확인</button>
          <button type="button" class="secondary" onclick="hideApiGuide()">닫기</button>
        </div>
        <div class="api-guide-small">주의: JavaScript 지도 키는 브라우저에서 쓰는 공개 키입니다. 국토부/공공데이터 키는 서버에서만 호출되도록 현재 구조에 넣어두었습니다.</div>
      </div>
    `);
  }

  window.refreshApiGuide = function() {
    renderApiGuide(true);
  };

  window.hideApiGuide = function() {
    document.querySelector('.api-guide-card')?.remove();
  };

  document.addEventListener('DOMContentLoaded', () => renderApiGuide(false));
  if (document.body) renderApiGuide(false);
})();
