const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const { claudeFallbackPath } = require('../server/claude-path')

test('fallback returns the native-installer path when it exists', () => {
  const home = path.join('C:', 'Users', 'Jean Dupont')
  const expected = path.join(home, '.local', 'bin', 'claude.exe')
  assert.equal(claudeFallbackPath(home, p => p === expected), expected)
})

test('fallback returns null when claude.exe is not there', () => {
  assert.equal(claudeFallbackPath('C:\\Users\\x', () => false), null)
})
