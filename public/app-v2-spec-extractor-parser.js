(() => {
  const MAX_TEXT_LENGTH = 100_000;
  const EMPTY_VALUES = Object.freeze({
    tenantName: '',
    occupantName: '',
    moveIn: '',
    fixed: '',
    claimDate: '',
    deposit: '',
    rent: '',
    occupiedPart: '',
  });
  const OCCUPANT_LABELS = Object.freeze([
    { key: 'tenantName', pattern: '임차인(?:명)?' },
    { key: 'occupantName', pattern: '점유자(?:명)?' },
    { key: 'moveIn', pattern: '전입일(?:자)?' },
    { key: 'fixed', pattern: '확정일자' },
    { key: 'claimDate', pattern: '배당요구일(?:자)?' },
    { key: 'deposit', pattern: '보증금' },
    { key: 'rent', pattern: '차임|월세' },
    { key: 'occupiedPart', pattern: '점유부분' },
  ]);
  const SPECIAL_RIGHT_TYPES = Object.freeze([
    '유치권',
    '법정지상권',
    '분묘기지권',
    '예고등기',
    '가처분',
    '가압류',
  ]);
  const SPECIAL_LABEL_PATTERN = [
    '권리자',
    '신고인',
    '채권자',
    '주장자',
    '신고일',
    '접수일자?',
    '금액',
    '채권금액',
    '채권최고액',
  ].join('|');
  const UNKNOWN_PATTERN = /^(?:없음|해당\s*없음|해당없음|미상|불명|-+)$/;
  const DATE_FIELDS = new Set(['moveIn', 'fixed', 'claimDate']);
  const MONEY_FIELDS = new Set(['deposit', 'rent']);
  const IDENTITY_FIELDS = new Set(['tenantName', 'occupantName']);

  function stableHash(value) {
    const text = String(value ?? '');
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function normalizeDate(value) {
    const text = String(value ?? '').trim();
    if (!text || UNKNOWN_PATTERN.test(text)) return '';
    const match = text.match(/(?:^|\D)(\d{4})[.\-/]?\s*(\d{1,2})[.\-/]?\s*(\d{1,2})(?:\D|$)/);
    if (!match) return '';
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year
      || date.getUTCMonth() + 1 !== month
      || date.getUTCDate() !== day
    ) return '';
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function normalizeMoney(value) {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (!text || UNKNOWN_PATTERN.test(text)) return '';
    const factors = {
      억: 100_000_000,
      천만: 10_000_000,
      백만: 1_000_000,
      십만: 100_000,
      만: 10_000,
      천: 1_000,
      백: 100,
      십: 10,
    };
    const matches = [...text.matchAll(/([\d,]+(?:\.\d+)?)\s*(천만|백만|십만|억|만|천|백|십)?\s*(원)?/g)]
      .filter((match) => match[0].trim());
    if (!matches.length) return '';
    let total = 0;
    let found = false;
    matches.forEach((match) => {
      const number = Number(match[1].replace(/,/g, ''));
      if (!Number.isFinite(number)) return;
      const factor = factors[match[2]] || 1;
      total += number * factor;
      found = true;
    });
    return found ? Math.round(total) : '';
  }

  function classifyTakeoverPhrase(value) {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    if (
      /매수인(?:이|에게)?\s*인수할\s*권리(?:는|가)?\s*없음/.test(text)
      || /인수(?:되는|하는|할)?\s*권리(?:는|가)?\s*없음/.test(text)
      || /인수(?:사항)?\s*없음/.test(text)
      || /인수하지\s*않음/.test(text)
    ) return 'no_takeover';
    if (
      /매수인(?:이|에게)?[^.\n]{0,40}(?:부담|인수)/.test(text)
      || /인수(?:될|되는|할)\s*수\s*있음/.test(text)
      || /인수(?:됨|한다|하여야)/.test(text)
      || /보증금[^.\n]{0,30}반환/.test(text)
    ) return 'possible_takeover';
    if (/인수|매수인|보증금[^.\n]{0,30}반환|대항력/.test(text)) return 'ambiguous';
    return '';
  }

  function splitLines(rawText) {
    const lines = [];
    let start = 0;
    let index = 0;
    while (index < rawText.length) {
      const character = rawText[index];
      if (character !== '\n' && character !== '\r') {
        index += 1;
        continue;
      }
      lines.push({ text: rawText.slice(start, index), start, end: index });
      if (character === '\r' && rawText[index + 1] === '\n') index += 1;
      index += 1;
      start = index;
    }
    lines.push({ text: rawText.slice(start), start, end: rawText.length });
    return lines;
  }

  function trimRange(text, start, end) {
    let rangeStart = start;
    let rangeEnd = end;
    while (rangeStart < rangeEnd && /[\s|,;]/.test(text[rangeStart])) rangeStart += 1;
    while (rangeEnd > rangeStart && /[\s|,;]/.test(text[rangeEnd - 1])) rangeEnd -= 1;
    return { start: rangeStart, end: rangeEnd };
  }

  function evidenceForRange(line, rangeStart, rangeEnd, label) {
    const range = trimRange(line.text, rangeStart, rangeEnd);
    return {
      start: line.start + range.start,
      end: line.start + range.end,
      label,
      text: line.text.slice(range.start, range.end),
    };
  }

  function lineEvidence(line, label) {
    return evidenceForRange(line, 0, line.text.length, label);
  }

  function occupantFields(line) {
    const labelPattern = OCCUPANT_LABELS.map(({ pattern }) => pattern).join('|');
    const matcher = new RegExp(`(${labelPattern})(?=\\s*[:：]|\\s+)\\s*[:：]?\\s*`, 'g');
    const matches = [...line.text.matchAll(matcher)];
    return matches.map((match, index) => {
      const definition = OCCUPANT_LABELS.find(({ pattern }) => new RegExp(`^(?:${pattern})$`).test(match[1]));
      const valueStart = match.index + match[0].length;
      const valueEnd = matches[index + 1]?.index ?? line.text.length;
      const valueRange = trimRange(line.text, valueStart, valueEnd);
      const evidenceEnd = matches[index + 1]?.index ?? line.text.length;
      return {
        key: definition.key,
        rawValue: line.text.slice(valueRange.start, valueRange.end),
        evidence: evidenceForRange(line, match.index, evidenceEnd, match[1]),
      };
    });
  }

  function normalizeOccupantValue(key, rawValue) {
    const text = String(rawValue ?? '').replace(/\s+/g, ' ').trim();
    if (!text || UNKNOWN_PATTERN.test(text)) return '';
    if (DATE_FIELDS.has(key)) return normalizeDate(text);
    if (MONEY_FIELDS.has(key)) return normalizeMoney(text);
    return text;
  }

  function newOccupantCandidate() {
    return {
      values: { ...EMPTY_VALUES },
      confidence: {},
      evidence: [],
      issues: [],
    };
  }

  function addOccupantFields(candidate, fields) {
    fields.forEach(({ key, rawValue, evidence }) => {
      const normalized = normalizeOccupantValue(key, rawValue);
      if (normalized === '') {
        if (rawValue) candidate.issues.push(`unresolved_${key}`);
        return;
      }
      if (candidate.values[key] !== '' && candidate.values[key] !== normalized) {
        candidate.issues.push(`conflicting_${key}`);
        return;
      }
      candidate.values[key] = normalized;
      candidate.confidence[key] = 'explicit';
      candidate.evidence.push(evidence);
    });
  }

  function finalizeOccupant(candidate) {
    if (!candidate) return null;
    const hasValue = Object.values(candidate.values).some((value) => value !== '');
    if (!hasValue) return null;
    const identity = JSON.stringify(candidate.values);
    return {
      id: `occupant-${stableHash(identity)}`,
      values: candidate.values,
      confidence: candidate.confidence,
      evidence: candidate.evidence,
      issues: [...new Set(candidate.issues)],
    };
  }

  function extractOccupants(lines) {
    const candidates = [];
    let current = null;
    const flush = () => {
      const candidate = finalizeOccupant(current);
      if (candidate) candidates.push(candidate);
      current = null;
    };

    lines.forEach((line) => {
      const fields = occupantFields(line);
      if (!fields.length) {
        flush();
        return;
      }
      const hasIdentity = fields.some(({ key }) => IDENTITY_FIELDS.has(key));
      if (hasIdentity) {
        flush();
        current = newOccupantCandidate();
      }
      if (!current) return;
      addOccupantFields(current, fields);
    });
    flush();
    return candidates;
  }

  function extractSpecialValue(lineText, labels) {
    const labelPattern = labels.join('|');
    const matcher = new RegExp(`(?:${labelPattern})(?=\\s*[:：]|\\s+)\\s*[:：]?\\s*(.*?)(?=\\s*(?:\\||${SPECIAL_LABEL_PATTERN})\\s*[:：]?|$)`);
    return matcher.exec(lineText)?.[1]?.trim() || '';
  }

  function extractSpecialRights(lines) {
    const candidates = [];
    lines.forEach((line) => {
      const phrase = line.text.replace(/\s+/g, ' ').trim();
      if (!phrase) return;
      SPECIAL_RIGHT_TYPES.filter((type) => phrase.includes(type)).forEach((typeCandidate) => {
        const rawDate = extractSpecialValue(line.text, ['신고일', '접수일자?']);
        const rawAmount = extractSpecialValue(line.text, ['채권최고액', '채권금액', '금액']);
        const holder = extractSpecialValue(line.text, ['권리자', '신고인', '채권자', '주장자']);
        const date = normalizeDate(rawDate);
        const amount = normalizeMoney(rawAmount);
        const issues = [];
        if (rawDate && !date) issues.push('unresolved_date');
        if (rawAmount && amount === '') issues.push('unresolved_amount');
        const identity = JSON.stringify({ typeCandidate, holder, date, amount, phrase });
        candidates.push({
          id: `special-${stableHash(identity)}`,
          typeCandidate,
          holder,
          date,
          amount,
          phrase,
          evidence: [lineEvidence(line, typeCandidate)],
          issues,
        });
      });
    });
    return candidates;
  }

  function extractTakeoverPhrases(lines) {
    const candidates = [];
    lines.forEach((line) => {
      const phrase = line.text.replace(/\s+/g, ' ').trim();
      const kind = classifyTakeoverPhrase(phrase);
      if (!kind) return;
      candidates.push({
        id: `takeover-${stableHash(`${kind}:${phrase}`)}`,
        kind,
        phrase,
        evidence: [lineEvidence(line, kind)],
      });
    });
    return candidates;
  }

  function dedupe(candidates, warningCode, warnings) {
    const unique = [];
    const ids = new Set();
    let removed = 0;
    candidates.forEach((candidate) => {
      if (ids.has(candidate.id)) {
        removed += 1;
        return;
      }
      ids.add(candidate.id);
      unique.push(candidate);
    });
    if (removed) warnings.push({ code: warningCode, count: removed });
    return unique;
  }

  function emptyResult(rawText, warning, rejected) {
    return {
      version: 1,
      rawHash: stableHash(rawText),
      candidates: {
        occupants: [],
        specialRights: [],
        takeoverPhrases: [],
      },
      warnings: warning ? [warning] : [],
      stats: {
        characterCount: rawText.length,
        lineCount: rawText ? splitLines(rawText).length : 0,
        occupantCount: 0,
        specialRightCount: 0,
        takeoverPhraseCount: 0,
        rejected,
      },
    };
  }

  function parse(value) {
    const rawText = String(value ?? '');
    if (!rawText.trim()) return emptyResult(rawText, { code: 'empty_text' }, false);
    if (rawText.length > MAX_TEXT_LENGTH) {
      return emptyResult(rawText, {
        code: 'text_too_long',
        limit: MAX_TEXT_LENGTH,
        actual: rawText.length,
      }, true);
    }

    const lines = splitLines(rawText);
    const warnings = [];
    const occupants = dedupe(extractOccupants(lines), 'duplicate_occupant_removed', warnings);
    const specialRights = dedupe(extractSpecialRights(lines), 'duplicate_special_right_removed', warnings);
    const takeoverPhrases = dedupe(extractTakeoverPhrases(lines), 'duplicate_takeover_phrase_removed', warnings);

    return {
      version: 1,
      rawHash: stableHash(rawText),
      candidates: {
        occupants,
        specialRights,
        takeoverPhrases,
      },
      warnings,
      stats: {
        characterCount: rawText.length,
        lineCount: lines.length,
        occupantCount: occupants.length,
        specialRightCount: specialRights.length,
        takeoverPhraseCount: takeoverPhrases.length,
        rejected: false,
      },
    };
  }

  window.__auctionSpecParser = Object.freeze({
    MAX_TEXT_LENGTH,
    parse,
    normalizeDate,
    normalizeMoney,
    classifyTakeoverPhrase,
  });
})();
