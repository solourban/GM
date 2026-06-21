const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const core = read('public/app-v2-core.js');
const date = read('public/app-v2-date.js');
const dateSource = read('public/app-v2-date-source.js');
const bulk = read('public/app-v2-bulk-tab.js');
const saved = read('public/app-v2-saved-tab.js');
const stack = read('public/app-v2-candidate-stack.js');
const scopeGuard = read('public/app-v2-tab-scope-guard.js');
const onbid = read('public/app-v2-onbid-entry.js');

assert(
  core.includes('function ensureTabResultsSection()') && core.includes('v2TabResultsSection'),
  'core must create a shared tab results section below the hero'
);
assert(
  core.includes('function syncTabResultsVisibility()') && core.includes('tabResultsRoot: ensureTabResultsSection'),
  'core must expose and sync the shared tab results outlet'
);
assert(
  core.includes('data-panel="bulk"') && core.includes('data-panel="date"') && core.includes('data-panel="saved"'),
  'home panels must keep stable data-panel markers'
);

assert(
  date.includes('function resultRoot()') && date.includes('v2DateEmptyStateCard') && date.includes('아직 조회된 후보가 없습니다'),
  'date tab must render a below-hero empty state through the shared result root'
);
assert(
  date.includes('root.innerHTML = renderResultsArea()') && date.includes('id="v2DateResultCard"'),
  'date results must be written to the shared tab results outlet'
);
assert(
  date.includes('function renderMobileCards(items)') && date.includes('v2-date-card-list') && date.includes('v2-date-table-wrap'),
  'date results must provide mobile cards instead of relying only on a wide table'
);
assert(
  core.includes('.v2-date-card-list,.v2-mobile-card-list{display:grid') && core.includes('.v2-date-table-wrap,.v2-bulk-table-wrap,.v2-saved-table-wrap,.v2-onbid-table-wrap{display:none}'),
  'mobile date result layout must hide the wide table and show card rows'
);
assert(
  core.includes('.site-header{padding:6px 0;overflow:visible}')
    && core.includes('.header-inner{width:100%;gap:8px;padding:0 12px;max-width:100%;min-width:0;overflow:visible;align-items:stretch}')
    && core.includes('.v2-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:100%;min-width:0;max-width:100%;gap:5px;align-items:stretch;overflow:visible;padding:3px}')
    && core.includes('.v2-tab{width:100%;min-width:0;max-width:100%;min-height:34px;'),
  'mobile sticky header must stay compact without clipping tab rows'
);
assert(
  dateSource.includes('function resultRoot()') && dateSource.includes("root.insertAdjacentHTML('afterbegin', renderCard(candidate))"),
  'selected date candidate source card must render below the search hero'
);
assert(
  !dateSource.includes("searchCard.insertAdjacentHTML('afterend', renderCard(candidate))"),
  'selected date candidate source card must not render inside the green search panel'
);

assert(
  bulk.includes('function resultRoot()') && bulk.includes('root.innerHTML = renderResults()'),
  'bulk lookup results must be written to the shared tab results outlet'
);
assert(
  bulk.includes('function renderMobileRows(rows)') && bulk.includes('id="v2BulkMobileCards"') && bulk.includes('v2-bulk-table-wrap'),
  'bulk lookup results must provide mobile cards and keep the wide table desktop-only'
);
assert(
  !bulk.includes('${renderResults()}'),
  'bulk result card must not be appended inside the green input panel'
);

assert(
  saved.includes('function resultRoot()') && saved.includes('id="v2SavedTabControlsCard"'),
  'saved tab must keep controls in the green panel'
);
assert(
  saved.includes('root.innerHTML = items.length ? renderSaved(items) : renderEmpty()'),
  'saved tab results must be written to the shared tab results outlet'
);
assert(
  saved.includes('function renderSavedMobileCards(top)') && saved.includes('id="v2SavedMobileCards"') && saved.includes('v2-saved-table-wrap'),
  'saved tab results must provide mobile cards and keep the wide table desktop-only'
);

assert(
  stack.includes('function resultRoot()') && stack.includes("root.insertAdjacentHTML('beforeend', renderCard())"),
  'candidate stack must append to the shared result root'
);
assert(
  !stack.includes("insertAdjacentHTML('afterend', renderCard())"),
  'candidate stack must not insert result cards next to a green-panel anchor'
);
assert(
  scopeGuard.includes('function tabResultsRoot()') && scopeGuard.includes('moveAllowedCardsIntoTabResults'),
  'tab scope guard must keep allowed cards in the shared result root'
);
assert(
  !scopeGuard.includes("anchor.insertAdjacentElement('afterend', stack)"),
  'tab scope guard must not move candidate cards back into the green panel'
);
assert(
  onbid.includes('function resultRoot()') && onbid.includes('id="v2OnbidResultCard"'),
  'onbid tab must render results through the shared result area'
);
assert(
  onbid.includes('function renderMobileItems(items)') && onbid.includes('id="v2OnbidMobileCards"') && onbid.includes('v2-onbid-table-wrap'),
  'onbid results must provide mobile cards and keep the wide table desktop-only'
);
assert(
  core.includes('.v2-date-card-list,.v2-mobile-card-list{display:grid') && core.includes('.v2-bulk-table-wrap,.v2-saved-table-wrap,.v2-onbid-table-wrap{display:none}'),
  'shared mobile result cards must show while wide tab result tables are hidden on mobile'
);
assert(
  !onbid.slice(onbid.indexOf('function renderPanel()'), onbid.indexOf('function syncTab()')).includes('v2OnbidResultArea'),
  'onbid result area must not be appended inside the green input panel'
);

console.log('tab results layout guard passed');
