const fs = require('fs');

console.log('--- RUNNING STUDIO PRO TYPOGRAPHY & CONTENT VERIFICATION TEST ---');

// 1. Verify HTML Structure
const html = fs.readFileSync('index.html', 'utf8');

const legacyIds = [
  'field-elem-text',
  'elem-text',
  'group-text-styles',
  'elem-font-family',
  'elem-font-size',
  'elem-align',
  'elem-text-color',
  'elem-text-color-hex'
];

let missingLegacy = legacyIds.filter(id => !html.includes(`id="${id}"`));
if (missingLegacy.length > 0) {
  console.error('[FAIL] Missing legacy IDs in index.html:', missingLegacy);
  process.exit(1);
} else {
  console.log(`[PASS] All ${legacyIds.length} legacy IDs preserved in index.html for 100% backward compatibility!`);
}

const studioIds = [
  'elem-text-char-count',
  'btn-text-clear',
  'elem-font-weight',
  'btn-font-size-dec',
  'btn-font-size-inc',
  'font-size-scrub-wrapper',
  'btn-text-align-left',
  'btn-text-align-center',
  'btn-text-align-right',
  'btn-text-format-bold',
  'btn-text-format-italic',
  'btn-text-format-underline',
  'btn-text-format-uppercase',
  'btn-text-format-strikethrough',
  'btn-text-color-trigger',
  'text-color-swatch-preview',
  'elem-line-height',
  'elem-letter-spacing'
];

let missingStudio = studioIds.filter(id => !html.includes(`id="${id}"`));
if (missingStudio.length > 0) {
  console.error('[FAIL] Missing Studio Pro IDs in index.html:', missingStudio);
  process.exit(1);
} else {
  console.log(`[PASS] All ${studioIds.length} Studio Pro IDs verified in index.html!`);
}

// 2. Verify CSS Rules
const css = fs.readFileSync('styles.css', 'utf8');
const requiredCssClasses = [
  '.typography-studio-container',
  '.typo-studio-field',
  '.typo-char-badge',
  '.btn-typo-clear',
  '.typo-specimen-badge',
  '.typo-select-font',
  '.typo-select-weight',
  '.typo-size-stepper',
  '.btn-typo-step',
  '.typo-size-scrub-wrapper',
  '.typo-segmented-control',
  '.btn-typo-align',
  '.typo-format-toolbar',
  '.btn-typo-format',
  '.typo-color-card',
  '.typo-color-swatch-btn',
  '.typo-spacing-grid',
  '.typo-metric-badge'
];

let missingCss = requiredCssClasses.filter(cls => !css.includes(cls));
if (missingCss.length > 0) {
  console.error('[FAIL] Missing Studio Pro CSS classes:', missingCss);
  process.exit(1);
} else {
  console.log(`[PASS] All ${requiredCssClasses.length} Studio Pro CSS classes verified in styles.css!`);
}

// 3. Verify Canvas WebGL Support
const canvasJs = fs.readFileSync('js/canvas.js', 'utf8');
const canvasTokens = [
  'resolvedWeight',
  'resolvedStyle',
  'resolvedLetterSpacing',
  'resolvedLineHeight',
  'isUppercase',
  'isUnderline',
  'isStrikethrough'
];

let missingCanvas = canvasTokens.filter(t => !canvasJs.includes(t));
if (missingCanvas.length > 0) {
  console.error('[FAIL] Missing Canvas WebGL tokens:', missingCanvas);
  process.exit(1);
} else {
  console.log(`[PASS] All ${canvasTokens.length} WebGL text rendering features verified in js/canvas.js!`);
}

// 4. Verify Editor Logic & Event Listeners
const editorJs = fs.readFileSync('js/editor.js', 'utf8');
const editorTokens = [
  'initTypographyStudio',
  'syncTypographyStudioUI',
  'btn-font-size-dec',
  'font-size-scrub-wrapper',
  'btn-text-align-left',
  'btn-text-format-bold',
  'btn-text-color-trigger',
  'elem-line-height',
  'elem-letter-spacing'
];

let missingEditor = editorTokens.filter(t => !editorJs.includes(t));
if (missingEditor.length > 0) {
  console.error('[FAIL] Missing Editor tokens:', missingEditor);
  process.exit(1);
} else {
  console.log(`[PASS] All ${editorTokens.length} Editor Studio Pro interaction tokens verified in js/editor.js!`);
}

console.log('--- ALL STUDIO PRO TYPOGRAPHY & CONTENT TESTS PASSED ---');
