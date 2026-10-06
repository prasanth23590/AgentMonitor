const { test } = require('node:test')
const assert = require('node:assert/strict')
const { fitBlocks } = require('../server/wiki')

test('fitBlocks keeps blocks in order until the character budget is reached', () => {
  const out = fitBlocks(['aaaa', 'bbbb', 'cccc'], 10) // 4 + 2 (separator) + 4 = 10 fits; next would not
  assert.equal(out, 'aaaa\n\nbbbb')
})

test('fitBlocks never exceeds the budget and handles empty input', () => {
  const blocks = Array.from({ length: 50 }, (_, i) => 'x'.repeat(100 + i))
  assert.ok(fitBlocks(blocks, 1000).length <= 1000)
  assert.equal(fitBlocks([], 1000), '')
})

test('fitBlocks returns nothing (not a truncated block) when even the first block is too big', () => {
  assert.equal(fitBlocks(['x'.repeat(50)], 10), '')
})
