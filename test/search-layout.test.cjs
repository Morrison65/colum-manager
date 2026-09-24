const test = require('node:test');
const assert = require('node:assert/strict');
const { searchLayoutDispatch } = require('../colum-manager.user.js');

test('saved HTML without a React owner is left in its native layout', () => {
    assert.equal(searchLayoutDispatch({}), null);
});

test('an unrelated component or unknown virtualizer cannot dispatch a guessed hook', () => {
    const grid = {};
    const unexpected = { memoizedState: true, queue: { dispatch() { throw Error('Must not dispatch'); } } };
    grid.__reactFiber$test = { memoizedProps: {}, memoizedState: unexpected };
    assert.equal(searchLayoutDispatch(grid), null);
    grid.__reactFiber$test.memoizedProps = { isVirtualList: true, itemsPerPage: 20, calculateColumns() {}, itemTransformer() {} };
    unexpected.next = { memoizedState: { current: grid } };
    assert.equal(searchLayoutDispatch(grid), null);
});
