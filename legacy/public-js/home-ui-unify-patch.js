(() => {
  const css = `
    .hero { min-height:640px !important; display:flex !important; align-items:center !important; }
    .hero-inner { width:100% !important; }
    .hero-copy { margin-bottom:34px !important; }
    .home-hero-tools { max-width:920px !important; width:100% !important; margin:0 auto !important; min-height:196px !important; }
    .home-hero-panel { width:100% !important; }

    .home-hero-panel > .search-box,
    .home-hero-panel > .bulk-card,
    .home-hero-panel > .date-rec-card,
    .home-hero-panel > .date-recs-card,
    .home-hero-panel > .today-dashboard-card,
    .home-tool-empty {
      max-width:920px !important;
      width:100% !important;
      margin:0 auto !important;
      background:#fff !important;
      color:var(--ink) !important;
      border:1px solid var(--line) !important;
      border-radius:20px !important;
      padding:22px !important;
      box-shadow:0 18px 42px rgba(0,0,0,.12) !important;
    }

    .home-hero-panel > .date-rec-card,
    .home-hero-panel > .date-recs-card { margin-top:0 !important; }
    .date-rec-head h3 { color:var(--ink) !important; font-family:var(--font-serif) !important; }
    .date-rec-head p, .date-rec-status { color:var(--ink-3) !important; }
    .date-score-help { background:var(--bg) !important; border-color:var(--line) !important; color:var(--ink-2) !important; }
    .date-score-help b { color:var(--accent) !important; }
    .date-rec-form label { color:var(--ink-3) !important; }
    .date-rec-form input, .date-rec-form select { background:var(--bg) !important; border:1px solid var(--line) !important; color:var(--ink) !important; }
    .date-rec-actions button { background:var(--accent) !important; color:var(--accent-ink) !important; }
    .date-rec-actions button.secondary { background:var(--bg) !important; color:var(--ink-2) !important; border:1px solid var(--line) !important; }
    .date-rec-debug { max-height:220px !important; overflow:auto !important; background:#111 !important; color:#f4e9c7 !important; }
    .date-rec-deploy-warn, .date-rec-warn { color:#7a271a !important; background:#fff1f0 !important; border-color:#fecdca !important; }

    .home-tool-empty { color:var(--ink-3) !important; font-size:13px !important; line-height:1.6 !important; text-align:center !important; }
    .home-tool-empty b { color:var(--ink) !important; }
    .results-section.container { min-height:120px !important; }

    @media (max-width:1040px){ .hero{min-height:620px !important;} }
    @media (max-width:720px){ .hero{min-height:auto !important; padding-top:56px !important; padding-bottom:44px !important;} .hero-copy{margin-bottom:24px !important;} .home-hero-tools{min-height:0 !important;} }
  `;
  let style = document.getElementById('homeUiUnifyPatchStyles');
  if (!style) {
    style = document.createElement('style');
    style.id = 'homeUiUnifyPatchStyles';
    document.head.appendChild(style);
  }
  style.textContent = css;

  function text(el){ return String(el?.textContent || '').replace(/\s+/g,' ').trim(); }
  function resultsBusy(){
    const t = text(document.getElementById('resultsSection'));
    return /대법원 경매정보에서 기본정보를 가져오는 중|기본정보 수집|Step\s*1|현재 기준 1차 판단 요약|자동 수집된 사건 정보|이해관계인|권리분석|요청 실패|사건 정보를 찾지 못했습니다|❌/.test(t);
  }
  const oldSwitch = window.switchHomeTab;
  window.switchHomeTab = function(tab){
    if (resultsBusy()) {
      document.getElementById('resultsSection')?.scrollIntoView({behavior:'smooth', block:'start'});
      return;
    }
    return oldSwitch ? oldSwitch(tab) : undefined;
  };
  window.GM?.patches?.register?.('home-ui-unify', { version:'v1' });
})();
