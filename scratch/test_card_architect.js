const fs = require('fs');
const http = require('http');

console.log('================================================================');
console.log('🚀 RUNNING MAGIC STUDIO CARD ARCHITECT COMPREHENSIVE VERIFICATION');
console.log('================================================================');

// 1. Verify HTML Architecture
console.log('\n[1/4] Verifying HTML Elements & Hierarchy in index.html...');
const html = fs.readFileSync('index.html', 'utf8');

const expectedCardArchitectIds = [
  'btn-font-picker-trigger',
  'elem-font-family',
  'elem-font-weight',
  'card-architect-mode-segmented',
  'btn-mode-card-architect',
  'btn-mode-plain-text',
  'magic-card-architect-panel',
  'plain-text-panel',
  'btn-ai-auto-structure',
  'btn-ai-auto-balance',
  'card-block-heading',
  'card-heading-input',
  'btn-ai-punchy-title',
  'card-block-subtext',
  'card-subtext-input',
  'btn-ai-shorten-subtext',
  'btn-ai-bulletize-subtext',
  'btn-ai-polish-subtext',
  'elem-subtext-gap',
  'elem-subtext-size',
  'elem-subtext-weight',
  'elem-subtext-color-hex',
  'btn-subtext-color-trigger',
  'elem-subtext-line-height',
  'elem-subtext-letter-spacing',
  'field-elem-text',
  'elem-text'
];

const missingIds = expectedCardArchitectIds.filter(id => !html.includes(`id="${id}"`));
if (missingIds.length > 0) {
  console.error('❌ FAIL: Missing Card Architect IDs:', missingIds);
  process.exit(1);
}
console.log(`✅ PASS: All ${expectedCardArchitectIds.length} Card Architect IDs verified in index.html!`);

// 2. Verify CSS Styling
console.log('\n[2/4] Verifying Modern Glassmorphism CSS in styles.css...');
const css = fs.readFileSync('styles.css', 'utf8');

const expectedCssSelectors = [
  '.card-architect-mode-segmented',
  '.btn-card-mode',
  '.magic-card-architect-panel',
  '.card-architect-ai-bar',
  '.card-ai-bar-title',
  '.card-ai-bar-actions',
  '.btn-card-ai-action',
  '.card-semantic-block',
  '.card-block-header',
  '.card-block-title',
  '.card-block-ai-chips',
  '.card-ai-chip',
  '.card-architect-input',
  '.card-architect-textarea',
  '.card-inline-toolstrip',
  '.card-block-spacing-row',
  '.card-spacing-chip'
];

const missingCss = expectedCssSelectors.filter(sel => !css.includes(sel));
if (missingCss.length > 0) {
  console.error('❌ FAIL: Missing Card Architect CSS selectors:', missingCss);
  process.exit(1);
}
console.log(`✅ PASS: All ${expectedCssSelectors.length} Card Architect CSS selectors verified in styles.css!`);

// 3. Verify JavaScript Logic & API Wiring
console.log('\n[3/4] Verifying Logic & API Integration...');
const editorJs = fs.readFileSync('js/editor.js', 'utf8');
const apiJs = fs.readFileSync('js/api.js', 'utf8');
const serverJs = fs.readFileSync('server.js', 'utf8');
const workerJs = fs.readFileSync('worker.js', 'utf8');

const requiredEditorTokens = [
  'activeCardMode',
  'setCardMode',
  'btn-mode-card-architect',
  'btn-mode-plain-text',
  'card-heading-input',
  'card-subtext-input',
  'handleAiCardAction',
  'btn-ai-auto-structure',
  'btn-ai-auto-balance',
  'btn-ai-punchy-title',
  'btn-ai-shorten-subtext',
  'btn-ai-bulletize-subtext',
  'btn-ai-polish-subtext',
  'api.executeCardAction'
];

const missingEditorTokens = requiredEditorTokens.filter(tok => !editorJs.includes(tok));
if (missingEditorTokens.length > 0) {
  console.error('❌ FAIL: Missing Card Architect tokens in editor.js:', missingEditorTokens);
  process.exit(1);
}
console.log('✅ PASS: All Card Architect tokens present in js/editor.js!');

if (!apiJs.includes('executeCardAction')) {
  console.error('❌ FAIL: executeCardAction missing in js/api.js');
  process.exit(1);
}
console.log('✅ PASS: executeCardAction verified in js/api.js!');

if (!serverJs.includes('/api/ai/card-action') || !workerJs.includes('/api/ai/card-action')) {
  console.error('❌ FAIL: /api/ai/card-action missing in server.js or worker.js');
  process.exit(1);
}
console.log('✅ PASS: /api/ai/card-action endpoint verified in server.js & worker.js!');

// 4. Live API Test against running server
console.log('\n[4/4] Testing Live AI Card Action API at http://localhost:3000/api/ai/card-action...');

function testLiveAction(action, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ action, ...payload });
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/ai/card-action',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 5000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(data);
    req.end();
  });
}

async function runLiveTests() {
  const actions = [
    {
      action: 'auto-structure',
      payload: { text: 'EPISODIC & WORKING MEMORY: Vectorized context stores, multi-agent message routing and recall buffers for high accuracy AI operations.' }
    },
    {
      action: 'punchy-title',
      payload: { text: 'A comprehensive overview of vectorized context stores and memory management techniques' }
    },
    {
      action: 'shorten',
      payload: { subtext: 'Our platform utilizes state-of-the-art vector embedding indexes coupled with hierarchical retrieval-augmented generation architectures to ensure high performance.' }
    },
    {
      action: 'bulletize',
      payload: { subtext: 'We support instant cloud deployment. Automated scale to zero. Built-in distributed GPU acceleration.' }
    },
    {
      action: 'auto-balance',
      payload: { fontSize: 44, subtextSize: 32 }
    }
  ];

  for (const test of actions) {
    try {
      const res = await testLiveAction(test.action, test.payload);
      if (res.status === 200 && res.data && res.data.success) {
        const payloadResult = res.data.data || res.data.result || {};
        console.log(`  ✨ [PASS] Action "${test.action}": HTTP 200 | Result:`, (JSON.stringify(payloadResult) || '').slice(0, 100) + '...');
      } else {
        console.error(`  ❌ [FAIL] Action "${test.action}":`, res);
        process.exit(1);
      }
    } catch (e) {
      console.error(`  ❌ [ERROR] Action "${test.action}" network/server error:`, e.message);
      process.exit(1);
    }
  }

  console.log('\n================================================================');
  console.log('🎉 ALL MAGIC STUDIO CARD ARCHITECT VERIFICATION TESTS PASSED!');
  console.log('================================================================');
}

runLiveTests();
