const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
const script = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-location.js'), 'utf8');
const finalJudgment = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-final-judgment.js'), 'utf8');
const copySummary = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-copy-summary.js'), 'utf8');

const required = [
  [pkg, 'node --check public/app-v2-location.js', 'location syntax check'],
  [script, 'renderMapPreview', 'map preview renderer'],
  [script, 'kakaoMapPoint', 'Kakao coordinate helper'],
  [script, 'loadKakaoSdk', 'Kakao SDK loader'],
  [script, 'MAP_SDK_TIMEOUT_MS', 'Kakao SDK timeout constant'],
  [script, 'MAP_TILE_WATCHDOG_MS', 'Kakao tile watchdog constant'],
  [script, "'/api/kakao/maps-sdk.js'", 'proxied Kakao SDK source'],
  [script, 'window.__kakaoMapsSdkLoader', 'Kakao browser SDK loader promise'],
  [script, 'Kakao map SDK proxy load timed out.', 'Kakao SDK timeout error'],
  [script, 'window.clearTimeout(timer)', 'Kakao SDK timeout cleanup'],
  [script, 'v2-kakao-map-preview', 'Kakao map preview container'],
  [script, 'data-map-url', 'Kakao map external url dataset'],
  [script, 'data-search-url', 'Kakao search external url dataset'],
  [script, 'data-map-state="loading"', 'visible map loading state'],
  [script, 'data-map-status-pill', 'visible map status pill'],
  [script, 'data-map-status-text', 'visible map status text'],
  [script, '지도 다시 맞춤', 'manual map relayout action'],
  [script, 'data-map-relayout', 'manual relayout button dataset'],
  [script, 'function setMapStatus', 'map status update helper'],
  [script, 'v2-map-fallback-actions', 'always-visible map fallback actions'],
  [script, 'data-map-watchdog', 'slow tile watchdog panel'],
  [script, '지도가 회색으로 보이면', 'visible grey map fallback copy'],
  [script, '지도가 늦게 표시되고 있습니다', 'visible slow map watchdog copy'],
  [script, 'initKakaoMapPreviews', 'Kakao map preview initializer'],
  [script, 'mapFailureMessage', 'Kakao map setup diagnostic'],
  [script, 'mapActionLinks', 'shared map fallback action links'],
  [script, 'showMapWatchdog', 'slow map watchdog display helper'],
  [script, 'hideMapWatchdog', 'slow map watchdog hide helper'],
  [script, '지도 연결 확인 필요', 'visible Kakao map failure state'],
  [script, 'JavaScript SDK 도메인', 'Kakao SDK domain guidance'],
  [script, 'map.relayout()', 'Kakao map relayout after render'],
  [script, "'tilesloaded'", 'Kakao tile loaded event'],
  [script, "target.dataset.mapState = 'slow'", 'slow tile map state'],
  [script, "target.dataset.mapState = 'ready'", 'ready tile map state'],
  [script, 'const kakaoMapRegistry = new Map()', 'Kakao map instance registry'],
  [script, 'function relayoutKakaoMaps', 'Kakao map relayout helper'],
  [script, 'map.setCenter(coords)', 'Kakao map recenter after hidden tab render'],
  [script, 'marker?.setPosition?.(coords)', 'Kakao marker recenter after relayout'],
  [script, 'function relayoutMapTarget', 'single map target relayout helper'],
  [script, "relayoutMapTarget(target, 'manual-button')", 'manual relayout button handler'],
  [script, 'relayoutTarget: relayoutMapTarget', 'debug bridge target relayout helper'],
  [script, 'requestAnimationFrame', 'Kakao map relayout animation frame'],
  [script, 'auction:workflow-step-change', 'Kakao map relayout on workflow tab activation'],
  [script, 'window.__auctionLocationMaps', 'Kakao map debug relayout bridge'],
  [script, 'NEARBY_CATEGORIES', 'nearby category definitions'],
  [script, "code: 'SW8'", 'subway nearby search'],
  [script, "code: 'SC4'", 'school nearby search'],
  [script, "code: 'HP8'", 'hospital nearby search'],
  [script, "code: 'CS2'", 'convenience nearby search'],
  [script, 'places.categorySearch', 'Kakao nearby category search'],
  [script, 'saveNearbyResult', 'nearby analysis persistence'],
  [script, 'data-nearby-summary', 'nearby analysis visible region'],
  [script, 'v2-location-map-reserve', 'loading map space reservation'],
  [script, 'min-height:1040px', 'desktop location card height reservation'],
  [script, 'min-height:1460px', 'mobile location card height reservation'],
  [script, '[data-nearby-summary] { min-height:0', 'nearby summary should not reserve blank mobile space'],
  [script, 'loadCachedLocation', 'same-case location cache restore'],
  [script, 'commitWhenScrollIdle', 'scroll-idle location update'],
  [script, 'MutationObserver', 'result rerender restore observer'],
  [script, 'card.innerHTML = next.innerHTML', 'in-place location card update'],
  [script, 'auction:result-card-change', 'targeted order notification'],
  [script, "mapProvider: 'kakao'", 'saved map provider'],
  [script, 'kakaoMapUrl: mapCoordUrl(doc, address)', 'Kakao map fallback link'],
  [script, 'kakaoSearchUrl: mapSearchUrl(doc, address)', 'search fallback link'],
  [finalJudgment, 'nearbySummary(location)', 'nearby analysis final judgment summary'],
  [finalJudgment, '주변시설 분석', 'nearby analysis final judgment field'],
  [copySummary, 'location.nearby?.categories', 'nearby analysis copy summary'],
  [copySummary, '주변 생활편의 시설:', 'nearby analysis copy heading'],
];

const forbidden = [
  [script, 'KAKAO_JS_KEY', 'browser-side Kakao JS key dependency'],
  [script, 'appkey=', 'direct map API key in client'],
  [script, 'https://maps.google.com/maps?q=', 'Google iframe map source'],
  [script, '<iframe', 'iframe preview'],
  [script, 'existing.outerHTML', 'full location card replacement'],
  [script, 'setInterval(upsertLocationCard', 'periodic location card upsert'],
  [script, 'min-height:400px', 'mobile nearby summary blank space regression'],
];

const missing = required.filter(([source, needle]) => !source.includes(needle)).map(([, , label]) => label);
const presentForbidden = forbidden.filter(([source, needle]) => source.includes(needle)).map(([, , label]) => label);

if (missing.length || presentForbidden.length) {
  const parts = [];
  if (missing.length) parts.push(`missing: ${missing.join(', ')}`);
  if (presentForbidden.length) parts.push(`forbidden: ${presentForbidden.join(', ')}`);
  throw new Error(`Location map card guard failed: ${parts.join(' / ')}`);
}

console.log('Location map card guard passed.');
