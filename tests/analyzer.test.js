const assert = require('assert');
const { analyzeCase } = require('../src/analyzer');

function baseBasic(overrides = {}) {
  return {
    감정평가액: '242000000',
    최저매각가격: '6811000',
    ...overrides,
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

run('예시 물건 2024타경110754는 대항력 임차인 고위험 케이스로 유지한다', () => {
  const report = analyzeCase({
    caseNo: '2024타경110754',
    court: '서울중앙지방법원',
    basic: baseBasic({ 감정평가액: '242,000,000', 최저매각가격: '8,514,000' }),
    rights: [{ date: '2022.3.24.', type: '근저당권', holder: '합자회사금오주류', amount: '40,000,000', _userMalso: true }],
    tenants: [{ name: '김예슬', moveIn: '2022.02.25', fixed: '2022/02/03', deposit: '267,000,000' }],
  });

  assert.strictEqual(report.case, '2024타경110754');
  assert.strictEqual(report.malso.date, '2022-03-24');
  assert.strictEqual(report.tenants[0].moveIn, '2022-02-25');
  assert.strictEqual(report.tenants[0].fixed, '2022-02-03');
  assert.strictEqual(report.tenants[0].deposit, 267000000);
  assert.strictEqual(report.tenants[0].daehang, '있음');
  assert.strictEqual(report.risk.level, 'danger');
});

run('혼합 날짜 형식과 한글 금액을 같은 값으로 정규화한다', () => {
  const report = analyzeCase({
    basic: baseBasic(),
    rights: [{ date: '2022.3.24.', type: '근저당권', holder: '합자회사금오주류', amount: '4천만원', _userMalso: true }],
    tenants: [{ name: '김예슬', moveIn: '20220225', fixed: '2022/02/03', deposit: '2억6700만원' }],
  });

  assert.strictEqual(report.malso.date, '2022-03-24');
  assert.strictEqual(report.rights[0].amount, 40000000);
  assert.strictEqual(report.tenants[0].moveIn, '2022-02-25');
  assert.strictEqual(report.tenants[0].fixed, '2022-02-03');
  assert.strictEqual(report.tenants[0].deposit, 267000000);
  assert.strictEqual(report.tenants[0].daehang, '있음');
});

run('전입일이 말소기준일과 같은 날이면 대항력 없음으로 판단한다', () => {
  const report = analyzeCase({
    basic: baseBasic(),
    rights: [{ date: '20220501', type: '근저당권', holder: 'OO은행', amount: '100000000', _userMalso: true }],
    tenants: [{ name: '동일일자임차인', moveIn: '20220501', fixed: '20220501', deposit: '50000000' }],
  });

  assert.strictEqual(report.malso.date, '2022-05-01');
  assert.strictEqual(report.tenants[0].daehang, '없음');
  assert.strictEqual(report.inherited.total, 0);
});

run('확정일자가 전입일보다 빨라도 대항력 판단은 전입일 기준으로 유지한다', () => {
  const report = analyzeCase({
    basic: baseBasic(),
    rights: [{ date: '20220324', type: '근저당권', holder: 'OO은행', amount: '40000000', _userMalso: true }],
    tenants: [{ name: '확정일자선행', moveIn: '20220225', fixed: '20220203', deposit: '100000000' }],
  });

  assert.strictEqual(report.tenants[0].moveIn, '2022-02-25');
  assert.strictEqual(report.tenants[0].fixed, '2022-02-03');
  assert.strictEqual(report.tenants[0].daehang, '있음');
  assert.strictEqual(report.risk.level, 'danger');
});

run('유치권은 말소기준 이후 입력되어도 특수권리 위험으로 유지한다', () => {
  const report = analyzeCase({
    basic: baseBasic(),
    rights: [
      { date: '20200501', type: '근저당권', holder: 'OO은행', amount: '120000000', _userMalso: true },
      { date: '20240101', type: '유치권', holder: '공사업자', amount: '30000000' },
    ],
    tenants: [],
  });

  const lien = report.rights.find((right) => right.type === '유치권');
  assert.ok(lien);
  assert.strictEqual(lien.status, '인수');
  assert.strictEqual(report.risk.level, 'danger');
  assert.ok(report.inherited.items.some((item) => /유치권/.test(item.label)));
});

run('말소기준권리가 없으면 위험도는 ok가 아니어야 한다', () => {
  const report = analyzeCase({
    basic: baseBasic(),
    rights: [{ date: '20200101', type: '소유권이전', holder: '소유자', amount: '' }],
    tenants: [{ name: '임차인', moveIn: '20220101', fixed: '20220102', deposit: '30000000' }],
  });

  assert.strictEqual(report.malso, null);
  assert.notStrictEqual(report.risk.level, 'ok');
  assert.ok(report.risk.flags.some((flag) => /말소기준권리/.test(flag.msg)));
});

run('raw/manual payload도 말소기준권리와 임차인을 병합해 분석한다', () => {
  const report = analyzeCase({
    raw: {
      caseNo: '2024타경110754',
      court: '서울중앙지방법원',
      basic: baseBasic({ 감정평가액: '242,000,000', 최저매각가격: '8,514,000' }),
      rights: [],
      tenants: [],
    },
    manual: {
      malso: { date: '2022.3.24.', type: '근저당권', holder: '합자회사금오주류', amount: '40,000,000' },
      tenants: [{ name: '김예슬', moveIn: '2022.02.25', fixed: '2022/02/03', deposit: '267,000,000' }],
    },
    region: 'seoul',
  });

  assert.strictEqual(report.case, '2024타경110754');
  assert.strictEqual(report.malso.date, '2022-03-24');
  assert.strictEqual(report.malso.isMalso, true);
  assert.strictEqual(report.tenants.length, 1);
  assert.strictEqual(report.tenants[0].daehang, '있음');
  assert.strictEqual(report.risk.level, 'danger');
});

run('manual 임차인이 있으면 raw 임차인보다 우선 적용한다', () => {
  const report = analyzeCase({
    raw: {
      basic: baseBasic(),
      rights: [{ date: '20200501', type: '근저당권', holder: 'OO은행', amount: '120000000' }],
      tenants: [{ name: 'raw임차인', moveIn: '20190101', fixed: '20190102', deposit: '90000000' }],
    },
    manual: {
      malso: { date: '20200501', type: '근저당권', holder: 'OO은행', amount: '120000000' },
      tenants: [{ name: 'manual임차인', moveIn: '20230115', fixed: '20230116', deposit: '50000000' }],
    },
  });

  assert.strictEqual(report.tenants.length, 1);
  assert.strictEqual(report.tenants[0].name, 'manual임차인');
  assert.strictEqual(report.tenants[0].daehang, '없음');
  assert.strictEqual(report.inherited.total, 0);
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
