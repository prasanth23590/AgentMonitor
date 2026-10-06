const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const http = require('http')
const net = require('net')
const { start } = require('../server')

let srv, dir

// `fetch` can't set the Host header, so use http.request.
function req({ method = 'GET', url = '/', host, headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const h = { ...headers }
    if (host !== undefined) h.Host = host
    const r = http.request({ host: '127.0.0.1', port: srv.port, path: url, method, headers: h }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }))
    })
    r.on('error', reject)
    if (body) r.write(body)
    r.end()
  })
}

before(async () => {
  // leading dot + space in the folder name on purpose (Review Focus #3)
  dir = fs.mkdtempSync(path.join(os.tmpdir(), '.agent monitor '))
  fs.writeFileSync(path.join(dir, 'index.html'), '<html>SPA-OK</html>')
  fs.writeFileSync(path.join(dir, 'app.js'), 'console.log(1)')
  srv = await start({ port: 0, staticDir: dir })
})
after(async () => {
  await srv.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

test('binds a real port on loopback', () => {
  assert.ok(srv.port > 0)
})

test('serves index.html at / and static assets from a dot+space directory', async () => {
  const root = await req({ url: '/' })
  assert.equal(root.status, 200)
  assert.match(root.body, /SPA-OK/)
  const js = await req({ url: '/app.js' })
  assert.equal(js.status, 200)
  assert.match(js.body, /console\.log/)
})

test('SPA fallback serves index.html for unknown non-API routes', async () => {
  const r = await req({ url: '/some/client/route' })
  assert.equal(r.status, 200)
  assert.match(r.body, /SPA-OK/)
})

test('unknown /api routes are a 404, not the SPA', async () => {
  const r = await req({ url: '/api/does-not-exist' })
  assert.equal(r.status, 404)
  assert.doesNotMatch(r.body, /SPA-OK/)
})

test('API answers on the same origin', async () => {
  const r = await req({ url: '/api/insights/meta' })
  assert.equal(r.status, 200)
  assert.ok('exists' in JSON.parse(r.body))
})

test('loopback Host headers are accepted (with and without port)', async () => {
  for (const host of ['localhost', `localhost:${srv.port}`, `127.0.0.1:${srv.port}`, 'localhost:5173', `[::1]:${srv.port}`]) {
    const r = await req({ url: '/api/insights/meta', host })
    assert.equal(r.status, 200, `host ${host}`)
  }
})

test('non-loopback / look-alike Host headers are rejected (DNS rebinding)', async () => {
  for (const host of ['evil.example', 'localhost.evil.com', '127.0.0.1.evil.com', 'evil.com:80']) {
    const r = await req({ url: '/api/sessions', host })
    assert.equal(r.status, 403, `host "${host}"`)
  }
})

// http.request replaces an empty Host with the real one, so send these over a raw socket.
function rawStatus(requestText) {
  return new Promise((resolve, reject) => {
    const s = net.connect(srv.port, '127.0.0.1', () => s.write(requestText))
    let data = ''
    s.on('data', c => { data += c })
    s.on('end', () => resolve(Number(/^HTTP\/1\.[01] (\d{3})/.exec(data)[1])))
    s.on('error', reject)
  })
}

test('an empty or missing Host header is rejected', async () => {
  assert.equal(await rawStatus('GET /api/sessions HTTP/1.1\r\nHost: \r\nConnection: close\r\n\r\n'), 403)
  assert.equal(await rawStatus('GET /api/sessions HTTP/1.0\r\n\r\n'), 403)
})

test('POST /api/stop is disabled unless enableStop is set (it would kill the parent process)', async () => {
  const r = await req({ method: 'POST', url: '/api/stop', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  assert.equal(r.status, 404)
})

test('GET /api/llm/status reports Ollama state (not running → running:false, never an error)', async () => {
  process.env.AGENT_MONITOR_OLLAMA_URL = 'http://127.0.0.1:1'
  try {
    const r = await req({ url: '/api/llm/status' })
    assert.equal(r.status, 200)
    const s = JSON.parse(r.body)
    assert.equal(s.running, false)
    assert.equal(s.installed, false)
    assert.equal(s.model, 'gemma4:12b')
  } finally { delete process.env.AGENT_MONITOR_OLLAMA_URL }
})

test('the old /api/llm/providers route is gone', async () => {
  assert.equal((await req({ url: '/api/llm/providers' })).status, 404)
})
