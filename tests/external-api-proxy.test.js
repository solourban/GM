const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const SERVER_PATH = path.join(ROOT, 'src', 'server.js');
const TARGET_EXTENSIONS = new Set(['.js', '.html', '.css']);

function fail(message) {
  console.error(`External API proxy guard failed: ${message}`);
  process.exit(1);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (!entry.isFile()) return [];
    return TARGET_EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function requireIncludes(content, needle, label) {
  if (!content.includes(needle)) fail(`${label} is missing.`);
}

function forbidPublic(pattern, label) {
  const files = walk(PUBLIC_DIR);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const match = content.match(pattern);
    if (match) fail(`${relative(file)} contains ${label}.`);
  }
}

const server = fs.readFileSync(SERVER_PATH, 'utf8');

forbidPublic(/dapi\.kakao\.com/i, 'direct Kakao local API host');
forbidPublic(/apis\.data\.go\.kr/i, 'direct data.go.kr API host');
forbidPublic(/KakaoAK\s+[A-Za-z0-9._-]{20,}/i, 'direct Kakao REST authorization token');
forbidPublic(/[?&]serviceKey=([A-Za-z0-9%+/=_-]{30,})/i, 'direct data.go.kr serviceKey token');

requireIncludes(server, "app.get('/api/location/geocode'", 'Kakao geocode proxy route');
requireIncludes(server, 'https://dapi.kakao.com/v2/local/search/address.json', 'Kakao local API upstream call in server');
requireIncludes(server, 'keys.kakaoRestKey', 'Kakao REST key server-side variable usage');
requireIncludes(server, 'Authorization:', 'Kakao REST authorization header in server');
requireIncludes(server, 'KakaoAK', 'Kakao REST authorization marker in server');
requireIncludes(server, "app.get('/api/molit/trades'", 'MOLIT trades proxy route');
requireIncludes(server, "app.get('/api/molit/apt-trades'", 'MOLIT apt trades proxy route');
requireIncludes(server, 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev', 'MOLIT apartment upstream call in server');
requireIncludes(server, 'serviceKey', 'MOLIT serviceKey server-side query marker');
requireIncludes(server, 'process.env.MOLIT_API_KEY', 'MOLIT server-side environment variable usage');

console.log('External API proxy guard passed.');
