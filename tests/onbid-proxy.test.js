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
requireIncludes(server, 'getRlstCltrList2', 'Onbid next-generation list upstream endpoint in server');
requireIncludes(server, "resultType: 'json'", 'Onbid JSON response type request');
requireIncludes(server, 'prptDivCd', 'Onbid required property type parameter');
requireIncludes(server, 'pvctTrgtYn', 'Onbid required private-contract flag parameter');
requireIncludes(server, "app.get('/api/onbid/detail'", 'Onbid detail proxy route');
requireIncludes(server, 'OnbidRlstDtlSrvc2', 'Onbid RlstDtlSrvc2 detail upstream in server');
requireIncludes(server, 'getRlstDtlInf2', 'Onbid next-generation detail upstream endpoint in server');
requireIncludes(server, 'cltrMngNo', 'Onbid detail required cltrMngNo parameter');
requireIncludes(server, 'pbctCdtnNo', 'Onbid detail pbctCdtnNo parameter');
requireIncludes(server, 'process.env.ONBID_API_KEY', 'Onbid server-side environment variable usage');
requireIncludes(server, 'hasOnbid', 'Onbid config status flag');
requireIncludes(server, 'safeOnbidDiagnostic', 'Onbid upstream diagnostic should be sanitized server-side');
requireIncludes(server, 'ONBID_SUCCESS_CODES', 'Onbid result code allowlist');

console.log('Onbid proxy guard passed.');
