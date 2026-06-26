const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const bidPlanSource = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-bid-plan.js'), 'utf8');
const copySummarySource = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-copy-summary.js'), 'utf8');
const finalJudgmentSource = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-final-judgment.js'), 'utf8');

const storage = new Map();
const sandbox = {
  window: { __auctionV2: { state: { report: null } } },
  document: {
    getElementById: () => null,
    dispatchEvent: () => {},
  },
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
  CustomEvent: function CustomEvent(type, init) {
    this.type = type;
    this.detail = init?.detail;
  },
  setInterval: () => 1,
  console,
};

vm.createContext(sandbox);
vm.runInContext(bidPlanSource, sandbox, { filename: 'app-v2-bid-plan.js' });

const api = sandbox.window.__auctionBidPlan;
assert(api, 'bid plan bridge should be exposed');
assert.strictEqual(typeof api.computePlan, 'function', 'computePlan should be testable');

const report = {
  court: '서울중앙지방법원',
  caseNo: '2024타경110754',
  basic: {
    감정평가액: '700,000,000원',
    최저매각가격: '500,000,000원',
    입찰보증금률: '10%',
  },
  inherited: { total: 10000000 },
  bidRec: { upper: 560000000 },
  risk: { level: 'warn' },
};

const snapshot = api.computePlan({
  plannedBid: '520000000',
  expectedSalePrice: '650000000',
  acquisitionTaxRate: '1.1',
  registryCost: '1000000',
  legalFee: '800000',
  unpaidManagementFee: '2000000',
  repairCost: '20000000',
  evictionCost: '5000000',
  loanAmount: '400000000',
  appraisalLoanRate: '60',
  bidLoanRate: '80',
  roomDeduction: '55000000',
  annualInterestRate: '5',
  holdingMonths: '6',
  prepaymentPenaltyRate: '1',
  sellBrokerageFee: '3000000',
  incomeTaxRate: '20',
  localIncomeTaxRate: '10',
}, report);

assert.strictEqual(snapshot.bidDeposit, 52000000, 'bid deposit should follow report rate');
assert.strictEqual(snapshot.acquisitionTax, 5720000, 'acquisition tax should use editable tax rate');
assert.strictEqual(snapshot.appraisalLoanCap, 420000000, 'appraisal loan cap should use appraised value and appraisal loan rate');
assert.strictEqual(snapshot.bidLoanCap, 416000000, 'bid loan cap should use planned bid and bid loan rate');
assert.strictEqual(snapshot.suggestedLoan, 361000000, 'suggested loan should subtract room deduction from the lower loan cap');
assert.strictEqual(snapshot.monthlyInterest, 1666667, 'monthly interest should include loan amount and annual rate');
assert.strictEqual(snapshot.holdingInterest, 10000002, 'holding period interest should be reflected');
assert.strictEqual(snapshot.prepaymentPenalty, 4000000, 'prepayment penalty should use loan amount and penalty rate');
assert.strictEqual(snapshot.totalAcquisitionCost, 568520002, 'total acquisition cost should include bid, taxes, fees, repair, eviction, interest, and prepayment penalty');
assert.strictEqual(snapshot.totalBurden, 578520002, 'total burden should include inherited amount separately');
assert.strictEqual(snapshot.requiredCash, 178520002, 'required cash should subtract the loan from total burden');
assert.strictEqual(snapshot.taxableBase, 78479998, 'taxable base should subtract deductible costs from pre-tax profit');
assert.strictEqual(snapshot.incomeTax, 15696000, 'income tax should use taxable base and income tax rate');
assert.strictEqual(snapshot.localIncomeTax, 1569600, 'local income tax should use income tax and local tax rate');
assert.strictEqual(snapshot.totalTax, 17265600, 'local income tax should be added to income tax');
assert.strictEqual(snapshot.totalCost, 598785602, 'total cost should include burden, selling fee, and tax');
assert.strictEqual(snapshot.afterTaxProfit, 51214398, 'after-tax profit should subtract total costs and tax from sale price');
assert.strictEqual(snapshot.breakEvenSalePrice, 598785602, 'break-even sale price should include total burden, selling fee, and taxes');
assert.strictEqual(snapshot.holdingMonthlyCost, 5333334, 'monthly holding cost should average interest, management, and repair costs over holding months');
assert(snapshot.roi > 28.6 && snapshot.roi < 28.7, 'ROI should be calculated from after-tax profit / required cash');

const autoLoan = api.computePlan({
  ...api.FIELD_DEFAULTS,
  plannedBid: '520000000',
  roomDeduction: '55000000',
}, report);
assert.strictEqual(autoLoan.suggestedLoan, 361000000, 'blank loan amount should use min(appraisal 60%, bid 80%) minus room deduction');
assert.strictEqual(autoLoan.loanAmount, 361000000, 'blank loan input should reflect the suggested reference loan amount');

storage.set(api.storageKey(report), '520000000');
assert.strictEqual(api.loadPlan(report).plannedBid, '520000000', 'old single-number storage must stay readable');

api.savePlan(report, { ...api.FIELD_DEFAULTS, plannedBid: '530000000', repairCost: '10000000' });
const stored = JSON.parse(storage.get(api.storageKey(report)));
assert.strictEqual(stored.plannedBid, '530000000', 'new storage should keep planned bid in JSON');
assert.strictEqual(stored.repairCost, '10000000', 'new storage should keep cost fields in JSON');

const requiredCopySummaryHooks = [
  'function loadBidPlanSnapshot',
  'window.__auctionBidPlan.currentSnapshot',
  'FINAL_JUDGMENT_STORAGE_KEY',
  'function appendFinalJudgmentSummary',
  '최종 검토 방향',
  '다음 확인순서',
  '입찰가·자금 계산',
  '필요 현금',
  '세후수익',
  '금융기관·세무 확인',
];
for (const needle of requiredCopySummaryHooks) {
  assert(copySummarySource.includes(needle), `copy summary should include ${needle}`);
}

const requiredBidPlanDisplayHooks = [
  '핵심 계산 결과',
  '상세 비용·대출·세금 입력',
  '상세 계산값 보기',
  'v2-bid-summary-block',
  'v2-bid-advanced-inputs',
  '계산 상세',
  '취득세+지방세',
  '감정가 기준 대출',
  '낙찰가 기준 대출',
  '방공제 금액',
  '중도상환수수료',
  '양도세/소득세',
  '양도세 지방세',
  '총 비용(세금 포함)',
  '권리관계와 명도 가능성',
  'data-bid-plan="totalCost"',
];
for (const needle of requiredBidPlanDisplayHooks) {
  assert(bidPlanSource.includes(needle), `bid plan display should include ${needle}`);
}

const dataBindings = [...bidPlanSource.matchAll(/data-bid-plan="([^"]+)"/g)].map((match) => match[1]);
const duplicateBindings = dataBindings.filter((key, index) => dataBindings.indexOf(key) !== index);
assert.deepStrictEqual(duplicateBindings, [], 'bid plan display bindings should not be duplicated');

const requiredFinalJudgmentHooks = [
  'function bidPlanSnapshot',
  'window.__auctionBidPlan?.currentSnapshot',
  'function nextChecks',
  '다음 확인순서',
  '최저가 기준 실질부담',
  '손익분기 매도가',
  '필요 현금',
  '세후수익',
  '수익률',
  '입찰가 산정',
];
for (const needle of requiredFinalJudgmentHooks) {
  assert(finalJudgmentSource.includes(needle), `final judgment should include ${needle}`);
}

console.log('Bid plan calculation guard passed.');
