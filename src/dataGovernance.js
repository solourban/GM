const LAST_REVIEWED = '2026-07-21';

const DATA_SOURCES = Object.freeze([
  {
    id: 'court-auction',
    label: '법원경매정보 조회',
    provider: '대한민국 법원 경매정보',
    sourceUrl: 'https://www.courtauction.go.kr/',
    classification: 'public-case-lookup',
    collectionMethod: '사용자가 입력한 법원·사건번호 또는 매각기일 조건으로 서버에서 건별 조회합니다.',
    routes: ['/api/fetch', '/api/recommendations/by-date', '/api/date/recommendations'],
    dataTypes: ['사건 기본정보', '물건 정보', '매각기일', '이해관계인', '일정 정보'],
    retention: '서버 데이터베이스에 사건 원문을 저장하지 않습니다. 화면 상태와 브라우저 저장소에는 사용자가 조회·저장한 값이 남을 수 있습니다.',
    trainingUse: 'AI 모델 학습이나 재판매용 데이터셋 구축에 사용하지 않습니다.',
    userNotice: '입찰 전 법원 원문 서류를 다시 확인해야 합니다.',
  },
  {
    id: 'kakao-local-map',
    label: '주소 좌표 변환과 지도 표시',
    provider: 'Kakao Developers',
    sourceUrl: 'https://developers.kakao.com/',
    classification: 'external-api',
    collectionMethod: '사용자가 조회한 주소를 서버 프록시로 전달해 좌표와 지도 SDK를 요청합니다.',
    routes: ['/api/location/geocode', '/api/kakao/maps-sdk.js'],
    dataTypes: ['주소', '좌표', '행정구역', '주변 장소 참고값'],
    retention: '좌표 변환 결과는 응답으로만 반환하며 서버 데이터베이스에 저장하지 않습니다.',
    trainingUse: 'AI 모델 학습이나 재판매용 데이터셋 구축에 사용하지 않습니다.',
    userNotice: '지도와 주변시설 정보는 현장 확인을 대체하지 않습니다.',
  },
  {
    id: 'molit-trades',
    label: '국토교통부 실거래가 참고지표',
    provider: '국토교통부 / 공공데이터포털',
    sourceUrl: 'https://www.data.go.kr/',
    classification: 'public-openapi',
    collectionMethod: '법정동코드와 계약월 조건으로 승인된 OpenAPI를 서버에서 호출합니다.',
    routes: ['/api/molit/trades', '/api/molit/apt-trades'],
    dataTypes: ['계약일', '거래금액', '전용면적', '층', '건물명'],
    retention: '응답 결과를 장기 저장하지 않고 참고지표 카드에만 표시합니다.',
    trainingUse: 'AI 모델 학습이나 재판매용 데이터셋 구축에 사용하지 않습니다.',
    userNotice: '실거래가는 동일 물건 확정값이 아니라 지역 참고값입니다.',
  },
  {
    id: 'onbid',
    label: '온비드 공매 조회',
    provider: '한국자산관리공사 온비드 / 공공데이터포털',
    sourceUrl: 'https://www.onbid.co.kr/',
    classification: 'public-openapi',
    collectionMethod: '지역·키워드·입찰기간 조건으로 승인된 OpenAPI를 서버에서 호출합니다.',
    routes: ['/api/onbid/items', '/api/onbid/detail'],
    dataTypes: ['공매 물건명', '소재지', '입찰기간', '최저입찰가', '기관명'],
    retention: '응답 결과를 장기 저장하지 않고 화면 결과와 사용자가 저장한 후보에만 반영합니다.',
    trainingUse: 'AI 모델 학습이나 재판매용 데이터셋 구축에 사용하지 않습니다.',
    userNotice: '온비드 원문 공고와 입찰 조건을 최종 확인해야 합니다.',
  },
  {
    id: 'user-input',
    label: '사용자 입력값과 브라우저 저장값',
    provider: '사용자',
    sourceUrl: '',
    classification: 'user-provided',
    collectionMethod: '사건번호, 주소, 메모, 입찰가, 비용 항목을 사용자가 직접 입력하거나 브라우저 저장소에 저장합니다.',
    routes: ['/api/analyze'],
    dataTypes: ['사건번호', '주소', '임차인·권리 입력값', '입찰가·비용 계산값', '체크리스트 메모'],
    retention: '분석 요청은 서버에서 즉시 계산용으로만 처리합니다. 저장 후보와 메모는 사용자의 브라우저 저장소에 남을 수 있습니다.',
    trainingUse: 'AI 모델 학습이나 재판매용 데이터셋 구축에 사용하지 않습니다.',
    userNotice: '공용 PC에서는 사용 후 현재 사건 초기화와 브라우저 저장소 삭제를 권장합니다.',
  },
]);

function cloneSource(source) {
  return {
    id: source.id,
    label: source.label,
    provider: source.provider,
    sourceUrl: source.sourceUrl,
    classification: source.classification,
    collectionMethod: source.collectionMethod,
    routes: [...source.routes],
    dataTypes: [...source.dataTypes],
    retention: source.retention,
    trainingUse: source.trainingUse,
    userNotice: source.userNotice,
  };
}

function listPublicDataSources() {
  return DATA_SOURCES.map(cloneSource);
}

function dataGovernanceSummary() {
  return {
    lastReviewed: LAST_REVIEWED,
    sources: DATA_SOURCES.length,
    externalSources: DATA_SOURCES.filter((source) => source.classification.includes('api') || source.classification.includes('lookup')).length,
    userProvidedSources: DATA_SOURCES.filter((source) => source.classification === 'user-provided').length,
    serverSideKeyUse: 'External API keys are used server-side and are not returned by public routes.',
    trainingUse: 'No user input, court data, public API response, or map/trade/onbid result is used for AI model training.',
    retention: 'No server-side case dataset is built from lookup results.',
  };
}

module.exports = {
  DATA_SOURCES,
  listPublicDataSources,
  dataGovernanceSummary,
};
