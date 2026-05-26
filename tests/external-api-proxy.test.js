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

requireIncludes(server, "app.get('/api/location/geocode'", 'Kakao geocode route');
requireIncludes(server, 'dapi.kakao.com/v2/local/search/address.json', 'Kakao local call in server');
requireIncludes(server, 'safeKakaoDiagnostic', 'Kakao diagnostic helper');
requireIncludes(server, 'addressName: address.address_name ||', 'Kakao jibun address mapping');
requireIncludes(server, 'roadAddress: road.address_name ||', 'Kakao road address mapping');
requireIncludes(server, "app.get('/api/molit/trades'", 'MOLIT unified trades route');
requireIncludes(server, 'RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev', 'MOLIT apartment call in server');
requireIncludes(server, 'RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade', 'MOLIT officetel call in server');
requireIncludes(server, 'RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade', 'MOLIT row house call in server');

console.log('External API proxy guard passed.');
