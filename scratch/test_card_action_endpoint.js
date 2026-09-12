const http = require('http');
const assert = require('assert');

function postJson(url, data) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const body = JSON.stringify(data);
        const req = http.request({
            hostname: u.hostname,
            port: u.port,
            path: u.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let resBody = '';
            res.on('data', chunk => resBody += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(resBody);
                    resolve({ status: res.statusCode, body: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: resBody });
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function run() {
    console.log('Testing /api/ai/card-action endpoints...');

    // 1. auto-structure
    const res1 = await postJson('http://localhost:3000/api/ai/card-action', {
        action: 'auto-structure',
        text: '01 EPISODIC & WORKING MEMORY\n\nVectorized context stores and cognitive memory architecture for autonomous agents.'
    });
    console.log('Auto-Structure Result:', res1.status, res1.body.result);
    assert.strictEqual(res1.status, 200);
    assert(res1.body.result.heading);
    assert(res1.body.result.subtext);

    // 2. punchy-title
    const res2 = await postJson('http://localhost:3000/api/ai/card-action', {
        action: 'punchy-title',
        heading: '01 EPISODIC & WORKING MEMORY'
    });
    console.log('Punchy Title Result:', res2.status, res2.body.result);
    assert.strictEqual(res2.status, 200);
    assert(res2.body.result.heading);

    // 3. shorten
    const res3 = await postJson('http://localhost:3000/api/ai/card-action', {
        action: 'shorten',
        subtext: 'In 2026, artificial intelligence transitions from passive assistants into autonomous agent swarms that coordinate complex workflows.'
    });
    console.log('Shorten Result:', res3.status, res3.body.result);
    assert.strictEqual(res3.status, 200);
    assert(res3.body.result.subtext);

    // 4. bulletize
    const res4 = await postJson('http://localhost:3000/api/ai/card-action', {
        action: 'bulletize',
        subtext: 'Vectorized context stores for real-time retrieval. Persistent working memory across agent tasks. Dynamic semantic recall.'
    });
    console.log('Bulletize Result:', res4.status, res4.body.result);
    assert.strictEqual(res4.status, 200);
    assert(res4.body.result.subtext.includes('•'));

    // 5. auto-balance
    const res5 = await postJson('http://localhost:3000/api/ai/card-action', {
        action: 'auto-balance',
        cardWidth: 500,
        cardHeight: 400,
        subtext: 'Short description.'
    });
    console.log('Auto-Balance Result:', res5.status, res5.body.result);
    assert.strictEqual(res5.status, 200);
    assert(res5.body.result.suggestedHeadingSize);

    console.log('\nAll 5 /api/ai/card-action tests PASSED successfully!');
}

run().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
