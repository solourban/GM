const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const PARSER_PATH = path.join(ROOT, 'public', 'app-v2-spec-extractor-parser.js');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'spec-extractor');
const source = fs.readFileSync(PARSER_PATH, 'utf8');

function fail(message) {
  console.error(`Specification extractor parser failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) fail(`${message}. Expected ${expected}, received ${actual}.`);
}

function fixture(name) {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8').replace(/\r\n?/g, '\n').trimEnd();
}

const sentinelState = { untouched: true };
const context = { window: { state: sentinelState } };
vm.runInNewContext(source, context, { filename: PARSER_PATH });
const api = context.window.__auctionSpecParser;

assert(api, 'parser API was not exposed');
assert(Object.isFrozen(api), 'parser API must be frozen');
assert(context.window.state === sentinelState, 'parser load must not mutate app state');
assertEqual(Object.keys(context.window).sort().join(','), '__auctionSpecParser,state', 'parser load must expose only its API');
['document', 'fetch', 'XMLHttpRequest', 'localStorage', 'sessionStorage'].forEach((forbidden) => {
  assert(!source.includes(forbidden), `parser source must not reference ${forbidden}`);
});

const basicRaw = fixture('tenant-basic.txt');
const basic = api.parse(basicRaw);
assertEqual(basic.candidates.occupants.length, 1, 'basic tenant candidate count');
assertEqual(basic.candidates.occupants[0].values.tenantName, '김OO', 'masked tenant name');
assertEqual(basic.candidates.occupants[0].values.moveIn, '2022-02-25', 'move-in date normalization');
assertEqual(basic.candidates.occupants[0].values.fixed, '2022-02-03', 'fixed date normalization');
assertEqual(basic.candidates.occupants[0].values.deposit, 267000000, 'deposit normalization');

const multiple = api.parse(fixture('occupants-multiple.txt'));
assertEqual(multiple.candidates.occupants.length, 2, 'separate occupant candidate count');
assertEqual(multiple.candidates.occupants[0].values.tenantName, '이OO', 'first tenant name');
assertEqual(multiple.candidates.occupants[1].values.occupantName, '박OO', 'second occupant name');

const details = api.parse(fixture('tenant-details.txt'));
assertEqual(details.candidates.occupants.length, 1, 'multi-line tenant candidate count');
assertEqual(details.candidates.occupants[0].values.claimDate, '2024-05-01', 'claim date normalization');
assertEqual(details.candidates.occupants[0].values.rent, 500000, 'rent normalization');
assertEqual(details.candidates.occupants[0].values.occupiedPart, '2층 전부', 'occupied part');

const special = api.parse(fixture('special-takeover.txt'));
assertEqual(special.candidates.specialRights.length, 1, 'special right candidate count');
assertEqual(special.candidates.specialRights[0].typeCandidate, '유치권', 'special right type');
assertEqual(special.candidates.specialRights[0].holder, '공사업체OO', 'special right holder');
assertEqual(special.candidates.specialRights[0].amount, 30000000, 'special right amount');
assertEqual(special.candidates.takeoverPhrases[0].kind, 'possible_takeover', 'possible takeover classification');

const noTakeover = api.parse(fixture('no-takeover.txt'));
assertEqual(noTakeover.candidates.takeoverPhrases.length, 1, 'negative takeover candidate count');
assertEqual(noTakeover.candidates.takeoverPhrases[0].kind, 'no_takeover', 'negative takeover classification');
assertEqual(
  noTakeover.candidates.takeoverPhrases.filter(({ kind }) => kind === 'possible_takeover').length,
  0,
  'negative takeover must not become possible takeover',
);
assertEqual(api.classifyTakeoverPhrase('매수인이 인수할 권리는 없음'), 'no_takeover', 'negative takeover particle variant');

const brokenRaw = fixture('broken-duplicate-html.txt');
const broken = api.parse(brokenRaw);
assertEqual(broken.candidates.occupants.length, 1, 'duplicate occupant removal');
assert(
  broken.warnings.some(({ code }) => code === 'duplicate_occupant_removed'),
  'duplicate removal warning is missing',
);
assert(!brokenRaw.includes('__auctionSpecParser'), 'fixture must remain plain source text');

const deterministicA = JSON.stringify(api.parse(basicRaw));
const deterministicB = JSON.stringify(api.parse(basicRaw));
assertEqual(deterministicA, deterministicB, 'same input must have identical output');

[basic, multiple, details, special, noTakeover, broken].forEach((result) => {
  const rawByHash = [basicRaw, fixture('occupants-multiple.txt'), fixture('tenant-details.txt'), fixture('special-takeover.txt'), fixture('no-takeover.txt'), brokenRaw]
    .find((raw) => api.parse(raw).rawHash === result.rawHash);
  Object.values(result.candidates).flat().forEach((candidate) => {
    candidate.evidence.forEach((evidence) => {
      assertEqual(rawByHash.slice(evidence.start, evidence.end), evidence.text, 'evidence must preserve raw offsets');
    });
  });
});

const unlabeledDate = api.parse('임차인: 정OO\n2023.01.02');
assertEqual(unlabeledDate.candidates.occupants[0].values.moveIn, '', 'unlabeled date must not be assigned');
assertEqual(unlabeledDate.candidates.occupants[0].values.fixed, '', 'unlabeled date must not become fixed date');
assertEqual(api.parse('임차인은 확인되지 않음').candidates.occupants.length, 0, 'ordinary prose must not become a labeled candidate');

const absentMoney = api.parse('임차인: 정OO | 보증금: 해당없음 | 차임: 없음');
assertEqual(absentMoney.candidates.occupants[0].values.deposit, '', 'absent deposit must not become zero');
assertEqual(absentMoney.candidates.occupants[0].values.rent, '', 'absent rent must not become zero');
assertEqual(api.parse('임차인: 정OO | 보증금: 0원').candidates.occupants[0].values.deposit, 0, 'explicit numeric zero must remain zero');

const tooLong = api.parse('가'.repeat(api.MAX_TEXT_LENGTH + 1));
assert(tooLong.stats.rejected, 'oversized text must be rejected');
assertEqual(tooLong.candidates.occupants.length, 0, 'oversized text must not produce occupants');
assert(tooLong.warnings.some(({ code }) => code === 'text_too_long'), 'oversized text warning is missing');

const empty = api.parse('');
assert(!empty.stats.rejected, 'empty text is not an oversized rejection');
assert(empty.warnings.some(({ code }) => code === 'empty_text'), 'empty text warning is missing');

console.log('Specification extractor parser passed.');
