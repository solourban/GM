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

function cloneWithoutInternalFields(value) {
  if (Array.isArray(value)) return value.map(cloneWithoutInternalFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['rawApis', 'debug', '_internalCsNo'].includes(key))
    .map(([key, item]) => [key, cloneWithoutInternalFields(item)]));
}

function sanitizeFetchCaseResult(result) {
  return cloneWithoutInternalFields(result || {});
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

function normalizeAdsensePublisherId(value) {
  const id = String(value || '').trim();
  return /^pub-\d{12,20}$/.test(id) ? id : '';
}

app.get('/ads.txt', (req, res) => {
  const publisherId = normalizeAdsensePublisherId(process.env.ADSENSE_PUBLISHER_ID);
  res.type('text/plain; charset=utf-8');
  if (!publisherId) {
    return res.status(404).send('# ADSENSE_PUBLISHER_ID is not configured.\n');
  }
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.send(`google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`);
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

app.get('/api/kakao/maps-sdk.js', (req, res) => {
  const keys = externalApiConfig();
  if (!keys.kakaoMapKey) {
    return res.status(400).type('application/javascript').send('throw new Error("Kakao map SDK key is not configured.");');
  }

  const url = new URL('https://dapi.kakao.com/v2/maps/sdk.js');
  url.searchParams.set('appkey', keys.kakaoMapKey);
  url.searchParams.set('autoload', 'false');
  url.searchParams.set('libraries', 'services');
  const sdkUrl = JSON.stringify(url.toString());

  return res.type('application/javascript; charset=utf-8').send(`
    (() => {
      if (window.__kakaoMapsSdkLoader) return;
      window.__kakaoMapsSdkLoader = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = ${sdkUrl};
        script.async = true;
        script.onload = () => {
          if (window.kakao?.maps?.load) window.kakao.maps.load(resolve);
          else reject(new Error('Kakao map SDK is unavailable.'));
        };
        script.onerror = () => reject(new Error('Kakao map SDK load failed.'));
        document.head.appendChild(script);
      });
    })();
  `);
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

function publicDateRecommendationResult(result) {
  if (!result || typeof result !== 'object') return result;
  const { debug, ...publicResult } = result;
  return publicResult;
}

async function handleDateRecommendations(req, res, scope = 'recommendations/by-date') {
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
    return res.status(status).json({ ...publicDateRecommendationResult(result), requestId: req.requestId });
  } catch (e) {
    logException(scope, req, e);
    return res.status(500).json(errorBody(req, '매각기일 추천 조회 중 오류가 발생했습니다.'));
  }
}

app.get('/api/recommendations/by-date', (req, res) => handleDateRecommendations(req, res, 'recommendations/by-date'));
app.get('/api/date/recommendations', (req, res) => handleDateRecommendations(req, res, 'date/recommendations'));

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
const MOLIT_FETCH_TIMEOUT_MS = 12_000;

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MOLIT_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
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
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`${config.label} 실거래가 API 응답 시간 초과`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function handleMolitTrades(req, res, options = {}) {
  const scope = options.scope || 'molit/trades';
  const fixedTradeType = options.fixedTradeType || '';
  try {
    const lawdCd = String(req.query.lawdCd || '').trim();
    const dealYmd = String(req.query.dealYmd || '').trim();
    const aptName = String(req.query.aptName || '').trim();
    const tradeType = fixedTradeType || String(req.query.tradeType || 'auto').trim();

    if (!validLawdCd(lawdCd)) return res.status(400).json(errorBody(req, '법정동코드 5자리가 필요합니다.'));
    if (!validDealYmd(dealYmd)) return res.status(400).json(errorBody(req, '계약월은 YYYYMM 형식이어야 합니다.'));

    const types = tradeType === 'auto' ? Object.keys(MOLIT_TYPES) : [tradeType];
    const results = [];

    for (const type of types) {
      try {
        results.push(await fetchMolitType({ type, lawdCd, dealYmd, aptName }));
      } catch (e) {
        logException(`${scope}:type`, req, e, { tradeType: type });
        results.push({ type, label: MOLIT_TYPES[type]?.label || type, error: '해당 유형 실거래가 조회 중 오류가 발생했습니다.', rawCount: 0, filteredCount: 0, trades: [] });
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
    logException(scope, req, e);
    return res.status(500).json(errorBody(req, '국토부 실거래가 조회 중 오류가 발생했습니다.'));
  }
}

app.get('/api/molit/trades', (req, res) => handleMolitTrades(req, res, { scope: 'molit/trades' }));
app.get('/api/molit/apt-trades', (req, res) => handleMolitTrades(req, res, { scope: 'molit/apt-trades', fixedTradeType: 'apt' }));

const ONBID_LIST_BASE_URL = 'https://apis.data.go.kr/B010003/OnbidRlstListSrvc2';
const ONBID_DETAIL_BASE_URL = 'https://apis.data.go.kr/B010003/OnbidRlstDtlSrvc2';
const ONBID_LIST_ENDPOINT = `${ONBID_LIST_BASE_URL}/getRlstCltrList2`;
const ONBID_DETAIL_ENDPOINT = `${ONBID_DETAIL_BASE_URL}/getRlstDtlInf2`;
const ONBID_DEFAULT_PRPT_DIV_CD = '0007,0010,0005,0004,0002,0003,0006,0008,0011';
const ONBID_SUCCESS_CODES = new Set(['00', '0000', 'NORMAL_CODE', 'INFO-00']);

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

function normalizeOnbidScalar(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return '';
  return String(value).trim();
}

function pickOnbid(item, keys) {
  if (typeof item === 'string') return pickXml(item, keys);
  if (!item || typeof item !== 'object') return '';
  const entries = Object.entries(item);
  for (const key of keys) {
    const direct = normalizeOnbidScalar(item[key]);
    if (direct) return direct;
    const lowerKey = String(key).toLowerCase();
    const match = entries.find(([entryKey]) => entryKey.toLowerCase() === lowerKey);
    const indirect = normalizeOnbidScalar(match?.[1]);
    if (indirect) return indirect;
  }
  return '';
}

function onbidResponseBody(payload) {
  return payload?.response?.body || payload?.body || payload || {};
}

function onbidItemsFromResponse(payload) {
  if (payload?.rawXml) return xmlItemsByName(payload.rawXml, 'item');
  const body = onbidResponseBody(payload);
  const items = body?.items?.item || body?.items || body?.item || [];
  if (Array.isArray(items)) return items;
  if (items && typeof items === 'object') return [items];
  return [];
}

function onbidTotalCount(payload, fallback) {
  const total = Number(onbidResponseBody(payload)?.totalCount);
  return Number.isFinite(total) ? total : fallback;
}

function normalizeYmd(value) {
  return String(value || '').replace(/[^0-9]/g, '').slice(0, 8);
}

function onbidMatchesFilters(item, { query, sido, signgu, bidStart, bidEnd }) {
  const text = [
    item.cltrNm,
    item.onbidCltrNm,
    item.lctnFullAddr,
    item.rawAddress,
    item.ldnmAdrs,
    item.nmrdAdrs,
  ].filter(Boolean).join(' ');
  if (query && !text.includes(query)) return false;
  if (sido && !String(item.lctnSdnm || item.sido || '').includes(sido)) return false;
  if (signgu && !String(item.lctnSggnm || item.signgu || '').includes(signgu)) return false;

  const startsAt = normalizeYmd(item.pbctBegnDtm || item.bidStrtDtm || item.bidPrdYmdStart);
  const endsAt = normalizeYmd(item.pbctClsDtm || item.bidEndDtm || item.bidPrdYmdEnd);
  if (bidStart && endsAt && endsAt < bidStart) return false;
  if (bidEnd && startsAt && startsAt > bidEnd) return false;
  return true;
}

function normalizeOnbidListItem(itemXml) {
  const cltrNo = pickOnbid(itemXml, ['cltrMngNo', 'CLTR_MNG_NO', 'cltrNo', 'CLTR_NO']);
  const plnmNo = pickOnbid(itemXml, ['plnmNo', 'PLNM_NO']);
  const pbctNo = pickOnbid(itemXml, ['pbctCdtnNo', 'PBCT_CDTN_NO', 'pbctNo', 'PBCT_NO']);
  const sido = pickOnbid(itemXml, ['lctnSdnm', 'LCTN_SDNM', 'sido', 'SIDO']);
  const signgu = pickOnbid(itemXml, ['lctnSggnm', 'LCTN_SGGNM', 'signgu', 'SIGNGU']);
  const rawAddress = pickOnbid(itemXml, ['ldnmAdrs', 'LDNM_ADRS', 'nmrdAdrs', 'NMRD_ADRS', 'lctnFullAddr', 'LCTN_FULL_ADDR']);
  const pbctBegnDtm = pickOnbid(itemXml, ['pbctBegnDtm', 'PBCT_BEGN_DTM', 'bidStrtDtm', 'BID_STRT_DTM', 'bidPrdYmdStart']);
  const pbctClsDtm = pickOnbid(itemXml, ['pbctClsDtm', 'PBCT_CLS_DTM', 'bidEndDtm', 'BID_END_DTM', 'bidPrdYmdEnd']);
  const statNm = pickOnbid(itemXml, ['pbctStatNm', 'PBCT_STAT_NM', 'statNm', 'STAT_NM', 'bidStatNm', 'BID_STAT_NM']);
  return {
    cltrNo,
    cltrMngNo: cltrNo,
    plnmNo,
    pbctNo,
    pbctCdtnNo: pbctNo,
    cltrNm: pickOnbid(itemXml, ['cltrNm', 'onbidCltrNm', 'CLTR_NM', 'ONBID_CLTR_NM']),
    onbidCltrNm: pickOnbid(itemXml, ['onbidCltrNm', 'cltrNm', 'ONBID_CLTR_NM', 'CLTR_NM']),
    onbidCltrno: pickOnbid(itemXml, ['onbidCltrno', 'onbidCltrNo', 'ONBID_CLTRNO', 'ONBID_CLTR_NO']),
    onbidPbancNo: pickOnbid(itemXml, ['onbidPbancNo', 'ONBID_PBANC_NO']),
    ctgrFullNm: pickOnbid(itemXml, ['ctgrFullNm', 'CTGR_FULL_NM', 'cltrUsgLclsCtgrNm']),
    prptDivCd: pickOnbid(itemXml, ['prptDivCd', 'PRPT_DIV_CD']),
    prptDivNm: pickOnbid(itemXml, ['prptDivNm', 'PRPT_DIV_NM']),
    pbctBegnDtm,
    pbctClsDtm,
    bidStrtDtm: pbctBegnDtm,
    bidEndDtm: pbctClsDtm,
    bidPrdYmdStart: pbctBegnDtm,
    bidPrdYmdEnd: pbctClsDtm,
    minBidPrc: pickOnbid(itemXml, ['minBidPrc', 'lowstBidPrc', 'MIN_BID_PRC', 'LOWST_BID_PRC']),
    apslAsesAvgAmt: pickOnbid(itemXml, ['apslAsesAvgAmt', 'apslEvlAmt', 'APSL_ASES_AVG_AMT', 'APSL_EVL_AMT']),
    sido,
    signgu,
    lctnSdnm: sido,
    lctnSggnm: signgu,
    lot: pickOnbid(itemXml, ['lot', 'LOT']),
    rawAddress,
    ldnmAdrs: pickOnbid(itemXml, ['ldnmAdrs', 'LDNM_ADRS']),
    nmrdAdrs: pickOnbid(itemXml, ['nmrdAdrs', 'NMRD_ADRS']),
    lctnFullAddr: rawAddress,
    statNm,
    bidStatNm: statNm,
    dspsMthodNm: pickOnbid(itemXml, ['dspsMthodNm', 'DSPS_MTHOD_NM']),
    pbctOrgNm: pickOnbid(itemXml, ['pbctOrgNm', 'rqstOrgNm', 'PBCT_ORG_NM', 'RQST_ORG_NM']),
  };
}

function normalizeOnbidDetailItem(itemXml) {
  const cltrNo = pickOnbid(itemXml, ['cltrMngNo', 'CLTR_MNG_NO', 'cltrNo', 'CLTR_NO']);
  const plnmNo = pickOnbid(itemXml, ['plnmNo', 'PLNM_NO']);
  const pbctNo = pickOnbid(itemXml, ['pbctCdtnNo', 'PBCT_CDTN_NO', 'pbctNo', 'PBCT_NO']);
  const ldnmAdrs = pickOnbid(itemXml, ['ldnmAdrs', 'LDNM_ADRS', 'lctnFullAddr', 'LCTN_FULL_ADDR']);
  const nmrdAdrs = pickOnbid(itemXml, ['nmrdAdrs', 'NMRD_ADRS']);
  const pbctBegnDtm = pickOnbid(itemXml, ['pbctBegnDtm', 'PBCT_BEGN_DTM', 'bidStrtDtm', 'BID_STRT_DTM']);
  const pbctClsDtm = pickOnbid(itemXml, ['pbctClsDtm', 'PBCT_CLS_DTM', 'bidEndDtm', 'BID_END_DTM']);
  const statNm = pickOnbid(itemXml, ['pbctStatNm', 'PBCT_STAT_NM', 'statNm', 'STAT_NM', 'bidStatNm', 'BID_STAT_NM']);
  const landArea = pickOnbid(itemXml, ['landSqms', 'LAND_SQMS']);
  const bldArea = pickOnbid(itemXml, ['bldSqms', 'BLD_SQMS']);
  return {
    cltrNo,
    cltrMngNo: cltrNo,
    plnmNo,
    pbctNo,
    pbctCdtnNo: pbctNo,
    cltrNm: pickOnbid(itemXml, ['cltrNm', 'onbidCltrNm', 'CLTR_NM', 'ONBID_CLTR_NM']),
    onbidCltrNm: pickOnbid(itemXml, ['onbidCltrNm', 'cltrNm', 'ONBID_CLTR_NM', 'CLTR_NM']),
    onbidCltrno: pickOnbid(itemXml, ['onbidCltrno', 'onbidCltrNo', 'ONBID_CLTRNO', 'ONBID_CLTR_NO']),
    onbidPbancNo: pickOnbid(itemXml, ['onbidPbancNo', 'ONBID_PBANC_NO']),
    ctgrFullNm: pickOnbid(itemXml, ['ctgrFullNm', 'CTGR_FULL_NM', 'cltrUsgLclsCtgrNm']),
    prptDivCd: pickOnbid(itemXml, ['prptDivCd', 'PRPT_DIV_CD']),
    goodsNm: pickOnbid(itemXml, ['goodsNm', 'GOODS_NM']),
    ldnmAdrs,
    nmrdAdrs,
    lctnFullAddr: ldnmAdrs || nmrdAdrs,
    minBidPrc: pickOnbid(itemXml, ['minBidPrc', 'lowstBidPrc', 'MIN_BID_PRC', 'LOWST_BID_PRC']),
    apslAsesAvgAmt: pickOnbid(itemXml, ['apslAsesAvgAmt', 'apslEvlAmt', 'APSL_ASES_AVG_AMT', 'APSL_EVL_AMT']),
    landArea,
    bldArea,
    area: [landArea && `토지 ${landArea}㎡`, bldArea && `건물 ${bldArea}㎡`].filter(Boolean).join(' / '),
    pbctBegnDtm,
    pbctClsDtm,
    bidStrtDtm: pbctBegnDtm,
    bidEndDtm: pbctClsDtm,
    statNm,
    bidStatNm: statNm,
    dspsMthodNm: pickOnbid(itemXml, ['dspsMthodNm', 'DSPS_MTHOD_NM']),
    prptDivNm: pickOnbid(itemXml, ['prptDivNm', 'PRPT_DIV_NM']),
    pbctOrgNm: pickOnbid(itemXml, ['pbctOrgNm', 'rqstOrgNm', 'PBCT_ORG_NM', 'RQST_ORG_NM']),
    potoUrlList: pickOnbid(itemXml, ['potoUrlList', 'POTO_URL_LIST']),
  };
}

function createOnbidUpstreamError(message, upstream = {}) {
  const error = new Error(message);
  error.isOnbidUpstream = true;
  error.upstream = {
    status: Number(upstream.status || 0),
    resultCode: String(upstream.resultCode || '').trim().slice(0, 80),
    resultMsg: String(upstream.resultMsg || '').replace(/\s+/g, ' ').trim().slice(0, 180),
  };
  return error;
}

function safeOnbidDiagnostic(error) {
  const upstream = error?.upstream || {};
  const status = Number(upstream.status || 0);
  const resultCode = String(upstream.resultCode || '').trim().slice(0, 80);
  const resultMsg = String(upstream.resultMsg || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  const message = String(error?.message || '');
  let hint = '온비드 OpenAPI 응답 상태와 조회 조건을 확인하세요.';
  if (status === 401 || status === 403 || /SERVICE|KEY|AUTH/i.test(`${resultCode} ${resultMsg}`)) {
    hint = 'ONBID_API_KEY 값 또는 공공데이터포털 활용 신청 상태를 확인하세요.';
  } else if (status === 429 || /LIMIT|TRAFFIC|QUOTA/i.test(`${resultCode} ${resultMsg}`)) {
    hint = '온비드 API 호출 한도 또는 일시 제한 가능성이 있습니다. 잠시 후 다시 조회하세요.';
  } else if (message.includes('시간 초과')) {
    hint = '온비드 API 응답이 늦습니다. 조건을 줄이거나 잠시 후 다시 조회하세요.';
  } else if (status >= 500) {
    hint = '온비드 또는 공공데이터포털 쪽 일시 오류일 수 있습니다.';
  }
  return { status, resultCode, resultMsg, hint };
}

function onbidQueryDiagnostic(filters, items, totalCount) {
  const appliedFilters = [
    filters.sido && `지역:${filters.sido}`,
    filters.signgu && `시군구:${filters.signgu}`,
    filters.query && `키워드:${filters.query}`,
    filters.bidStart && `시작:${filters.bidStart}`,
    filters.bidEnd && `종료:${filters.bidEnd}`,
  ].filter(Boolean);
  const hint = items.length
    ? '온비드 API 조회와 화면 표시가 정상입니다. 세부 조회 버튼으로 원문 상세를 확인하세요.'
    : '결과가 없으면 지역/시군구/키워드/입찰기간 조건을 하나씩 줄여 다시 조회하세요.';
  return {
    appliedFilters,
    totalCount: Number(totalCount || 0),
    hint,
  };
}

async function fetchOnbid(endpoint, params, serviceKey) {
  const url = new URL(endpoint);
  url.searchParams.set('serviceKey', serviceKey);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const text = await res.text();
    if (!res.ok) {
      throw createOnbidUpstreamError('온비드 API 응답 오류', {
        status: res.status,
        resultCode: `HTTP_${res.status}`,
        resultMsg: text,
      });
    }

    try {
      const payload = JSON.parse(text);
      const header = payload?.response?.header || payload?.header || {};
      const resultCode = String(header.resultCode || '').trim();
      const resultMsg = String(header.resultMsg || header.resultMessage || '').trim();
      if (resultCode && !ONBID_SUCCESS_CODES.has(resultCode)) {
        throw createOnbidUpstreamError('온비드 API 결과 코드 오류', {
          status: res.status,
          resultCode,
          resultMsg,
        });
      }
      return payload;
    } catch (parseError) {
      if (parseError?.isOnbidUpstream) throw parseError;
      const xmlResultCode = xmlText(text, 'resultCode') || xmlText(text, 'returnReasonCode');
      const xmlResultMsg = xmlText(text, 'resultMsg') || xmlText(text, 'returnAuthMsg') || xmlText(text, 'errMsg');
      if (xmlResultCode && !ONBID_SUCCESS_CODES.has(xmlResultCode)) {
        throw createOnbidUpstreamError('온비드 API XML 결과 코드 오류', {
          status: res.status,
          resultCode: xmlResultCode,
          resultMsg: xmlResultMsg,
        });
      }
      return { rawXml: text };
    }
  } catch (e) {
    if (e.name === 'AbortError') throw createOnbidUpstreamError('온비드 API 응답 시간 초과');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function numberInRange(value, fallback, min, max) {
  const number = Number(String(value || '').replace(/[^0-9]/g, ''));
  if (!Number.isFinite(number) || number < min) return fallback;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

app.get('/api/onbid/items', async (req, res) => {
  try {
    const key = requireOnbidKey(req, res);
    if (!key) return;

    const query = sanitizeOnbidParam(req.query.query || req.query.keyword, 60);
    const sido = sanitizeOnbidParam(req.query.sido || req.query.lctnSdnm, 30);
    const signgu = sanitizeOnbidParam(req.query.signgu || req.query.lctnSggnm, 30);
    const bidStart = sanitizeOnbidParam(req.query.bidPrdYmdStart, 8);
    const bidEnd = sanitizeOnbidParam(req.query.bidPrdYmdEnd, 8);
    const pageNo = String(numberInRange(req.query.pageNo, 1, 1, 100));
    const numOfRows = String(numberInRange(req.query.numOfRows, 10, 1, 20));
    const prptDivCd = sanitizeOnbidParam(req.query.prptDivCd, 80) || ONBID_DEFAULT_PRPT_DIV_CD;
    const pvctTrgtYn = sanitizeOnbidParam(req.query.pvctTrgtYn, 1).toUpperCase() === 'Y' ? 'Y' : 'N';

    const payload = await fetchOnbid(ONBID_LIST_ENDPOINT, {
      pageNo,
      numOfRows,
      resultType: 'json',
      prptDivCd,
      pvctTrgtYn,
      onbidCltrNm: query,
      lctnSdnm: sido,
      lctnSggnm: signgu,
      bidPrdYmdStart: bidStart,
      bidPrdYmdEnd: bidEnd,
    }, key);

    const filters = { query, sido, signgu, bidStart, bidEnd, prptDivCd, pvctTrgtYn };
    const items = onbidItemsFromResponse(payload)
      .map(normalizeOnbidListItem)
      .filter((item) => onbidMatchesFilters(item, { query, sido, signgu, bidStart, bidEnd }));
    const totalCount = onbidTotalCount(payload, items.length);
    return res.json({
      ok: true,
      count: items.length,
      totalCount,
      pageNo: Number(pageNo),
      numOfRows: Number(numOfRows),
      keyword: query,
      filters,
      diagnostic: onbidQueryDiagnostic(filters, items, totalCount),
      items,
      requestId: req.requestId,
    });
  } catch (e) {
    logException('onbid/items', req, e);
    return res.status(502).json(errorBody(req, '온비드 목록 조회 중 오류가 발생했습니다.', { upstream: safeOnbidDiagnostic(e) }));
  }
});

app.get('/api/onbid/detail', async (req, res) => {
  try {
    const key = requireOnbidKey(req, res);
    if (!key) return;

    const cltrNo = sanitizeOnbidParam(req.query.cltrNo || req.query.cltrMngNo, 40);
    const plnmNo = sanitizeOnbidParam(req.query.plnmNo, 40);
    const pbctNo = sanitizeOnbidParam(req.query.pbctNo || req.query.pbctCdtnNo, 40);
    if (!cltrNo && !plnmNo) return res.status(400).json(errorBody(req, '온비드 상세 조회에 필요한 물건번호가 없습니다.'));

    const payload = await fetchOnbid(ONBID_DETAIL_ENDPOINT, {
      pageNo: '1',
      numOfRows: '10',
      resultType: 'json',
      cltrMngNo: cltrNo || plnmNo,
      pbctCdtnNo: pbctNo,
    }, key);

    const items = onbidItemsFromResponse(payload).map(normalizeOnbidDetailItem);
    return res.json({ ok: true, count: items.length, item: items[0] || null, detail: items[0] || null, items, requestId: req.requestId });
  } catch (e) {
    logException('onbid/detail', req, e);
    return res.status(502).json(errorBody(req, '온비드 상세 조회 중 오류가 발생했습니다.', { upstream: safeOnbidDiagnostic(e) }));
  }
});

app.post('/api/fetch', async (req, res) => {
  try {
    const { jiwonNm, saYear, saSer } = req.body || {};
    if (!jiwonNm || !saYear || !saSer) {
      return res.status(400).json(errorBody(req, '법원, 연도, 사건번호를 모두 입력하세요.'));
    }
    const result = sanitizeFetchCaseResult(await fetchCase({ jiwonNm, saYear, saSer }));
    return res.json({ ok: true, raw: result, elapsed: result.elapsed, requestId: req.requestId });
  } catch (e) {
    logException('fetch', req, e);
    return res.status(500).json(errorBody(req, '사건 조회 중 오류가 발생했습니다.'));
  }
});

app.post('/api/analyze', (req, res) => {
  try {
    const result = analyzeCase(req.body || {});
    res.json({ ok: true, result, report: result, requestId: req.requestId });
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
