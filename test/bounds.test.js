const { test } = require('node:test')
const assert = require('node:assert/strict')
const { resolveBounds } = require('../electron/bounds')

const main = { workArea: { x: 0, y: 0, width: 1920, height: 1040 } }
const left = { workArea: { x: -1920, y: 0, width: 1920, height: 1040 } }

test('no / garbage saved bounds → defaults', () => {
  assert.deepEqual(resolveBounds(null, [main]), { width: 1400, height: 900 })
  assert.deepEqual(resolveBounds({ width: 'x', height: NaN }, [main]), { width: 1400, height: 900 })
  assert.deepEqual(resolveBounds({ width: 100, height: 100, x: 0, y: 0 }, [main]), { width: 1400, height: 900 })
})

test('bounds fully on a display are kept', () => {
  const saved = { x: 100, y: 50, width: 1200, height: 800 }
  assert.deepEqual(resolveBounds(saved, [main]), saved)
})

test('bounds on a secondary monitor to the left are kept while it is attached', () => {
  const saved = { x: -1500, y: 20, width: 1200, height: 800 }
  assert.deepEqual(resolveBounds(saved, [left, main]), saved)
})

test('bounds on a monitor that is no longer attached drop the position (Review Focus #4)', () => {
  const saved = { x: -1500, y: 20, width: 1200, height: 800 }
  assert.deepEqual(resolveBounds(saved, [main]), { width: 1200, height: 800 })
})

test('window mostly off-screen (< 100px visible) drops the position', () => {
  const saved = { x: 1880, y: 20, width: 1200, height: 800 } // only 40px visible
  assert.deepEqual(resolveBounds(saved, [main]), { width: 1200, height: 800 })
})
