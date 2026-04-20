/**
 * 법원경매정보 크롤러 v3 — 직접 API 호출
 * ─────────────────────────────────────────
 * Puppeteer 없이 단순 fetch로 대법원 내부 API 3개를 직접 호출.
 * 브라우저 띄울 필요 없어서 훨씬 빠르고 안정적.
 *
 * 사용 API:
 *   POST /pgj/pgj15A/selectAuctnCsSrchRslt.on  — 사건내역
 *   POST /pgj/pgj15A/selectCsDtlDxdyDts.on     — 기일내역
 *   POST /pgj/pgj15A/selectDlvrOfdocDtsDtl.on  — 문건/송달내역
 */

const BASE = 'https://www.courtauction.go.kr';

// 법원 코드 (대법원 내부 사용하는 B000xxx 형식)
// 실제로 selectCortOfcLst.on 에서 목록 받아올 수도 있지만, 자주 쓰는 것들만 하드코딩
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

// 공통 헤더 (브라우저처럼 보이게)
const HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Content-Type': 'application/json;charset=UTF-8',
  'Origin': BASE,
  'Referer': `${BASE}/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ159M00.xml`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'X-Requested-With': 'XMLHttpRequest',
};

async function callApi(path, payload) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json();
}

async function fetchCase(saYear, saSer, jiwonNm) {
  const cortOfcCd = COURT_CODES[jiwonNm];
  const csNo = `${saYear}타경${saSer}`;

  const result = {
    caseNo: csNo,
    court: jiwonNm,
    cortOfcCd,
    fetchedAt: new Date().toISOString(),
    status: 'ok',
    basic: {},
    rights: [],
    tenants: [],
    schedule: [],
    interested: [],
    objects: [],
    rawApis: {},
    debug: { steps: [] },
  };

  if (!cortOfcCd) {
    result.status = 'error';
    result.error = `알 수 없는 법원: ${jiwonNm}`;
    return result;
  }

  try {
    // ── API 1: 사건내역 ──
    result.debug.steps.push(`[1/3] 사건내역 조회: ${jiwonNm} ${csNo}`);
    const searchData = await callApi('/pgj/pgj15A/selectAuctnCsSrchRslt.on', {
      dma_srchCsDtlInf: { cortOfcCd, csNo },
    });
    result.rawApis.search = searchData;

    if (searchData.status !== 200 || !searchData.data) {
      result.status = 'error';
      result.error = searchData.message || '사건을 찾을 수 없습니다';
      return result;
    }

    const d = searchData.data;

    // 기본 정보 매핑
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
      // 내부 사용을 위한 원본 csNo
      result._internalCsNo = b.csNo;
    }

    // 물건 목록
    if (Array.isArray(d.dlt_dspslGdsDspslObjctLst) && d.dlt_dspslGdsDspslObjctLst.length) {
      const obj = d.dlt_dspslGdsDspslObjctLst[0];
      result.basic['물건종별'] = getUsageName(obj.lclDspslGdsLstUsgCd, obj.mclDspslGdsLstUsgCd);
      result.basic['소재지'] = obj.userSt || '';
      result.basic['감정평가액'] = formatMoney(obj.aeeEvlAmt);
      result.basic['최저매각가격'] = formatMoney(obj.fstPbancLwsDspslPrc);
      result.basic['매각기일'] = formatYmd(obj.dspslDxdyYmd);
      result.basic['입찰보증금률'] = obj.prchDposRate ? `${obj.prchDposRate}%` : '';
      // 유찰 횟수 (매각기일 횟수 - 1)
      result.basic['유찰횟수'] = `${Math.max(0, (obj.dspslDxdyDnum || 1) - 1)}회`;
      result.objects = d.dlt_dspslGdsDspslObjctLst;
    }

    // 소재지 배당요구종기
    if (Array.isArray(d.dlt_dstrtDemnLstprdDts) && d.dlt_dstrtDemnLstprdDts.length) {
      const dt = d.dlt_dstrtDemnLstprdDts[0];
      if (dt.dstrtDemnLstprdYmd) {
        result.basic['배당요구종기'] = formatYmd(dt.dstrtDemnLstprdYmd);
      }
    }

    // 이해관계인 (임차인, 채권자 등)
    if (Array.isArray(d.dlt_rletCsIntrpsLst)) {
      result.interested = d.dlt_rletCsIntrpsLst.map((p) => ({
        type: p.auctnIntrpsDvsNm,
        name: p.intrpsNm,
        seq: p.intrpsSeq,
      }));

      // 임차인만 따로 추출 (이름만 있고 전입/확정/보증금은 별도 API 필요 — 현재는 이름만)
      result.tenants = result.interested
        .filter((p) => p.type === '임차인')
        .map((p) => ({ '임차인': p.name }));
    }

    // ── API 2: 기일내역 ──
    result.debug.steps.push(`[2/3] 기일내역 조회`);
    try {
      const dxdyData = await callApi('/pgj/pgj15A/selectCsDtlDxdyDts.on', {
        dma_srchDlvrOfdocDts: { cortOfcCd, csNo: result._internalCsNo || csNo, srchFlag: 'F' },
      });
      result.rawApis.schedule = dxdyData;

      if (dxdyData.data) {
        // 기일 목록은 여러 구조가 있을 수 있어서 탐색
        const lists = [
          dxdyData.data.dlt_rletCsGdsDtsDxdyInf,
          dxdyData.data.dlt_csDtlDxdyDts,
          dxdyData.data.dlt_dxdyInf,
        ].filter(Array.isArray);

        for (const lst of lists) {
          lst.forEach((item) => {
            result.schedule.push([
              formatYmd(item.dxdyYmd),
              item.dxdyHm ? `${item.dxdyHm.substring(0, 2)}:${item.dxdyHm.substring(2)}` : '',
              item.dxdyPlcNm || '',
              getDxdyKndName(item.auctnDxdyKndCd),
              getDxdyRsltName(item.auctnDxdyRsltCd),
              formatMoney(item.fstPbancLwsDspslPrc || item.lwsDspslPrc),
            ]);
          });
        }
      }
    } catch (e) {
      result.debug.steps.push(`기일내역 조회 실패: ${e.message} (무시하고 계속)`);
    }

    // ── API 3: 문건/송달내역 (선택적) ──
    result.debug.steps.push(`[3/3] 문건/송달내역 조회`);
    try {
      const delvData = await callApi('/pgj/pgj15A/selectDlvrOfdocDtsDtl.on', {
        dma_srchDlvrOfdocDts: { cortOfcCd, csNo: result._internalCsNo || csNo, srchFlag: 'F' },
      });
      result.rawApis.delivery = delvData;
    } catch (e) {
      result.debug.steps.push(`송달내역 조회 실패: ${e.message} (무시)`);
    }

    result.debug.steps.push(`✓ 완료`);
  } catch (e) {
    result.status = 'error';
    result.error = e.message || String(e);
    result.debug.steps.push(`EXCEPTION: ${e.message}`);
    console.error('[crawler] error:', e);
  }

  return result;
}

// ── Helpers ──
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
  const codes = {
    '20000': '부동산',
    '20100': '주거용건물',
    '20106': '다세대',
    '20104': '아파트',
    '20105': '연립주택',
    '20200': '상업용건물',
    '20300': '토지',
    '20400': '자동차',
  };
  return codes[mcl] || codes[lcl] || '부동산';
}

function getDxdyKndName(cd) {
  const codes = {
    '01': '매각기일',
    '02': '매각결정기일',
    '03': '심문기일',
    '04': '낙찰허가결정',
  };
  return codes[cd] || cd || '';
}

function getDxdyRsltName(cd) {
  const codes = {
    '002': '유찰',
    '003': '매각',
    '004': '변경',
    '005': '연기',
    '006': '취하',
    '007': '정지',
    '008': '속행',
    '009': '기각',
  };
  return codes[cd] || cd || '';
}

module.exports = { fetchCase };
