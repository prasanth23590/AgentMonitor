const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { reconcile } = require('../server/ledger')

function tmpLedger() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'am-ledger-'))
  return { file: path.join(dir, 'ledger.json'), dir }
}
const entry = (n, model = 'claude-opus-4') => ({
  input: n, output: n * 2, cacheCreation: n * 3, cacheRead: n * 4,
  byModel: { [model]: { input: n, output: n * 2, cacheCreation: n * 3, cacheRead: n * 4 } },
})

test('first call with no ledger reports nothing lost', () => {
  const { file } = tmpLedger()
  const lost = reconcile({ 'p/a.jsonl': entry(1) }, file)
  assert.deepEqual(lost, { input: 0, output: 0, cacheCreation: 0, cacheRead: 0, byModel: {} })
})

test('a pruned file moves into lost totals, including per-model', () => {
  const { file } = tmpLedger()
  reconcile({ 'p/a.jsonl': entry(1), 'p/b.jsonl': entry(10, 'claude-sonnet-4') }, file)
  const lost = reconcile({ 'p/a.jsonl': entry(1) }, file) // b pruned
  assert.equal(lost.input, 10)
  assert.equal(lost.output, 20)
  assert.equal(lost.cacheCreation, 30)
  assert.equal(lost.cacheRead, 40)
  assert.deepEqual(lost.byModel['claude-sonnet-4'], { input: 10, output: 20, cacheCreation: 30, cacheRead: 40 })
})

test('repeating the same snapshot does not add anything twice', () => {
  const { file } = tmpLedger()
  reconcile({ 'p/a.jsonl': entry(1), 'p/b.jsonl': entry(10) }, file)
  const first = reconcile({ 'p/a.jsonl': entry(1) }, file)
  const second = reconcile({ 'p/a.jsonl': entry(1) }, file)
  assert.deepEqual(second, first)
})

test('lost totals accumulate across several prunings and survive on disk', () => {
  const { file } = tmpLedger()
  reconcile({ a: entry(1), b: entry(2), c: entry(4) }, file)
  reconcile({ a: entry(1), c: entry(4) }, file)          // b gone → lost 2
  const lost = reconcile({ a: entry(1) }, file)          // c gone → lost 2 + 4
  assert.equal(lost.input, 6)
  assert.ok(fs.existsSync(file))
})

test('an empty scan (unreadable projects dir) is ignored, not treated as "everything pruned"', () => {
  const { file } = tmpLedger()
  reconcile({ a: entry(5) }, file)
  const lost = reconcile({}, file)
  assert.equal(lost.input, 0)
  // the files come back: still nothing lost, no double counting
  assert.equal(reconcile({ a: entry(5) }, file).input, 0)
})

test('a corrupt ledger file does not throw and starts fresh', () => {
  const { file } = tmpLedger()
  fs.writeFileSync(file, '{not json')
  const lost = reconcile({ a: entry(1) }, file)
  assert.equal(lost.input, 0)
})

test('a file that is unreadable this scan keeps its last known totals (not zeroed)', () => {
  const { file } = tmpLedger()
  reconcile({ a: entry(5), b: entry(1) }, file)
  reconcile({ a: null, b: entry(1) }, file)               // a locked by antivirus/OneDrive
  const lost = reconcile({ b: entry(1) }, file)           // a is pruned before it was ever readable again
  assert.equal(lost.input, 5)                             // history survived the transient failure
  assert.deepEqual(lost.byModel['claude-opus-4'], { input: 5, output: 10, cacheCreation: 15, cacheRead: 20 })
})

test('a file that is unreadable and then readable again is not double counted', () => {
  const { file } = tmpLedger()
  reconcile({ a: entry(5) }, file)
  reconcile({ a: null }, file)
  assert.equal(reconcile({ a: entry(5) }, file).input, 0)
})

test('a brand-new file that is unreadable is ignored without throwing', () => {
  const { file } = tmpLedger()
  assert.equal(reconcile({ a: entry(1), n: null }, file).input, 0)
  assert.equal(reconcile({ a: entry(1) }, file).input, 0)
})

test('a file whose totals shrink keeps the tokens it already reported (all-time must not go down)', () => {
  const { file } = tmpLedger()
  reconcile({ a: entry(10) }, file)
  const lost = reconcile({ a: entry(4) }, file)
  assert.equal(lost.input, 6)
  assert.equal(lost.output, 12)
  assert.deepEqual(lost.byModel['claude-opus-4'], { input: 6, output: 12, cacheCreation: 18, cacheRead: 24 })
  assert.equal(reconcile({ a: entry(4) }, file).input, 6) // and not again on the next scan
})
