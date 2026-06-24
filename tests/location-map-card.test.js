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
  [script, "'/api/kakao/maps-sdk.js'", 'proxied Kakao SDK source'],
  [script, 'window.__kakaoMapsSdkLoader', 'Kakao browser SDK loader promise'],
  [script, 'v2-kakao-map-preview', 'Kakao map preview container'],
  [script, 'initKakaoMapPreviews', 'Kakao map preview initializer'],
  [script, 'mapFailureMessage', 'Kakao map setup diagnostic'],
  [script, '지도 연결 확인 필요', 'visible Kakao map failure state'],
  [script, 'JavaScript SDK 도메인', 'Kakao SDK domain guidance'],
  [script, 'map.relayout()', 'Kakao map relayout after render'],
  [script, 'const kakaoMapRegistry = new Map()', 'Kakao map instance registry'],
  [script, 'function relayoutKakaoMaps', 'Kakao map relayout helper'],
  [script, 'map.setCenter(coords)', 'Kakao map recenter after hidden tab render'],
  [script, 'marker?.setPosition?.(coords)', 'Kakao marker recenter after relayout'],
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
  [script, 'min-height:400px', 'mobile nearby summary height reservation'],
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
