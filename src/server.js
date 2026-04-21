const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const { analyzeCase } = require('./analyzer');
const { fetchCase } = require('./crawler');

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: '경매AI v3 서버 정상' });
});

// 1단계: 사건번호로 기본정보 자동 수집
app.post('/api/fetch', async (req, res) => {
  const startTime = Date.now();
  try {
    const { saYear, saSer, jiwonNm } = req.body;
    if (!saYear || !saSer || !jiwonNm) {
      return res.status(400).json({ error: '필수 파라미터 누락' });
    }
    console.log(`[fetch] ${jiwonNm} ${saYear}타경${saSer}`);
    const raw = await fetchCase(String(saYear), String(saSer), String(jiwonNm));
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (raw.status !== 'ok') {
      return res.status(500).json({
        error: raw.error || '크롤링 실패',
        debug: raw.debug,
        elapsed: `${elapsed}s`,
      });
    }
    res.json({ ok: true, raw, elapsed: `${elapsed}s` });
  } catch (e) {
    console.error('[fetch] exception:', e);
    res.status(500).json({ error: e.message || String(e) });
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

    // 사용자가 지정한 말소기준이 있으면 강제로 그것이 먼저 오게 조작
    // (analyzer가 날짜순 첫 번째 근저당/가압류를 자동 선택하므로, 그게 맞다면 별도 처리 불필요)
    // manual.malso가 있으면 맨 앞에 추가해서 확실히 선택되게
    if (manual.malso && manual.malso.date) {
      merged.rights.unshift({
        '접수일자': manual.malso.date,
        '권리종류': manual.malso.type || '근저당권',
        '권리자': manual.malso.holder || '-',
        '채권금액': manual.malso.amount || '0',
        '_userMalso': true,
      });
    }

    const report = analyzeCase(merged, region);
    res.json({ ok: true, report });
  } catch (e) {
    console.error('[analyze] exception:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`경매AI v3 서버 시작: port ${PORT}`);
});
