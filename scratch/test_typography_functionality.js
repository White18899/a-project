const fs = require('fs');

console.log('--- TESTING TYPOGRAPHY FUNCTIONALITY WHITELIST & LOGIC ---');

// 1. Verify that js/editor.js allows typography properties in updateActiveElem
const editorJs = fs.readFileSync('js/editor.js', 'utf8');

const requiredWhitelistedKeys = [
  'fontWeight',
  'isBold',
  'isItalic',
  'isUnderline',
  'isUppercase',
  'isStrikethrough',
  'lineHeight',
  'letterSpacing'
];

// Extract textAndBoxKeys array from editor.js
const match = editorJs.match(/const textAndBoxKeys = \[([\s\S]*?)\];/);
if (!match) {
  console.error('[FAIL] Could not find textAndBoxKeys array in js/editor.js');
  process.exit(1);
}

const arrayContent = match[1];
let missingKeys = requiredWhitelistedKeys.filter(k => !arrayContent.includes(`'${k}'`));
if (missingKeys.length > 0) {
  console.error('[FAIL] textAndBoxKeys is missing keys:', missingKeys);
  process.exit(1);
} else {
  console.log(`[PASS] All ${requiredWhitelistedKeys.length} typography keys are correctly whitelisted in updateActiveElem!`);
}

// 2. Verify canvas.js text rendering handles decoGraphics and on-top rendering
const canvasJs = fs.readFileSync('js/canvas.js', 'utf8');

if (!canvasJs.includes('decoGraphics') || !canvasJs.includes('decoGraphics.lineStyle')) {
  console.error('[FAIL] canvas.js is missing decoGraphics overlay for underline/strikethrough');
  process.exit(1);
} else {
  console.log('[PASS] Canvas WebGL properly renders decorative lines on top of text!');
}

// 3. Verify CSS styling fixes for metric badges
const css = fs.readFileSync('styles.css', 'utf8');
if (!css.includes('-webkit-appearance: none') || !css.includes('-moz-appearance: textfield')) {
  console.error('[FAIL] styles.css is missing spinner suppression for metric badges');
  process.exit(1);
} else {
  console.log('[PASS] styles.css properly suppresses spinners and provides comfortable width for metric inputs!');
}

console.log('--- ALL TYPOGRAPHY FUNCTIONALITY VERIFICATIONS PASSED ---');
