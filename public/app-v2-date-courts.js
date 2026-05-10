(() => {
  const COURTS = [
    ['서울중앙', '서울중앙'], ['서울동부', '서울동부'], ['서울서부', '서울서부'], ['서울남부', '서울남부'], ['서울북부', '서울북부'],
    ['의정부', '의정부'], ['인천', '인천'], ['수원', '수원'], ['성남', '성남'], ['여주', '여주'], ['평택', '평택'], ['안산', '안산'], ['안양', '안양'], ['고양', '고양'], ['부천', '부천'], ['남양주', '남양주'],
    ['춘천', '춘천'], ['강릉', '강릉'], ['원주', '원주'], ['속초', '속초'], ['영월', '영월'],
    ['대전', '대전'], ['홍성', '홍성'], ['공주', '공주'], ['논산', '논산'], ['서산', '서산'], ['천안지원', '천안'],
    ['청주', '청주'], ['충주', '충주'], ['제천지원', '제천'], ['영동', '영동'],
    ['대구', '대구'], ['안동', '안동'], ['경주', '경주'], ['포항', '포항'], ['김천', '김천'], ['상주', '상주'], ['의성', '의성'], ['영덕', '영덕'], ['대구서부', '대구서부'],
    ['부산', '부산'], ['부산동부', '부산동부'], ['부산서부', '부산서부'], ['울산', '울산'],
    ['창원', '창원'], ['마산', '마산'], ['통영', '통영'], ['밀양', '밀양'], ['거창', '거창'], ['진주', '진주'],
    ['광주', '광주'], ['목포', '목포'], ['장흥', '장흥'], ['순천', '순천'], ['해남', '해남'],
    ['전주', '전주'], ['군산지원', '군산'], ['정읍', '정읍'], ['남원', '남원'], ['제주', '제주'],
  ];

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalize(value) {
    const v = clean(value);
    if (!v) return '서울중앙';
    if (v === '천안') return '천안지원';
    if (v === '군산') return '군산지원';
    if (v === '제천') return '제천지원';
    return v.replace(/지방법원/g, '').replace(/법원/g, '').trim();
  }

  function replaceCourtInput() {
    const current = document.getElementById('dateCourtV2');
    if (!current || current.tagName === 'SELECT') return;

    const selected = normalize(current.value);
    const select = document.createElement('select');
    select.id = 'dateCourtV2';
    select.className = current.className;
    select.setAttribute('aria-label', '법원');

    COURTS.forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      if (normalize(value) === selected || normalize(label) === selected) option.selected = true;
      select.appendChild(option);
    });

    current.replaceWith(select);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function improveEmptyMessage() {
    const msg = document.getElementById('dateMessageV2');
    if (!msg) return;
    if (msg.textContent.includes('검증 가능한 매각기일')) {
      msg.textContent = '해당 법원·기간에서 확인 가능한 매각기일 후보가 없습니다. 기간을 넓히거나 다른 법원을 선택해 주세요.';
    }
  }

  setInterval(() => {
    replaceCourtInput();
    improveEmptyMessage();
  }, 400);
})();
