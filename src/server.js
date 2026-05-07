const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
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

app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/', (req, res, next) => {
  fs.readFile(path.join(PUBLIC_DIR, 'index.html'), 'utf8', (err, html) => {
    if (err) return next(err);
    let patched = html;
    const scripts = ['/gm-core-patch.js', '/patch-registry-patch.js', '/landing-polish-patch.js', '/platform-patch.js', '/address-fix.js', '/watchlist-patch.js', '/watchlist-enhance-patch.js', '/today-dashboard-patch.js', '/date-recommendations-patch.js', '/stepflow-patch.js', '/fetch-error-patch.js', '/court-list-patch.js', '/bulk-fetch-patch.js', '/map-patch.js', '/molit-patch.js', '/molit-scenario-patch.js', '/capital-patch.js', '/cashflow-patch.js', '/stability-patch.js', '/diagnostics-patch.js', '/exit-plan-patch.js', '/bid-checklist-patch.js', '/final-summary-patch.js', '/api-guide-patch.js'];
    scripts.forEach((src) => {
      if (!patched.includes(src)) patched = patched.replace('</body>', `<script src="${src}"></script>\n</body>`);
    });
    res.type('html').send(patched);
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

  if (recent.length > RATE_LIMIT_MAX) return res.status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
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

app.use('/api', rateLimit);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: '경매AI v3 서버 정상' });
});

app.get('/api/config', (req, res) => {
  const kakaoKey = process.env.KAKAO_JS_KEY || process.env.KAKAO_MAP_KEY || '';
  const molitKey = process.env.MOLIT_API_KEY || process.env.DATA_GO_KR_KEY || '';
  res.json({
    ok: true,
    kakaoJsKey: kakaoKey,
    hasKakaoMap: Boolean(kakaoKey),
    hasMolit: Boolean(molitKey),
  });
});

app.get('/api/courts', (req, res) => {
  res.json({ ok: true, courts: listCourts() });
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
    return res.status(status).json(result);
  } catch (e) {
    console.error('[recommendations/by-date] exception:', e);
    return res.status(500).json({ ok: false, error: '매각기일 추천 조회 중 오류가 발생했습니다.', detail: e.message || String(e) });
  }
});

function xmlText(xml, tag) {
  const m = String(xml || '').match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : '';
}

function parseAptTradeXml(xml) {
  const items = [...String(xml || '').matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  return items.map((item) => ({
    aptName: xmlText(item, 'aptNm') || xmlText(item, '아파트'),
    dealAmount: xmlText(item, 'dealAmount') || xmlText(item, '거래금액'),
    buildYear: xmlText(item, 'buildYear') || xmlText(item, '건축년도'),
    dealYear: xmlText(item, 'dealYear') || xmlText(item, '년'),
    dealMonth: xmlText(item, 'dealMonth') || xmlText(item, '월'),
    dealDay: xmlText(item, 'dealDay') || xmlText(item, '일'),
    area: xmlText(item, 'excluUseAr') || xmlText(item, '전용면적'),
    floor: xmlText(item, 'floor') || xmlText(item, '층'),
    dong: xmlText(item, 'umdNm') || xmlText(item, '법정동'),
    roadName: xmlText(item, 'roadNm') || xmlText(item, '도로명'),
    cancelDate: xmlText(item, 'cdealDay') || xmlText(item, '해제사유발생일'),
  }));
}

app.get('/api/molit/apt-trades', async (req, res) => {
  try {
    const key = process.env.MOLIT_API_KEY || process.env.DATA_GO_KR_KEY || '';
    if (!key) return res.status(400).json({ error: 'MOLIT_API_KEY 환경변수가 필요합니다.' });

    const lawdCd = String(req.query.lawdCd || '').trim();
    const dealYmd = String(req.query.dealYmd || '').trim();
    const aptName = String(req.query.aptName || '').trim();
    if (!/^\d{5}$/.test(lawdCd)) return res.status(400).json({ error: '법정동코드 앞 5자리(LAWD_CD)를 입력해주세요.' });
    if (!/^\d{6}$/.test(dealYmd)) return res.status(400).json({ error: '계약월(DEAL_YMD)은 YYYYMM 6자리로 입력해주세요.' });

    const url = new URL('https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev');
    url.searchParams.set('serviceKey', key);
    url.searchParams.set('LAWD_CD', lawdCd);
    url.searchParams.set('DEAL_YMD', dealYmd);
    url.searchParams.set('pageNo', '1');
    url.searchParams.set('numOfRows', '1000');

    const apiRes = await fetch(url.toString(), { headers: { Accept: 'application/xml,text/xml,*/*' } });
    const xml = await apiRes.text();
    if (!apiRes.ok) return res.status(502).json({ error: `국토부 API 응답 오류: ${apiRes.status}` });

    let trades = parseAptTradeXml(xml);
    if (aptName) {
      const compact = aptName.replace(/\s+/g, '').toLowerCase();
      trades = trades.filter((t) => String(t.aptName || '').replace(/\s+/g, '').toLowerCase().includes(compact));
    }

    return res.json({ ok: true, count: trades.length, trades: trades.slice(0, 100) });
  } catch (e) {
    console.error('[molit] exception:', e);
    return res.status(500).json({ error: '실거래가 조회 중 오류가 발생했습니다.', detail: e.message || String(e) });
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
    if (inputError) return res.status(400).json({ error: inputError });

    const year = String(saYear).trim();
    const serial = String(saSer).trim();
    const court = String(jiwonNm).trim();

    console.log(`[fetch] ${court} ${year}타경${serial}`);
    const raw = await fetchCase(year, serial, court);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (raw.status !== 'ok') {
      return res.status(502).json({
        error: raw.error || '법원경매정보 조회에 실패했습니다.',
        diagnosis: raw.diagnosis || null,
        debug: raw.debug,
        elapsed: `${elapsed}s`,
      });
    }
    return res.json({ ok: true, raw, elapsed: `${elapsed}s` });
  } catch (e) {
    console.error('[fetch] exception:', e);
    return res.status(500).json({ error: '서버 처리 중 오류가 발생했습니다.', detail: e.message || String(e) });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { raw, manual, region = 'other' } = req.body;
    if (!raw || !manual) return res.status(400).json({ error: '필수 파라미터 누락 (raw, manual)' });

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
    return res.json({ ok: true, report });
  } catch (e) {
    console.error('[analyze] exception:', e);
    return res.status(500).json({ error: '분석 처리 중 오류가 발생했습니다.', detail: e.message || String(e) });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`경매AI v3 서버 시작: port ${PORT}`);
});
