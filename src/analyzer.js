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
  const text = String(s).replace(/\s+/g, '').trim();

  if (/[억만천]/.test(text)) {
    let total = 0;
    const eok = text.match(/([0-9,]+(?:\.\d+)?)억/);
    const man = text.match(/([0-9,]+(?:\.\d+)?)만/);
    const cheon = text.match(/([0-9,]+(?:\.\d+)?)천/);
    if (eok) total += Math.round(Number(eok[1].replace(/,/g, '')) * 100_000_000);
    if (man) total += Math.round(Number(man[1].replace(/,/g, '')) * 10_000);
    if (!man && cheon) total += Math.round(Number(cheon[1].replace(/,/g, '')) * 10_000_000);
    if (Number.isFinite(total) && total > 0) return total;
  }

  const digits = text.replace(/[^0-9]/g, '');
  const parsed = digits ? parseInt(digits, 10) : 0;
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function normalizeDate(s) {
  if (!s) return '';
  const text = String(s).trim().replace(/\s+/g, '');

  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const [, y, mo, d] = compact;
    return `${y}-${mo}-${d}`;
  }

  const separated = text.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\.?/);
  if (separated) {
    const [, y, mo, d] = separated;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  return text;
}

function isValidDateString(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const [y, m, d] = String(s).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function compareDate(a, b) {
  if (!isValidDateString(a) || !isValidDateString(b)) return null;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function formatMoney(n) {
  const safe = Math.max(0, Number(n || 0));
  if (!safe) return '-';
  const 억 = Math.floor(safe / 100_000_000);
  const 만 = Math.floor((safe % 100_000_000) / 10_000);
  const parts = [];
  if (억) parts.push(`${억}억`);
  if (만) parts.push(`${만.toLocaleString('ko-KR')}만`);
  return (parts.join(' ') || '0') + '원';
}

function normalizeRights(raw = []) {
  return raw
    .map((r) => {
      const date = normalizeDate(r['접수일자'] || r['접수일'] || r['접수'] || r.date || '');
      return {
        date,
        dateValid: !date || isValidDateString(date),
        type: (r['권리종류'] || r['등기'] || r.type || '').trim(),
        holder: (r['권리자'] || r['등기명의인'] || r.holder || '').trim(),
        amount: parseMoney(r['채권금액'] || r['채권최고액'] || r['금액'] || r.amount || ''),
        _userMalso: Boolean(r._userMalso),
      };
    })
    .filter((r) => r.date || r.type || r.holder || r.amount);
}

function normalizeTenants(raw = []) {
  return raw
    .map((t) => {
      const moveIn = normalizeDate(t['전입신고일자'] || t['전입일'] || t['전입'] || t.moveIn || '');
      const fixed = normalizeDate(t['확정일자'] || t.fixed || '');
      return {
        name: (t['임차인'] || t['성명'] || t.name || '').trim(),
        moveIn,
        moveInValid: !moveIn || isValidDateString(moveIn),
        fixed,
        fixedValid: !fixed || isValidDateString(fixed),
        deposit: parseMoney(t['보증금'] || t['임차보증금'] || t.deposit || ''),
      };
    })
    .filter((t) => t.name || t.moveIn || t.fixed || t.deposit);
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasAnyValue(obj, keys) {
  return keys.some((key) => cleanText(obj?.[key]));
}

function manualMalsoRight(manual = {}) {
  const malso = manual?.malso || {};
  if (!hasAnyValue(malso, ['date', 'type', 'holder', 'amount', '접수일자', '권리종류', '권리자', '채권금액'])) return null;
  return {
    date: cleanText(malso.date || malso['접수일자'] || malso['접수일']),
    type: cleanText(malso.type || malso['권리종류']) || '근저당권',
    holder: cleanText(malso.holder || malso['권리자']),
    amount: cleanText(malso.amount || malso['채권금액'] || malso['채권최고액']),
    _userMalso: true,
  };
}

function manualSpecialRights(manual = {}) {
  return safeArray(manual?.specials)
    .filter((special) => hasAnyValue(special, ['date', 'type', 'holder', 'amount', '접수일자', '권리종류', '권리자', '채권금액']))
    .map((special) => ({
      date: cleanText(special.date || special['접수일자'] || special['접수일']),
      type: cleanText(special.type || special['권리종류']) || '유치권',
      holder: cleanText(special.holder || special['권리자']),
      amount: cleanText(special.amount || special['채권금액'] || special['채권최고액']),
    }));
}

function manualTenantRows(manual = {}) {
  return safeArray(manual?.tenants)
    .map((tenant) => ({
      name: cleanText(tenant?.name || tenant?.['임차인'] || tenant?.['성명']),
      moveIn: cleanText(tenant?.moveIn || tenant?.['전입일'] || tenant?.['전입신고일자']),
      fixed: cleanText(tenant?.fixed || tenant?.['확정일자']),
      deposit: cleanText(tenant?.deposit || tenant?.['보증금'] || tenant?.['임차보증금']),
    }))
    .filter((tenant) => hasAnyValue(tenant, ['name', 'moveIn', 'fixed', 'deposit']));
}

function normalizeAnalyzePayload(input, fallbackRegion = 'other') {
  if (!input || typeof input !== 'object' || !input.raw || typeof input.raw !== 'object') {
    return { raw: input || {}, region: fallbackRegion || 'other' };
  }

  const raw = input.raw || {};
  const manual = input.manual && typeof input.manual === 'object' ? input.manual : {};
  const rights = [...safeArray(raw.rights)];
  const malso = manualMalsoRight(manual);
  if (malso) rights.push(malso);
  rights.push(...manualSpecialRights(manual));

  const manualTenants = manualTenantRows(manual);
  const tenants = manualTenants.length ? manualTenants : safeArray(raw.tenants);

  return {
    raw: {
      ...raw,
      rights,
      tenants,
    },
    region: input.region || fallbackRegion || 'other',
  };
}

function findMalso(rights) {
  const userSelected = rights.find((r) => r._userMalso && r.dateValid);
  if (userSelected) return userSelected;

  const candidates = rights.filter((r) => r.dateValid && MALSO_KEYWORDS.some((k) => r.type.includes(k)));
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.date.localeCompare(b.date));
  return candidates[0];
}

function analyzeRights(rights, malso) {
  const sorted = [...rights].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  return sorted.map((r) => {
    const out = { ...r };
    if (!r.dateValid) {
      out.status = '?';
      out.reason = '접수일자 형식이 올바르지 않아 권리 순위를 판단할 수 없습니다.';
    } else if (ALWAYS_INHERIT.some((k) => r.type.includes(k))) {
      out.status = '인수';
      out.reason = `${r.type}은(는) 경매로 소멸되지 않을 수 있는 특수권리입니다. 원본 서류 확인이 필요합니다.`;
    } else if (!malso) {
      out.status = '?';
      out.reason = '말소기준권리를 확정할 수 없습니다.';
    } else if (r._userMalso || r === malso) {
      out.status = '소멸';
      out.reason = '사용자가 입력한 말소기준권리입니다.';
      out.isMalso = true;
    } else {
      const cmp = compareDate(r.date, malso.date);
      if (cmp === null) {
        out.status = '?';
        out.reason = '날짜 비교가 불가능해 인수·소멸 여부를 판단할 수 없습니다.';
      } else if (cmp < 0) {
        out.status = '인수';
        out.reason = '말소기준보다 선순위로 보입니다. 인수 여부 원본 확인이 필요합니다.';
      } else {
        out.status = '소멸';
        out.reason = '말소기준 이후 권리로 추정됩니다.';
      }
    }
    return out;
  });
}

function analyzeTenants(tenants, malso) {
  return tenants.map((t) => {
    const out = { ...t };
    if (!t.moveIn) {
      out.daehang = '확인필요';
      out.reason = '전입신고일이 없어 대항력 판단이 불가능합니다.';
    } else if (!t.moveInValid) {
      out.daehang = '확인필요';
      out.reason = '전입신고일 형식이 올바르지 않아 대항력 판단이 불가능합니다.';
    } else if (t.fixed && !t.fixedValid) {
      out.daehang = '확인필요';
      out.reason = '확정일자 형식이 올바르지 않아 배당순위 판단이 불안정합니다.';
    } else if (!malso) {
      out.daehang = '?';
      out.reason = '말소기준권리를 확정할 수 없습니다.';
    } else {
      const cmp = compareDate(t.moveIn, malso.date);
      if (cmp === null) {
        out.daehang = '확인필요';
        out.reason = '전입일과 말소기준일 비교가 불가능합니다.';
      } else if (cmp < 0) {
        out.daehang = '있음';
        out.reason = `전입일(${t.moveIn})이 말소기준권리(${malso.date})보다 빠릅니다. 배당에서 보증금 전액을 받지 못하면 매수인 인수 가능성이 있습니다.`;
      } else {
        out.daehang = '없음';
        out.reason = `전입(${t.moveIn}) ≥ 말소기준(${malso.date}) → 대항력 없음으로 추정`;
      }
    }

    if (!t.deposit) {
      out.depositWarning = '보증금이 0원이거나 입력되지 않아 인수금액 계산이 제한됩니다.';
    }
    return out;
  });
}

function simulateBaedang(bidPrice, rights, tenants, region) {
  const safeBid = Math.max(0, Number(bidPrice || 0));
  let remain = safeBid;
  const allocations = [];

  const cost = Math.round(safeBid * 0.03);
  allocations.push({ order: 1, label: '경매집행비용(임의 추정 3%)', amount: cost });
  remain = Math.max(0, remain - cost);

  const [limit, maxAmt] = CHOI_U_SEON[region] || CHOI_U_SEON.other;
  const half = Math.floor(safeBid / 2);
  let choiTotal = 0;
  tenants.forEach((t) => {
    if (t.deposit > 0 && t.deposit <= limit) {
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
  remain = Math.max(0, remain - choiTotal);

  const priority = [];
  rights.forEach((r) => {
    if (r.dateValid && /근저당|저당|전세권|담보가등기/.test(r.type) && r.status === '소멸') {
      priority.push({ kind: 'right', date: r.date, label: `${r.type} (${r.holder})`, amount: r.amount, ref: r });
    }
  });
  tenants.forEach((t) => {
    if (t.deposit > 0 && t.fixed && t.fixedValid && t.moveInValid) {
      const remainDep = Math.max(0, t.deposit - (t._choi || 0));
      if (remainDep > 0) {
        const wuseon = t.fixed > t.moveIn ? t.fixed : t.moveIn;
        priority.push({ kind: 'tenant', date: wuseon, label: `임차인 우선변제 (${t.name || '임차인'})`, amount: remainDep, ref: t });
      }
    }
  });
  priority.sort((a, b) => a.date.localeCompare(b.date));

  priority.forEach((p) => {
    if (remain <= 0) return;
    const pay = Math.max(0, Math.min(p.amount, remain));
    if (!pay) return;
    allocations.push({ order: 3, label: `${p.label} — ${p.date}`, amount: pay });
    p.ref._baedang = Math.max(0, (p.ref._baedang || 0) + pay);
    remain = Math.max(0, remain - pay);
  });

  return { bidPrice: safeBid, allocations, surplus: remain };
}

function calculateInherited(rights, tenants) {
  const items = [];
  let total = 0;
  rights.forEach((r) => {
    if (r.status === '인수') {
      const amount = Math.max(0, Number(r.amount || 0));
      const note = ALWAYS_INHERIT.some((k) => r.type.includes(k)) ? '특수권리 확인 필요' : '선순위 권리 인수 가능성';
      items.push({ label: `${r.type} (${r.holder})`, amount, note });
      total += amount;
    }
  });
  tenants.forEach((t) => {
    if (t.daehang === '있음') {
      const received = Math.max(0, (t._choi || 0) + (t._baedang || 0));
      const unpaid = Math.max(0, t.deposit - received);
      if (unpaid > 0) {
        items.push({
          label: `대항력 임차인 미배당 보증금 추정 (${t.name || '임차인'})`,
          amount: unpaid,
          note: '배당 후 미배당 보증금 추정액입니다. 실제 배당 결과에 따라 보증금 전액 인수 가능성도 확인해야 합니다.',
        });
        total += unpaid;
      }
    }
  });
  return { total: Math.max(0, total), items };
}

function assessRisk(rights, tenants, inherited, minBid, malso) {
  const flags = [];
  let level = 'ok';

  if (!malso) {
    flags.push({ sev: 'warn', msg: '말소기준권리를 확정할 수 없습니다.' });
    level = 'warn';
  }

  const invalidRights = rights.filter((r) => r.date && !r.dateValid);
  if (invalidRights.length) {
    flags.push({ sev: 'warn', msg: `접수일자 형식 확인이 필요한 권리 ${invalidRights.length}건` });
    level = 'warn';
  }

  const invalidTenantDates = tenants.filter((t) => (t.moveIn && !t.moveInValid) || (t.fixed && !t.fixedValid));
  if (invalidTenantDates.length) {
    flags.push({ sev: 'warn', msg: `날짜 형식 확인이 필요한 임차인 ${invalidTenantDates.length}명` });
    level = 'warn';
  }

  const zeroDepositTenants = tenants.filter((t) => !t.deposit);
  if (zeroDepositTenants.length) {
    flags.push({ sev: 'warn', msg: `보증금 확인이 필요한 임차인 ${zeroDepositTenants.length}명` });
    level = 'warn';
  }

  const unknownTenants = tenants.filter((t) => t.daehang === '확인필요' || t.daehang === '?');
  if (unknownTenants.length) {
    flags.push({ sev: 'warn', msg: `대항력 판단 불가 임차인 ${unknownTenants.length}명` });
    level = 'warn';
  }

  const special = rights.filter((r) => ALWAYS_INHERIT.some((k) => r.type.includes(k)));
  if (special.length) {
    flags.push({ sev: 'danger', msg: `특수권리 ${special.length}건 (${special.map((r) => r.type).join(', ')})` });
    level = 'danger';
  }

  const daehang = tenants.filter((t) => t.daehang === '있음');
  if (daehang.length) {
    const depositSum = daehang.reduce((sum, t) => sum + Math.max(0, Number(t.deposit || 0)), 0);
    flags.push({
      sev: depositSum > 0 ? 'danger' : 'warn',
      msg: `대항력 있는 것으로 보이는 임차인 ${daehang.length}명. 배당 부족 시 보증금 인수 가능성이 있습니다.`,
    });
    if (depositSum > 0 || inherited.total > 0) level = 'danger';
    else if (level === 'ok') level = 'warn';
  }

  const safeMinBid = Math.max(0, Number(minBid || 0));
  if (inherited.total > 0 && safeMinBid) {
    const ratio = inherited.total / safeMinBid;
    if (ratio >= 0.3) {
      flags.push({ sev: 'danger', msg: `배당 후 미배당 추정액이 최저가의 ${(ratio * 100).toFixed(0)}%입니다.` });
      level = 'danger';
    } else if (ratio >= 0.05) {
      flags.push({ sev: 'warn', msg: `배당 후 미배당 추정액이 최저가의 ${(ratio * 100).toFixed(0)}%입니다.` });
      if (level === 'ok') level = 'warn';
    }
  }

  if (!flags.length) flags.push({ sev: 'ok', msg: '입력값 기준으로 큰 인수 위험은 보이지 않습니다. 원본 서류 재확인은 필요합니다.' });
  return { level, flags };
}

function recommendBid(appraisal, minBid, inheritedTotal) {
  const safeAppraisal = Math.max(0, Number(appraisal || 0));
  const safeMinBid = Math.max(0, Number(minBid || 0));
  const safeInherited = Math.max(0, Number(inheritedTotal || 0));
  if (!safeAppraisal || !safeMinBid) return null;
  const taxAndOther = safeAppraisal * 0.056;
  const rawUpper = Math.floor(Math.min(safeAppraisal * 0.85, safeAppraisal - safeInherited - taxAndOther));
  const upper = Math.max(safeMinBid, rawUpper, 0);
  return { lower: safeMinBid, upper, base: safeAppraisal };
}

function generateExplanation(rep) {
  const lines = [];
  if (rep.malso) {
    lines.push(
      `<p><b>1. 말소기준권리</b><br>` +
      `${rep.malso.date}에 ${rep.malso.holder || '-'}가 설정한 <b>${rep.malso.type}</b>을 말소기준권리로 보고 분석했습니다. ` +
      `이 날짜 이후의 권리는 소멸되는 것으로 추정하고, 이전 권리는 인수 가능성이 있는 것으로 표시했습니다.</p>`
    );
  } else {
    lines.push(`<p><b>1. 말소기준권리</b><br>말소기준권리를 확정할 수 없어 권리분석 신뢰도가 낮습니다. 등기부상 최선순위 권리를 다시 확인하세요.</p>`);
  }
  const inheritList = rep.rights.filter((r) => r.status === '인수');
  if (inheritList.length) {
    lines.push(
      `<p><b>2. 인수 가능 권리</b><br>` +
      `${inheritList.map((r) => r.type).join(', ')}는 낙찰자 인수 가능성이 있습니다. ` +
      `입력값 기준 인수 추정금액은 ${formatMoney(rep.inherited.total)}입니다.</p>`
    );
  } else {
    lines.push(`<p><b>2. 인수 권리</b><br>입력값 기준으로는 낙찰자가 인수할 선순위 권리가 뚜렷하게 보이지 않습니다.</p>`);
  }
  if (rep.tenants.length) {
    const daehang = rep.tenants.filter((t) => t.daehang === '있음');
    if (daehang.length) {
      const depositSum = daehang.reduce((sum, t) => sum + Math.max(0, Number(t.deposit || 0)), 0);
      lines.push(
        `<p><b>3. 임차인</b><br>${daehang.length}명이 대항력 있는 임차인으로 추정됩니다. ` +
        `입력 보증금 합계는 ${formatMoney(depositSum)}이며, 배당에서 보증금 전액을 받지 못하면 미배당 잔액이 매수인에게 인수될 수 있습니다.</p>`
      );
    } else {
      lines.push(`<p><b>3. 임차인</b><br>입력값 기준으로는 후순위 임차인으로 보입니다. 전입일·확정일자·배당요구 여부를 원본에서 재확인하세요.</p>`);
    }
  }
  const total = {
    ok: '입력값 기준으로 큰 인수 위험은 보이지 않습니다. 다만 원본 서류와 등기부 확인은 필수입니다.',
    warn: `인수 추정금액 ${formatMoney(rep.inherited.total)}을 실질 투자비에 반영해 판단하세요.`,
    danger: `대항력 임차인 또는 인수 가능 권리가 있습니다. 표시된 인수 추정금액은 배당 후 미배당액 기준의 1차 추정이며, 실제 배당 결과에 따라 보증금 전액 인수 가능성까지 확인해야 합니다.`,
  }[rep.risk.level] || '원본 서류 재확인이 필요합니다.';
  lines.push(`<p><b>4. 총평 · ${rep.risk.level.toUpperCase()}</b><br>${total}</p>`);
  return lines.join('');
}

function analyzeCase(raw, region = 'other') {
  const normalized = normalizeAnalyzePayload(raw, region);
  const safeRaw = normalized.raw || {};
  const effectiveRegion = normalized.region || region || 'other';
  const rights = normalizeRights(safeRaw.rights);
  const tenantsRaw = normalizeTenants(safeRaw.tenants);
  const malso = findMalso(rights);
  const analyzedRights = analyzeRights(rights, malso);
  const tenants = analyzeTenants(tenantsRaw, malso);

  const basic = safeRaw.basic || {};
  const minBid = parseMoney(basic['최저매각가격'] || basic['최저가']);
  const appraisal = parseMoney(basic['감정평가액'] || basic['감정가']);

  const baedang = simulateBaedang(minBid || appraisal || 100_000_000, analyzedRights, tenants, effectiveRegion);
  const inherited = calculateInherited(analyzedRights, tenants);
  const risk = assessRisk(analyzedRights, tenants, inherited, minBid, malso);
  const bidRec = recommendBid(appraisal, minBid, inherited.total);

  const pre = {
    case: safeRaw.caseNo,
    court: safeRaw.court,
    basic,
    malso,
    rights: analyzedRights,
    tenants,
    baedang,
    inherited,
    risk,
    bidRec,
    url: safeRaw.url,
  };
  return { ...pre, explanation: generateExplanation(pre) };
}

module.exports = { analyzeCase, formatMoney };
