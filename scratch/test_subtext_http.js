const http = require('http');
const assert = require('assert');

console.log('Testing live HTTP server at http://localhost:3000...');

http.get('http://localhost:3000/', (res) => {
    assert.strictEqual(res.statusCode, 200, `Expected 200 OK but got ${res.statusCode}`);
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
        assert(data.includes('id="btn-scope-heading"'), 'index.html missing btn-scope-heading over HTTP');
        assert(data.includes('id="btn-scope-subtext"'), 'index.html missing btn-scope-subtext over HTTP');
        assert(data.includes('id="group-subtext-styles"'), 'index.html missing group-subtext-styles over HTTP');
        assert(data.includes('id="btn-toggle-subtext"'), 'index.html missing btn-toggle-subtext over HTTP');
        assert(data.includes('id="elem-subtext-size"'), 'index.html missing elem-subtext-size over HTTP');
        assert(data.includes('id="elem-subtext-color"'), 'index.html missing elem-subtext-color over HTTP');
        console.log('✓ Live server is actively serving the updated index.html with all subtext controls!');

        // Also verify js/editor.js over HTTP
        http.get('http://localhost:3000/js/editor.js', (resJs) => {
            assert.strictEqual(resJs.statusCode, 200, `Expected 200 OK for editor.js but got ${resJs.statusCode}`);
            let jsData = '';
            resJs.on('data', chunk => { jsData += chunk; });
            resJs.on('end', () => {
                assert(jsData.includes('subtextSize'), 'editor.js over HTTP missing subtextSize');
                assert(jsData.includes('setTypoScope'), 'editor.js over HTTP missing setTypoScope');
                assert(jsData.includes('subtextColor'), 'editor.js over HTTP missing subtextColor');
                console.log('✓ Live server is actively serving the updated js/editor.js with subtext handlers!');
                console.log('\nAll HTTP integration checks passed successfully!');
            });
        });
    });
}).on('error', (err) => {
    console.error('HTTP request error:', err);
    process.exit(1);
});
