(() => {
  if (document.getElementById('landingPolishPatchStyles')) return;
  const style = document.createElement('style');
  style.id = 'landingPolishPatchStyles';
  style.textContent = `
    :root { --font-serif: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .site-header { background: rgba(246,245,241,.96); border-bottom: 1px solid var(--line); padding: 0; }
    .header-inner { min-height: 82px; display:flex; align-items:center; }
    .brand { display:inline-flex; align-items:center; gap:14px; text-decoration:none; color:inherit; }
    .brand-mark { width:48px; height:48px; border-radius:14px; background:#080D15; color:var(--accent-ink); font-family:var(--font-body); font-size:23px; font-weight:800; box-shadow:0 8px 22px rgba(8,13,21,.12); }
    .brand-text h1 { font-family:var(--font-body); font-size:24px; font-weight:850; line-height:1.05; letter-spacing:-.045em; }
    .brand-text p { margin-top:5px; font-size:14px; font-weight:500; color:var(--ink-3); letter-spacing:-.02em; }

    .hero { background: radial-gradient(circle at 82% 10%, rgba(244,233,199,.08), transparent 28%), linear-gradient(180deg,#074332 0%,#063727 100%); padding:58px 0 46px; }
    .hero-inner { position:relative; }
    .hero-copy { max-width:760px; margin:0 auto 28px; text-align:center; }
    .hero-eyebrow { display:inline-flex; padding:8px 14px; border-radius:999px; background:rgba(255,255,255,.09); border:1px solid rgba(255,255,255,.12); color:var(--accent-ink); font-size:13px; font-weight:750; margin-bottom:18px; }
    .hero-title { font-family:var(--font-body); font-size:clamp(30px,4.2vw,46px); font-weight:850; line-height:1.22; letter-spacing:-.055em; margin-bottom:18px; word-break:keep-all; }
    .hero-title em { color:var(--accent-ink); font-style:normal; }
    .hero-sub { max-width:640px; font-size:17px; line-height:1.72; letter-spacing:-.03em; color:rgba(246,245,241,.74); word-break:keep-all; }

    .search-box { background:#fff; color:var(--ink); border:1px solid rgba(229,228,222,.92); border-radius:22px; padding:22px; max-width:920px; box-shadow:0 18px 48px rgba(0,0,0,.18); }
    .search-title { display:flex; gap:12px; align-items:flex-start; margin-bottom:18px; }
    .search-title b { display:block; font-size:20px; font-weight:850; letter-spacing:-.04em; }
    .search-title p { margin:4px 0 0; color:var(--ink-3); font-size:13px; line-height:1.45; }
    .search-icon { width:36px; height:36px; border-radius:12px; display:grid; place-items:center; background:var(--accent-soft); color:var(--accent); font-size:20px; font-weight:900; }
    .search-row { display:grid; grid-template-columns:minmax(220px,1.4fr) minmax(90px,.55fr) minmax(180px,1fr) auto; gap:12px; align-items:end; }
    .field { display:flex; flex-direction:column; gap:6px; min-width:0; }
    .field > span { color:var(--ink-3); font-size:12px; font-weight:750; }
    .search-row select, .search-row input { width:100%; background:#fff; border:1px solid var(--line-2); color:var(--ink); padding:13px 14px; border-radius:12px; font-size:15px; font-weight:650; outline:none; }
    .search-row select option { background:#fff; color:var(--ink); }
    .search-row input::placeholder { color:#A4ACB6; font-weight:500; }
    .search-row select:focus, .search-row input:focus { border-color:var(--accent); box-shadow:0 0 0 3px rgba(11,61,46,.1); }
    .case-input-wrap { position:relative; }
    .case-input-wrap .sep { position:absolute; left:13px; top:50%; transform:translateY(-50%); color:var(--accent); font-size:13px; font-weight:850; pointer-events:none; }
    .case-input-wrap input { padding-left:48px; }
    .btn-primary { background:var(--accent); color:#fff; min-height:48px; padding:0 22px; font-weight:850; box-shadow:0 10px 22px rgba(11,61,46,.18); }
    .search-hint { color:var(--ink-3); font-weight:650; }

    @media (max-width:760px) {
      .container { padding-left:18px; padding-right:18px; }
      .header-inner { min-height:76px; }
      .brand-mark { width:44px; height:44px; border-radius:13px; font-size:21px; }
      .brand-text h1 { font-size:22px; }
      .brand-text p { font-size:13px; margin-top:3px; }
      .hero { padding:38px 0 32px; }
      .hero-copy { text-align:left; margin-bottom:22px; }
      .hero-title { text-align:left; font-size:clamp(28px,8vw,38px); line-height:1.2; }
      .hero-sub { text-align:left; font-size:15.5px; margin-left:0; }
      .hero-eyebrow { margin-bottom:14px; }
      .search-box { padding:18px; border-radius:20px; }
      .search-row { grid-template-columns:1fr 110px; gap:10px; }
      .court-field, .case-field, .btn-primary { grid-column:1/-1; }
      .btn-primary { width:100%; min-height:50px; }
    }
    @media (max-width:420px) { .hero-title { font-size:30px; } .search-row { grid-template-columns:1fr; } .year-field { grid-column:1/-1; } }
  `;
  document.head.appendChild(style);
  window.GM?.patches?.register?.('landing-polish', { version: 'v1' });
})();
