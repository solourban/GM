const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
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
app.use(express.static(path.join(__dirname, '..', 'public')));

const { analyzeCase } = require('./analyzer');
const { fetchCase } = require('./crawler');

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 30);
const apiHits = new Map();

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
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
    return res.status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
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

app.use('/api', rateLimit);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: '경매AI v3 서버 정상' });
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

// 1단계: 사건번호로 기본정보 자동 수집
app.post('/api/fetch', async (req, res) => {
  const startTime = Date.now();
  try {
    const { saYear, saSer, jiwonNm } = req.body;
    const inputError = validateFetchInput({ saYear, saSer, jiwonNm });
    if (inputError) {
      return res.status(400).json({ error: inputError });
    }

    const year = String(saYear).trim();
    const serial = String(saSer).trim();
    const court = String(jiwonNm).trim();

    console.log(`[fetch] ${court} ${year}타경${serial}`);
    const raw = await fetchCase(year, serial, court);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (raw.status !== 'ok') {
      return res.status(502).json({
        error: raw.error || '법원경매정보 조회에 실패했습니다.',
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

// 2단계: 사용자가 PDF 보고 입력한 정보 + 자동수집 데이터로 권리분석
app.post('/api/analyze', async (req, res) => {
  try {
    const { raw, manual, region = 'other' } = req.body;
    if (!raw || !manual) {
      return res.status(400).json({ error: '필수 파라미터 누락 (raw, manual)' });
    }

    // manual 입력을 raw 구조에 merge
    // manual = { malso: {date, type, holder, amount}, rights: [...], tenants: [...], specials: [...] }
    const merged = { ...raw };
    merged.rights = manual.rights || [];
    merged.tenants = (manual.tenants || []).map((t) => ({
      '임차인': t.name || '',
      '전입신고일자': t.moveIn || '',
      '확정일자': t.fixed || '',
      '보증금': t.deposit || '',
    }));

    // 특약 (유치권/법정지상권/분묘기지권)이 있으면 rights에 추가
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

    // 사용자가 지정한 말소기준권리는 분석 엔진에서 우선 선택되도록 표시한다.
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
