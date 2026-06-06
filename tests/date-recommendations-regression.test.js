const assert = require('assert');

const { __test } = require('../src/dateRecommendations');

const payload = __test.buildPayload({
  cortOfcCd: 'B000410',
  startYmd: '20260606',
  endYmd: '20260613',
  usage: 'all',
  maxBidRate: '1',
  pageNo: 1,
  useUsage: false,
  useRate: false,
});

assert.strictEqual(
  payload.dma_srchGdsDtlSrchInfo.cortStDvs,
  '1',
  'date recommendations must search by selected court, not by location defaults'
);
assert.strictEqual(
  payload.dma_srchGdsDtlSrchInfo.cortOfcCd,
  'B000410',
  'selected court code must be passed to the court auction search payload'
);

const extracted = __test.extractItems({
  json: {
    data: {
      dlt_srchResult: [
        {
          boCd: 'B000410',
          srnSaNo: '2024타경120591',
          maemulAddr: '부산광역시 A',
          maemulUtilCd: '03',
          gamevalAmt: '100000000',
          notifyMinmaePrice1: '50000000',
          notifyMinmaePriceRate1: '50',
          yuchalCnt: '2',
          maeGiil: '20260610',
        },
        {
          boCd: 'B000410',
          srnSaNo: '2024타경120591',
          maemulAddr: '부산광역시 B',
          maemulUtilCd: '03',
          gamevalAmt: '100000000',
          notifyMinmaePrice1: '50000000',
          notifyMinmaePriceRate1: '50',
          yuchalCnt: '2',
          maeGiil: '20260610',
        },
      ],
    },
  },
}, '부산지방법원', 'B000410');

assert.strictEqual(extracted.rawCount, 2, 'fixture must include duplicate raw rows');
assert.strictEqual(extracted.duplicateCount, 1, 'same court and case number should be counted as a duplicate');
assert.strictEqual(extracted.items.length, 1, 'same court and case number should render once');
assert.strictEqual(__test.canonicalDateItemKey(extracted.items[0]), 'B000410|2024타경120591');

console.log('date recommendations regression guard passed');
