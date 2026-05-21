const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SERVER_PATH = path.join(ROOT, 'src', 'server.js');
const server = fs.readFileSync(SERVER_PATH, 'utf8');

function fail(message) {
  console.error(`Onbid proxy guard failed: ${message}`);
  process.exit(1);
}

function requireIncludes(content, needle, label) {
  if (!content.includes(needle)) fail(`${label} is missing.`);
}

requireIncludes(server, "app.get('/api/onbid/items'", 'Onbid items proxy route');
requireIncludes(server, 'OnbidRlstListSrvc2', 'Onbid RlstListSrvc2 base upstream in server');
requireIncludes(server, 'getOnbidRlstList', 'Onbid list upstream endpoint in server');
requireIncludes(server, "app.get('/api/onbid/detail'", 'Onbid detail proxy route');
requireIncludes(server, 'getOnbidRlstDtl', 'Onbid detail upstream endpoint in server');
requireIncludes(server, 'process.env.ONBID_API_KEY', 'Onbid server-side environment variable usage');
requireIncludes(server, 'hasOnbid', 'Onbid config status flag');
requireIncludes(server, "req.query.query || req.query.keyword || req.query.cltrNm", 'Onbid keyword alias handling');
requireIncludes(server, "req.query.sido || req.query.lctnSdnm", 'Onbid sido alias handling');
requireIncludes(server, "req.query.signgu || req.query.lctnSggnm", 'Onbid signgu alias handling');
requireIncludes(server, 'PBCT_BEGN_DTM: bidPrdYmdStart', 'Onbid bid start filter forwarding');
requireIncludes(server, 'PBCT_CLS_DTM: bidPrdYmdEnd', 'Onbid bid end filter forwarding');
requireIncludes(server, "req.query.cltrNo || req.query.cltrMngNo", 'Onbid detail cltrNo alias handling');
requireIncludes(server, "req.query.pbctNo || req.query.pbctCdtnNo", 'Onbid detail pbctNo alias handling');
requireIncludes(server, 'cltrMngNo: cltrNo', 'Onbid list/detail frontend cltr alias');
requireIncludes(server, 'pbctCdtnNo: pbctNo', 'Onbid list/detail frontend pbct alias');

console.log('Onbid proxy guard passed.');
