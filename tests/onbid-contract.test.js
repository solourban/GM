const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'src', 'server.js'), 'utf8');
const front = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-onbid-entry.js'), 'utf8');

function fail(message) {
  console.error(`Onbid contract guard failed: ${message}`);
  process.exit(1);
}

function requireIncludes(source, needle, label) {
  if (!source.includes(needle)) fail(`${label} is missing.`);
}

function sectionBetween(source, startNeedle, endNeedle, label) {
  const start = source.indexOf(startNeedle);
  if (start === -1) fail(`${label} start marker is missing.`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  if (end === -1) fail(`${label} end marker is missing.`);
  return source.slice(start, end);
}

requireIncludes(server, 'req.query.query || req.query.keyword', 'keyword alias support');
requireIncludes(server, 'req.query.sido || req.query.lctnSdnm', 'sido alias support');
requireIncludes(server, 'req.query.signgu || req.query.lctnSggnm', 'signgu alias support');
requireIncludes(server, 'bidPrdYmdStart: bidStart', 'bid start forwarding');
requireIncludes(server, 'bidPrdYmdEnd: bidEnd', 'bid end forwarding');
requireIncludes(server, "resultType: 'json'", 'Onbid JSON response forwarding');
requireIncludes(server, 'ONBID_DEFAULT_PRPT_DIV_CD', 'Onbid default property type forwarding');
requireIncludes(server, 'pvctTrgtYn', 'Onbid private-contract flag forwarding');
requireIncludes(server, 'numberInRange(req.query.numOfRows, 10, 1, 20)', 'Onbid numOfRows cap');
requireIncludes(server, 'cltrMngNo: cltrNo', 'list/detail cltr alias');
requireIncludes(server, 'pbctCdtnNo: pbctNo', 'list/detail pbct alias');
requireIncludes(server, 'detail: items[0] || null', 'detail response alias');
requireIncludes(server, "return res.status(502).json(errorBody(req, '온비드 목록 조회 중 오류가 발생했습니다.'))", 'safe list error response');
requireIncludes(server, "return res.status(502).json(errorBody(req, '온비드 상세 조회 중 오류가 발생했습니다.'))", 'safe detail error response');

const onbidRoutes = sectionBetween(server, "app.get('/api/onbid/items'", "app.post('/api/fetch'", 'Onbid routes');
if (/detail\s*:\s*e\.message/.test(onbidRoutes)) fail('Onbid routes must not expose e.message as detail.');

requireIncludes(front, "params.set('cltrNo'", 'frontend detail cltr param');
requireIncludes(front, "params.set('pbctNo'", 'frontend detail pbct param');
requireIncludes(front, 'data.detail || data.item || {}', 'frontend detail/item response fallback');
requireIncludes(front, "['cltrMngNo', 'cltrNo'", 'frontend cltr field alias');

console.log('Onbid contract guard passed.');
