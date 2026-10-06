const { test } = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('child_process')
const { psQuote, isSafeCwd } = require('../server/launch-safety')

const onWindows = process.platform === 'win32'

// Run `psQuote(value)` through a real PowerShell and return the char codes it evaluates to,
// so the test proves the literal round-trips instead of trusting string replacement.
function psRoundTrip(value) {
  const script = `Write-Output (([int[]][char[]](${psQuote(value)})) -join ',')`
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { encoding: 'utf8' })
  return out.trim().split('\n').pop().trim()
}
const codes = s => [...s].map(c => c.charCodeAt(0)).join(',')

test('psQuote round-trips ASCII quotes, curly quotes, $() and ; through real PowerShell', { skip: !onWindows }, () => {
  for (const v of [
    "it's",
    'Bob\u2019s stuff',                       // curly apostrophe (Word/macOS)
    'x\u2019; calc; \u2018',                  // would break out of a naive literal and run `calc`
    'a\u201Ab\u201Bc',                        // the other two PowerShell quote characters
    'C:\\tmp\\a $(calc) ;b',
  ]) {
    assert.equal(psRoundTrip(v), codes(v), `value ${JSON.stringify(v)}`)
  }
})

test('psQuote doubles every PowerShell quote character', () => {
  assert.equal(psQuote("a'b\u2019c"), "'a''b\u2019\u2019c'")
})

test('Windows cwd: backslashes, spaces, curly apostrophes and commas are fine', () => {
  assert.equal(isSafeCwd('C:\\Users\\Jean Dupont\\Bob\u2019s stuff', true), true)
  assert.equal(isSafeCwd('C:\\src\\Smith, John', true), true)
})

test('Windows cwd: ; (Windows Terminal command separator) and cmd metacharacters are rejected', () => {
  for (const bad of ['C:\\src\\foo;new-tab cmd /k calc', 'C:\\a&b', 'C:\\a%PATH%', 'C:\\a^b', 'C:\\a"b', 'C:\\a`b']) {
    assert.equal(isSafeCwd(bad, true), false, bad)
  }
})

test('POSIX cwd: backslash and quotes are still rejected', () => {
  assert.equal(isSafeCwd('/home/a\\b', false), false)
  assert.equal(isSafeCwd("/home/it's", false), false)
  assert.equal(isSafeCwd('/home/ok dir', false), true)
})
