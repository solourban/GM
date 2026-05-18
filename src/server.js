const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const packageJson = require('../package.json');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SERVICE_NAME = packageJson.name || 'auction-analyzer';
const SERVICE_VERSION = packageJson.version || 'unknown';
const startedAt = new Date();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (allowedOrigins.length) {
  app.use(cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('허용되지 않은 출처입니다.'));
    },
  }));
}

function createRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function errorBody(req, message, extra = {}) {
  return {
    ok: false,
    error: message,
    requestId: req.requestId || null,
    ...extra,
  };
}

function logException(scope, req, error, extra = {}) {
  console.error(`[${scope}]`, {
    requestId: req.requestId || null,
    method: req.method,
    path: req.path,
    message: error?.message || String(error),
    stack: error?.stack || null,
    ...extra,
  });
}

app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || createRequestId();
  res.setHeader('X-Request-Id', req.requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/', (req, res, next) => {
  fs.readFile(path.join(PUBLIC_DIR, 'index.html'), 'utf8', (err, html) => {
    if (err) return next(err);
    res.type('html').send(html);
  });
});

app.use(express.static(PUBLIC_DIR));

const { analyzeCase } = require('./analyzer');
const { fetchCase, listCourts } = require('./crawler');
const { findAuctionsByDate } = require('./dateRecommendations');

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 30);
const apiHits = new Map();

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function rateLimit(req, res, next) {
  const now = Date.now();
  const ip = clientIp(req);
  const bucket = apiHits.get(ip) || [];
  const recent = bucket.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  apiHits.set(ip, recent);

  if (recent.length > RATE_LIMIT_MAX) {
    return res.status(429).json(errorBody(req, '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'));
  }
  return next();
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, hits] of apiHits.entries()) {
    const recent = hits.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
    if (recent.length) apiHits.set(ip, recent);
    else apiHits.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS).unref?.();

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
});

app.use('/api', rateLimit);

function externalApiConfig() {
  return {
    kakaoRestKey: process.env.KAKAO_REST_API_KEY || process.env.KAKAO_LOCAL_API_KEY || '',
    kakaoMapKey: process.env.KAKAO_JS_KEY || process.env.KAKAO_MAP_KEY || '',
    molitKey: process.env.MOLIT_API_KEY || process.env.DATA_GO_KR_KEY || '',
    onbidKey: process.env.ONBID_API_KEY || '',
  };
}

app.get('/api/config', (req, res) => {
  const keys = externalApiConfig();
  res.json({
    ok: true,
    hasKakaoRest: Boolean(keys.kakaoRestKey),
    hasKakaoMap: Boolean(keys.kakaoMapKey),
    hasMolit: Boolean(keys.molitKey),
    hasOnbid: Boolean(keys.onbidKey),
    envNames: {
      kakaoRest: 'KAKAO_REST_API_KEY',
      kakaoMap: 'KAKAO_JS_KEY',
      molit: 'MOLIT_API_KEY',
      onbid: 'ONBID_API_KEY',
    },
    requestId: req.requestId,
  });
});

function validateAddressInput(address) {
  const value = String(address || '').trim();
  if (!value) return { error: '주소를 입력해주세요.' };
  if (value.length < 2) return { error: '주소는 2자 이상 입력해주세요.' };
  if (value.length > 120) return { error: '주소는 120자 이하로 입력해주세요.' };
  if (/[<>`{}]/.test(value)) return { error: '주소에 허용되지 않는 문자가 포함되어 있습니다.' };
  return { value };
}

function normalizeKakaoAddressDocument(doc) {
  const address = doc?.address || {};
  const road = doc?.road_address || {};
  return {
    addressName: doc?.address_name || '',
    x: doc?.x || '',
    y: doc?.y || '',
    type: doc?.address_type || '',
    region1: address.region_1depth_name || road.region_1depth_name || '',
    region2: address.region_2depth_name || road.region_2depth_name || '',
    region3: address.region_3depth_name || road.region_3depth_name || '',
    roadAddress: road.address_name || '',
    buildingName: road.building_name || '',
    zoneNo: road.zone_no || '',
    bCode: address.b_code || '',
    hCode: address.h_code || '',
  };
}

app.get('/api/location/geocode', async (req, res) => {
  try {
    const keys = externalApiConfig();
    if (!keys.kakaoRestKey) return res.status(400).json(errorBody(req, '카카오 주소검색 환경설정이 필요합니다.'));

    const input = validateAddressInput(req.query.address);
    if (input.error) return res.status(400).json(errorBody(req, input.error));

    const url = new URL('https://dapi.kakao.com/v2/local/search/address.json');
    url.searchParams.set('query', input.value);
    url.searchParams.set('size', '5');

    const apiRes = await fetch(url.toString(), {
      headers: {
        Authorization: `KakaoAK ${keys.kakaoRestKey}`,
        Accept: 'application/json',
      },
    });
    const data = await apiRes.json().catch(() => null);

    if (!apiRes.ok) {
      logException('location/geocode:upstream', req, new Error('Kakao API response error'), { status: apiRes.status, upstream: data?.message || data?.errorType || null });
      return res.status(apiRes.status).json(errorBody(req, '카카오 주소검색 API 응답 오류가 발생했습니다.', { status: apiRes.status }));
    }

    const documents = Array.isArray(data?.documents) ? data.documents.map(normalizeKakaoAddressDocument) : [];
    return res.json({
      ok: true,
      query: input.value,
      count: documents.length,
      documents,
      meta: {
        totalCount: data?.meta?.total_count || 0,
        pageableCount: data?.meta?.pageable_count || 0,
        isEnd: Boolean(data?.meta?.is_end),
      },
      requestId: req.requestId,
    });
  } catch (e) {
    logException('location/geocode', req, e);
    return res.status(500).json(errorBody(req, '주소 좌표 변환 중 오류가 발생했습니다.'));
  }
});

app.get('/api/courts', (req, res) => {
  res.json({ ok: true, courts: listCourts(), requestId: req.requestId });
});

app.get('/api/recommendations/by-date', async (req, res) => {
  try {
    const result = await findAuctionsByDate({
      court: req.query.court || '서울중앙',
      start: req.query.start || '',
      end: req.query.end || '',
      usage: req.query.usage || 'all',
      maxBidRate: req.query.maxBidRate || 1,
      limit: req.query.limit || 20,
    });
    const status = result.ok ? 200 : 502;
    return res.status(status).json({ ...result, requestId: req.requestId });
  } catch (e) {
    logException('recommendations/by-date', req, e);
    return res.status(500).json(errorBody(req, '매각기일 추천 조회 중 오류가 발생했습니다.'));
  }
});

function xmlText(xml, tag) {
  const m = String(xml || '').match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : '';
}

function pickXml(item, tags) {
  for (const tag of tags) {
    const value = xmlText(item, tag);
    if (value) return value;
  }
  return '';
}

const MOLIT_TYPES = {
  apt: {
    label: '아파트',
    url: 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev',
    nameTags: ['aptNm', '아파트', '단지'],
  },
  offi: {
    label: '오피스텔',
    url: 'https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade',
    nameTags: ['offiNm', '오피스텔', '단지'],
  },
  rh: {
    label: '연립다세대',
    url: 'https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade',
    nameTags: ['mhouseNm', 'houseNm', '연립다세대', '단지'],
  },
};

function parseTradeXml(xml, tradeType = 'apt') {
  const typeInfo = MOLIT_TYPES[tradeType] || MOLIT_TYPES.apt;
  const items = [...String(xml || '').matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  return items.map((item) => ({
    tradeType,
    tradeTypeLabel: typeInfo.label,
    aptName: pickXml(item, typeInfo.nameTags) || pickXml(item, ['aptNm', 'offiNm', 'mhouseNm', 'houseNm', '아파트', '오피스텔', '연립다세대', '단지']),
    dealAmount: pickXml(item, ['dealAmount', '거래금액']),
    buildYear: pickXml(item, ['buildYear', '건축년도']),
    dealYear: pickXml(item, ['dealYear', '년']),
    dealMonth: pickXml(item, ['dealMonth', '월']),
    dealDay: pickXml(item, ['dealDay', '일']),
    area: pickXml(item, ['excluUseAr', '전용면적']),
    floor: pickXml(item, ['floor', '층']),
    dong: pickXml(item, ['umdNm', '법정동']),
    roadName: pickXml(item, ['roadNm', '도로명']),
    cancelDate: pickXml(item, ['cdealDay', '해제사유발생일']),
  }));
}

function compactName(value) {
  return String(value || '').replace(/\s+/g, '').replace(/[()\[\]{}·,._\-]/g, '').toLowerCase();
}

function filterTradesByName(trades, aptName) {
  const query = compactName(aptName);
  if (!query) return { trades, matchQuality: 'none', filterApplied: false };
  const filtered = trades.filter((t) => compactName(t.aptName).includes(query) || query.includes(compactName(t.aptName)));
  const matchQuality = query.length >= 4 ? 'strong' : 'weak';
  return { trades: filtered, matchQuality, filterApplied: true };
}

async function fetchMolitType({ key, lawdCd, dealYmd, aptName, tradeType }) {
  const typeInfo = MOLIT_TYPES[tradeType] || MOLIT_TYPES.apt;
  const url = new URL(typeInfo.url);
  url.searchParams.set('serviceKey', key);
  url.searchParams.set('LAWD_CD', lawdCd);
  url.searchParams.set('DEAL_YMD', dealYmd);
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('numOfRows', '1000');

  const apiRes = await fetch(url.toString(), { headers: { Accept: 'application/xml,text/xml,*/*' } });
  const xml = await apiRes.text();
  if (!apiRes.ok) throw new Error(`${typeInfo.label} API 응답 오류: ${apiRes.status}`);
  const parsed = parseTradeXml(xml, tradeType);
  const filtered = filterTradesByName(parsed, aptName);
  return { type: tradeType, label: typeInfo.label, rawCount: parsed.length, ...filtered };
}

async function lookupMolitTrades({ lawdCd, dealYmd, aptName, tradeType }) {
  const key = process.env.MOLIT_API_KEY || process.env.DATA_GO_KR_KEY || '';
  if (!key) return { status: 400, body: { ok: false, error: '국토부 실거래가 환경설정이 필요합니다.' } };
  if (!/^\d{5}$/.test(lawdCd)) return { status: 400, body: { ok: false, error: '법정동코드 앞 5자리(LAWD_CD)를 입력해주세요.' } };
  if (!/^\d{6}$/.test(dealYmd)) return { status: 400, body: { ok: false, error: '계약월(DEAL_YMD)은 YYYYMM 6자리로 입력해주세요.' } };

  const types = tradeType && tradeType !== 'auto' ? [tradeType] : ['apt', 'offi', 'rh'];
  const results = [];
  const errors = [];
  for (const type of types) {
    try {
      results.push(await fetchMolitType({ key, lawdCd, dealYmd, aptName, tradeType: type }));
    } catch (e) {
      errors.push({ type, error: '조회 실패' });
    }
  }

  const trades = results.flatMap((r) => r.trades);
  const rawCount = results.reduce((sum, r) => sum + Number(r.rawCount || 0), 0);
  const filterApplied = Boolean(aptName);
  const matchQuality = filterApplied
    ? (compactName(aptName).length >= 4 ? 'strong' : 'weak')
    : 'none';
  return {
    status: 200,
    body: {
      ok: true,
      count: trades.length,
      rawCount,
      filterApplied,
      matchQuality,
      tradeTypes: results.map((r) => ({ type: r.type, label: r.label, rawCount: r.rawCount, filteredCount: r.trades.length })),
      errors,
      trades: trades.slice(0, 150),
    },
  };
}

app.get('/api/molit/trades', async (req, res) => {
  try {
    const result = await lookupMolitTrades({
      lawdCd: String(req.query.lawdCd || '').trim(),
      dealYmd: String(req.query.dealYmd || '').trim(),
      aptName: String(req.query.aptName || '').trim(),
      tradeType: String(req.query.tradeType || 'auto').trim(),
    });
    return res.status(result.status).json({ ...result.body, requestId: req.requestId });
  } catch (e) {
    logException('molit/trades', req, e);
    return res.status(500).json(errorBody(req, '실거래가 조회 중 오류가 발생했습니다.'));
  }
});

app.get('/api/molit/apt-trades', async (req, res) => {
  try {
    const result = await lookupMolitTrades({
      lawdCd: String(req.query.lawdCd || '').trim(),
      dealYmd: String(req.query.dealYmd || '').trim(),
      aptName: String(req.query.aptName || '').trim(),
      tradeType: 'apt',
    });
    return res.status(result.status).json({ ...result.body, requestId: req.requestId });
  } catch (e) {
    logException('molit/apt-trades', req, e);
    return res.status(500).json(errorBody(req, '실거래가 조회 중 오류가 발생했습니다.'));
  }
});

const ONBID_REAL_ESTATE_LIST_URL = process.env.ONBID_LIST_URL || 'https://apis.data.go.kr/B010003/OnbidRlstListSrvc2/getRlstCltrList';
const ONBID_PROPERTY_DETAIL_URL = process.env.ONBID_DETAIL_URL || 'http://apis.data.go.kr/B010003/OnbidPbancCltrDtlSrvc/getPbancCltrInf';

function boundedInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sanitizeOnbidText(value, maxLength = 50) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length > maxLength) return text.slice(0, maxLength);
  return text;
}

function appendOnbidParam(url, name, value, maxLength = 50) {
  const safe = sanitizeOnbidText(value, maxLength);
  if (safe) url.searchParams.set(name, safe);
}

function normalizeOnbidItems(data) {
  const body = data?.response?.body || data?.body || data;
  const items = body?.items?.item || body?.item || [];
  if (Array.isArray(items)) return items;
  if (items && typeof items === 'object') return [items];
  return [];
}

function normalizeOnbidDetail(data) {
  const body = data?.response?.body || data?.body || data;
  const item = body?.item || body?.items?.item || body;
  if (Array.isArray(item)) return item[0] || {};
  if (item && typeof item === 'object') return item;
  return {};
}

app.get('/api/onbid/items', async (req, res) => {
  try {
    const keys = externalApiConfig();
    if (!keys.onbidKey) return res.status(400).json(errorBody(req, '온비드 공매 API 환경설정이 필요합니다.'));

    const pageNo = boundedInt(req.query.pageNo, 1, 1, 1000);
    const numOfRows = boundedInt(req.query.numOfRows, 10, 1, 100);
    const url = new URL(ONBID_REAL_ESTATE_LIST_URL);
    url.searchParams.set('serviceKey', keys.onbidKey);
    url.searchParams.set('pageNo', String(pageNo));
    url.searchParams.set('numOfRows', String(numOfRows));
    url.searchParams.set('resultType', 'json');
    url.searchParams.set('prptDivCd', sanitizeOnbidText(req.query.prptDivCd, 80) || '0007,0010,0005,0002,0006');
    url.searchParams.set('dspsMthodCd', sanitizeOnbidText(req.query.dspsMthodCd, 20) || '0001');
    url.searchParams.set('bidDivCd', sanitizeOnbidText(req.query.bidDivCd, 20) || '0001');
    url.searchParams.set('pvctTrgtYn', sanitizeOnbidText(req.query.pvctTrgtYn, 1) || 'N');

    appendOnbidParam(url, 'lctnSdnm', req.query.lctnSdnm);
    appendOnbidParam(url, 'lctnSggnm', req.query.lctnSggnm);
    appendOnbidParam(url, 'lctnEmdNm', req.query.lctnEmdNm);
    appendOnbidParam(url, 'onbidCltrNm', req.query.keyword || req.query.onbidCltrNm, 80);
    appendOnbidParam(url, 'rqstOrgNm', req.query.rqstOrgNm, 80);
    appendOnbidParam(url, 'lowstBidPrcStart', req.query.lowstBidPrcStart, 20);
    appendOnbidParam(url, 'lowstBidPrcEnd', req.query.lowstBidPrcEnd, 20);
    appendOnbidParam(url, 'bidPrdYmdStart', req.query.bidPrdYmdStart, 8);
    appendOnbidParam(url, 'bidPrdYmdEnd', req.query.bidPrdYmdEnd, 8);

    const apiRes = await fetch(url.toString(), { headers: { Accept: 'application/json,*/*' } });
    const text = await apiRes.text();
    const data = JSON.parse(text);

    if (!apiRes.ok) {
      logException('onbid/items:upstream', req, new Error('Onbid API response error'), { status: apiRes.status });
      return res.status(apiRes.status).json(errorBody(req, '온비드 공매 API 응답 오류가 발생했습니다.', { status: apiRes.status }));
    }

    const body = data?.response?.body || data?.body || {};
    const items = normalizeOnbidItems(data);
    return res.json({
      ok: true,
      pageNo,
      numOfRows,
      totalCount: Number(body.totalCount || items.length || 0),
      count: items.length,
      items,
      requestId: req.requestId,
    });
  } catch (e) {
    logException('onbid/items', req, e);
    return res.status(500).json(errorBody(req, '온비드 공매 물건 조회 중 오류가 발생했습니다.'));
  }
});

app.get('/api/onbid/detail', async (req, res) => {
  try {
    const keys = externalApiConfig();
    if (!keys.onbidKey) return res.status(400).json(errorBody(req, '온비드 공매 API 환경설정이 필요합니다.'));

    const cltrMngNo = sanitizeOnbidText(req.query.cltrMngNo, 40);
    const pbctCdtnNo = sanitizeOnbidText(req.query.pbctCdtnNo, 40);
    if (!cltrMngNo) return res.status(400).json(errorBody(req, '물건관리번호(cltrMngNo)를 입력해주세요.'));

    const url = new URL(ONBID_PROPERTY_DETAIL_URL);
    url.searchParams.set('serviceKey', keys.onbidKey);
    url.searchParams.set('resultType', 'json');
    url.searchParams.set('cltrMngNo', cltrMngNo);
    if (pbctCdtnNo) url.searchParams.set('pbctCdtnNo', pbctCdtnNo);

    const apiRes = await fetch(url.toString(), { headers: { Accept: 'application/json,*/*' } });
    const text = await apiRes.text();
    const data = JSON.parse(text);

    if (!apiRes.ok) {
      logException('onbid/detail:upstream', req, new Error('Onbid detail API response error'), { status: apiRes.status });
      return res.status(apiRes.status).json(errorBody(req, '온비드 공매 상세 API 응답 오류가 발생했습니다.', { status: apiRes.status }));
    }

    return res.json({
      ok: true,
      cltrMngNo,
      pbctCdtnNo,
      detail: normalizeOnbidDetail(data),
      raw: data?.response || data,
      requestId: req.requestId,
    });
  } catch (e) {
    logException('onbid/detail', req, e);
    return res.status(500).json(errorBody(req, '온비드 공매 상세 조회 중 오류가 발생했습니다.'));
  }
});

function validateFetchInput({ saYear, saSer, jiwonNm }) {
  const year = String(saYear || '').trim();
  const serial = String(saSer || '').trim();
  const court = String(jiwonNm || '').trim();

  if (!year || !serial || !court) return '법원, 사건연도, 사건번호를 모두 입력해주세요.';
  if (!/^\d{4}$/.test(year)) return '사건연도는 4자리 숫자로 입력해주세요.';
  if (!/^\d{1,10}$/.test(serial)) return '사건번호는 숫자만 입력해주세요.';
  return null;
}

app.post('/api/fetch', async (req, res) => {
  const startTime = Date.now();
  try {
    const { saYear, saSer, jiwonNm } = req.body;
    const inputError = validateFetchInput({ saYear, saSer, jiwonNm });
    if (inputError) return res.status(400).json(errorBody(req, inputError));

    const year = String(saYear).trim();
    const serial = String(saSer).trim();
    const court = String(jiwonNm).trim();

    console.log(`[fetch] ${court} ${year}타경${serial} requestId=${req.requestId}`);
    const raw = await fetchCase(year, serial, court);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (raw.status !== 'ok') {
      console.warn('[fetch] crawler failed', { requestId: req.requestId, diagnosis: raw.diagnosis || null, debug: raw.debug || null });
      return res.status(502).json(errorBody(req, raw.error || '법원경매정보 조회에 실패했습니다.', {
        diagnosis: raw.diagnosis || null,
        elapsed: `${elapsed}s`,
      }));
    }
    return res.json({ ok: true, raw, elapsed: `${elapsed}s`, requestId: req.requestId });
  } catch (e) {
    logException('fetch', req, e);
    return res.status(500).json(errorBody(req, '서버 처리 중 오류가 발생했습니다.'));
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { raw, manual, region = 'other' } = req.body;
    if (!raw || !manual) return res.status(400).json(errorBody(req, '필수 파라미터 누락 (raw, manual)'));

    const merged = { ...raw };
    merged.rights = manual.rights || [];
    merged.tenants = (manual.tenants || []).map((t) => ({
      '임차인': t.name || '',
      '전입신고일자': t.moveIn || '',
      '확정일자': t.fixed || '',
      '보증금': t.deposit || '',
    }));

    if (Array.isArray(manual.specials)) {
      manual.specials.forEach((s) => {
        merged.rights.push({
          '접수일자': s.date || '2000-01-01',
          '권리종류': s.type || '유치권',
          '권리자': s.holder || '-',
          '채권금액': s.amount || '0',
        });
      });
    }

    if (manual.malso && manual.malso.date) {
      merged.rights.unshift({
        '접수일자': manual.malso.date,
        '권리종류': manual.malso.type || '근저당권',
        '권리자': manual.malso.holder || '-',
        '채권금액': manual.malso.amount || '0',
        _userMalso: true,
      });
    }

    const report = analyzeCase(merged, region);
    return res.json({ ok: true, report, requestId: req.requestId });
  } catch (e) {
    logException('analyze', req, e);
    return res.status(500).json(errorBody(req, '분석 처리 중 오류가 발생했습니다.'));
  }
});

app.use((err, req, res, next) => {
  logException('express', req, err);
  if (res.headersSent) return next(err);
  return res.status(500).json(errorBody(req, '서버 처리 중 오류가 발생했습니다.'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`${SERVICE_NAME} 서버 시작: port ${PORT}`);
});
