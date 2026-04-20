const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const { analyzeCase } = require('./analyzer');
const { fetchCase } = require('./crawler');

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: '경매AI 분석 서버 정상' });
});

app.post('/api/analyze', async (req, res) => {
  const startTime = Date.now();
  try {
    const { saYear, saSer, jiwonNm, region = 'other' } = req.body;

    if (!saYear || !saSer || !jiwonNm) {
      return res.status(400).json({ error: '필수 파라미터 누락' });
    }

    console.log(`[analyze] ${jiwonNm} ${saYear}타경${saSer}`);

    const raw = await fetchCase(String(saYear), String(saSer), String(jiwonNm));
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (raw.status !== 'ok') {
      return res.status(500).json({
        error: raw.error || '크롤링 실패',
        debug: raw.debug,
        elapsed: `${elapsed}s`,
      });
    }

    const report = analyzeCase(raw, region);
    console.log(`[analyze] OK in ${elapsed}s`);

    res.json({
      ok: true,
      report,
      debug: raw.debug,
      elapsed: `${elapsed}s`,
    });
  } catch (e) {
    console.error('[analyze] exception:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`경매AI 분석 서버 시작: port ${PORT}`);
});
