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

function digits(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function compactDate(value) {
  const s = digits(value);
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

function clean(value) {
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

function money(value) {
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
  const s = values.map(clean).filter(Boolean).join(' ');
  const m = s.match(/(20\d{2})\s*타경\s*(\d{1,10})/);
  return m ? `${m[1]}타경${m[2]}` : '';
}

function courtStem(value) {
  return clean(value)
    .replace(/지방법원|지원|법원|본원|대한민국|특별시|광역시|특별자치도|특별자치시|경기도|강원도|충청남도|충청북도|전라남도|전라북도|경상남도|경상북도/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function hasJsonFragment(value) {
  const s = String(value || '');
  return /\"?[a-zA-Z0-9_]+\"?\s*:\s*\"?/.test(s) || /jpDeptCd|jinstatCd|mulStatcd|maemulUtilCd/.test(s);
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

function itemCourtCode(item) {
  return clean(pick(item, ['boCd', 'cortOfcCd', 'jibunCortCd', 'cortCd'])) || String(item?.docid || '').slice(0, 7);
}

function itemCourtMatches(item, requestedCourt, requestedCourtCode) {
  const code = itemCourtCode(item);
  if (code && requestedCourtCode && code !== requestedCourtCode) return false;
  const rawCourt = clean(pick(item, ['jibunCortNm', 'cortOfcNm', 'courtNm', 'cortNm']));
  if (!rawCourt) return true;
  const req = courtStem(requestedCourt);
  const got = courtStem(rawCourt);
  return !got || !req || got.includes(req) || req.includes(got);
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
    score -= 10;
    reasons.push('가격정보 확인 필요');
  }

  if (failCount >= 3) { score += 18; reasons.push('유찰 3회 이상'); }
  else if (failCount >= 2) { score += 12; reasons.push('유찰 2회'); }
  else if (failCount === 0) { score -= 5; reasons.push('신건/유찰 적음'); }

  if (/아파트/.test(usage)) { score += 16; reasons.push('아파트'); }
  else if (/다세대|연립|주거|오피스텔|단독|다가구/.test(usage)) { score += 10; reasons.push('주거형'); }
  else if (usage) { score -= 4; reasons.push('용도 추가확인'); }

  if (!appraisal || !minBid) score = Math.min(score, 15);
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return { score: finalScore, decision: finalScore >= 52 ? '상위후보' : finalScore >= 30 ? '검토' : '보류', reasons };
}

function addressFromObject(item) {
  const direct = pick(item, [
    'bgPlaceRdAllAddr', 'maemulSidoSigu', 'maemulAddr', 'userSt', 'st', 'addr', 'bldgNm', 'buldNm', 'buldList', '소재지'
  ]);
  const composed = direct || [item.hjguSido, item.hjguDong, item.daepyoLotno, item.buldNm, item.buldList].filter(Boolean).join(' ');
  const address = clean(composed);
  if (!address || hasJsonFragment(address)) return '주소 확인 필요';
  return address;
}

function usageName(item) {
  const direct = clean(pick(item, ['dspslUsgNm', 'lclDspslGdsLstUsgNm', 'mclDspslGdsLstUsgNm', 'gdsUsgNm', '물건종별', 'usgNm']));
  if (direct) return direct;
  const code = clean(item.maemulUtilCd);
  const map = { '01': '아파트', '02': '연립/다세대', '03': '단독/다가구', '04': '오피스텔', '13': '다가구' };
  return map[code] || '용도 확인 필요';
}

function objectToItem(item, requestedCourt, requestedCourtCode) {
  const rawCase = pick(item, ['srnSaNo', 'printCsNo', 'userCsNo', 'csNo', 'userCsNoVal', '사건번호']);
  const caseNo = caseNoFrom(rawCase, item.csNo, item.userCsNo, item.srnSaNo);
  const courtOk = itemCourtMatches(item, requestedCourt, requestedCourtCode);
  const usage = usageName(item);
  const appraisal = money(pick(item, ['gamevalAmt', 'aeeEvlAmt', 'aprsAmt', '감정평가액', '감정가']));
  const minBid = money(pick(item, ['notifyMinmaePrice1', 'fstPbancLwsDspslPrc', 'lwsDspslPrc', '최저매각가격', '최저가']));
  const rateRaw = money(pick(item, ['notifyMinmaePriceRate1', 'lwsDspslPrcRate', '최저가율']));
  const bidRate = rateRaw ? (rateRaw > 1 ? rateRaw / 100 : rateRaw) : (appraisal && minBid ? minBid / appraisal : 1);
  const failRaw = pick(item, ['yuchalCnt', 'dspslDxdyDnum', 'fbCnt', '유찰횟수']);
  const failCount = Number.isFinite(Number(failRaw)) ? Number(failRaw) : money(failRaw);
  const saleDateRaw = clean(pick(item, ['maeGiil', 'dspslDxdyYmd', 'dxdyYmd', '매각기일']));
  const score = scoreCandidate({ appraisal, minBid, bidRate, usage, failCount });

  return {
    court: requestedCourt,
    rawCourt: clean(pick(item, ['jibunCortNm', 'cortOfcNm', 'courtNm', 'cortNm'])),
    boCd: itemCourtCode(item),
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
    invalid: !caseNo || !courtOk,
    invalidReason: !caseNo ? '사건번호 인식 실패' : `법원코드 불일치(${itemCourtCode(item)} != ${requestedCourtCode})`,
    source: 'json',
  };
}

function parseHtmlItems(text, requestedCourt) {
  const visible = clean(text);
  if (!/(20\d{2})\s*타경/.test(visible)) return [];
  const rows = String(text || '').match(/<tr[\s\S]*?<\/tr>/gi) || [];
  if (!rows.length) return [];
  const out = [];
  for (const row of rows) {
    const s = clean(row);
    const caseNo = caseNoFrom(s);
    if (!caseNo) continue;
    const amounts = [...s.matchAll(/([0-9,]{5,})\s*원/g)].map((m) => money(m[1]));
    const appraisal = amounts[0] || 0;
    const minBid = amounts[1] || 0;
    const usage = (s.match(/아파트|다세대|연립|오피스텔|단독|다가구|상가|토지/) || [''])[0] || '용도 확인 필요';
    const rate = (s.match(/(\d{1,3})\s*%/) || [])[1];
    const bidRate = rate ? Number(rate) / 100 : (appraisal && minBid ? minBid / appraisal : 1);
    const failCount = Number((s.match(/유찰\s*(\d+)/) || [])[1] || 0);
    const date = (s.match(/20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}|20\d{6}/) || [''])[0];
    const score = scoreCandidate({ appraisal, minBid, bidRate, usage, failCount });
    out.push({ court: requestedCourt, caseNo, address: '주소 확인 필요', usage, appraisal, minBid, saleDate: date ? formatYmd(date) : '', failCount, margin: appraisal && minBid ? appraisal - minBid : 0, bidRate, score: score.score, decision: score.decision, reasons: score.reasons, source: 'html' });
  }
  return out;
}

function extractItems(response, requestedCourt, requestedCourtCode) {
  const items = [];
  const rejected = [];
  const courtCodeMismatches = {};

  if (response.json) {
    const direct = response.json?.data?.dlt_srchResult;
    if (Array.isArray(direct)) items.push(...direct.map((x) => objectToItem(x, requestedCourt, requestedCourtCode)));

    // JSON 응답일 때는 원문 text를 HTML로 다시 파싱하지 않는다.
    // 그렇지 않으면 JSON 필드 조각이 주소처럼 노출된다.
    if (!items.length) {
      for (const arr of findArrays(response.json)) items.push(...arr.items.map((x) => objectToItem(x, requestedCourt, requestedCourtCode)));
    }
  } else {
    items.push(...parseHtmlItems(response.text, requestedCourt));
  }

  const seen = new Set();
  const valid = [];
  for (const item of items) {
    if (item.invalid) {
      rejected.push(item.invalidReason);
      if (item.boCd) courtCodeMismatches[item.boCd] = (courtCodeMismatches[item.boCd] || 0) + 1;
      continue;
    }
    const key = `${item.court}|${item.caseNo}|${item.address}`;
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push(item);
  }

  return { items: valid, rejected: rejected.slice(0, 10), courtCodeMismatches };
}

function usageCodes(usage) {
  if (usage === '20104') return { lclDspslGdsLstUsgCd: '20000', mclDspslGdsLstUsgCd: '20100', sclDspslGdsLstUsgCd: '20104' };
  if (usage === '20100') return { lclDspslGdsLstUsgCd: '20000', mclDspslGdsLstUsgCd: '20100', sclDspslGdsLstUsgCd: '' };
  return { lclDspslGdsLstUsgCd: '', mclDspslGdsLstUsgCd: '', sclDspslGdsLstUsgCd: '' };
}

function buildPayload({ cortOfcCd, startYmd, endYmd, usage, maxBidRate, useUsage, useRate, pageNo = 1 }) {
  const codes = useUsage ? usageCodes(usage) : usageCodes('all');
  const rateMax = useRate && Number(maxBidRate || 1) < 1 ? String(Math.round(Number(maxBidRate) * 100)) : '';
  return {
    dma_pageInfo: { pageNo, pageSize: 40, bfPageNo: '', startRowNo: '', totalCnt: '', totalYn: 'Y', groupTotalCount: '' },
    dma_srchGdsDtlSrchInfo: {
      rletDspslSpcCondCd: '', bidDvsCd: '000331', mvprpRletDvsCd: '00031R', cortAuctnSrchCondCd: '0004601',
      cortOfcCd, boCd: cortOfcCd, cortCd: cortOfcCd, jibunCortCd: cortOfcCd,
      rprsAdongSdCd: '', rprsAdongSggCd: '', rprsAdongEmdCd: '', rdnmSdCd: '', rdnmSggCd: '', rdnmNo: '',
      mvprpDspslPlcAdongSdCd: '', mvprpDspslPlcAdongSggCd: '', mvprpDspslPlcAdongEmdCd: '', rdDspslPlcAdongSdCd: '', rdDspslPlcAdongSggCd: '', rdDspslPlcAdongEmdCd: '',
      jdbnCd: '', execrOfcDvsCd: '', ...codes, cortAuctnMbrsId: '', aeeEvlAmtMin: '', aeeEvlAmtMax: '', lwsDspslPrcRateMin: '', lwsDspslPrcRateMax: rateMax,
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
  const debug = { engine: 'date-recommendations-v3-json-only-when-json', courtName, cortOfcCd, startYmd, endYmd, attempts: [] };

  if (!cortOfcCd) return { ok: false, verified: false, error: `지원하지 않는 법원명입니다: ${options.court}`, debug, items: [] };

  const modes = [
    { useUsage: false, useRate: false },
    { useUsage: true, useRate: false },
    { useUsage: true, useRate: true },
  ];

  for (const mode of modes) {
    for (let pageNo = 1; pageNo <= 3; pageNo += 1) {
      const payload = buildPayload({ cortOfcCd, startYmd, endYmd, usage: options.usage, maxBidRate: options.maxBidRate, pageNo, ...mode });
      const attempt = { endpoint: '/pgj/pgjsearch/searchControllerMain.on', pageNo, mode, ok: false };
      try {
        const response = await postCourt('/pgj/pgjsearch/searchControllerMain.on', payload);
        const extracted = extractItems(response, courtName, cortOfcCd);
        attempt.ok = true;
        attempt.status = response.status;
        attempt.json = Boolean(response.json);
        attempt.textLength = response.text.length;
        attempt.rawHasCaseNo = /(20\d{2})\s*타경/.test(clean(response.text));
        attempt.count = extracted.items.length;
        attempt.rejected = extracted.rejected;
        attempt.courtCodeMismatches = extracted.courtCodeMismatches;
        if (response.json?.data) attempt.dataKeys = Object.keys(response.json.data).slice(0, 20);
        const direct = response.json?.data?.dlt_srchResult;
        if (Array.isArray(direct)) {
          attempt.rawResultCount = direct.length;
          attempt.rawCourtCodes = [...new Set(direct.map(itemCourtCode).filter(Boolean))].slice(0, 10);
        }
        attempt.sampleText = clean(response.text).slice(0, 500);
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
  }

  return {
    ok: false,
    verified: false,
    error: '검증 가능한 매각기일 목록 데이터가 없습니다. 진단 원문에서 rawCourtCodes/courtCodeMismatches를 확인하세요.',
    court: courtName,
    start: formatYmd(startYmd),
    end: formatYmd(endYmd),
    items: [],
    debug,
  };
}

module.exports = { findAuctionsByDate };
