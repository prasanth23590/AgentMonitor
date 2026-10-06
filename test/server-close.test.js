const { test } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const { start } = require('../server')

test('close() resolves promptly even with an open SSE connection', async () => {
  const srv = await start({ port: 0 })
  await new Promise((resolve, reject) => {
    const r = http.get({ host: '127.0.0.1', port: srv.port, path: '/api/sessions/stream' }, res => {
      res.once('data', resolve) // first frame arrived → stream is open
    })
    r.on('error', () => {}) // the socket is destroyed by close(); ignore
    setTimeout(() => reject(new Error('no SSE frame')), 3000)
  })
  const closed = await Promise.race([
    srv.close().then(() => 'closed'),
    new Promise(r => setTimeout(() => r('timeout'), 3000)),
  ])
  assert.equal(closed, 'closed')
})
