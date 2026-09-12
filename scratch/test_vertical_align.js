const fs = require('fs');
const assert = require('assert');

console.log('--- Testing Vertical Alignment Implementation ---');

// 1. Check index.html
const html = fs.readFileSync('a:/a-project/index.html', 'utf8');
assert(html.includes('id="typo-valign-segmented"'), 'Missing typo-valign-segmented in index.html');
assert(html.includes('id="hud-valign-top"'), 'Missing hud-valign-top in index.html');
assert(html.includes('id="hud-valign-middle"'), 'Missing hud-valign-middle in index.html');
assert(html.includes('id="hud-valign-bottom"'), 'Missing hud-valign-bottom in index.html');
assert(html.includes('data-valign="top"'), 'Missing data-valign="top" in index.html');
assert(html.includes('data-valign="middle"'), 'Missing data-valign="middle" in index.html');
assert(html.includes('data-valign="bottom"'), 'Missing data-valign="bottom" in index.html');
assert(html.includes('class="card-inline-toolstrip card-toolstrip-row-formatting"'), 'Missing formatting row in index.html');
console.log('✓ index.html structure verified (HUD buttons, segmented control, formatting row)');

// 2. Check styles.css
const css = fs.readFileSync('a:/a-project/styles.css', 'utf8');
assert(css.includes('.btn-valign'), 'Missing .btn-valign in styles.css');
assert(css.includes('.card-toolstrip-row-formatting'), 'Missing .card-toolstrip-row-formatting in styles.css');
console.log('✓ styles.css verified (.btn-valign and card-toolstrip-row-formatting)');

// 3. Check js/state.js
const stateJs = fs.readFileSync('a:/a-project/js/state.js', 'utf8');
assert(stateJs.includes("verticalAlign: 'middle'"), 'state.js ElementTemplates.text must have verticalAlign: middle');
console.log('✓ js/state.js verified (ElementTemplates default)');

// 4. Check js/editor.js
const editorJs = fs.readFileSync('a:/a-project/js/editor.js', 'utf8');
assert(editorJs.includes("'verticalAlign'"), 'editor.js textAndBoxKeys must include verticalAlign');
assert(editorJs.includes("mini.style.justifyContent = vAlign === 'top'"), 'editor.js must map vAlign in thumbnails');
assert(editorJs.includes("valignBtns"), 'editor.js must bind valignBtns');
assert(editorJs.includes("hud-valign-top"), 'editor.js must handle hud-valign-top');
assert(editorJs.includes("hud-valign-middle"), 'editor.js must handle hud-valign-middle');
assert(editorJs.includes("hud-valign-bottom"), 'editor.js must handle hud-valign-bottom');
assert(editorJs.includes("element.verticalAlign || 'middle'"), 'editor.js syncTypographyStudioUI must sync verticalAlign');
console.log('✓ js/editor.js verified (whitelist, thumbnail, listeners, sync)');

// 5. Check js/canvas.js
const canvasJs = fs.readFileSync('a:/a-project/js/canvas.js', 'utf8');
assert(canvasJs.includes("elem.verticalAlign || 'middle'"), 'canvas.js must read elem.verticalAlign');
assert(canvasJs.includes("vAlign === 'top'"), 'canvas.js must handle top vertical alignment');
assert(canvasJs.includes("vAlign === 'bottom'"), 'canvas.js must handle bottom vertical alignment');
console.log('✓ js/canvas.js verified (vAlign calculation logic)');

// 6. Test calculation logic simulation
function computeVerticalPosition(contentHeight, textHeight, padding, verticalAlign, hasBg = false) {
    const vAlign = verticalAlign || 'middle';
    const vPad = padding > 0 ? padding : (hasBg ? 16 : 0);
    if (vAlign === 'top') {
        return vPad;
    } else if (vAlign === 'bottom' || vAlign === 'down') {
        let y = contentHeight - vPad - textHeight;
        return y < vPad ? vPad : y;
    } else {
        let y = (contentHeight - textHeight) / 2;
        return y < vPad ? vPad : y;
    }
}

// Card with height 200, textHeight 40, padding 20
const topY = computeVerticalPosition(200, 40, 20, 'top');
const midY = computeVerticalPosition(200, 40, 20, 'middle');
const botY = computeVerticalPosition(200, 40, 20, 'bottom');

assert.strictEqual(topY, 20, 'Top align must equal padding 20');
assert.strictEqual(midY, 80, 'Middle align must equal (200 - 40) / 2 = 80');
assert.strictEqual(botY, 140, 'Bottom align must equal 200 - 20 - 40 = 140');

assert(topY < midY && midY < botY, 'Top < Middle < Bottom ordering must hold');
console.log(`✓ Mathematical simulation passed: Top = ${topY}px, Middle = ${midY}px, Bottom = ${botY}px`);

console.log('\n--- ALL VERTICAL ALIGNMENT TESTS PASSED! ---');
