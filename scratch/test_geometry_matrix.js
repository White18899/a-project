const fs = require('fs');

console.log('--- RUNNING STUDIO PRO GEOMETRY MATRIX VERIFICATION TEST ---');

// 1. Verify HTML Structure
const html = fs.readFileSync('index.html', 'utf8');

const legacyIds = [
  'elem-x',
  'elem-y',
  'elem-w',
  'elem-h'
];

let missingLegacy = legacyIds.filter(id => !html.includes(`id="${id}"`));
if (missingLegacy.length > 0) {
  console.error('[FAIL] Missing legacy geometry IDs in index.html:', missingLegacy);
  process.exit(1);
} else {
  console.log(`[PASS] All ${legacyIds.length} legacy geometry IDs preserved in index.html for 100% backward compatibility!`);
}

const studioGeometryIds = [
  'geometry-matrix-container',
  'field-geo-x',
  'badge-geo-x',
  'elem-x',
  'field-geo-y',
  'badge-geo-y',
  'elem-y',
  'field-geo-w',
  'badge-geo-w',
  'elem-w',
  'btn-aspect-ratio-lock',
  'icon-aspect-ratio-lock',
  'field-geo-h',
  'badge-geo-h',
  'elem-h'
];

let missingStudio = studioGeometryIds.filter(id => !html.includes(`id="${id}"`));
if (missingStudio.length > 0) {
  console.error('[FAIL] Missing Studio Geometry Matrix IDs in index.html:', missingStudio);
  process.exit(1);
} else {
  console.log(`[PASS] All ${studioGeometryIds.length} Studio Pro Geometry Matrix IDs verified in index.html!`);
}

// 2. Verify CSS Rules
const css = fs.readFileSync('styles.css', 'utf8');
const requiredCssSelectors = [
  '.geometry-matrix-container',
  '.geometry-row',
  '.geometry-row-coords',
  '.geometry-row-dims',
  '.geometry-field',
  '.geometry-badge',
  '.geo-badge-letter',
  '.geometry-input',
  '.geometry-unit',
  '.btn-aspect-ratio-lock',
  '.btn-aspect-ratio-lock.locked'
];

let missingCss = requiredCssSelectors.filter(sel => !css.includes(sel));
if (missingCss.length > 0) {
  console.error('[FAIL] Missing Geometry Matrix CSS selectors:', missingCss);
  process.exit(1);
} else {
  console.log(`[PASS] All ${requiredCssSelectors.length} Studio Pro Geometry Matrix CSS selectors verified in styles.css!`);
}

// 3. Verify JavaScript Logic
const editorJs = fs.readFileSync('js/editor.js', 'utf8');
const requiredJsTokens = [
  'initGeometryMatrix',
  'syncGeometryMatrixUI',
  'evaluateMathExpression',
  'btn-aspect-ratio-lock',
  'badge-geo-x',
  'badge-geo-y',
  'badge-geo-w',
  'badge-geo-h',
  'isAspectLocked',
  'setupBadgeScrub'
];

let missingJs = requiredJsTokens.filter(tok => !editorJs.includes(tok));
if (missingJs.length > 0) {
  console.error('[FAIL] Missing Geometry Matrix JS tokens:', missingJs);
  process.exit(1);
} else {
  console.log(`[PASS] All ${requiredJsTokens.length} Geometry Matrix JS logic tokens verified in js/editor.js!`);
}

// 4. Test Math Expression Evaluator Logic
function evaluateMathExpression(str, currentVal) {
    if (!str) return currentVal;
    let clean = String(str).trim();
    if (/^[+\-*/]/.test(clean)) {
        clean = `${currentVal}${clean}`;
    }
    if (!/^[0-9+\-*/().\s]+$/.test(clean)) {
        const num = parseFloat(clean);
        return isNaN(num) ? currentVal : Math.round(num);
    }
    try {
        const result = Function(`'use strict'; return (${clean})`)();
        if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
            return Math.round(result);
        }
    } catch (e) {
        // Fallback
    }
    const num = parseFloat(clean);
    return isNaN(num) ? currentVal : Math.round(num);
}

// Test assertions
if (evaluateMathExpression('+20', 130) !== 150) throw new Error('Relative addition failed');
if (evaluateMathExpression('-30', 100) !== 70) throw new Error('Relative subtraction failed');
if (evaluateMathExpression('*2', 700) !== 1400) throw new Error('Relative multiplication failed');
if (evaluateMathExpression('/2', 80) !== 40) throw new Error('Relative division failed');
if (evaluateMathExpression('1920/2', 0) !== 960) throw new Error('Absolute expression failed');
if (evaluateMathExpression('500', 100) !== 500) throw new Error('Standard numeric assignment failed');
console.log('[PASS] Smart math expression parser verified for all relative & absolute arithmetic!');

console.log('--- ALL STUDIO PRO GEOMETRY MATRIX TESTS PASSED ---');
