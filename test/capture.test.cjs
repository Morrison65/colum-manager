const test = require('node:test');
const assert = require('node:assert/strict');
const { options } = require('../skills/capture-site-layout/scripts/capture-site.cjs');

test('capture is bounded and cannot mix origins or credential-bearing URLs', () => {
    const base = ['--url', 'https://example.com/videos/', '--out', 'verification/new-capture'];
    const config = options([...base, '--include', '^/videos/', '--max-pages', '2']);
    assert.equal(config.maxPages, 2);
    assert(config.include.test('/videos/page-2/'));
    assert(!config.include.test('/account/logout/'));
    assert.throws(() => options([...base, '--max-pages', '100']), /Invalid maxPages/);
    assert.throws(() => options([...base, '--url', 'https://other.example/videos/']), /share one origin/);
    assert.throws(() => options(['--url', 'https://user:password@example.com/', '--out', 'verification/new-capture']), /no credentials/);
    assert.throws(() => options(['--url', 'file:///private', '--out', 'verification/new-capture']), /HTTP/);
});
