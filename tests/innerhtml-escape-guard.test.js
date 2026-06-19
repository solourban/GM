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
    .map((src) => src.split('?')[0])
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

const core = read('public/app-v2-core.js');
[
  'const esc = (v)',
  'select.innerHTML = courts.map((name) => `<option>${esc(name)}</option>`).join',
  'if (parts.length <= 1 && !building) return esc(s);',
  'parts.slice(1).map((p) => `<span class="sub">${esc(p)}</span>`).join',
  'root.innerHTML = `<div class="v2-result-card v2-error"><h3>조회 실패</h3><p>${esc(state.error)}</p></div>`',
  '<p>${esc(state.error)}</p><p class="v2-note">아래에는 마지막 성공 결과를 유지했습니다.</p>',
  '<p>${esc(state.analyzeError)}</p><p class="v2-note">Step 2 입력값은 유지됩니다.</p>',
  'value="${esc(getManual(path))}" placeholder="${esc(placeholder)}" data-manual-path="${esc(path)}"',
  'items.map((x) => `<li>${esc(x)}</li>`).join',
  '<td>${esc(t.reason || \'-\')}</td>',
  '<td>${esc(r.reason || \'-\')}</td>',
].forEach((needle) => requireIncludes(core, needle, `core ${needle}`));

const date = read('public/app-v2-date.js');
[
  'function esc(value)',
  'value="${esc(value)}" ${active ? \'selected\' : \'\'}>${esc(label)}</option>',
  '<li>${esc(selectedComparisonText(avgMinBid))}</li>',
  'data-date-search-case="${esc(item.caseNo || \'\')}"',
  '${esc(Array.isArray(item.reasons) ? item.reasons.join(\', \') : \'\')}',
  '<div id="dateMessageV2" class="${messageClass}">${esc(state.message)}</div>',
  'root.innerHTML = renderResultsArea()',
].forEach((needle) => requireIncludes(date, needle, `date ${needle}`));

const dateCourts = read('public/app-v2-date-courts.js');
[
  'function esc(value)',
  'return `<option value="${esc(value)}" ${active ? \'selected\' : \'\'}>${esc(label)}</option>`',
  'if (shouldRefreshOptions(current)) current.innerHTML = optionHtml(selected)',
  'select.innerHTML = optionHtml(selected)',
].forEach((needle) => requireIncludes(dateCourts, needle, `date courts ${needle}`));

const savedTab = read('public/app-v2-saved-tab.js');
[
  'const esc = (value)',
  '${esc(propertyTypes()?.usageOf(item) || item.usage || \'-\')}',
  '${esc(item.minBid || formatWon(item.minBid))}',
  '${esc(decision(item, score))}',
  'data-case-no="${esc(item.caseNo || \'\')}"',
  'root.innerHTML = items.length ? renderSaved(items) : renderEmpty()',
].forEach((needle) => requireIncludes(savedTab, needle, `saved tab ${needle}`));

const dateSource = read('public/app-v2-date-source.js');
[
  'function esc(value)',
  'issues.push(`매각기일이 다릅니다. 후보 ${esc(candidate.saleDate)} / 조회 ${esc(fetched.saleDate)}`)',
  '<p class="v2-note">${esc(result.text)}</p>',
  '<textarea id="v2DateCandidateMemo"',
  '>${esc(memo)}</textarea>',
  '<span class="v2-badge">${esc(label)}</span>',
  '<h3>${esc(candidate.caseNo || \'사건번호 미확인\')}</h3>',
  '${esc(candidate.reason || \'후보 사유 없음\')}',
  'status.textContent = memo.value.trim() ?',
].forEach((needle) => requireIncludes(dateSource, needle, `date source ${needle}`));

const candidateStack = read('public/app-v2-candidate-stack.js');
[
  'function esc(value)',
  '${esc(lowestMinBid?.item?.caseNo || \'-\')}',
  'top.map(({ item, score, decision }) => `<li>${esc(item.caseNo || \'-\')} · 점수 ${score} · ${esc(decision)}</li>`).join',
  '<td>${esc(item.caseNo || \'-\')}</td>',
  '<td>${esc(memo || \'-\')}</td>',
  'data-search-candidate="${esc(item.caseNo || \'\')}"',
  'data-save-candidate="${esc(item.caseNo || \'\')}"',
  'data-remove-candidate="${esc(item.caseNo || \'\')}"',
].forEach((needle) => requireIncludes(candidateStack, needle, `candidate stack ${needle}`));

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

const displayFix = read('public/app-v2-display-fix.js');
[
  'const esc = (value)',
  '${esc(riskLabel(level))}',
  '${esc(money(minBid))}',
  '${esc(money(practicalBurden))}',
  '${esc(`입력 임차인 ${tenants}명, 인수 가능 항목 ${inheritedItems}건 기준입니다.`)}',
  '${esc(decisionMessage(report, inheritedTotal, minBid))}',
  '${esc(percent(upperRate))}',
  '${esc(bidRangeMessage(report, lower, upper, base, inheritedTotal))}',
  '${esc(`입찰보증금률은 현재 ${bidDepositRate}% 기준으로 계산했습니다.`)}',
  '${esc(fundingMessage(report, minTotal, upperTotal))}',
  'items.map((item) => `<li>□ ${esc(item)}</li>`).join',
].forEach((needle) => requireIncludes(displayFix, needle, `display fix ${needle}`));

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

const resultPolish = read('public/app-v2-result-polish.js');
[
  'const esc = (value)',
  '<div class="v2-info ${extra}"><div class="k">${esc(label)}</div><div class="v">${esc(clean(value) || \'-\')}</div></div>',
  "${info('기본정보 매각기일', saleDate)}",
  "${info('최저매각가격', basic['최저매각가격'])}",
  "${info('조회 상태', raw.status === 'ok' ? '정상 수집' : clean(raw.status || '-'))}",
].forEach((needle) => requireIncludes(resultPolish, needle, `result polish ${needle}`));

const workflowShell = read('public/app-v2-workflow-shell.js');
[
  'function esc(value)',
  '<h3>${esc(copy.title)}</h3>',
  '<p class="v2-note">${esc(copy.note)}</p>',
  'const classAttr = item.className ? ` class="${esc(item.className)}"` : \'\'',
  '<div${classAttr} title="${esc(value)}"><span>${esc(item.label)}</span><strong>${esc(value)}</strong></div>',
  'data-workflow-step="${esc(step.id)}"',
  '>${esc(step.label)}</button>',
].forEach((needle) => requireIncludes(workflowShell, needle, `workflow shell ${needle}`));

const molit = read('public/app-v2-molit-trades.js');
[
  'function esc(value)',
  'function info(k, v, extra = \'\')',
  '${esc(reason)}',
  '${esc(message)}',
  '<td>${esc(trade.tradeTypeLabel || trade.tradeType || \'-\')}</td>',
  '<td>${esc(trade.aptName || \'-\')}</td>',
  'return types.map((t) => `${esc(t.label || t.type || \'-\')}: ${Number(t.filteredCount || 0)}건`).join',
  "info('유형별 결과', renderTypeSummary(result.data?.tradeTypes), 'wide')",
].forEach((needle) => requireIncludes(molit, needle, `molit ${needle}`));

const confidence = read('public/app-v2-confidence.js');
[
  'function esc(value)',
  'return `<div class="v2-info"><div class="k">${esc(item.label)}</div>',
  '${esc(snapshot.label)} · ${esc(`${snapshot.ratio}%`)}',
  '${esc(snapshot.message)}',
  '${esc(snapshot.tradeScope)}',
  '${esc(missingText)}',
].forEach((needle) => requireIncludes(confidence, needle, `confidence ${needle}`));

const caseSync = read('public/app-v2-case-sync-status.js');
[
  'function esc(value)',
  'function info(label, value)',
  '${esc(value)}',
  '${esc(data.label)}',
  '${esc(data.message)}',
  "info('현재 사건 key', shortKey(data.key))",
  "statusInfo('입지 임시값', data.hasLocation)",
].forEach((needle) => requireIncludes(caseSync, needle, `case sync ${needle}`));

const copySummary = read('public/app-v2-copy-summary.js');
[
  'const area = document.createElement(\'textarea\')',
  'area.value = text',
  'await copyText(buildSummaryText(report))',
  "status.textContent = '복사되었습니다.'",
  "status.textContent = '복사에 실패했습니다. 브라우저 권한을 확인해주세요.'",
].forEach((needle) => requireIncludes(copySummary, needle, `copy summary ${needle}`));

const finalJudgment = read('public/app-v2-final-judgment.js');
[
  'function esc(value)',
  '${esc(decision.label)}',
  '${esc(decision.text)}',
  '${esc(snapshot.nearbySummary)}',
  '${esc(snapshot.tradeScopeNote)}',
  'snapshot.reasons.map((item) => `<li>${esc(item)}</li>`).join',
  'snapshot.nextChecks.map((item) => `<li>${esc(item)}</li>`).join',
  'if (existing) existing.outerHTML = html',
].forEach((needle) => requireIncludes(finalJudgment, needle, `final judgment ${needle}`));

const finalCopy = read('public/app-v2-final-copy-bridge.js');
[
  'function esc(value)',
  '${esc(copyState.status)}',
  'data-summary-signature="${esc(summarySignature(summary))}"',
  '<textarea id="${TEXTAREA_ID}" readonly',
  '>${esc(summary)}</textarea>',
  'existing.textContent = message',
  'temp.value = summary',
].forEach((needle) => requireIncludes(finalCopy, needle, `final copy ${needle}`));

console.log(`InnerHTML escape guard passed. Checked ${loadedScripts.length} loaded v2 scripts.`);
