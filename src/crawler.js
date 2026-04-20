/**
 * 법원경매정보 크롤러 (v2 — 디버그 모드)
 * 여러 진입 경로 시도 + HTML 샘플을 응답에 포함시켜 원인 분석 가능
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const COURT_ENC = {
  '서울중앙지방법원': '%BC%AD%BF%EF%C1%DF%BE%D3%C1%F6%B9%E6%B9%FD%BF%F8',
  '서울동부지방법원': '%BC%AD%BF%EF%B5%BF%BA%CE%C1%F6%B9%E6%B9%FD%BF%F8',
  '서울서부지방법원': '%BC%AD%BF%EF%BC%AD%BA%CE%C1%F6%B9%E6%B9%FD%BF%F8',
  '서울남부지방법원': '%BC%AD%BF%EF%B3%B2%BA%CE%C1%F6%B9%E6%B9%FD%BF%F8',
  '서울북부지방법원': '%BC%AD%BF%EF%BA%CF%BA%CE%C1%F6%B9%E6%B9%FD%BF%F8',
  '대전지방법원': '%B4%EB%C0%FC%C1%F6%B9%E6%B9%FD%BF%F8',
  '천안지원': '%C3%B5%BE%C8%C1%F6%BF%F8',
  '부산지방법원': '%BA%CE%BB%EA%C1%F6%B9%E6%B9%FD%BF%F8',
  '부산지방법원 동부지원': '%BA%CE%BB%EA%C1%F6%B9%E6%B9%FD%BF%F8+%B5%BF%BA%CE%C1%F6%BF%F8',
  '부산지방법원 서부지원': '%BA%CE%BB%EA%C1%F6%B9%E6%B9%FD%BF%F8+%BC%AD%BA%CE%C1%F6%BF%F8',
  '대구지방법원': '%B4%EB%B1%B8%C1%F6%B9%E6%B9%FD%BF%F8',
  '인천지방법원': '%C0%CE%C3%B5%C1%F6%B9%E6%B9%FD%BF%F8',
  '광주지방법원': '%B1%A4%C1%D6%C1%F6%B9%E6%B9%FD%BF%F8',
  '수원지방법원': '%BC%F6%BF%F8%C1%F6%B9%E6%B9%FD%BF%F8',
  '의정부지방법원': '%C0%C7%C1%A4%BA%CE%C1%F6%B9%E6%B9%FD%BF%F8',
  '울산지방법원': '%BF%EF%BB%EA%C1%F6%B9%E6%B9%FD%BF%F8',
  '창원지방법원': '%C3%A2%BF%F8%C1%F6%B9%E6%B9%FD%BF%F8',
  '청주지방법원': '%C3%BB%C1%D6%C1%F6%B9%E6%B9%FD%BF%F8',
  '전주지방법원': '%C0%FC%C1%D6%C1%F6%B9%E6%B9%FD%BF%F8',
  '춘천지방법원': '%C3%E1%C3%B5%C1%F6%B9%E6%B9%FD%BF%F8',
  '제주지방법원': '%C1%A6%C1%D6%C1%F6%B9%E6%B9%FD%BF%F8',
};

function encodeCourt(name) {
  return COURT_ENC[name] || encodeURIComponent(name);
}

let browserInstance = null;

async function getBrowser() {
  if (browserInstance && browserInstance.isConnected()) return browserInstance;
  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
    ],
  });
  return browserInstance;
}

async function fetchCase(saYear, saSer, jiwonNm) {
  const jiwonEnc = encodeCourt(jiwonNm);

  // 여러 진입 URL 시도
  const urls = [
    // 원본 진입점 (사건목록 조회)
    'https://www.courtauction.go.kr/RetrieveRealEstDetailInqSaList.laf' +
      `?jiwonNm=${jiwonEnc}&saYear=${saYear}&saSer=${saSer}` +
      '&_CUR_CMD=InitMulSrch.laf&_SRCH_SRNID=PNO102014' +
      '&_NEXT_CMD=RetrieveRealEstDetailInqSaList.laf',
    // 메인 접속 후 검색 경로 (fallback)
    'https://www.courtauction.go.kr/',
  ];

  const primaryUrl = urls[0];
  const result = {
    caseNo: `${saYear}타경${saSer}`,
    court: jiwonNm,
    url: primaryUrl,
    fetchedAt: new Date().toISOString(),
    status: 'ok',
    basic: {},
    rights: [],
    tenants: [],
    schedule: [],
    debug: {
      steps: [],
      finalUrl: null,
      htmlLength: 0,
      tableCount: 0,
      hasContent: false,
      htmlSample: '',
      pageTitle: '',
    },
  };

  let page = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ko-KR,ko;q=0.9' });
    await page.setViewport({ width: 1280, height: 900 });

    // Step 1: 진입점 접속
    result.debug.steps.push(`GOTO: ${primaryUrl}`);
    await page.goto(primaryUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));

    result.debug.finalUrl = page.url();
    result.debug.pageTitle = await page.title();
    result.debug.steps.push(`ARRIVED: ${result.debug.finalUrl}`);
    result.debug.steps.push(`TITLE: ${result.debug.pageTitle}`);

    // 모든 frame 정보 수집 (iframe 있는지 확인)
    const frames = page.frames();
    result.debug.steps.push(`FRAMES: ${frames.length}개`);
    frames.forEach((f, i) => {
      result.debug.steps.push(`  Frame[${i}]: ${f.url()}`);
    });

    // Step 2: iframe이 있으면 그 안쪽 콘텐츠 찾기
    let targetFrame = page.mainFrame();
    for (const f of frames) {
      if (f.url().includes('courtauction')) {
        targetFrame = f;
      }
    }

    // Step 3: 사건 링크 찾아 클릭
    const linkText = `${saYear}타경${saSer}`;
    const clicked = await page.evaluate((text) => {
      const findInAll = (root) => {
        const links = Array.from(root.querySelectorAll('a'));
        const target = links.find((a) => (a.textContent || '').includes(text));
        if (target) {
          target.click();
          return true;
        }
        // iframe 내부도 확인
        const iframes = Array.from(root.querySelectorAll('iframe'));
        for (const ifr of iframes) {
          try {
            if (ifr.contentDocument && findInAll(ifr.contentDocument)) return true;
          } catch {}
        }
        return false;
      };
      return findInAll(document);
    }, linkText);

    result.debug.steps.push(`CASE_LINK_CLICKED: ${clicked}`);

    if (clicked) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        await page.waitForNavigation({ timeout: 5000, waitUntil: 'networkidle2' });
      } catch {}
      result.debug.steps.push(`AFTER_CLICK_URL: ${page.url()}`);
    }

    // Step 4: 최종 HTML 수집 (모든 프레임)
    const htmls = [];
    htmls.push(await page.content());
    for (const f of page.frames()) {
      try {
        if (f !== page.mainFrame()) {
          const frameHtml = await f.content();
          if (frameHtml.length > 500) htmls.push(frameHtml);
        }
      } catch {}
    }

    const fullHtml = htmls.join('\n<!-- FRAME SEPARATOR -->\n');
    result.debug.htmlLength = fullHtml.length;

    // Step 5: 파싱
    const parsed = parseDetail(fullHtml);
    Object.assign(result, parsed);
    result.debug.tableCount = parsed._tableCount || 0;
    result.debug.hasContent =
      Object.keys(result.basic).length > 0 ||
      result.rights.length > 0 ||
      result.tenants.length > 0;

    // Step 6: HTML 샘플 저장 (앞부분 + 중간 + 끝 — 디버깅용)
    if (!result.debug.hasContent) {
      const sampleBody = fullHtml.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
      result.debug.htmlSample = sampleBody.substring(0, 3000);
    }

    if (!result.debug.hasContent) {
      result.status = 'error';
      result.error = `페이지에서 사건 정보를 찾지 못함. URL: ${result.debug.finalUrl}`;
    }
  } catch (e) {
    result.status = 'error';
    result.error = e.message || String(e);
    result.debug.steps.push(`EXCEPTION: ${e.message}`);
    console.error('[crawler] error:', e);
  } finally {
    if (page) {
      try { await page.close(); } catch {}
    }
  }

  return result;
}

function parseDetail(html) {
  const $ = cheerio.load(html);
  const out = { basic: {}, rights: [], tenants: [], schedule: [], _tableCount: 0 };

  const tables = $('table');
  out._tableCount = tables.length;

  tables.each((_, el) => {
    const $table = $(el);
    const headerText = $table.find('th').map((_, th) => $(th).text().trim()).get().join('|');
    const allText = $table.text();

    if (/사건번호|물건종별|감정평가|최저매각/.test(headerText)) {
      Object.assign(out.basic, parseKV($table, $));
    }
    if (/임차인|전입|확정/.test(headerText)) {
      out.tenants.push(...parseRows($table, $));
    }
    if (/접수일|등기|권리종류/.test(headerText) && /채권|금액|권리자/.test(headerText)) {
      out.rights.push(...parseRows($table, $));
    }
    if (/매각기일|유찰/.test(allText) && /최저매각가격|최저가/.test(allText)) {
      $table.find('tr').slice(1).each((_, tr) => {
        const cells = $(tr).find('td').map((_, td) => $(td).text().trim()).get();
        if (cells.length >= 3) out.schedule.push(cells);
      });
    }
  });

  return out;
}

function parseKV($table, $) {
  const d = {};
  $table.find('tr').each((_, tr) => {
    const cells = $(tr).find('th, td').toArray();
    for (let i = 0; i < cells.length - 1; i++) {
      if (cells[i].name === 'th') {
        const key = $(cells[i]).text().trim();
        const val = $(cells[i + 1]).text().replace(/\s+/g, ' ').trim();
        if (key && val) d[key] = val;
        i++;
      }
    }
  });
  return d;
}

function parseRows($table, $) {
  const rows = [];
  const headers = $table.find('tr').first().find('th, td').map((_, el) => $(el).text().trim()).get();
  $table.find('tr').slice(1).each((_, tr) => {
    const cells = $(tr).find('td').map((_, td) => $(td).text().replace(/\s+/g, ' ').trim()).get();
    if (cells.length < 2) return;
    if (/없음|조사된 임차인 내역 없음/.test(cells.join(''))) return;
    const row = {};
    headers.forEach((h, i) => {
      if (h && cells[i]) row[h] = cells[i];
    });
    if (Object.keys(row).length > 0) rows.push(row);
  });
  return rows;
}

module.exports = { fetchCase };
