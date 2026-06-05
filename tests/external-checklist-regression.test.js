const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
const script = fs.readFileSync(path.join(ROOT, 'public', 'app-v2-external-checklist.js'), 'utf8');

const required = [
  [index, '<script src="/app-v2-external-checklist.js"></script>', 'script include'],
  [pkg, 'node --check public/app-v2-external-checklist.js', 'syntax check'],
  [script, 'v2ExternalVerificationCard', 'external checklist card id'],
  [script, 'data-external-count', 'live count marker'],
  [script, 'data-external-status', 'live status marker'],
  [script, 'updateCardStatus', 'status-only update function'],
  [script, 'function renderChecklistRows', 'compact row renderer'],
  [script, 'v2-external-row', 'external row class'],
  [script, 'data-external-item', 'external row marker'],
  [script, "document.getElementById('v2EssentialDocumentsCard')", 'risk-step anchor after essential documents'],
  [script, "card.className = 'v2-result-card v2-external-checklist-card'", 'result-card class'],
  [script, "card.dataset.workflowStep = 'risk'", 'risk workflow step marker'],
  [script, 'removeFinalJudgmentStatus', 'final judgment detach cleanup'],
  [script, 'card.dataset.caseKey !== caseKey(currentReport)', 'case change rerender guard'],
  [script, 'if (!target) return;', 'temporary anchor absence preservation'],
  [script, 'scheduleUpsert', 'targeted upsert scheduler'],
  [script, 'MutationObserver', 'result rerender observer'],
  [script, 'isUserScrolling', 'active scroll guard'],
  [script, 'auction:result-card-change', 'targeted order notification'],
  [script, 'saveChecklist(data, currentReport)', 'case scoped localStorage save'],
  [script, 'document.addEventListener(\'change\'', 'change listener'],
  [script, 'document.addEventListener(\'input\'', 'input listener'],
  [script, 'window.__auctionExternalChecklist', 'public bridge'],
];

const forbidden = [
  [script, 'outerHTML', 'full card outerHTML replacement'],
  [script, 'setInterval(upsertCard, 1200)', 'blind full rerender interval'],
  [script, 'setInterval(', 'periodic checklist upsert'],
  [script, '!currentReport || !target', 'temporary anchor removal branch'],
  [script, 'injectFinalJudgmentStatus', 'final judgment card injection'],
  [script, 'v2ExternalVerificationFinalStatus\');\n      box.className', 'final judgment injected info box'],
  [script, 'v2-detail-table-wrap', 'dense table checklist layout'],
];

const missing = required.filter(([source, needle]) => !source.includes(needle)).map(([, , label]) => label);
const presentForbidden = forbidden.filter(([source, needle]) => source.includes(needle)).map(([, , label]) => label);

if (missing.length || presentForbidden.length) {
  const parts = [];
  if (missing.length) parts.push(`missing: ${missing.join(', ')}`);
  if (presentForbidden.length) parts.push(`forbidden: ${presentForbidden.join(', ')}`);
  throw new Error(`External checklist regression guard failed: ${parts.join(' / ')}`);
}

console.log('External checklist regression guard passed.');
