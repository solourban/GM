const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'src', 'server.js'), 'utf8');
const core = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-core.js'), 'utf8');
const crawler = require(path.join(ROOT, 'src', 'crawler.js'));

function fail(message) {
  console.error(`Court lookup readiness guard failed: ${message}`);
  process.exit(1);
}

function requireIncludes(source, needle, label) {
  if (!source.includes(needle)) fail(`${label} is missing.`);
}

const courts = crawler.listCourts();
if (!Array.isArray(courts) || courts.length < 50) fail('court list should expose nationwide court coverage.');

const central = crawler.courtSupport('서울중앙');
if (!central.supported) fail('서울중앙 alias should be supported.');
if (central.normalized !== '서울중앙지방법원') fail('서울중앙 alias should normalize to 서울중앙지방법원.');
if (!central.code) fail('supported court should include a public court code.');

const blank = crawler.courtSupport('');
if (blank.supported) fail('blank court name must not normalize into a supported court.');

requireIncludes(server, "const { fetchCase, courtSupport, listCourts } = require('./crawler')", 'server crawler import');
requireIncludes(server, "app.get('/api/courts'", 'courts route');
requireIncludes(server, 'count: courts.length', 'courts route count');
requireIncludes(server, 'lookup: queryName ? courtSupport(queryName) : null', 'courts route lookup diagnostic');
requireIncludes(server, 'function validateFetchLookupInput(body = {})', 'fetch lookup validator');
requireIncludes(server, "if (!/^\\d{4}$/.test(saYear))", 'server year format guard');
requireIncludes(server, "if (!/^\\d+$/.test(saSer))", 'server serial format guard');
requireIncludes(server, '지원하지 않는 법원입니다. 법원 목록에서 다시 선택해주세요.', 'unsupported court message');
requireIncludes(server, 'sanitizeFetchCaseResult(await fetchCase(input.value))', 'fetch route should use normalized input');
requireIncludes(server, 'court: input.court', 'fetch route should return public court support diagnostic');

requireIncludes(core, 'courtOptions: []', 'front-end court option state');
requireIncludes(core, 'courtSupportCount: 0', 'front-end court count state');
requireIncludes(core, 'id="v2CourtCoverageNote"', 'court coverage note element');
requireIncludes(core, '지원 법원 목록을 확인 중입니다.', 'court coverage loading copy');
requireIncludes(core, 'function renderCourtCoverage()', 'court coverage renderer');
requireIncludes(core, 'function isSelectedCourtSupported(court)', 'court support client guard');
requireIncludes(core, '지원 법원 목록에서 법원을 다시 선택해주세요.', 'client unsupported court validation');
requireIncludes(core, "${info('지원 법원', supportText)}", 'failure card should show court coverage count');

console.log('Court lookup readiness guard passed.');
