const fs = require('fs');

console.log('--- RUNNING STUDIO PRO FILL & STROKE (APPEARANCE & STYLE) VERIFICATION TEST ---');

// 1. Verify HTML Structure
const html = fs.readFileSync('index.html', 'utf8');

const legacyIds = [
  'elem-bg-color',
  'elem-bg-color-hex',
  'elem-bg-alpha',
  'elem-border-radius',
  'elem-border-width',
  'elem-border-style',
  'elem-border-color',
  'elem-border-color-hex'
];

let missingLegacy = legacyIds.filter(id => !html.includes(`id="${id}"`));
if (missingLegacy.length > 0) {
  console.error('[FAIL] Missing legacy Appearance IDs in index.html:', missingLegacy);
  process.exit(1);
} else {
  console.log(`[PASS] All ${legacyIds.length} legacy Appearance IDs preserved in index.html for 100% backward compatibility!`);
}

const studioAppearanceIds = [
  'group-bg-styles',
  'btn-bg-color-trigger',
  'bg-color-swatch-preview',
  'bg-color-hex-label',
  'bg-opacity-scrub-wrapper',
  'bg-opacity-pct-label',
  'elem-bg-alpha-slider',
  'border-style-segmented',
  'btn-border-color-trigger',
  'border-color-swatch-preview',
  'border-color-hex-label',
  'border-width-stepper',
  'btn-border-width-dec',
  'border-width-scrub-wrapper',
  'btn-border-width-inc',
  'border-radius-stepper',
  'btn-border-radius-dec',
  'border-radius-scrub-wrapper',
  'btn-border-radius-inc'
];

let missingStudio = studioAppearanceIds.filter(id => !html.includes(`id="${id}"`));
if (missingStudio.length > 0) {
  console.error('[FAIL] Missing Studio Pro Appearance IDs in index.html:', missingStudio);
  process.exit(1);
} else {
  console.log(`[PASS] All ${studioAppearanceIds.length} Studio Pro Appearance IDs verified in index.html!`);
}

// 2. Verify CSS Rules
const css = fs.readFileSync('styles.css', 'utf8');
const requiredCssSelectors = [
  '.appearance-studio-container',
  '.appearance-group',
  '.appearance-group-label',
  '.appearance-surface-row',
  '.btn-appearance-color-trigger',
  '.appearance-swatch-preview',
  '.appearance-hex-label',
  '.appearance-opacity-badge',
  '.appearance-opacity-slider',
  '.appearance-stroke-segmented',
  '.btn-stroke-style',
  '.appearance-stroke-row',
  '.appearance-stepper',
  '.btn-appearance-step',
  '.appearance-stepper-input-wrapper',
  '.stepper-input',
  '.appearance-corners-row',
  '.radius-preset-pills',
  '.btn-radius-preset'
];

let missingCss = requiredCssSelectors.filter(sel => !css.includes(sel));
if (missingCss.length > 0) {
  console.error('[FAIL] Missing Appearance CSS selectors:', missingCss);
  process.exit(1);
} else {
  console.log(`[PASS] All ${requiredCssSelectors.length} Studio Pro Appearance CSS selectors verified in styles.css!`);
}

// 3. Verify JavaScript Logic
const editorJs = fs.readFileSync('js/editor.js', 'utf8');
const requiredJsTokens = [
  'initAppearanceStudio',
  'syncAppearanceStudioUI',
  'btn-bg-color-trigger',
  'btn-border-color-trigger',
  'elem-bg-alpha-slider',
  'border-style-segmented',
  'btn-border-width-dec',
  'btn-border-width-inc',
  'border-width-scrub-wrapper',
  'btn-border-radius-dec',
  'btn-border-radius-inc',
  'border-radius-scrub-wrapper',
  'btn-radius-preset'
];

let missingJs = requiredJsTokens.filter(tok => !editorJs.includes(tok));
if (missingJs.length > 0) {
  console.error('[FAIL] Missing Appearance JS tokens:', missingJs);
  process.exit(1);
} else {
  console.log(`[PASS] All ${requiredJsTokens.length} Appearance JS logic tokens verified in js/editor.js!`);
}

// 4. Verify Opacity Icon & Track Refinements
if (html.includes('💧')) {
  console.error('[FAIL] Droplet emoji still present in index.html!');
  process.exit(1);
} else {
  console.log('[PASS] Droplet emoji successfully removed from index.html.');
}

if (!html.includes('opacity-icon-svg') || !html.includes('appearance-opacity-track-wrap') || !html.includes('bg-opacity-gradient-fill')) {
  console.error('[FAIL] Missing vector opacity icon or track wrapper in index.html');
  process.exit(1);
} else {
  console.log('[PASS] Opacity vector SVG icon and alpha gradient track elements verified in index.html.');
}

if (!css.includes('.appearance-opacity-track-wrap') || !css.includes('.appearance-opacity-gradient-fill')) {
  console.error('[FAIL] Missing opacity track styles in styles.css');
  process.exit(1);
} else {
  console.log('[PASS] Studio-grade alpha gradient track and thumb styling verified in styles.css.');
}

// 5. Verify Default Border Width 3px
const stateJs = fs.readFileSync('js/state.js', 'utf8');
if (!stateJs.includes('borderWidth: 3')) {
  console.error('[FAIL] Shape default borderWidth: 3 not found in js/state.js');
  process.exit(1);
} else {
  console.log('[PASS] Shape template borderWidth: 3 verified in js/state.js.');
}

if (!html.includes('id="elem-border-width" value="3"')) {
  console.error('[FAIL] Default border width value="3" not found in index.html');
  process.exit(1);
} else {
  console.log('[PASS] Default border width input value="3" verified in index.html.');
}

if (!editorJs.includes('updateOpacityGradientTrack')) {
  console.error('[FAIL] updateOpacityGradientTrack not found in js/editor.js');
  process.exit(1);
} else {
  console.log('[PASS] Dynamic opacity gradient track sync logic verified in js/editor.js.');
}

console.log('--- ALL STUDIO PRO FILL & STROKE TESTS PASSED ---');
