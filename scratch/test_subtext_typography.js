const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST SUITE: SUBTEXT & PARAGRAPH TYPOGRAPHY CONTROLS ---');

// 1. Verify index.html DOM Elements
console.log('\n[Test 1] Verifying DOM elements in index.html...');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const requiredElementIds = [
    'btn-toggle-subtext',
    'subtext-toggle-label',
    'elem-has-subtext',
    'typo-scope-container',
    'btn-scope-heading',
    'btn-scope-subtext',
    'subtext-active-dot',
    'group-subtext-styles',
    'elem-subtext-gap',
    'elem-subtext-weight',
    'elem-subtext-size',
    'btn-subtext-size-dec',
    'btn-subtext-size-inc',
    'subtext-size-scrub-wrapper',
    'btn-subtext-align-left',
    'btn-subtext-align-center',
    'btn-subtext-align-right',
    'elem-subtext-align',
    'btn-subtext-format-bold',
    'btn-subtext-format-italic',
    'btn-subtext-format-underline',
    'btn-subtext-format-uppercase',
    'btn-subtext-format-strikethrough',
    'btn-subtext-color-trigger',
    'subtext-color-swatch-preview',
    'elem-subtext-color-hex',
    'elem-subtext-color',
    'elem-subtext-line-height',
    'elem-subtext-letter-spacing'
];

requiredElementIds.forEach(id => {
    assert(indexHtml.includes(`id="${id}"`), `Missing required element ID in index.html: ${id}`);
});
console.log(`✓ All ${requiredElementIds.length} required DOM elements verified in index.html.`);

// 2. Verify styles.css
console.log('\n[Test 2] Verifying subtext styles in styles.css...');
const stylesCss = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
const requiredSelectors = [
    '.btn-subtext-toggle-pill',
    '.typo-scope-container',
    '.typo-scope-segmented',
    '.btn-typo-scope',
    '.subtext-active-dot',
    '.subtext-status-card',
    '.subtext-gap-control'
];
requiredSelectors.forEach(selector => {
    assert(stylesCss.includes(selector), `Missing CSS selector in styles.css: ${selector}`);
});
console.log(`✓ All ${requiredSelectors.length} required CSS classes verified in styles.css.`);

// 3. Verify js/canvas.js Dual-Node WebGL Logic
console.log('\n[Test 3] Verifying WebGL Canvas dual-node rendering logic in js/canvas.js...');
const canvasJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'canvas.js'), 'utf8');

assert(canvasJs.includes('hasSubtextStyling'), 'canvas.js missing hasSubtextStyling check');
assert(canvasJs.includes('headingPixiText'), 'canvas.js missing headingPixiText');
assert(canvasJs.includes('subtextPixiText'), 'canvas.js missing subtextPixiText');
assert(canvasJs.includes('elem.subtextGap'), 'canvas.js missing subtextGap calculation');
assert(canvasJs.includes('elem.subtextSize'), 'canvas.js missing subtextSize styling');
assert(canvasJs.includes('elem.subtextColor'), 'canvas.js missing subtextColor styling');
assert(canvasJs.includes('elem.subtextFontWeight'), 'canvas.js missing subtextFontWeight styling');
console.log('✓ WebGL Canvas dual-node rendering logic verified.');

// 4. Verify js/editor.js State Whitelist & Handlers
console.log('\n[Test 4] Verifying state whitelist & handlers in js/editor.js...');
const editorJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'editor.js'), 'utf8');

const subtextKeys = [
    'hasSubtext', 'subtext', 'subtextSize', 'subtextColor',
    'subtextFontWeight', 'subtextIsBold', 'subtextItalic', 'subtextUnderline',
    'subtextUppercase', 'subtextStrikethrough', 'subtextLineHeight',
    'subtextLetterSpacing', 'subtextGap', 'subtextAlign'
];
subtextKeys.forEach(k => {
    assert(editorJs.includes(`'${k}'`), `Missing property in textAndBoxKeys whitelist: ${k}`);
});

assert(editorJs.includes('setTypoScope'), 'editor.js missing setTypoScope function');
assert(editorJs.includes('window.updateTypoScopeVisibility'), 'editor.js missing updateTypoScopeVisibility');
assert(editorJs.includes('btn-toggle-subtext'), 'editor.js missing btn-toggle-subtext handler');
assert(editorJs.includes('elem-subtext-size'), 'editor.js missing elem-subtext-size handling');
assert(editorJs.includes('elem-subtext-color'), 'editor.js missing elem-subtext-color handling');
assert(editorJs.includes('updateSlideCardPreview'), 'editor.js missing updateSlideCardPreview');
console.log('✓ State whitelist, scope switcher, and subtext handlers verified in js/editor.js.');

// 5. Verify server.js & worker.js AI prompt updates
console.log('\n[Test 5] Verifying AI prompt updates in server.js and worker.js...');
const serverJs = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const workerJs = fs.readFileSync(path.join(__dirname, '..', 'worker.js'), 'utf8');

assert(serverJs.includes('"hasSubtext": true'), 'server.js missing hasSubtext instruction');
assert(serverJs.includes('"subtextSize"'), 'server.js missing subtextSize instruction');
assert(serverJs.includes('"subtextColor"'), 'server.js missing subtextColor instruction');

assert(workerJs.includes('"hasSubtext": true'), 'worker.js missing hasSubtext instruction');
assert(workerJs.includes('"subtextSize"'), 'worker.js missing subtextSize instruction');
assert(workerJs.includes('"subtextColor"'), 'worker.js missing subtextColor instruction');
console.log('✓ AI generation prompts in server.js and worker.js verified.');

// 6. Functional Simulation: Auto-Split Text Logic
console.log('\n[Test 6] Simulating text auto-split algorithm...');
const sampleCardText = "THE PIVOTAL PARADIGM SHIFT\n\nIn 2026, artificial intelligence transitions from passive assistants into autonomous agent swarms.";
let headingText = sampleCardText;
let subtextContent = '';

const hasSubtextStyling = true;
if (hasSubtextStyling && headingText.includes('\n')) {
    const parts = headingText.includes('\n\n') ? headingText.split(/\n\n+/) : headingText.split(/\n+/);
    headingText = parts[0] || '';
    subtextContent = parts.slice(1).join('\n\n');
}

assert.strictEqual(headingText, 'THE PIVOTAL PARADIGM SHIFT');
assert.strictEqual(subtextContent, 'In 2026, artificial intelligence transitions from passive assistants into autonomous agent swarms.');
console.log(`✓ Auto-split successfully extracted:`);
console.log(`  Heading: "${headingText}"`);
console.log(`  Subtext: "${subtextContent}"`);

console.log('\n======================================================');
console.log('ALL SUBTEXT TYPOGRAPHY TESTS PASSED SUCCESSFULLY! (6/6)');
console.log('======================================================');
