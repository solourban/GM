const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SERVER_PATH = path.join(ROOT, 'src', 'server.js');
const server = fs.readFileSync(SERVER_PATH, 'utf8');

function fail(message) {
  console.error(`External API proxy guard failed: ${message}`);
  process.exit(1);
}

function requireIncludes(content, needle, label) {
  if (!content.includes(needle)) fail(`${label} is missing.`);
}

requireIncludes(server, "app.get('/api/location/geocode'", 'Kakao geocode proxy route');
requireIncludes(server, 'dapi.kakao.com/v2/local/search/address.json', 'Kakao local API upstream call in server');
requireIncludes(server, "app.get('/api/molit/trades'", 'MOLIT trades proxy route');
requireIncludes(server, "app.get('/api/molit/apt-trades'", 'MOLIT apt trades proxy route');
requireIncludes(server, 'apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev', 'MOLIT apartment upstream call in server');

console.log('External API proxy guard passed.');
