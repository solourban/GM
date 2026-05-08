const BASE = 'https://www.courtauction.go.kr';
const { COURT_CODES, normalizeCourtName } = require('./crawler');

const HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Content-Type': 'application/json;charset=UTF-8',
  Origin: BASE,
  Referer: `${BASE}/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ151F00.xml`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'X-Requested-With': 'XMLHttpRequest',
};

function onlyDigits(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function compactDate(value) {
  const s = onlyDigits(value);
  return /^\d{8}$/.test(s) ? s : '';
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysYmd(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function formatYmd(value) {
  const s = compactDate(value);
  if (!s) return String(value || '');
  return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function moneyNumber(value) {
  const n = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function pick(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return '';
}

function caseNoFrom(...values) {
  const s = values.map(stripHtml).filter(Boolean).join(' ');
  const m = s.match(/(20\d{2})\s*타경\s*(\d{1,10})/);
  return m ? `${m[1]}타경${m[2]}` : '';
}

function courtStem(value) {
  return stripHtml(value)
    .replace(/지방법원|지원|법원|본원|대한민국|특별시|광역시|특별자치도|특별자치시|경기도|강원도|충청남도|충청북도|전라남도|전라북도|경상남도|경상북도/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function courtMatches(requestedCourt, resultCourt, rawCaseText) {
  const req = courtStem(requestedCourt);
  const got = courtStem(resultCourt);
  const raw = courtStem(String(rawCaseText || '').replace(/20\d{2}\s*타경[\s\S]*/g, ''));
  if (got && req && !got.includes(req) && !req.includes(got)) return false;
  if (raw && raw.length >= 2 && req && !raw.includes(req) && !req.includes(raw)) return false;
  return true;
}

async function postCourt(path, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { status: res.status, text, json };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`${path} timeout`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function findArrays(value, path = 'root', out = []) {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    if (value.some((x) => x && typeof x === 'object')) out.push({ path, items: value });
    value.forEach((v, i) => findArrays(v, `${path}[${i}]`, out));
    return out;
  }
  Object.entries(value).forEach(([key, val]) => findArrays(val, `${path}.${key}`, out));
  return out;
}

function scoreCandidate({ appraisal, minBid, bidRate, usage, failCount }) {
  let score = 0;
  const reasons = [];
  if (appraisal && minBid) {
    if (bidRate <= 0.55) { score += 38; reasons.push('최저가율 55% 이하'); }
    else if (bidRate <= 0.7) { score += 28; reasons.push('최저가율 70% 이하'); }
    else if (bidRate <= 0.85) { score += 14; reasons.push('최저가율 85% 이하'); }
    else { score -= 8; reasons.push('할인폭 작음'); }
  } else {
    reasons.push('가격정보 확인 필요');
  }

  if (failCount >= 3) { score += 18; reasons.push('유찰 3회 이상'); }
  else if (failCount >= 2) { score += 12; reasons.push('유찰 2회'); }
  else if (failCount === 0) { score -= 5; reasons.push('신건/유찰 적음'); }

  if (/아파트/.test(usage)) { score += 16; reasons.push('아파트'); }
  else if (/다세대|연립|주거|오피스텔|단독|다가구/.test(usage)) { score += 10; reasons.push('주거형'); }
  else if (usage) { score -= 4; reasons.push('용도 추가확인'); }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return { score: finalScore, decision: finalScore >= 52 ? '상위후보' : finalScore >= 30 ? '검토' : '보류', reasons };
}

function addressFromObject(item) {
  const direct = pick(item, ['bgPlaceRdAllAddr', 'userSt', 'st', 'addr', 'bldgNm', '소재지']);
  if (direct) return stripHtml(direct);
  return stripHtml([item.hjguSido, item.hjguDong, item.daepyoLotno, item.buldNm, item.buldList].filter(Boolean).join(' '));
}

function objectToItem(item, requestedCourt) {
  const rawCase = pick(item, ['printCsNo', 'userCsNo', 'csNo', 'userCsNoVal', '사건번호']);
  const caseNo = caseNoFrom(rawCase, item.csNo, item.userCsNo, item.printCsNo);
  const rawCourt = stripHtml(pick(item, ['jibunCortNm', 'cortOfcNm', 'courtNm', 'cortNm']));
  const usage = stripHtml(pick(item, ['dspslUsgNm', 'lclDspslGdsLstUsgNm', 'mclDspslGdsLstUsgNm', 'gdsUsgNm', '물건종별', 'usgNm']));
  const appraisal = moneyNumber(pick(item, ['gamevalAmt', 'aeeEvlAmt', 'aprsAmt', '감정평가액', '감정가']));
  const minBid = moneyNumber(pick(item, ['notifyMinmaePrice1', 'fstPbancLwsDspslPrc', 'lwsDspslPrc', '최저매각가격', '최저가']));
  const rateRaw = moneyNumber(pick(item, ['notifyMinmaePriceRate1', 'lwsDspslPrcRate', '최저가율']));
  const bidRate = rateRaw ? (rateRaw > 1 ? rateRaw / 100 : rateRaw) : (appraisal && minBid ? minBid / appraisal : 1);
  const failRaw = pick(item, ['yuchalCnt', 'dspslDxdyDnum', 'fbCnt', '유찰횟수']);
  const failCount = Number.isFinite(Number(failRaw)) ? Number(failRaw) : moneyNumber(failRaw);
  const saleDateRaw = stripHtml(pick(item, ['maeGiil', 'dspslDxdyYmd', 'dxdyYmd', '매각기일']));
  const score = scoreCandidate({ appraisal, minBid, bidRate, usage, failCount });
  const invalid = !caseNo || !courtMatches(requestedCourt, rawCourt, rawCase);
  return {
    court: requestedCourt,
    rawCourt,
    caseNo,
    address: addressFromObject(item),
    usage,
    appraisal,
    minBid,
    saleDate: /^\d{8}$/.test(saleDateRaw) ? formatYmd(saleDateRaw) : saleDateRaw,
    failCount,
    margin: appraisal && minBid ? appraisal - minBid : 0,
    bidRate,
    score: score.score,
    decision: score.decision,
    reasons: score.reasons,
    invalid,
    invalidReason: !caseNo ? '사건번호 인식 실패' : '요청 법원과 결과 법원 불일치',
  };
}

function parseHtmlItems(text, requestedCourt) {
  const raw = String(text || '');
  const visible = stripHtml(raw);
  if (!/(20\d{2})\s*타경/.test(visible)) return [];

  const rows = raw.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const chunks = rows.length ? rows : visible.split(/(?=20\d{2}\s*타경)/g);
  const out = [];

  for (const chunk of chunks) {
    const s = stripHtml(chunk);
    const caseNo = caseNoFrom(s);
    if (!caseNo) continue;
    if (!courtMatches(requestedCourt, '', s)) continue;

    const amounts = [...s.matchAll(/([0-9,]{5,})\s*원/g)].map((m) => moneyNumber(m[1]));
    const appraisal = amounts[0] || 0;
    const minBid = amounts[1] || amounts[0] || 0;
    const rate = (s.match(/(\d{1,3})\s*%/) || [])[1];
    const bidRate = rate ? Number(rate) / 100 : (appraisal && minBid ? minBid / appraisal : 1);
    const fail = Number((s.match(/유찰\s*(\d+)/) || [])[1] || 0);
    const usage = (s.match(/아파트|다세대|연립|오피스텔|단독|다가구|상가|토지/) || [''])[0];
    const date = (s.match(/20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}|20\d{6}/) || [''])[0];
    const address = s.replace(/[\s\S]*?20\d{2}\s*타경\s*\d{1,10}/, '').replace(/감정가[\s\S]*/g, '').slice(0, 90).trim();
    const score = scoreCandidate({ appraisal, minBid, bidRate, usage, failCount: fail });
    out.push({ court: requestedCourt, caseNo, address, usage, appraisal, minBid, saleDate: date ? formatYmd(date) : '', failCount: fail, margin: appraisal && minBid ? appraisal - minBid : 0, bidRate, score: score.score, decision: score.decision, reasons: score.reasons, source: 'html' });
  }

  return out;
}

function extractItems(response, requestedCourt) {
  const items = [];
  const rejected = [];

  const direct = response.json?.data?.dlt_srchResult;
  if (Array.isArray(direct)) items.push(...direct.map((x) => objectToItem(x, requestedCourt)));

  if (response.json) {
    for (const arr of findArrays(response.json)) items.push(...arr.items.map((x) => objectToItem(x, requestedCourt)));
  }

  items.push(...parseHtmlItems(response.text, requestedCourt));

  const seen = new Set();
  const valid = [];
  for (const item of items) {
    if (item.invalid) {
      rejected.push(item.invalidReason);
      continue;
    }
    const key = `${item.court}|${item.caseNo}|${item.address}`;
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push(item);
  }

  return { items: valid, rejected: rejected.slice(0, 10) };
}

function usageCodes(usage) {
  if (usage === '20104') return { lclDspslGdsLstUsgCd: '20000', mclDspslGdsLstUsgCd: '20100', sclDspslGdsLstUsgCd: '20104' };
  if (usage === '20100') return { lclDspslGdsLstUsgCd: '20000', mclDspslGdsLstUsgCd: '20100', sclDspslGdsLstUsgCd: '' };
  return { lclDspslGdsLstUsgCd: '', mclDspslGdsLstUsgCd: '', sclDspslGdsLstUsgCd: '' };
}

function buildPayload({ cortOfcCd, startYmd, endYmd, usage, maxBidRate, useUsage, useRate }) {
  const codes = useUsage ? usageCodes(usage) : usageCodes('all');
  const rateMax = useRate && Number(maxBidRate || 1) < 1 ? String(Math.round(Number(maxBidRate) * 100)) : '';
  return {
    dma_pageInfo: { pageNo: 1, pageSize: 40, bfPageNo: '', startRowNo: '', totalCnt: '', totalYn: 'Y', groupTotalCount: '' },
    dma_srchGdsDtlSrchInfo: {
      rletDspslSpcCondCd: '', bidDvsCd: '000331', mvprpRletDvsCd: '00031R', cortAuctnSrchCondCd: '0004601',
      rprsAdongSdCd: '', rprsAdongSggCd: '', rprsAdongEmdCd: '', rdnmSdCd: '', rdnmSggCd: '', rdnmNo: '',
      mvprpDspslPlcAdongSdCd: '', mvprpDspslPlcAdongSggCd: '', mvprpDspslPlcAdongEmdCd: '', rdDspslPlcAdongSdCd: '', rdDspslPlcAdongSggCd: '', rdDspslPlcAdongEmdCd: '',
      cortOfcCd, jdbnCd: '', execrOfcDvsCd: '', ...codes, cortAuctnMbrsId: '', aeeEvlAmtMin: '', aeeEvlAmtMax: '', lwsDspslPrcRateMin: '', lwsDspslPrcRateMax: rateMax,
      flbdNcntMin: '', flbdNcntMax: '', objctArDtsMin: '', objctArDtsMax: '', mvprpArtclKndCd: '', mvprpArtclNm: '', mvprpAtchmPlcTypCd: '', notifyLoc: 'on', lafjOrderBy: '',
      pgmId: 'PGJ151F01', csNo: '', cortStDvs: '3', statNum: 1, bidBgngYmd: startYmd, bidEndYmd: endYmd,
      dspslDxdyYmd: '', fstDspslHm: '', scndDspslHm: '', thrdDspslHm: '', fothDspslHm: '', dspslPlcNm: '', lwsDspslPrcMin: '', lwsDspslPrcMax: '',
      grbxTypCd: '', gdsVendNm: '', fuelKndCd: '', carMdyrMax: '', carMdyrMin: '', carMdlNm: '',
    },
  };
}

function matchesUsage(item, usage) {
  if (!usage || usage === 'all') return true;
  if (usage === '20104') return /아파트/.test(item.usage || '');
  if (usage === '20100') return /아파트|다세대|연립|주거|오피스텔|단독|다가구/.test(item.usage || '');
  return true;
}

function applyFilters(items, options) {
  const maxRate = Number(options.maxBidRate || 1);
  return items
    .filter((x) => matchesUsage(x, options.usage))
    .filter((x) => maxRate >= 1 || !x.bidRate || x.bidRate <= maxRate)
    .sort((a, b) => b.score - a.score || b.margin - a.margin)
    .slice(0, Number(options.limit || 20));
}

async function findAuctionsByDate(options = {}) {
  const startYmd = compactDate(options.start) || todayYmd();
  const endYmd = compactDate(options.end) || addDaysYmd(7);
  const courtName = normalizeCourtName(options.court || '서울중앙');
  const cortOfcCd = COURT_CODES[courtName];
  const debug = { engine: 'date-recommendations-v2-json-html', courtName, cortOfcCd, startYmd, endYmd, attempts: [] };

  if (!cortOfcCd) return { ok: false, verified: false, error: `지원하지 않는 법원명입니다: ${options.court}`, debug, items: [] };

  const payloads = [
    buildPayload({ cortOfcCd, startYmd, endYmd, usage: options.usage, maxBidRate: options.maxBidRate, useUsage: false, useRate: false }),
    buildPayload({ cortOfcCd, startYmd, endYmd, usage: options.usage, maxBidRate: options.maxBidRate, useUsage: true, useRate: false }),
    buildPayload({ cortOfcCd, startYmd, endYmd, usage: options.usage, maxBidRate: options.maxBidRate, useUsage: true, useRate: true }),
  ];

  for (const payload of payloads) {
    const attempt = { endpoint: '/pgj/pgjsearch/searchControllerMain.on', payloadKeys: Object.keys(payload), ok: false };
    try {
      const response = await postCourt('/pgj/pgjsearch/searchControllerMain.on', payload);
      const extracted = extractItems(response, courtName);
      attempt.ok = true;
      attempt.status = response.status;
      attempt.json = Boolean(response.json);
      attempt.textLength = response.text.length;
      attempt.rawHasCaseNo = /(20\d{2})\s*타경/.test(stripHtml(response.text));
      attempt.count = extracted.items.length;
      attempt.rejected = extracted.rejected;
      attempt.sampleText = stripHtml(response.text).slice(0, 500);
      if (response.json?.data) attempt.dataKeys = Object.keys(response.json.data).slice(0, 20);
      debug.attempts.push(attempt);
      if (extracted.items.length) {
        const filtered = applyFilters(extracted.items, options);
        return { ok: true, verified: true, court: courtName, start: formatYmd(startYmd), end: formatYmd(endYmd), count: filtered.length, items: filtered, debug };
      }
    } catch (e) {
      attempt.error = e.message || String(e);
      debug.attempts.push(attempt);
    }
  }

  return {
    ok: false,
    verified: false,
    error: '검증 가능한 매각기일 목록 데이터가 없습니다. 진단 원문에서 rawHasCaseNo/textLength/dataKeys/sampleText를 확인하세요.',
    court: courtName,
    start: formatYmd(startYmd),
    end: formatYmd(endYmd),
    items: [],
    debug,
  };
}

module.exports = { findAuctionsByDate };
