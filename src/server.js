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
    addressName: address.address_name || '',
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

function safeKakaoDiagnostic(apiRes, data) {
  const status = Number(apiRes?.status || 0);
  const errorType = String(data?.errorType || data?.error || '').slice(0, 80);
  const message = String(data?.message || data?.msg || '').slice(0, 180);
  let hint = '카카오 REST 키 값, 앱 사용 상태, API 사용 가능 여부를 확인하세요.';
  if (status === 401 || status === 403) hint = 'REST API 키가 잘못되었거나 앱/API 권한 문제가 있을 수 있습니다.';
  if (status === 429) hint = '카카오 API 호출 한도를 초과했을 수 있습니다. 잠시 후 다시 시도하세요.';
  if (status >= 500) hint = '카카오 API 또는 네트워크 일시 오류일 수 있습니다.';
  return { status, errorType, message, hint };
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
      const upstream = safeKakaoDiagnostic(apiRes, data);
      logException('location/geocode:upstream', req, new Error('Kakao API response error'), { upstream });
      return res.status(apiRes.status).json(errorBody(req, '카카오 주소검색 API 응답 오류가 발생했습니다.', { upstream }));
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
  officetel: {
    label: '오피스텔',
    url: 'https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade',
    nameTags: ['offiNm', '단지', '건물명'],
  },
  rh: {
    label: '연립다세대',
    url: 'https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade',
    nameTags: ['mhouseNm', '연립다세대', '주택명'],
  },
};

function normalizeTradeItem(itemXml, tradeType, label) {
  const name = pickXml(itemXml, MOLIT_TYPES[tradeType]?.nameTags || []);
  return {
    tradeType,
    tradeTypeLabel: label,
    aptName: name,
    dealAmount: pickXml(itemXml, ['dealAmount', '거래금액']),
    dealYear: pickXml(itemXml, ['dealYear', '년']),
    dealMonth: pickXml(itemXml, ['dealMonth', '월']),
    dealDay: pickXml(itemXml, ['dealDay', '일']),
    area: pickXml(itemXml, ['excluUseAr', '전용면적', 'area']),
    floor: pickXml(itemXml, ['floor', '층']),
    buildYear: pickXml(itemXml, ['buildYear', '건축년도']),
  };
}

function xmlItems(xml) {
  return [...String(xml || '').matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
}

function normalizeMolitServiceKey(value) {
  const key = String(value || '').trim();
  if (!key) return '';
  try {
    return decodeURIComponent(key);
  } catch (_) {
    return key;
  }
}

function validLawdCd(value) {
  return /^\d{5}$/.test(String(value || ''));
}

function validDealYmd(value) {
  return /^\d{6}$/.test(String(value || ''));
}

async function fetchMolitType({ type, lawdCd, dealYmd, aptName }) {
  const config = MOLIT_TYPES[type];
  if (!config) throw new Error('지원하지 않는 실거래가 유형입니다.');

  const serviceKey = normalizeMolitServiceKey(externalApiConfig().molitKey);
  if (!serviceKey) throw new Error('국토부 실거래가 API 키가 없습니다.');

  const url = new URL(config.url);
  url.searchParams.set('LAWD_CD', lawdCd);
  url.searchParams.set('DEAL_YMD', dealYmd);
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('numOfRows', '50');
  url.searchParams.set('pageNo', '1');

  const res = await fetch(url.toString());
  const text = await res.text();
  if (!res.ok) throw new Error(`${config.label} 실거래가 API 응답 오류`);

  const items = xmlItems(text).map((xml) => normalizeTradeItem(xml, type, config.label));
  const filter = String(aptName || '').trim().replace(/\s+/g, '');
  const filtered = filter
    ? items.filter((item) => String(item.aptName || '').replace(/\s+/g, '').includes(filter) || filter.includes(String(item.aptName || '').replace(/\s+/g, '')))
    : items;

  return {
    type,
    label: config.label,
    rawCount: items.length,
    filteredCount: filtered.length,
    trades: filtered,
  };
}

app.get('/api/molit/trades', async (req, res) => {
  try {
    const lawdCd = String(req.query.lawdCd || '').trim();
    const dealYmd = String(req.query.dealYmd || '').trim();
    const aptName = String(req.query.aptName || '').trim();
    const tradeType = String(req.query.tradeType || 'auto').trim();

    if (!validLawdCd(lawdCd)) return res.status(400).json(errorBody(req, '법정동코드 5자리가 필요합니다.'));
    if (!validDealYmd(dealYmd)) return res.status(400).json(errorBody(req, '계약월은 YYYYMM 형식이어야 합니다.'));

    const types = tradeType === 'auto' ? Object.keys(MOLIT_TYPES) : [tradeType];
    const results = [];

    for (const type of types) {
      try {
        results.push(await fetchMolitType({ type, lawdCd, dealYmd, aptName }));
      } catch (e) {
        results.push({ type, label: MOLIT_TYPES[type]?.label || type, error: e.message, rawCount: 0, filteredCount: 0, trades: [] });
      }
    }

    const allTrades = results.flatMap((r) => r.trades || []);
    return res.json({
      ok: true,
      lawdCd,
      dealYmd,
      aptName,
      tradeTypes: results.map(({ type, label, rawCount, filteredCount, error }) => ({ type, label, rawCount, filteredCount, error })),
      rawCount: results.reduce((sum, r) => sum + Number(r.rawCount || 0), 0),
      count: allTrades.length,
      trades: allTrades,
      requestId: req.requestId,
    });
  } catch (e) {
    logException('molit/trades', req, e);
    return res.status(500).json(errorBody(req, '국토부 실거래가 조회 중 오류가 발생했습니다.'));
  }
});

const ONBID_BASE_URL = 'https://apis.data.go.kr/B010003/OnbidRlstListSrvc2';
const ONBID_LIST_ENDPOINT = `${ONBID_BASE_URL}/getOnbidRlstList`; 
const ONBID_DETAIL_ENDPOINT = `${ONBID_BASE_URL}/getOnbidRlstDtl`;

function sanitizeOnbidParam(value, max = 80) {
  return String(value || '')
    .replace(/[<>`{}]/g, '')
    .trim()
    .slice(0, max);
}

function requireOnbidKey(req, res) {
  const key = externalApiConfig().onbidKey;
  if (!key) {
    res.status(400).json(errorBody(req, '온비드 API 키가 없습니다. Railway Variables에 ONBID_API_KEY를 추가하세요.'));
    return '';
  }
  return key;
}

function xmlItemsByName(xml, name) {
  return [...String(xml || '').matchAll(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, 'gi'))].map((m) => m[1]);
}

function normalizeOnbidListItem(itemXml) {
  return {
    cltrNo: pickXml(itemXml, ['CLTR_NO', 'cltrNo']),
    plnmNo: pickXml(itemXml, ['PLNM_NO', 'plnmNo']),
    pbctNo: pickXml(itemXml, ['PBCT_NO', 'pbctNo']),
    cltrNm: pickXml(itemXml, ['CLTR_NM', 'cltrNm']),
    ctgrFullNm: pickXml(itemXml, ['CTGR_FULL_NM', 'ctgrFullNm']),
    pbctBegnDtm: pickXml(itemXml, ['PBCT_BEGN_DTM', 'pbctBegnDtm']),
    pbctClsDtm: pickXml(itemXml, ['PBCT_CLS_DTM', 'pbctClsDtm']),
    minBidPrc: pickXml(itemXml, ['MIN_BID_PRC', 'minBidPrc']),
    apslAsesAvgAmt: pickXml(itemXml, ['APSL_ASES_AVG_AMT', 'apslAsesAvgAmt']),
    sido: pickXml(itemXml, ['SIDO', 'sido']),
    signgu: pickXml(itemXml, ['SIGNGU', 'signgu']),
    lot: pickXml(itemXml, ['LOT', 'lot']),
    rawAddress: pickXml(itemXml, ['LDNM_ADRS', 'NMRD_ADRS', 'ldnmAdrs', 'nmrdAdrs']),
    statNm: pickXml(itemXml, ['STAT_NM', 'statNm']),
  };
}

function normalizeOnbidDetailItem(itemXml) {
  return {
    cltrNo: pickXml(itemXml, ['CLTR_NO', 'cltrNo']),
    plnmNo: pickXml(itemXml, ['PLNM_NO', 'plnmNo']),
    pbctNo: pickXml(itemXml, ['PBCT_NO', 'pbctNo']),
    cltrNm: pickXml(itemXml, ['CLTR_NM', 'cltrNm']),
    ctgrFullNm: pickXml(itemXml, ['CTGR_FULL_NM', 'ctgrFullNm']),
    goodsNm: pickXml(itemXml, ['GOODS_NM', 'goodsNm']),
    ldnmAdrs: pickXml(itemXml, ['LDNM_ADRS', 'ldnmAdrs']),
    nmrdAdrs: pickXml(itemXml, ['NMRD_ADRS', 'nmrdAdrs']),
    minBidPrc: pickXml(itemXml, ['MIN_BID_PRC', 'minBidPrc']),
    apslAsesAvgAmt: pickXml(itemXml, ['APSL_ASES_AVG_AMT', 'apslAsesAvgAmt']),
    pbctBegnDtm: pickXml(itemXml, ['PBCT_BEGN_DTM', 'pbctBegnDtm']),
    pbctClsDtm: pickXml(itemXml, ['PBCT_CLS_DTM', 'pbctClsDtm']),
    statNm: pickXml(itemXml, ['STAT_NM', 'statNm']),
  };
}

async function fetchOnbid(endpoint, params) {
  const serviceKey = requireOnbidKey({ requestId: null }, { status: () => ({ json: () => {} }) });
  if (!serviceKey) throw new Error('온비드 API 키가 없습니다.');

  const url = new URL(endpoint);
  url.searchParams.set('ServiceKey', serviceKey);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });

  const res = await fetch(url.toString());
  const text = await res.text();
  if (!res.ok) throw new Error('온비드 API 응답 오류');

  return text;
}

app.get('/api/onbid/items', async (req, res) => {
  try {
    const key = requireOnbidKey(req, res);
    if (!key) return;

    const query = sanitizeOnbidParam(req.query.query, 60);
    const sido = sanitizeOnbidParam(req.query.sido, 30);
    const pageNo = sanitizeOnbidParam(req.query.pageNo || '1', 10);
    const numOfRows = sanitizeOnbidParam(req.query.numOfRows || '10', 10);

    const xml = await fetchOnbid(ONBID_LIST_ENDPOINT, {
      ServiceKey: key,
      pageNo,
      numOfRows,
      CLTR_NM: query,
      SIDO: sido,
      _type: 'xml',
    });

    const items = xmlItemsByName(xml, 'item').map(normalizeOnbidListItem);
    return res.json({ ok: true, count: items.length, items, requestId: req.requestId });
  } catch (e) {
    logException('onbid/items', req, e);
    return res.status(502).json(errorBody(req, '온비드 목록 조회 중 오류가 발생했습니다.', { detail: e.message }));
  }
});

app.get('/api/onbid/detail', async (req, res) => {
  try {
    const key = requireOnbidKey(req, res);
    if (!key) return;

    const cltrNo = sanitizeOnbidParam(req.query.cltrNo, 40);
    const plnmNo = sanitizeOnbidParam(req.query.plnmNo, 40);
    const pbctNo = sanitizeOnbidParam(req.query.pbctNo, 40);
    if (!cltrNo && !plnmNo && !pbctNo) return res.status(400).json(errorBody(req, '온비드 상세 조회에 필요한 물건번호가 없습니다.'));

    const xml = await fetchOnbid(ONBID_DETAIL_ENDPOINT, {
      ServiceKey: key,
      CLTR_NO: cltrNo,
      PLNM_NO: plnmNo,
      PBCT_NO: pbctNo,
      _type: 'xml',
    });

    const items = xmlItemsByName(xml, 'item').map(normalizeOnbidDetailItem);
    return res.json({ ok: true, count: items.length, item: items[0] || null, items, requestId: req.requestId });
  } catch (e) {
    logException('onbid/detail', req, e);
    return res.status(502).json(errorBody(req, '온비드 상세 조회 중 오류가 발생했습니다.', { detail: e.message }));
  }
});

app.post('/api/fetch', async (req, res) => {
  try {
    const { jiwonNm, saYear, saSer } = req.body || {};
    if (!jiwonNm || !saYear || !saSer) {
      return res.status(400).json(errorBody(req, '법원, 연도, 사건번호를 모두 입력하세요.'));
    }
    const result = await fetchCase({ jiwonNm, saYear, saSer });
    return res.json({ ok: true, raw: result, elapsed: result.elapsed, requestId: req.requestId });
  } catch (e) {
    logException('fetch', req, e);
    return res.status(500).json(errorBody(req, e.message || '조회 실패'));
  }
});

app.post('/api/analyze', (req, res) => {
  try {
    const result = analyzeCase(req.body || {});
    res.json({ ok: true, result, requestId: req.requestId });
  } catch (e) {
    logException('analyze', req, e);
    res.status(500).json(errorBody(req, '분석 중 오류가 발생했습니다.'));
  }
});

app.use((req, res) => {
  res.status(404).json(errorBody(req, '찾을 수 없는 경로입니다.'));
});

app.use((err, req, res, next) => {
  logException('unhandled', req, err);
  res.status(500).json(errorBody(req, '서버 오류가 발생했습니다.'));
});

app.listen(PORT, () => {
  console.log(`${SERVICE_NAME} server listening on ${PORT}`);
});
