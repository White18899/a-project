const fs = require('fs');

console.log('--- RUNNING STUDIO PRO FONT PICKER POPOVER VERIFICATION TEST ---');

// 1. Verify HTML Structure
const html = fs.readFileSync('index.html', 'utf8');

const requiredHtmlIds = [
  'btn-font-picker-trigger',
  'selected-font-name',
  'selected-font-badge',
  'font-trigger-glyph',
  'elem-font-family',
  'elem-font-weight',
  'studio-font-picker-popover',
  'font-picker-search-input',
  'btn-clear-font-search',
  'font-picker-categories',
  'font-picker-recents-section',
  'font-picker-recent-list',
  'font-picker-catalog-title',
  'font-picker-catalog-list',
  'font-picker-empty',
  'btn-clear-recent-fonts'
];

let missingIds = requiredHtmlIds.filter(id => !html.includes(`id="${id}"`));
if (missingIds.length > 0) {
  console.error('[FAIL] Missing Font Picker IDs in index.html:', missingIds);
  process.exit(1);
} else {
  console.log(`[PASS] All ${requiredHtmlIds.length} Font Picker IDs verified in index.html!`);
}

// 2. Verify all 35 Google Fonts are present in hidden select
const expectedFonts = [
  'Outfit', 'Inter', 'Montserrat', 'Space Grotesk', 'Unbounded', 'Comfortaa',
  'Quicksand', 'Bebas Neue', 'Playfair Display', 'Cinzel', 'Cinzel Decorative',
  'Cormorant Garamond', 'Abril Fatface', 'Cardo', 'Oswald', 'Josefin Sans',
  'Rajdhani', 'Righteous', 'Russo One', 'Lobster', 'Satisfy', 'Dancing Script',
  'Courgette', 'Pacifico', 'Kaushan Script', 'Permanent Marker', 'Shadows Into Light',
  'Fira Code', 'Space Mono', 'Courier New', 'Press Start 2P', 'VT323',
  'Silkscreen', 'Arial', 'Georgia'
];

let missingFontOptions = expectedFonts.filter(f => !html.includes(`value="${f}"`));
if (missingFontOptions.length > 0) {
  console.error('[FAIL] Missing Font options in select:', missingFontOptions);
  process.exit(1);
} else {
  console.log(`[PASS] All ${expectedFonts.length} font options preserved in #elem-font-family!`);
}

// 3. Verify CSS Rules
const css = fs.readFileSync('styles.css', 'utf8');
const requiredCssSelectors = [
  '.typo-font-grid-pro',
  '.btn-font-picker-trigger',
  '.font-trigger-glyph',
  '.font-trigger-info',
  '.font-trigger-name',
  '.font-trigger-badge',
  '.font-trigger-chevron',
  '.typo-select-weight-pro',
  '.studio-font-popover',
  '.font-popover-header',
  '.font-search-bar',
  '#font-picker-search-input',
  '.font-category-pills',
  '.font-pill',
  '.font-popover-body',
  '.font-section-group',
  '.font-section-title',
  '.btn-clear-recents',
  '.font-card-list',
  '.font-specimen-card',
  '.font-card-name',
  '.font-card-tag',
  '.font-card-sample',
  '.font-card-check',
  '.font-picker-empty'
];

let missingCss = requiredCssSelectors.filter(sel => !css.includes(sel));
if (missingCss.length > 0) {
  console.error('[FAIL] Missing Font Picker CSS selectors:', missingCss);
  process.exit(1);
} else {
  console.log(`[PASS] All ${requiredCssSelectors.length} Font Picker CSS selectors verified in styles.css!`);
}

// 4. Verify JavaScript Logic
const editorJs = fs.readFileSync('js/editor.js', 'utf8');
const requiredJsTokens = [
  'GOOGLE_FONTS_CATALOG',
  'initStudioFontPicker',
  'window.updateStudioFontTrigger',
  'btn-font-picker-trigger',
  'studio-font-picker-popover',
  'font-picker-search-input',
  'font-picker-categories',
  'studio_recent_fonts',
  'repositionFontPicker',
  'openFontPickerPopover',
  'closeFontPickerPopover',
  'createFontCard',
  'renderFontLists'
];

let missingJs = requiredJsTokens.filter(tok => !editorJs.includes(tok));
if (missingJs.length > 0) {
  console.error('[FAIL] Missing Font Picker JS tokens:', missingJs);
  process.exit(1);
} else {
  console.log(`[PASS] All ${requiredJsTokens.length} Font Picker JS logic tokens verified in js/editor.js!`);
}

// 5. Verify Catalog contains all 35 fonts
expectedFonts.forEach(font => {
  if (!editorJs.includes(`name: '${font}'`)) {
    console.error(`[FAIL] Font "${font}" missing from GOOGLE_FONTS_CATALOG in js/editor.js`);
    process.exit(1);
  }
});
console.log(`[PASS] All ${expectedFonts.length} fonts confirmed in GOOGLE_FONTS_CATALOG!`);

console.log('--- ALL STUDIO PRO FONT PICKER POPOVER TESTS PASSED ---');
