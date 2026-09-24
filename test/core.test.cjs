const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanSettings, fittingColumns, siteFor, searchLayoutDispatch } = require('../colum-manager.user.js');

test('storage corruption and out of range inputs preserve defaults', () => {
    for (const value of [null, false, [], 'text', { columns: 0, gap: 41, wide: 'false' }, { columns: 1.5, gap: -1 }]) {
        assert.deepEqual(cleanSettings(value), cleanSettings());
    }
    assert.equal(cleanSettings({ columns: 8, gap: 0, wide: false }).columns, 8);
    assert.equal(cleanSettings({ columns: 8, gap: 0, wide: false }).wide, false);
});
test('responsive columns account for gaps and never reach zero', () => {
    assert.equal(fittingColumns(1920, 8, 8), 8);
    assert.equal(fittingColumns(430, 8, 40), 1);
    assert.equal(fittingColumns(900, 8, 8), 4);
    assert.equal(fittingColumns(0, 3, 8), 1);
});
test('only explicitly supported hosts match', () => {
    assert.equal(siteFor('site-ma.brazzers.com'), 'brazzers');
    assert.equal(siteFor('www.c4splus.com'), 'c4splus');
    assert.equal(siteFor('c4splus.com'), 'c4splus');
    for (const host of ['c4splus.com.example.org', 'www.brazzers.com', 'example.com']) assert.equal(siteFor(host), null);
});
test('virtual adapter requires the entire known React hook signature', () => {
    const grid = {};
    assert.equal(searchLayoutDispatch(grid), null);
    const noop = () => {}, range = [0, 60];
    const values = [300, 5, 220, range, true, { create: noop, deps: [true] },
        { create: noop, deps: [220, 5, noop, true] }, [noop, [range, noop, 220, 5, 300, true, noop]], { current: grid }];
    const hooks = values.map(memoizedState => ({ memoizedState, queue: { dispatch: noop } }));
    hooks.forEach((hook, i) => hook.next = hooks[i + 1]);
    grid.__reactFiber$fixture = { memoizedProps: { isVirtualList: true, calculateColumns: noop, itemTransformer: noop, itemsPerPage: 20 }, memoizedState: hooks[0] };
    assert.equal(searchLayoutDispatch(grid), noop);
    hooks[6].memoizedState.deps[0] = 999;
    assert.equal(searchLayoutDispatch(grid), null);
    delete grid.__reactFiber$fixture.memoizedProps.calculateColumns;
    assert.equal(searchLayoutDispatch(grid), null);
});
