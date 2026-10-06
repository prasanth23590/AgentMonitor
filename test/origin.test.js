const { test } = require('node:test')
const assert = require('node:assert/strict')
const { isSameOrigin } = require('../electron/origin')

const origin = 'http://127.0.0.1:5000'

test('same-origin URLs pass', () => {
  assert.equal(isSameOrigin('http://127.0.0.1:5000/', origin), true)
  assert.equal(isSameOrigin('http://127.0.0.1:5000/api/x?y=1#z', origin), true)
})

test('userinfo trick (host is really evil.com) is rejected', () => {
  assert.equal(isSameOrigin('http://127.0.0.1:5000@evil.com/', origin), false)
})

test('a longer port that merely starts with the origin is rejected', () => {
  assert.equal(isSameOrigin('http://127.0.0.1:50001/', origin), false)
})

test('other host, other scheme, garbage and empty are rejected', () => {
  for (const u of ['https://127.0.0.1:5000/', 'http://localhost:5000/', 'http://evil.com/', 'not a url', '', undefined, null]) {
    assert.equal(isSameOrigin(u, origin), false, String(u))
  }
})
