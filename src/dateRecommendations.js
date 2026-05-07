const BASE = 'https://www.courtauction.go.kr';
const { COURT_CODES, normalizeCourtName } = require('./crawler');

const HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Content-Type': 'application/json;charset=UTF-8',
  Origin: BASE,
  Referer: `${BASE}/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ151M00.xml`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'X-Requested-With': 'XMLHttpRequest',
};

function compactDate(value) {
  const s = String(value || '').replace(/[^0-9]/g, '');
  if (/^\d{8}$/.test(s)) return s;
  return '';
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

function formatYmd(s) {
  const ymd = compactDate(s);
  if (!ymd) return String(s || '');
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`;
}

function moneyNumber(value) {
  const n = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function callApi(path, payload) {
  const url = `${BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = { rawText: text.slice(0, 500) }; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return data;
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
    if (value.length && value.some((x) => x && typeof x === 'object')) out.push({ path, items: value });
    value.forEach((v, i) => findArrays(v, `${path}[${i}]`, out));
    return out;
  }
  Object.entries(value).forEach(([k, v]) => findArrays(v, `${path}.${k}`, out));
  return out;
}

function pickFirst(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] != null && obj[key] !== '') return obj[key];
  }
  return '';
}

function normalizeItem(item, courtName) {
  const caseNo = cleanText(pickFirst(item, ['userCsNo', 'csNo', 'userCsNoVal', '사건번호']));
  const address = cleanText(pickFirst(item, ['userSt', 'st', 'addr', 'bldgNm', '소재지']));
  const usage = cleanText(pickFirst(item, ['lclDspslGdsLstUsgNm', 'mclDspslGdsLstUsgNm', 'gdsUsgNm', '물건종별', 'usgNm']));
  const appraisal = moneyNumber(pickFirst(item, ['aeeEvlAmt', 'aprsAmt', '감정평가액', '감정가']));
  const minBid = moneyNumber(pickFirst(item, ['fstPbancLwsDspslPrc', 'lwsDspslPrc', '최저매각가격', '최저가']));
  const saleDate = formatYmd(pickFirst(item, ['dspslDxdyYmd', 'dxdyYmd', '매각기일']));
  const failCountRaw = pickFirst(item, ['dspslDxdyDnum', 'fbCnt', '유찰횟수']);
  const failCount = Number.isFinite(Number(failCountRaw)) ? Math.max(0, Number(failCountRaw) - 1) : moneyNumber(failCountRaw);
  const margin = appraisal && minBid ? appraisal - minBid : 0;
  const bidRate = appraisal && minBid ? minBid / appraisal : 1;
  const score = scoreCandidate({ appraisal, minBid, bidRate, usage, failCount });

  return {
    court: courtName,
    caseNo,
    address,
    usage,
    appraisal,
    minBid,
    saleDate,
    failCount,
    margin,
    bidRate,
    score: score.score,
    decision: score.decision,
    reasons: score.reasons,
    raw: item,
  };
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

  let decision = '보류';
  if (score >= 52) decision = '상위후보';
  else if (score >= 30) decision = '검토';
  return { score: Math.max(0, Math.min(100, Math.round(score))), decision, reasons };
}

function extractItems(data, courtName) {
  const arrays = findArrays(data);
  const candidates = arrays
    .map((entry) => ({ ...entry, score: entry.items.length }))
    .filter((entry) => entry.items.length)
    .sort((a, b) => b.items.length - a.items.length);

  for (const entry of candidates) {
    const normalized = entry.items
      .map((item) => normalizeItem(item, courtName))
      .filter((item) => item.caseNo || item.address || item.appraisal || item.minBid);
    if (normalized.length) return { items: normalized, sourcePath: entry.path };
  }
  return { items: [], sourcePath: '' };
}

function buildPayloads({ cortOfcCd, startYmd, endYmd, usage }) {
  const base = {
    cortOfcCd,
    dspslDxdyYmdFr: startYmd,
    dspslDxdyYmdTo: endYmd,
    dxdyYmdFr: startYmd,
    dxdyYmdTo: endYmd,
    searchFromDate: startYmd,
    searchToDate: endYmd,
    pageNo: 1,
    rowSize: 50,
    recordCountPerPage: 50,
  };
  const usagePayload = usage && usage !== 'all' ? { lclDspslGdsLstUsgCd: usage } : {};
  return [
    { dma_search: { ...base, ...usagePayload } },
    { dma_srchGdsDtl: { ...base, ...usagePayload } },
    { dma_srchLst: { ...base, ...usagePayload } },
    { dma_searchParam: { ...base, ...usagePayload } },
    { ...base, ...usagePayload },
  ];
}

async function findAuctionsByDate(options = {}) {
  const startYmd = compactDate(options.start) || todayYmd();
  const endYmd = compactDate(options.end) || addDaysYmd(7);
  const courtName = normalizeCourtName(options.court || '서울중앙');
  const cortOfcCd = COURT_CODES[courtName];
  const usage = options.usage || 'all';
  const debug = { courtName, cortOfcCd, startYmd, endYmd, attempts: [] };

  if (!cortOfcCd) {
    return { ok: false, error: `지원하지 않는 법원명입니다: ${options.court}`, debug, items: [] };
  }

  const endpointCandidates = [
    '/pgj/pgj15A/selectGdsDtlSrchRslt.on',
    '/pgj/pgj15A/selectAuctnGdsSrchRslt.on',
    '/pgj/pgj15A/selectAuctnGdsList.on',
    '/pgj/pgj15A/selectDxdyGdsSrchRslt.on',
    '/pgj/pgj15A/selectAuctnDxdySrchRslt.on',
  ];
  const payloads = buildPayloads({ cortOfcCd, startYmd, endYmd, usage });

  for (const endpoint of endpointCandidates) {
    for (const payload of payloads) {
      const attempt = { endpoint, payloadKeys: Object.keys(payload), ok: false };
      try {
        const data = await callApi(endpoint, payload);
        const extracted = extractItems(data, courtName);
        attempt.ok = true;
        attempt.status = data.status;
        attempt.sourcePath = extracted.sourcePath;
        attempt.count = extracted.items.length;
        debug.attempts.push(attempt);
        if (extracted.items.length) {
          const minRate = Number(options.maxBidRate || 1);
          const filtered = extracted.items
            .filter((item) => !minRate || item.bidRate <= minRate)
            .sort((a, b) => b.score - a.score || b.margin - a.margin)
            .slice(0, Number(options.limit || 20));
          return { ok: true, court: courtName, start: formatYmd(startYmd), end: formatYmd(endYmd), count: filtered.length, items: filtered, debug };
        }
      } catch (e) {
        attempt.error = e.message || String(e);
        debug.attempts.push(attempt);
      }
    }
  }

  return {
    ok: false,
    error: '매각기일 목록 API 후보를 찾지 못했습니다. 대법원 목록 검색 엔드포인트 확인이 필요합니다.',
    court: courtName,
    start: formatYmd(startYmd),
    end: formatYmd(endYmd),
    items: [],
    debug,
  };
}

module.exports = { findAuctionsByDate };
