/**
 * 권리분석 엔진
 */

const MALSO_KEYWORDS = ['근저당', '저당', '가압류', '압류', '담보가등기', '경매개시결정'];
const ALWAYS_INHERIT = ['유치권', '법정지상권', '분묘기지권'];

const CHOI_U_SEON = {
  seoul: [165_000_000, 55_000_000],
  overcrowded: [145_000_000, 48_000_000],
  metro: [85_000_000, 28_000_000],
  other: [75_000_000, 25_000_000],
};

function parseMoney(s) {
  if (!s) return 0;
  const digits = String(s).replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function normalizeDate(s) {
  if (!s) return '';
  const m = String(s).match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return String(s);
}

function formatMoney(n) {
  if (!n) return '-';
  const 억 = Math.floor(n / 100_000_000);
  const 만 = Math.floor((n % 100_000_000) / 10_000);
  const parts = [];
  if (억) parts.push(`${억}억`);
  if (만) parts.push(`${만.toLocaleString('ko-KR')}만`);
  return (parts.join(' ') || '0') + '원';
}

function normalizeRights(raw) {
  return raw
    .map((r) => ({
      date: normalizeDate(r['접수일자'] || r['접수일'] || r['접수'] || ''),
      type: (r['권리종류'] || r['등기'] || '').trim(),
      holder: (r['권리자'] || r['등기명의인'] || '').trim(),
      amount: parseMoney(r['채권금액'] || r['채권최고액'] || r['금액'] || ''),
    }))
    .filter((r) => r.date || r.type);
}

function normalizeTenants(raw) {
  return raw
    .map((t) => ({
      name: (t['임차인'] || t['성명'] || '').trim(),
      moveIn: normalizeDate(t['전입신고일자'] || t['전입일'] || t['전입'] || ''),
      fixed: normalizeDate(t['확정일자'] || ''),
      deposit: parseMoney(t['보증금'] || t['임차보증금'] || ''),
    }))
    .filter((t) => t.moveIn);
}

function findMalso(rights) {
  const candidates = rights.filter((r) => MALSO_KEYWORDS.some((k) => r.type.includes(k)));
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.date.localeCompare(b.date));
  return candidates[0];
}

function analyzeRights(rights, malso) {
  const sorted = [...rights].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((r) => {
    const out = { ...r };
    if (ALWAYS_INHERIT.some((k) => r.type.includes(k))) {
      out.status = '인수';
      out.reason = `${r.type}은(는) 경매로 소멸되지 않는 특수권리`;
    } else if (!malso) {
      out.status = '?';
      out.reason = '말소기준권리 없음';
    } else if (r === malso) {
      out.status = '소멸';
      out.reason = '말소기준 본인 — 매각으로 소멸';
      out.isMalso = true;
    } else if (r.date < malso.date) {
      out.status = '인수';
      out.reason = '말소기준보다 선순위 → 인수';
    } else {
      out.status = '소멸';
      out.reason = '말소기준 이후 → 소멸';
    }
    return out;
  });
}

function analyzeTenants(tenants, malso) {
  return tenants.map((t) => {
    const out = { ...t };
    if (!malso) {
      out.daehang = '?';
      out.reason = '말소기준 없음';
    } else if (t.moveIn < malso.date) {
      out.daehang = '있음';
      out.reason = `전입(${t.moveIn}) < 말소기준(${malso.date}) → 대항력 있음`;
    } else {
      out.daehang = '없음';
      out.reason = `전입(${t.moveIn}) ≥ 말소기준(${malso.date}) → 대항력 없음`;
    }
    return out;
  });
}

function simulateBaedang(bidPrice, rights, tenants, region) {
  let remain = bidPrice;
  const allocations = [];

  const cost = Math.round(bidPrice * 0.03);
  allocations.push({ order: 1, label: '경매집행비용(추정 3%)', amount: cost });
  remain -= cost;
  if (remain < 0) remain = 0;

  const [limit, maxAmt] = CHOI_U_SEON[region] || CHOI_U_SEON.other;
  const half = Math.floor(bidPrice / 2);
  let choiTotal = 0;
  tenants.forEach((t) => {
    if (t.deposit <= limit) {
      const allow = Math.max(0, Math.min(t.deposit, maxAmt, half - choiTotal));
      if (allow > 0) {
        allocations.push({ order: 2, label: `소액임차인 최우선변제 (${t.name || '임차인'})`, amount: allow });
        t._choi = allow;
        choiTotal += allow;
      } else {
        t._choi = 0;
      }
    } else {
      t._choi = 0;
    }
  });
  remain -= choiTotal;
  if (remain < 0) remain = 0;

  const priority = [];
  rights.forEach((r) => {
    if (/근저당|저당|전세권|담보가등기/.test(r.type) && r.status === '소멸') {
      priority.push({ kind: 'right', date: r.date, label: `${r.type} (${r.holder})`, amount: r.amount, ref: r });
    }
  });
  tenants.forEach((t) => {
    if (t.fixed) {
      const remainDep = Math.max(0, t.deposit - (t._choi || 0));
      if (remainDep > 0) {
        const wuseon = t.fixed > t.moveIn ? t.fixed : t.moveIn;
        priority.push({ kind: 'tenant', date: wuseon, label: `임차인 우선변제 (${t.name})`, amount: remainDep, ref: t });
      }
    }
  });
  priority.sort((a, b) => a.date.localeCompare(b.date));

  priority.forEach((p) => {
    if (remain <= 0) return;
    const pay = Math.min(p.amount, remain);
    allocations.push({ order: 3, label: `${p.label} — ${p.date}`, amount: pay });
    p.ref._baedang = (p.ref._baedang || 0) + pay;
    remain -= pay;
  });

  return { bidPrice, allocations, surplus: remain };
}

function calculateInherited(rights, tenants) {
  const items = [];
  let total = 0;
  rights.forEach((r) => {
    if (r.status === '인수') {
      const note = ALWAYS_INHERIT.some((k) => r.type.includes(k)) ? '특수권리' : '선순위 권리 인수';
      items.push({ label: `${r.type} (${r.holder})`, amount: r.amount, note });
      total += r.amount;
    }
  });
  tenants.forEach((t) => {
    if (t.daehang === '있음') {
      const received = (t._choi || 0) + (t._baedang || 0);
      const unpaid = Math.max(0, t.deposit - received);
      if (unpaid > 0) {
        items.push({ label: `대항력 임차인 미배당 (${t.name})`, amount: unpaid, note: '낙찰자 인수' });
        total += unpaid;
      }
    }
  });
  return { total, items };
}

function assessRisk(rights, tenants, inherited, minBid) {
  const flags = [];
  let level = 'ok';

  const special = rights.filter((r) => ALWAYS_INHERIT.some((k) => r.type.includes(k)));
  if (special.length) {
    flags.push({ sev: 'danger', msg: `특수권리 ${special.length}건 (${special.map((r) => r.type).join(', ')})` });
    level = 'danger';
  }

  const daehang = tenants.filter((t) => t.daehang === '있음');
  if (daehang.length) {
    flags.push({ sev: inherited.total > 0 ? 'danger' : 'warn', msg: `대항력 임차인 ${daehang.length}명` });
    if (level === 'ok') level = 'warn';
  }

  if (inherited.total > 0 && minBid) {
    const ratio = inherited.total / minBid;
    if (ratio >= 0.3) {
      flags.push({ sev: 'danger', msg: `인수금액이 최저가의 ${(ratio * 100).toFixed(0)}%` });
      level = 'danger';
    } else if (ratio >= 0.05) {
      flags.push({ sev: 'warn', msg: `인수금액이 최저가의 ${(ratio * 100).toFixed(0)}%` });
      if (level === 'ok') level = 'warn';
    }
  }

  if (!flags.length) flags.push({ sev: 'ok', msg: '권리관계가 깨끗한 물건입니다' });
  return { level, flags };
}

function recommendBid(appraisal, minBid, inheritedTotal) {
  if (!appraisal || !minBid) return null;
  const taxAndOther = appraisal * 0.056;
  const upper = Math.max(minBid, Math.floor(Math.min(appraisal * 0.85, appraisal - inheritedTotal - taxAndOther)));
  return { lower: minBid, upper, base: appraisal };
}

function generateExplanation(rep) {
  const lines = [];
  if (rep.malso) {
    lines.push(
      `<p><b>1. 말소기준권리</b><br>` +
      `${rep.malso.date}에 ${rep.malso.holder}가 설정한 <b>${rep.malso.type}</b>이 말소기준권리입니다. ` +
      `이 날짜 이후의 권리는 경매로 소멸되고, 이전 권리는 인수 대상입니다.</p>`
    );
  }
  const inheritList = rep.rights.filter((r) => r.status === '인수');
  if (inheritList.length) {
    lines.push(
      `<p><b>2. 인수되는 권리</b><br>` +
      `${inheritList.map((r) => r.type).join(', ')}는 낙찰자가 인수합니다. ` +
      `총 인수금액 ${formatMoney(rep.inherited.total)}을 입찰가 외에 부담해야 합니다.</p>`
    );
  } else {
    lines.push(`<p><b>2. 인수 권리 없음</b><br>낙찰자가 인수할 선순위 권리가 없습니다.</p>`);
  }
  if (rep.tenants.length) {
    const daehang = rep.tenants.filter((t) => t.daehang === '있음');
    if (daehang.length) {
      lines.push(
        `<p><b>3. 대항력 있는 임차인</b><br>${daehang.length}명이 대항력 있음. 미배당 보증금은 낙찰자 인수.</p>`
      );
    } else {
      lines.push(`<p><b>3. 임차인 대항력 없음</b><br>모든 임차인 후순위.</p>`);
    }
  }
  const total = {
    ok: '권리관계가 깔끔합니다. 시세 대비 입찰가 경쟁력이 핵심.',
    warn: `인수금액 ${formatMoney(rep.inherited.total)} 반영한 실질 투자비로 판단하세요.`,
    danger: '위험 요소 여러 개. 전문가 검토 필수.',
  }[rep.risk.level];
  lines.push(`<p><b>4. 총평 · ${rep.risk.level.toUpperCase()}</b><br>${total}</p>`);
  return lines.join('');
}

function analyzeCase(raw, region = 'other') {
  const rights = normalizeRights(raw.rights);
  const tenantsRaw = normalizeTenants(raw.tenants);
  const malso = findMalso(rights);
  const analyzedRights = analyzeRights(rights, malso);
  const tenants = analyzeTenants(tenantsRaw, malso);

  const minBid = parseMoney(raw.basic['최저매각가격'] || raw.basic['최저가']);
  const appraisal = parseMoney(raw.basic['감정평가액'] || raw.basic['감정가']);

  const baedang = simulateBaedang(minBid || appraisal || 100_000_000, analyzedRights, tenants, region);
  const inherited = calculateInherited(analyzedRights, tenants);
  const risk = assessRisk(analyzedRights, tenants, inherited, minBid);
  const bidRec = recommendBid(appraisal, minBid, inherited.total);

  const pre = {
    case: raw.caseNo,
    court: raw.court,
    basic: raw.basic,
    malso,
    rights: analyzedRights,
    tenants,
    baedang,
    inherited,
    risk,
    bidRec,
    url: raw.url,
  };
  return { ...pre, explanation: generateExplanation(pre) };
}

module.exports = { analyzeCase, formatMoney };
