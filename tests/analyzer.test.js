const assert = require('assert');
const { analyzeCase } = require('../src/analyzer');

function baseBasic() {
  return {
    감정평가액: '242000000',
    최저매각가격: '6811000',
  };
}

function run(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

run('후순위 임차인은 대항력 없음 및 인수금액 0원으로 판단한다', () => {
  const report = analyzeCase({
    basic: baseBasic(),
    rights: [{ date: '20200501', type: '근저당권', holder: 'OO은행', amount: '120000000', _userMalso: true }],
    tenants: [{ name: '후순위임차인', moveIn: '20230115', fixed: '20230116', deposit: '50000000' }],
  });

  assert.strictEqual(report.malso.date, '2020-05-01');
  assert.strictEqual(report.tenants.length, 1);
  assert.strictEqual(report.tenants[0].daehang, '없음');
  assert.strictEqual(report.inherited.total, 0);
  assert.strictEqual(report.risk.level, 'ok');
});

run('선순위 임차인은 대항력 있음 및 고위험으로 판단한다', () => {
  const report = analyzeCase({
    basic: baseBasic(),
    rights: [{ date: '20220324', type: '근저당권', holder: '합자회사금오주류', amount: '40000000', _userMalso: true }],
    tenants: [{ name: '김예슬', moveIn: '20220225', fixed: '20220203', deposit: '267000000' }],
  });

  assert.strictEqual(report.malso.date, '2022-03-24');
  assert.strictEqual(report.tenants[0].daehang, '있음');
  assert.ok(report.inherited.total > 0);
  assert.strictEqual(report.risk.level, 'danger');
  assert.match(report.tenants[0].reason, /매수인 인수 가능성/);
});

run('잘못된 날짜는 확인필요 또는 말소기준 불확정으로 처리한다', () => {
  const report = analyzeCase({
    basic: baseBasic(),
    rights: [{ date: '20201399', type: '근저당권', holder: 'OO은행', amount: '120000000', _userMalso: true }],
    tenants: [{ name: '임차인', moveIn: '20230115', fixed: '20230116', deposit: '50000000' }],
  });

  assert.strictEqual(report.malso, null);
  assert.strictEqual(report.rights[0].dateValid, false);
  assert.strictEqual(report.rights[0].status, '?');
  assert.notStrictEqual(report.risk.level, 'ok');
});

run('보증금 0원 임차인은 경고 플래그를 유지한다', () => {
  const report = analyzeCase({
    basic: baseBasic(),
    rights: [{ date: '20200501', type: '근저당권', holder: 'OO은행', amount: '120000000', _userMalso: true }],
    tenants: [{ name: '보증금누락', moveIn: '20230115', fixed: '20230116', deposit: '' }],
  });

  assert.strictEqual(report.tenants.length, 1);
  assert.strictEqual(report.tenants[0].deposit, 0);
  assert.ok(report.tenants[0].depositWarning);
  assert.notStrictEqual(report.risk.level, 'ok');
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
