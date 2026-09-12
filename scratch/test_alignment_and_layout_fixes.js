const fs = require('fs');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 VERIFYING ALIGNMENT DECOUPLING & CARD ARCHITECT BUG FIXES');
console.log('================================================================');

// 1. Verify Canvas.js Dual-Node & Anchor Logic
console.log('\n[1/6] Testing canvas.js dual-node auto-split and independent anchors...');
const canvasJs = fs.readFileSync('js/canvas.js', 'utf8');

assert(canvasJs.includes("if (elem.hasSubtext !== false && !subtextContent && headingText.includes('\\n'))"), 
    'canvas.js must auto-split multiline text when subtext is not explicitly set');

assert(canvasJs.includes('headingPixiText.anchor.x = 0;'), 
    'headingPixiText must explicitly reset anchor.x to 0 for left alignment');

assert(canvasJs.includes('subtextPixiText.anchor.x = 0;'), 
    'subtextPixiText must explicitly reset anchor.x to 0 for left alignment');

assert(canvasJs.includes('elem.subtextIsBold || elem.subtextBold'), 
    'canvas.js must support both subtextIsBold and subtextBold');

console.log('✅ PASS: canvas.js dual-node auto-split and independent anchor logic verified!');

// 2. Verify editor.js State Normalization & Button Decoupling
console.log('\n[2/6] Testing editor.js state normalization on select and independent align handlers...');
const editorJs = fs.readFileSync('js/editor.js', 'utf8');

assert(editorJs.includes("if (element.text && element.text.includes('\\n') && element.hasSubtext !== false)"),
    'syncTypographyStudioUI must auto-split multiline text');

assert(editorJs.includes("updateActiveElemAndSave({ text: h, subtext: s, hasSubtext: true, subtextAlign: element.subtextAlign });"),
    'syncTypographyStudioUI must save split heading, subtext, and hasSubtext into state');

// Verify Heading alignment handler preserves subtext
const alignBtnsIdx = editorJs.indexOf('// Segmented alignment toolbar (Heading / Content Alignment)');
const alignBtnsChunk = editorJs.substring(alignBtnsIdx, alignBtnsIdx + 1200);
assert(alignBtnsChunk.includes('updates.subtext = subVal;'), 
    'Heading align handler must preserve subtext in state');
assert(alignBtnsChunk.includes('updates.hasSubtext = true;'), 
    'Heading align handler must ensure hasSubtext is true');

// Verify Subtext alignment handler preserves heading
const subtextAlignBtnsIdx = editorJs.indexOf('// Subtext Alignment Segmented Control');
const subtextAlignBtnsChunk = editorJs.substring(subtextAlignBtnsIdx, subtextAlignBtnsIdx + 1200);
assert(subtextAlignBtnsChunk.includes('subtextAlign: alignVal'), 
    'Subtext align handler must update subtextAlign');
assert(subtextAlignBtnsChunk.includes('hasSubtext: true'), 
    'Subtext align handler must ensure hasSubtext is true');

console.log('✅ PASS: editor.js state normalization and decoupled alignment click handlers verified!');

// 3. Verify Subtext Toolstrip Symmetrical Rows in index.html
console.log('\n[3/6] Testing Subtext Toolstrip Rows in index.html...');
const html = fs.readFileSync('index.html', 'utf8');

assert(html.includes('class="card-inline-toolstrip card-subtext-row-primary"'),
    'index.html must have card-subtext-row-primary');
assert(html.includes('class="card-inline-toolstrip card-subtext-row-secondary"'),
    'index.html must have card-subtext-row-secondary');
assert(html.includes('class="card-inline-toolstrip card-subtext-row-formatting"'),
    'index.html must have card-subtext-row-formatting');
assert(html.includes('class="card-inline-toolstrip card-subtext-row-tertiary"'),
    'index.html must have card-subtext-row-tertiary');
assert(html.includes('class="card-inline-toolstrip card-subtext-row-quaternary"'),
    'index.html must have card-subtext-row-quaternary');

// Verify Row 1 has Size Stepper and Color Card
const row1Idx = html.indexOf('class="card-inline-toolstrip card-subtext-row-primary"');
const row1EndIdx = html.indexOf('<!-- Subtext Toolstrip Row 2: Weight & Alignment -->');
const row1Chunk = html.substring(row1Idx, row1EndIdx);
assert(row1Chunk.includes('id="elem-subtext-size"'), 'Row 1 must contain elem-subtext-size');
assert(row1Chunk.includes('id="subtext-color-wrapper"'), 'Row 1 must contain subtext-color-wrapper');
assert(!row1Chunk.includes('id="elem-subtext-weight"'), 'Row 1 must NOT contain elem-subtext-weight (moved to Row 2 for space)');

// Verify Row 2 has Weight Select and Alignment
const row2Idx = row1EndIdx;
const row2EndIdx = html.indexOf('<!-- Subtext Toolstrip Row 2B: Formatting Buttons');
const row2Chunk = html.substring(row2Idx, row2EndIdx);
assert(row2Chunk.includes('id="elem-subtext-weight"'), 'Row 2 must contain elem-subtext-weight');
assert(row2Chunk.includes('id="typo-subtext-align-segmented"'), 'Row 2 must contain typo-subtext-align-segmented');

console.log('✅ PASS: Symmetrical Subtext Toolstrip Rows verified in index.html!');

// 4. Verify CSS Layouts in styles.css
console.log('\n[4/6] Testing CSS layout rules in styles.css...');
const css = fs.readFileSync('styles.css', 'utf8');

assert(css.includes('grid-template-columns: 84px minmax(0, 1fr);'),
    'card-subtext-row-primary must be 84px minmax(0, 1fr) for size stepper and color card');

assert(css.includes('grid-template-columns: minmax(0, 1fr) 78px;'),
    'card-subtext-row-secondary must be minmax(0, 1fr) 78px for weight select and alignment');

assert(css.includes('.card-subtext-row-formatting'),
    'styles.css must style card-subtext-row-formatting');

assert(css.includes('cursor: ew-resize;'),
    'card-subtext-gap-chip must have cursor: ew-resize for interactive scrubber');

console.log('✅ PASS: CSS layout rules for rows and gap chip verified!');

// 5. Verify Gap Chip Pointer Scrubber in editor.js
console.log('\n[5/6] Testing interactive scrubber on .card-subtext-gap-chip...');
assert(editorJs.includes("document.querySelector('.card-subtext-gap-chip')"),
    'editor.js must select .card-subtext-gap-chip');
assert(editorJs.includes("gapChip.addEventListener('pointerdown'"),
    'editor.js must bind pointerdown on gapChip');
assert(editorJs.includes('updateActiveElem({ subtextGap: newVal })'),
    'editor.js must update subtextGap during scrub');

console.log('✅ PASS: Interactive gap scrubber verified in js/editor.js!');

// 6. Verify AI Card Action Response Handling in server.js, worker.js, and editor.js
console.log('\n[6/6] Testing AI Card Action fallback and response parsing...');
const serverJs = fs.readFileSync('server.js', 'utf8');
const workerJs = fs.readFileSync('worker.js', 'utf8');

assert(serverJs.includes('data: fallbackResult'), 
    'server.js must return data: fallbackResult on fallback');
assert(workerJs.includes('data: fallbackResult'), 
    'worker.js must return data: fallbackResult on fallback');

assert(editorJs.includes('const data = resp ? (resp.data || resp.result) : null;'),
    'editor.js must support resp.data || resp.result');
assert(editorJs.includes('const hSize = data.suggestedHeadingSize || data.fontSize;'),
    'editor.js must support suggestedHeadingSize');
assert(editorJs.includes('const sSize = data.suggestedSubtextSize || data.subtextSize;'),
    'editor.js must support suggestedSubtextSize');
assert(editorJs.includes('const gapVal = data.suggestedGap !== undefined ? data.suggestedGap : data.gap;'),
    'editor.js must support suggestedGap');

console.log('✅ PASS: AI Card Action response handling verified across server, worker, and editor!');

console.log('\n================================================================');
console.log('🎉 ALL 6 VERIFICATION TEST SUITES PASSED FLAWLESSLY!');
console.log('================================================================');
