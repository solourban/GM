const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function fail(message) {
  throw new Error(`innerHTML escape guard failed: ${message}`);
}

function requireIncludes(source, needle, label) {
  if (!source.includes(needle)) fail(`${label} missing`);
}

function forbid(source, pattern, label) {
  if (pattern.test(source)) fail(`${label} should not be present`);
}

function scriptRefsFromIndex() {
  return [...read('public/index.html').matchAll(/<script\s+src="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((src) => src.startsWith('/app-v2-'))
    .map((src) => `public${src}`);
}

const loadedScripts = scriptRefsFromIndex();
if (!loadedScripts.includes('public/app-v2-core.js')) fail('loaded app-v2 scripts were not parsed from index.html');

loadedScripts.forEach((file) => {
  const source = read(file);
  forbid(source, /\beval\s*\(/, `${file} eval`);
  forbid(source, /\bnew\s+Function\s*\(/, `${file} new Function`);
  forbid(source, /document\.write\s*\(/, `${file} document.write`);
});

const validate = read('public/app-v2-validate.js');
[
  'function esc(value)',
  'messages.map((msg) => `<div>• ${esc(msg)}</div>`).join',
  'warnings.map((msg) => `<li>${esc(msg)}</li>`).join',
  '<p>${esc(message)}</p>',
].forEach((needle) => requireIncludes(validate, needle, `validate ${needle}`));

const allocation = read('public/app-v2-allocation.js');
[
  'function esc(value)',
  '${esc(item.order || \'\')}',
  '${esc(item.label || \'-\')}',
  '${esc(item.note || \'-\')}',
  '${esc(tenant.name || \'임차인\')}',
  '${esc(tenant.moveIn || \'-\')}',
  '${esc(report?.malso?.date || \'-\')}',
].forEach((needle) => requireIncludes(allocation, needle, `allocation ${needle}`));

const riskBrief = read('public/app-v2-risk-brief.js');
[
  'function esc(value)',
  '${esc(riskLabel(level))}',
  '${esc(money(inheritedTotal))}',
  '${esc(money(practicalBurden))}',
  '${esc(actionLevel(report))}',
  'reasons.map((reason) => `<li>${esc(reason)}</li>`).join',
].forEach((needle) => requireIncludes(riskBrief, needle, `risk brief ${needle}`));

const onbid = read('public/app-v2-onbid-entry.js');
[
  'function esc(value)',
  'data-cltr-mng-no="${esc(row.cltrMngNo)}"',
  'data-pbct-cdtn-no="${esc(row.pbctNo)}"',
  'data-copy-text="${esc(row.cltrMngNo)}"',
  '<h4>${esc(row.name || \'물건명 확인 필요\')}</h4>',
  '<p class="v2-note">${esc(row.address || \'소재지 확인 필요\')}</p>',
  '<h3>${esc(row.name || \'공매 물건 상세\')}</h3>',
  'rawEntries.map(([key, value]) => `<tr><td>${esc(key)}</td><td>${esc(value)}</td></tr>`).join',
].forEach((needle) => requireIncludes(onbid, needle, `onbid ${needle}`));

const bidPlan = read('public/app-v2-bid-plan.js');
[
  'function esc(value)',
  'data-bid-plan-field="${esc(key)}"',
  'placeholder="${esc(placeholder)}"',
  'setText(card,',
  'input.addEventListener(\'input\', () => updateCalculated(card, report))',
].forEach((needle) => requireIncludes(bidPlan, needle, `bid plan ${needle}`));

const location = read('public/app-v2-location.js');
[
  'function esc(value)',
  'function renderAttemptText(attempt)',
  'attempts.map((attempt) => esc(renderAttemptText(attempt))).join',
  'data-x="${esc(point.x)}"',
  'data-y="${esc(point.y)}"',
  'data-title="${esc(title)}"',
  'href="${esc(kakaoMapUrl)}"',
  'href="${esc(kakaoSearchUrl)}"',
].forEach((needle) => requireIncludes(location, needle, `location ${needle}`));

const specExtractor = read('public/app-v2-spec-extractor.js');
[
  'const esc = (value)',
  'evidence.map((item) => `<blockquote>${esc(item.text || \'\')}</blockquote>`).join',
  'issues.map((issue) => `<span>${esc(issueLabel(issue))}</span>`).join',
  '<textarea id="${SOURCE_ID}" class="v2-spec-source" placeholder="매각물건명세서 원문을 붙여넣으세요.">${esc(activeDraft.rawText)}</textarea>',
].forEach((needle) => requireIncludes(specExtractor, needle, `spec extractor ${needle}`));

const externalChecklist = read('public/app-v2-external-checklist.js');
[
  'const esc = (value)',
  'data-external-item="${esc(item.id)}"',
  'data-external-check="${esc(item.id)}"',
  'aria-label="${esc(item.title)} 확인"',
  '<span>${esc(item.title)}</span>',
  '<p>${esc(item.guide)}<span>${esc(item.source)}</span></p>',
  'data-external-memo="${esc(item.id)}"',
  'value="${esc(data.memos?.[item.id] || \'\')}"',
].forEach((needle) => requireIncludes(externalChecklist, needle, `external checklist ${needle}`));

const bulk = read('public/app-v2-bulk-tab.js');
[
  'const esc = (value)',
  '<textarea id="v2BulkCases" rows="7"',
  '>${esc(state.inputText)}</textarea>',
  'data-court="${esc(row.court)}"',
  'data-year="${esc(row.year)}"',
  'data-serial="${esc(row.serial)}"',
  '${state.message ? `<div class="v2-form-message show warn">${esc(state.message)}</div>` : \'\'}',
].forEach((needle) => requireIncludes(bulk, needle, `bulk ${needle}`));

const essentialDocs = read('public/app-v2-essential-documents.js');
[
  'function esc(value)',
  '${esc(info.court || \'확인 필요\')}',
  '${esc(info.caseNo || \'확인 필요\')}',
  'data-document-kind="${esc(doc.id)}"',
  'doc.checks.map((item) => `<li>${esc(item)}</li>`).join',
  'status.textContent = message || \'\'',
].forEach((needle) => requireIncludes(essentialDocs, needle, `essential documents ${needle}`));

const serviceStatus = read('public/app-v2-service-status.js');
[
  'function esc(value)',
  '${esc(message)}',
  '${missing.map((item) => `<li><b>${esc(item.env)}</b> 추가 필요 · ${esc(item.note)}</li>`).join',
  "info('서비스 버전', esc(clean(health?.version || '-')))",
  "info('요청ID', esc(requestId || '-'))",
].forEach((needle) => requireIncludes(serviceStatus, needle, `service status ${needle}`));

console.log(`InnerHTML escape guard passed. Checked ${loadedScripts.length} loaded v2 scripts.`);
