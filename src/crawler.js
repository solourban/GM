/**
 * 법원경매정보 크롤러 v3 — 직접 API 호출
 */

const BASE = 'https://www.courtauction.go.kr';

const COURT_CODES = {
  '서울중앙지방법원': 'B000210',
  '서울동부지방법원': 'B000211',
  '서울서부지방법원': 'B000215',
  '서울남부지방법원': 'B000212',
  '서울북부지방법원': 'B000213',
  '의정부지방법원': 'B000214',
  '인천지방법원': 'B000240',
  '수원지방법원': 'B000250',
  '성남지원': 'B000251',
  '여주지원': 'B000252',
  '평택지원': 'B000253',
  '안산지원': 'B000254',
  '안양지원': 'B000255',
  '고양지원': 'B000256',
  '부천지원': 'B000257',
  '춘천지방법원': 'B000260',
  '강릉지원': 'B000261',
  '원주지원': 'B000262',
  '속초지원': 'B000263',
  '영월지원': 'B000264',
  '대전지방법원': 'B000270',
  '홍성지원': 'B000271',
  '공주지원': 'B000272',
  '논산지원': 'B000273',
  '서산지원': 'B000274',
  '천안지원': 'B000275',
  '청주지방법원': 'B000280',
  '충주지원': 'B000281',
  '제천지원': 'B000282',
  '영동지원': 'B000283',
  '대구지방법원': 'B000310',
  '안동지원': 'B000311',
  '경주지원': 'B000312',
  '포항지원': 'B000313',
  '김천지원': 'B000314',
  '상주지원': 'B000315',
  '의성지원': 'B000316',
  '영덕지원': 'B000317',
  '대구서부지원': 'B000318',
  '부산지방법원': 'B000410',
  '부산지방법원 동부지원': 'B000411',
  '부산지방법원 서부지원': 'B000412',
  '울산지방법원': 'B000420',
  '창원지방법원': 'B000430',
  '마산지원': 'B000431',
  '통영지원': 'B000432',
  '밀양지원': 'B000433',
  '거창지원': 'B000434',
  '진주지원': 'B000435',
  '광주지방법원': 'B000510',
  '목포지원': 'B000511',
  '장흥지원': 'B000512',
  '순천지원': 'B000513',
  '해남지원': 'B000514',
  '전주지방법원': 'B000520',
  '군산지원': 'B000521',
  '정읍지원': 'B000522',
  '남원지원': 'B000523',
  '제주지방법원': 'B000610',
};

function compactCourtKey(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/지방법원/g, '')
    .replace(/법원/g, '')
    .replace(/지원/g, '지원');
}

const COURT_ALIASES = Object.fromEntries([
  ['서울중앙', '서울중앙지방법원'], ['중앙', '서울중앙지방법원'], ['서울중앙지법', '서울중앙지방법원'],
  ['서울동부', '서울동부지방법원'], ['동부', '서울동부지방법원'], ['서울동부지법', '서울동부지방법원'],
  ['서울서부', '서울서부지방법원'], ['서부', '서울서부지방법원'], ['서울서부지법', '서울서부지방법원'],
  ['서울남부', '서울남부지방법원'], ['남부', '서울남부지방법원'], ['서울남부지법', '서울남부지방법원'],
  ['서울북부', '서울북부지방법원'], ['북부', '서울북부지방법원'], ['서울북부지법', '서울북부지방법원'],
  ['의정부', '의정부지방법원'], ['인천', '인천지방법원'], ['수원', '수원지방법원'], ['춘천', '춘천지방법원'],
  ['대전', '대전지방법원'], ['청주', '청주지방법원'], ['대구', '대구지방법원'], ['부산', '부산지방법원'],
  ['울산', '울산지방법원'], ['창원', '창원지방법원'], ['광주', '광주지방법원'], ['전주', '전주지방법원'], ['제주', '제주지방법원'],
  ['대구서부', '대구서부지원'], ['대구서부지원', '대구서부지원'],
  ['부산동부', '부산지방법원 동부지원'], ['부산동부지원', '부산지방법원 동부지원'], ['동부지원', '부산지방법원 동부지원'],
  ['부산서부', '부산지방법원 서부지원'], ['부산서부지원', '부산지방법원 서부지원'], ['서부지원', '부산지방법원 서부지원'],
  ...Object.keys(COURT_CODES).flatMap((court) => {
    const compact = compactCourtKey(court);
    const short = compact.replace(/지원$/, '');
    return [[court, court], [compact, court], [short, court]];
  }),
]);

const HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Content-Type': 'application/json;charset=UTF-8',
  'Origin': BASE,
  'Referer': `${BASE}/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ159M00.xml`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'X-Requested-With': 'XMLHttpRequest',
};

function normalizeCourtName(name) {
  const raw = String(name || '').trim();
  if (COURT_CODES[raw]) return raw;
  const compact = compactCourtKey(raw);
  if (COURT_ALIASES[raw]) return COURT_ALIASES[raw];
  if (COURT_ALIASES[compact]) return COURT_ALIASES[compact];
  if (COURT_CODES[`${raw}지방법원`]) return `${raw}지방법원`;
  if (COURT_CODES[`${raw}지원`]) return `${raw}지원`;
  const found = Object.keys(COURT_CODES).find((court) => court.includes(raw) || compactCourtKey(court).includes(compact));
  return found || raw;
}

function buildFailureHints(reason, { courtName, csNo, cortOfcCd }) {
  const hints = [
    '법원명, 사건연도, 사건번호가 맞는지 먼저 확인하세요.',
    '대법원 사이트에서 취하·정지·종국·매각완료 사건은 조회 구조가 다를 수 있습니다.',
    '일부 사건은 물건번호 또는 내부 사건번호 매칭이 필요해 자동 조회가 실패할 수 있습니다.',
    '대법원 경매정보 사이트 응답 지연/차단이면 잠시 후 다시 시도하세요.',
  ];
  return { reason, courtName, csNo, cortOfcCd, hints };
}

async function callApi(path, payload) {
  const url = `${BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, { method: 'POST', headers: HEADERS, body: JSON.stringify(payload), signal: controller.signal });
    if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
    return res.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`API ${path} timeout`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCase(saYear, saSer, jiwonNm) {
  const courtName = normalizeCourtName(jiwonNm);
  const cortOfcCd = COURT_CODES[courtName];
  const csNo = `${saYear}타경${saSer}`;

  const result = { caseNo: csNo, court: courtName, requestedCourt: jiwonNm, cortOfcCd, fetchedAt: new Date().toISOString(), status: 'ok', basic: {}, rights: [], tenants: [], schedule: [], interested: [], objects: [], rawApis: {}, debug: { steps: [] } };

  if (!cortOfcCd) {
    result.status = 'error';
    result.error = `지원하지 않는 법원명입니다: ${jiwonNm}`;
    result.diagnosis = buildFailureHints('court_not_supported', { courtName, csNo, cortOfcCd });
    result.debug.steps.push(`법원 코드 없음: ${jiwonNm}`);
    return result;
  }

  try {
    result.debug.steps.push(`[1/3] 사건내역 조회: ${courtName} ${csNo}`);
    const searchData = await callApi('/pgj/pgj15A/selectAuctnCsSrchRslt.on', { dma_srchCsDtlInf: { cortOfcCd, csNo } });
    result.rawApis.search = searchData;

    if (searchData.status !== 200 || !searchData.data) {
      result.status = 'error';
      result.error = searchData.message || '사건을 찾을 수 없습니다';
      result.diagnosis = buildFailureHints('case_not_found_or_empty', { courtName, csNo, cortOfcCd });
      result.debug.steps.push(`사건내역 없음: status=${searchData.status}, message=${searchData.message || '-'}`);
      return result;
    }

    const d = searchData.data;

    if (d.dma_csBasInf) {
      const b = d.dma_csBasInf;
      result.basic = {
        '사건번호': b.userCsNo,
        '사건명': b.csNm,
        '법원': b.cortOfcNm,
        '담당계': b.cortAuctnJdbnNm,
        '접수일자': formatYmd(b.csRcptYmd),
        '경매개시일': formatYmd(b.csCmdcYmd),
        '청구금액': formatMoney(b.clmAmt),
        '종국결과': b.ultmtDvsCd === '000' ? '미종국' : (b.ultmtDvsCd || ''),
        '담당계전화': b.jdbnTelno,
        '집행관실전화': b.execrCsTelno,
      };
      result._internalCsNo = b.csNo;
    }

    if (Array.isArray(d.dlt_dspslGdsDspslObjctLst) && d.dlt_dspslGdsDspslObjctLst.length) {
      const obj = d.dlt_dspslGdsDspslObjctLst[0];
      result.basic['물건종별'] = getUsageName(obj.lclDspslGdsLstUsgCd, obj.mclDspslGdsLstUsgCd);
      result.basic['소재지'] = obj.userSt || '';
      result.basic['감정평가액'] = formatMoney(obj.aeeEvlAmt);
      result.basic['최저매각가격'] = formatMoney(obj.fstPbancLwsDspslPrc);
      result.basic['매각기일'] = formatYmd(obj.dspslDxdyYmd);
      result.basic['입찰보증금률'] = obj.prchDposRate ? `${obj.prchDposRate}%` : '';
      result.basic['유찰횟수'] = `${Math.max(0, (obj.dspslDxdyDnum || 1) - 1)}회`;
      result.objects = d.dlt_dspslGdsDspslObjctLst;
    } else {
      result.debug.steps.push('물건목록 없음: 사건은 있으나 물건 데이터가 비어 있음');
    }

    if (Array.isArray(d.dlt_dstrtDemnLstprdDts) && d.dlt_dstrtDemnLstprdDts.length) {
      const dt = d.dlt_dstrtDemnLstprdDts[0];
      if (dt.dstrtDemnLstprdYmd) result.basic['배당요구종기'] = formatYmd(dt.dstrtDemnLstprdYmd);
    }

    if (Array.isArray(d.dlt_rletCsIntrpsLst)) {
      result.interested = d.dlt_rletCsIntrpsLst.map((p) => ({ type: p.auctnIntrpsDvsNm, name: p.intrpsNm, seq: p.intrpsSeq }));
      result.tenants = result.interested.filter((p) => p.type === '임차인').map((p) => ({ '임차인': p.name }));
    }

    result.debug.steps.push(`[2/3] 기일내역 조회`);
    try {
      const dxdyData = await callApi('/pgj/pgj15A/selectCsDtlDxdyDts.on', { dma_srchDlvrOfdocDts: { cortOfcCd, csNo: result._internalCsNo || csNo, srchFlag: 'F' } });
      result.rawApis.schedule = dxdyData;
      if (dxdyData.data) {
        const lists = [dxdyData.data.dlt_rletCsGdsDtsDxdyInf, dxdyData.data.dlt_csDtlDxdyDts, dxdyData.data.dlt_dxdyInf].filter(Array.isArray);
        for (const lst of lists) {
          lst.forEach((item) => {
            result.schedule.push([formatYmd(item.dxdyYmd), item.dxdyHm ? `${item.dxdyHm.substring(0, 2)}:${item.dxdyHm.substring(2)}` : '', item.dxdyPlcNm || '', getDxdyKndName(item.auctnDxdyKndCd), getDxdyRsltName(item.auctnDxdyRsltCd), formatMoney(item.fstPbancLwsDspslPrc || item.lwsDspslPrc)]);
          });
        }
      }
    } catch (e) {
      result.debug.steps.push(`기일내역 조회 실패: ${e.message} (무시하고 계속)`);
    }

    result.debug.steps.push(`[3/3] 문건/송달내역 조회`);
    try {
      const delvData = await callApi('/pgj/pgj15A/selectDlvrOfdocDtsDtl.on', { dma_srchDlvrOfdocDts: { cortOfcCd, csNo: result._internalCsNo || csNo, srchFlag: 'F' } });
      result.rawApis.delivery = delvData;
    } catch (e) {
      result.debug.steps.push(`송달내역 조회 실패: ${e.message} (무시)`);
    }

    result.debug.steps.push(`✓ 완료`);
  } catch (e) {
    result.status = 'error';
    result.error = e.message || String(e);
    result.diagnosis = buildFailureHints('api_exception', { courtName, csNo, cortOfcCd });
    result.debug.steps.push(`EXCEPTION: ${e.message}`);
    console.error('[crawler] error:', e);
  }

  return result;
}

function formatYmd(ymd) {
  if (!ymd) return '';
  const s = String(ymd);
  if (s.length === 8) return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
  return s;
}

function formatMoney(n) {
  if (n == null || n === '') return '';
  const num = Number(n);
  if (isNaN(num) || num === 0) return '0원';
  return num.toLocaleString('ko-KR') + '원';
}

function getUsageName(lcl, mcl) {
  const codes = { '20000': '부동산', '20100': '주거용건물', '20106': '다세대', '20104': '아파트', '20105': '연립주택', '20200': '상업용건물', '20300': '토지', '20400': '자동차' };
  return codes[mcl] || codes[lcl] || '부동산';
}

function getDxdyKndName(cd) {
  const codes = { '01': '매각기일', '02': '매각결정기일', '03': '심문기일', '04': '낙찰허가결정' };
  return codes[cd] || cd || '';
}

function getDxdyRsltName(cd) {
  const codes = { '002': '유찰', '003': '매각', '004': '변경', '005': '연기', '006': '취하', '007': '정지', '008': '속행', '009': '기각' };
  return codes[cd] || cd || '';
}

function listCourts() {
  return Object.entries(COURT_CODES).map(([name, code]) => ({ name, code }));
}

module.exports = { fetchCase, COURT_CODES, normalizeCourtName, listCourts };
