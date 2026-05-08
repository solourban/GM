(() => {
  const css = `
    .gm-map-empty-small{border:1px solid #e5dfd5;background:#fbfaf7;border-radius:14px;padding:16px 18px!important;min-height:auto!important;color:#111827!important;text-align:left!important}
    .gm-map-empty-small .t{font-weight:900;font-size:16px;margin-bottom:4px}.gm-map-empty-small .d{color:#667085;font-size:13px;line-height:1.55}
    .gm-hide-before-step1{display:none!important}
    .gm-stake-card.gm-collapsed table tbody tr:nth-child(n+9),.gm-auto-card.gm-collapsed table tbody tr:nth-child(n+9){display:none}
    .gm-stake-tools,.gm-auto-tools{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:10px 0 12px;color:#667085;font-size:13px}
    .gm-stake-tools button,.gm-auto-tools button{background:#004733;color:#fff2c7;border:0;border-radius:10px;padding:9px 12px;font-weight:900;cursor:pointer}
    .gm-temp-note{margin:8px 0 10px;color:#667085;font-size:13px;line-height:1.55}.gm-temp-note b{color:#0b4f3f}
    .gm-schedule-small{padding-top:14px!important;padding-bottom:14px!important}.gm-schedule-small .note,.gm-schedule-small .warn-note{font-size:13px!important;line-height:1.55!important}
    .gm-address-wrap{display:block;line-height:1.45}.gm-address-wrap .main{display:block}.gm-address-wrap .sub{display:block;margin-top:4px;font-size:.86em;color:#344054}.gm-address-wrap .building{display:block;margin-top:3px;font-size:.86em;color:#667085}
    .gm-api-state{position:relative}.gm-api-state .gm-api-kicker{display:block;color:#667085;font-size:12px;font-weight:800;margin-bottom:6px}.gm-api-state .gm-api-main{display:block;font-size:17px;font-weight:900}.gm-api-state .gm-api-desc{display:block;color:#667085;font-size:12.5px;line-height:1.5;margin-top:8px}
    .gm-molit-ready{border-color:#d6eadf!important;background:#f3fbf6!important}.gm-molit-ready .gm-api-main{color:#0b4f3f}.gm-kakao-wait .gm-api-main{color:#111827}
  `;
  const old = document.getElementById('step1UxPolishStyles');
  if(old) old.textContent = css;
  else { const s=document.createElement('style'); s.id='step1UxPolishStyles'; s.textContent=css; document.head.appendChild(s); }

  function tx(el){return String(el&&el.textContent||'').replace(/\s+/g,' ').trim()}
  function heading(re){return [...document.querySelectorAll('h1,h2,h3,h4,strong,b')].find(el=>re.test(tx(el)))}
  function cardOf(el){let c=el;for(let i=0;c&&i<8;i++,c=c.parentElement){const cls=String(c.className||'');if(c.offsetWidth>300&&(c.querySelector('table')||/card|box|panel|section|extra/i.test(cls)))return c}return el&&el.parentElement}
  function isLeafish(el){return el && el.children.length <= 1 && tx(el).length < 170}
  function hasStep1Result(){return Boolean(heading(/Step\s*1\s*완료|기본정보\s*수집|물건·현황\s*요약|입지분석\s*\/\s*시세\s*검증|이해관계인\s*\(/))}
  function isLoading(){return /가져오는 중|조회 중|수집 중|로딩 중/.test(tx(document.body))}

  function summaryTitle(){
    const h=heading(/최종\s*입찰\s*판단\s*요약/);
    if(!h||h.dataset.gmDone)return;
    h.dataset.gmDone='1';
    h.textContent='현재 기준 1차 판단 요약';
    if(!h.parentElement.querySelector('.gm-temp-note')){
      const note=document.createElement('div');
      note.className='gm-temp-note';
      note.innerHTML='<b>임시 판단입니다.</b> 명세서·임차인·시세·자금 입력 후 점수와 판단이 갱신됩니다.';
      h.insertAdjacentElement('afterend',note);
    }
  }

  function gateMapCards(){
    const allow = hasStep1Result() && !isLoading();
    [...document.querySelectorAll('.gm-map-empty-small')].forEach(el=>{
      el.classList.toggle('gm-hide-before-step1', !allow);
    });
  }

  function mapEmpty(){
    if(!hasStep1Result() || isLoading()) { gateMapCards(); return; }
    const box=[...document.querySelectorAll('div,section')].find(el=>{
      const t=tx(el);
      return !el.dataset.gmDone && t.includes('지도 로딩 실패') && t.includes('Kakao 지도 SDK 로드 실패') && el.offsetHeight>90;
    });
    if(!box){ gateMapCards(); return; }
    box.dataset.gmDone='1';
    box.className=(box.className+' gm-map-empty-small').trim();
    box.innerHTML='<div class="t">지도 연동 필요</div><div class="d">Kakao API 키가 정상 연결되면 지도와 주변 입지 분석이 표시됩니다. 지금은 카카오맵 열기 버튼으로 주소를 확인하세요.</div>';
    gateMapCards();
  }

  function scheduleSmall(){
    const h=heading(/진행일정\s*\/\s*매각기일/);
    const card=h&&cardOf(h);
    if(!card||card.dataset.gmSchedule)return;
    if(!tx(card).includes('기일내역이 자동 조회되지 않았습니다'))return;
    card.dataset.gmSchedule='1';
    card.classList.add('gm-schedule-small');
    [...card.querySelectorAll('div,p')].forEach(el=>{if(tx(el).includes('기일내역이 자동 조회되지 않았습니다'))el.textContent='기일내역은 원문에서 재확인하세요. 현재는 자동 수집된 매각기일만 요약에 반영했습니다.'});
  }

  function collapseTable({titleRe, cardClass, toolClass, label}){
    const h=heading(titleRe);
    const card=h&&cardOf(h);
    const table=card&&card.querySelector('table');
    if(!card||!table||card.dataset[cardClass])return;
    const rows=[...table.querySelectorAll('tbody tr')];
    if(rows.length<=8)return;
    card.dataset[cardClass]='1';
    card.classList.add(cardClass,'gm-collapsed');
    const tools=document.createElement('div');
    tools.className=toolClass;
    tools.innerHTML='<div><b>요약 표시</b> · 전체 '+rows.length+'개 항목 중 8개만 우선 표시</div><button type="button">상세 펼치기</button>';
    table.insertAdjacentElement('beforebegin',tools);
    tools.querySelector('button').onclick=()=>{const collapsed=card.classList.toggle('gm-collapsed');tools.querySelector('button').textContent=collapsed?'상세 펼치기':'상세 접기'};
  }

  function autoInfo(){collapseTable({titleRe:/자동\s*수집된\s*사건\s*정보/,cardClass:'gm-auto-card',toolClass:'gm-auto-tools',label:'사건정보'})}
  function stakeholders(){collapseTable({titleRe:/이해관계인\s*\(/,cardClass:'gm-stake-card',toolClass:'gm-stake-tools',label:'이해관계인'})}

  function splitAddress(raw){
    const s=String(raw||'').replace(/\s+/g,' ').trim();
    if(!s||s.includes('gm-address-wrap'))return null;
    const m=s.match(/\(([^()]+)\)\s*$/);
    const building=m?m[0]:'';
    const body=building?s.slice(0,s.length-building.length).trim():s;
    const parts=body.split(',').map(v=>v.trim()).filter(Boolean);
    if(parts.length<2&&!building)return null;
    return{main:parts[0]||body,sub:parts.slice(1).join(', '),building};
  }

  function addressLines(){
    const selectors='td,.addr,.address,.case-address,.basic-address,.location-address';
    const els=[...document.querySelectorAll(selectors)].filter(el=>{
      const t=tx(el);
      return !el.dataset.gmAddr && isLeafish(el) && /서울특별시|서울시|경기도|충청남도|부산광역시|대구광역시|인천광역시/.test(t) && /\d/.test(t);
    });
    els.slice(0,6).forEach(el=>{
      const p=splitAddress(tx(el));
      if(!p)return;
      el.dataset.gmAddr='1';
      el.innerHTML='<span class="gm-address-wrap"><span class="main">'+p.main+'</span>'+(p.sub?'<span class="sub">'+p.sub+'</span>':'')+(p.building?'<span class="building">'+p.building+'</span>':'')+'</span>';
    });
  }

  function apiCards(){
    if(!hasStep1Result() || isLoading()) return;
    [...document.querySelectorAll('div,span')].forEach(el=>{
      const t=tx(el);
      if(el.dataset.gmApi||!isLeafish(el))return;
      if(t==='Kakao API 키 필요'){
        el.dataset.gmApi='1';
        el.classList.add('gm-api-state','gm-kakao-wait');
        el.innerHTML='<span class="gm-api-kicker">지도 연동</span><span class="gm-api-main">Kakao API 연결 필요</span><span class="gm-api-desc">연결 후 지도와 주변 입지 분석이 표시됩니다.</span>';
      }else if(t==='국토부 API 연동 필요'){
        el.dataset.gmApi='1';
        el.classList.add('gm-api-state','gm-molit-ready');
        el.innerHTML='<span class="gm-api-kicker">실거래가</span><span class="gm-api-main">국토부 API 조회 가능</span><span class="gm-api-desc">아래 실거래가 조회에서 같은 건물·유사 거래를 확인하세요.</span>';
      }
    });
  }

  function hideStaleOnSearch(){
    [...document.querySelectorAll('button')].forEach(btn=>{
      if(btn.dataset.gmSearchBound)return;
      if(!/물건\s*기본정보\s*조회|조회/.test(tx(btn)))return;
      btn.dataset.gmSearchBound='1';
      btn.addEventListener('click',()=>{
        [...document.querySelectorAll('.gm-map-empty-small')].forEach(el=>el.classList.add('gm-hide-before-step1'));
      },true);
    });
  }

  function run(){hideStaleOnSearch();summaryTitle();mapEmpty();scheduleSmall();autoInfo();stakeholders();addressLines();apiCards();gateMapCards()}
  document.addEventListener('DOMContentLoaded',run);
  setInterval(run,1000);
  run();
  window.GM?.patches?.register?.('step1-ux-polish',{version:'v5-collapse-long-tables'});
})();
