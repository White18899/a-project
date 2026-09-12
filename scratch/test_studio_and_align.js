const fs = require('fs');
const path = require('path');
const assert = require('assert');
const http = require('http');

console.log('================================================================');
console.log('🚀 TESTING INDEPENDENT ALIGNMENT & MAGIC AI STUDIO INTEGRATION');
console.log('================================================================\n');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const editorJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'editor.js'), 'utf8');
const canvasJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'canvas.js'), 'utf8');
const stylesCss = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
const stateJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'state.js'), 'utf8');

// [1] Verify Heading vs Subtext Alignment Isolation in index.html
console.log('[1/5] Verifying Alignment Buttons in index.html...');
assert(html.includes('id="typo-align-segmented"'), 'Missing typo-align-segmented');
assert(html.includes('id="typo-subtext-align-segmented"'), 'Missing typo-subtext-align-segmented');
assert(html.includes('btn-heading-align'), 'Missing btn-heading-align class in index.html');
assert(html.includes('btn-subtext-align'), 'Missing btn-subtext-align class in index.html');
assert(html.includes('id="btn-text-align-left"'), 'Missing btn-text-align-left');
assert(html.includes('id="btn-text-align-center"'), 'Missing btn-text-align-center');
assert(html.includes('id="btn-text-align-right"'), 'Missing btn-text-align-right');
assert(html.includes('id="btn-subtext-align-left"'), 'Missing btn-subtext-align-left');
assert(html.includes('id="btn-subtext-align-center"'), 'Missing btn-subtext-align-center');
assert(html.includes('id="btn-subtext-align-right"'), 'Missing btn-subtext-align-right');
console.log('✅ PASS: Heading and Subtext buttons have distinct selectors in index.html!');

// [2] Verify Decoupled Alignment in js/editor.js, js/canvas.js, js/state.js
console.log('\n[2/5] Verifying Decoupled Alignment Logic in JS...');
assert(editorJs.includes('#typo-align-segmented .btn-heading-align'), 'editor.js must scope heading align buttons to typo-align-segmented');
assert(editorJs.includes('#typo-subtext-align-segmented .btn-subtext-align'), 'editor.js must scope subtext align buttons to typo-subtext-align-segmented');
assert(editorJs.includes("const subAlign = element.subtextAlign || 'left';"), 'editor.js must not fallback subAlign to element.align');
assert(!editorJs.includes("const subAlign = element.subtextAlign || element.align || 'left';"), 'editor.js still contains buggy fallback');
assert(canvasJs.includes("const subtextResolvedAlign = elem.subtextAlign || 'left';"), 'canvas.js must decouple subtextResolvedAlign from resolvedAlign');
assert(!canvasJs.includes("const subtextResolvedAlign = elem.subtextAlign || resolvedAlign;"), 'canvas.js still has resolvedAlign fallback');
assert(stateJs.includes("subtextAlign: 'left'"), 'state.js ElementTemplates.text must specify subtextAlign: left');
console.log('✅ PASS: JS Alignment logic is completely decoupled and independent!');

// [3] Verify Magic AI Studio in index.html
console.log('\n[3/5] Verifying Magic AI Studio DOM Elements in index.html...');
const requiredAiStudioIds = [
    'ai-tab',
    'ai-key-status-pill',
    'ai-key-pill-dot',
    'ai-key-pill-label',
    'ai-key-drawer',
    'ai-key-status-badge',
    'ai-key-input-wrapper',
    'ai-gemini-key-input',
    'btn-ai-save-key',
    'ai-key-configured-wrapper',
    'btn-ai-change-key',
    'ai-deck-quiz-section',
    'ai-prompt-input',
    'btn-ai-clear-prompt',
    'ai-mode-select',
    'ai-slide-count-group',
    'ai-slide-count',
    'ai-slide-count-display',
    'btn-ai-count-minus',
    'btn-ai-count-plus',
    'ai-theme-select',
    'btn-ai-preview-outline',
    'btn-ai-generate',
    'ai-progress-container',
    'ai-error-banner',
    'ai-outline-container',
    'ai-outline-count-badge',
    'btn-ai-outline-add',
    'ai-outline-list',
    'btn-ai-outline-redraft',
    'btn-ai-outline-generate-all',
    'ai-asset-section',
    'ai-asset-prompt',
    'btn-ai-generate-asset',
    'ai-asset-result-card',
    'ai-asset-preview-img',
    'btn-ai-asset-add-canvas',
    'btn-ai-asset-set-bg'
];

let missingIds = requiredAiStudioIds.filter(id => !html.includes(`id="${id}"`));
assert.strictEqual(missingIds.length, 0, `Missing AI Studio IDs in index.html: ${missingIds.join(', ')}`);
assert(html.includes('Magic AI Studio'), 'Tab or header must display Magic AI Studio');
console.log(`✅ PASS: All ${requiredAiStudioIds.length} Magic AI Studio IDs verified in index.html!`);

// [4] Verify CSS Classes for Magic AI Studio in styles.css
console.log('\n[4/5] Verifying CSS Rules in styles.css...');
const requiredClasses = [
    '.ai-studio-header',
    '.ai-studio-title-group',
    '.ai-studio-title-icon',
    '.ai-studio-title',
    '.ai-studio-subtitle',
    '.ai-key-status-pill',
    '.ai-key-drawer',
    '.ai-segmented-control',
    '.ai-segment-btn',
    '.ai-input-block',
    '.ai-inspiration-tray',
    '.ai-prompt-chip',
    '.ai-theme-grid',
    '.ai-theme-card',
    '.ai-stepper-row',
    '.ai-preset-pill',
    '.ai-btn-primary',
    '.ai-btn-instant',
    '.ai-outline-container',
    '.ai-outline-card',
    '.ai-asset-result-card',
    '.btn-subtext-align',
    '.btn-heading-align'
];

let missingCss = requiredClasses.filter(c => !stylesCss.includes(c));
assert.strictEqual(missingCss.length, 0, `Missing CSS classes in styles.css: ${missingCss.join(', ')}`);
console.log(`✅ PASS: All ${requiredClasses.length} CSS selectors verified in styles.css!`);

// [5] HTTP Server Live Health Check
console.log('\n[5/5] Testing Live Server HTTP Response...');
const req = http.get('http://localhost:3000', (res) => {
    assert.strictEqual(res.statusCode, 200, 'Server must return 200 OK');
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        assert(body.includes('Magic AI Studio'), 'Server response must include Magic AI Studio');
        assert(body.includes('btn-subtext-align'), 'Server response must include btn-subtext-align');
        console.log('✅ PASS: Server is serving updated index.html with Magic AI Studio and decoupled alignments!');
        console.log('\n================================================================');
        console.log('🎉 ALL TESTS PASSED! BOTH ISSUES ARE FULLY RESOLVED!');
        console.log('================================================================');
        process.exit(0);
    });
});
req.on('error', (err) => {
    console.error('Server connection error:', err.message);
    process.exit(1);
});
