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
assert.strictEqual(snapshot.monthlyInterest, 1666667, 'monthly interest should include loan amount and annual rate');
assert.strictEqual(snapshot.holdingInterest, 10000002, 'holding period interest should be reflected');
assert.strictEqual(snapshot.totalAcquisitionCost, 568520002, 'total acquisition cost should include bid, taxes, fees, repair, eviction, interest, and prepayment penalty');
assert.strictEqual(snapshot.totalBurden, 578520002, 'total burden should include inherited amount separately');
assert.strictEqual(snapshot.requiredCash, 178520002, 'required cash should subtract the loan from total burden');
assert.strictEqual(snapshot.taxableBase, 78479998, 'taxable base should subtract deductible costs from pre-tax profit');
assert.strictEqual(snapshot.totalTax, 17265600, 'local income tax should be added to income tax');
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
