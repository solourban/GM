const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
const script = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-location.js'), 'utf8');

const required = [
  [pkg, 'node --check public/app-v2-location.js', 'location syntax check'],
  [script, 'renderMapPreview', 'map preview renderer'],
  [script, 'mapEmbedUrl', 'map embed url helper'],
  [script, 'https://maps.google.com/maps?q=', 'stable iframe map source'],
  [script, '<iframe', 'iframe preview'],
  [script, '지도 미리보기', 'map preview label'],
  [script, 'mapEmbedUrl: mapEmbedUrl(doc)', 'saved embed url'],
  [script, '지도 미리보기는 좌표 확인용입니다.', 'limited use notice'],
  [script, '카카오맵에서 보기', 'kakao map fallback link'],
  [script, '주소 검색', 'search fallback link'],
];

const forbidden = [
  [script, 'KAKAO_JS_KEY', 'browser-side kakao js key dependency'],
  [script, 'appkey=', 'direct map api key in client'],
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
