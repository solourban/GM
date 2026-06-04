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
  [script, 'NEARBY_CATEGORIES', 'nearby category definitions'],
  [script, "code: 'SW8'", 'subway nearby search'],
  [script, "code: 'SC4'", 'school nearby search'],
  [script, "code: 'HP8'", 'hospital nearby search'],
  [script, "code: 'CS2'", 'convenience nearby search'],
  [script, 'places.categorySearch', 'Kakao nearby category search'],
  [script, 'saveNearbyResult', 'nearby analysis persistence'],
  [script, 'data-nearby-summary', 'nearby analysis visible region'],
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
