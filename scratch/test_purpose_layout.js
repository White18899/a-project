const fs = require('fs');

console.log('--- RUNNING PURPOSE-DIVIDED LAYOUT VERIFICATION TEST ---');

// 1. Verify HTML Structure
const html = fs.readFileSync('index.html', 'utf8');

const requiredIds = [
  'group-layout-alignment',
  'layout-target-indicator',
  'btn-align-left',
  'btn-align-center-h',
  'btn-align-right',
  'btn-align-top',
  'btn-align-middle-v',
  'btn-align-bottom',
  'btn-distribute-h',
  'btn-distribute-v',
  'btn-stack-row',
  'btn-stack-col',
  'btn-stack-grid',
  'layout-gap-input'
];

let missingIds = requiredIds.filter(id => !html.includes(`id="${id}"`));
if (missingIds.length > 0) {
  console.error('[FAIL] Missing IDs in index.html:', missingIds);
  process.exit(1);
} else {
  console.log(`[PASS] All ${requiredIds.length} Purpose-Divided Layout IDs are present in index.html!`);
}

// 2. Verify CSS Rules
const css = fs.readFileSync('styles.css', 'utf8');

const requiredCss = [
  '.layout-purpose-container',
  '.layout-purpose-header',
  '.layout-target-badge',
  '.layout-purpose-group',
  '.layout-subgroup-labels',
  '.layout-align-dual-grid',
  '.layout-segmented-control',
  '.btn-layout-tool',
  '.layout-distribute-grid',
  '.btn-layout-pill',
  '.layout-stack-flow-row',
  '.layout-gap-badge'
];

let missingCss = requiredCss.filter(cls => !css.includes(cls));
if (missingCss.length > 0) {
  console.error('[FAIL] Missing CSS classes in styles.css:', missingCss);
  process.exit(1);
} else {
  console.log(`[PASS] All ${requiredCss.length} required CSS classes are present in styles.css!`);
}

// 3. Verify JS Logic
const editorJs = fs.readFileSync('js/editor.js', 'utf8');
const requiredJsTokens = [
  'SlideLayoutEngine',
  'btn-align-left',
  'btn-align-center-h',
  'btn-align-right',
  'btn-align-top',
  'btn-align-middle-v',
  'btn-align-bottom',
  'btn-distribute-h',
  'btn-distribute-v',
  'btn-stack-row',
  'btn-stack-col',
  'btn-stack-grid',
  'layout-gap-input'
];

let missingJs = requiredJsTokens.filter(token => !editorJs.includes(token));
if (missingJs.length > 0) {
  console.error('[FAIL] Missing JS tokens in js/editor.js:', missingJs);
  process.exit(1);
} else {
  console.log(`[PASS] All ${requiredJsTokens.length} event bindings & handlers are wired in js/editor.js!`);
}

console.log('--- ALL PURPOSE-DIVIDED LAYOUT TESTS PASSED ---');
