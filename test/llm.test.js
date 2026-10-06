const { test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const llm = require('../server/llm')

let fake, requests

// Minimal stand-in for Ollama's HTTP API. `handler(req, bodyText, res)` decides the response.
function startFake(handler) {
  requests = []
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let body = ''
      req.on('data', c => { body += c })
      req.on('end', () => {
        requests.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : null })
        handler(req, body, res)
      })
    })
    server.listen(0, '127.0.0.1', () => {
      process.env.AGENT_MONITOR_OLLAMA_URL = `http://127.0.0.1:${server.address().port}`
      resolve(server)
    })
  })
}
const ndjson = (...objs) => objs.map(o => JSON.stringify(o)).join('\n') + '\n'
const chunk = text => ({ message: { role: 'assistant', content: text }, done: false })
const done = { message: { role: 'assistant', content: '' }, done: true }

beforeEach(() => { delete process.env.AGENT_MONITOR_MODEL; delete process.env.AGENT_MONITOR_NUM_CTX })
afterEach(async () => {
  delete process.env.AGENT_MONITOR_OLLAMA_URL
  if (fake) await new Promise(r => { fake.closeAllConnections(); fake.close(r) })
  fake = null
})

test('chat posts the model, system+user messages, streaming, and an explicit num_ctx', async () => {
  fake = await startFake((req, body, res) => { res.end(ndjson(chunk('hi'), done)) })
  const out = await llm.chat({ system: 'be brief', user: 'hello' })
  assert.equal(out, 'hi')
  const sent = requests[0]
  assert.equal(sent.method, 'POST')
  assert.equal(sent.url, '/api/chat')
  assert.equal(sent.body.model, 'gemma4:12b')
  assert.equal(sent.body.stream, true)
  assert.equal(sent.body.think, false)
  assert.equal(sent.body.options.num_ctx, 16384) // Ollama's default is 4096, which silently truncates big prompts
  assert.deepEqual(sent.body.messages, [
    { role: 'system', content: 'be brief' },
    { role: 'user', content: 'hello' },
  ])
  assert.equal('format' in sent.body, false)
})

test('json: true asks Ollama for constrained JSON output', async () => {
  fake = await startFake((req, body, res) => { res.end(ndjson(chunk('{}'), done)) })
  await llm.chat({ user: 'x', json: true })
  assert.equal(requests[0].body.format, 'json')
  assert.equal(requests[0].body.messages.length, 1) // no system message when none given
})

test('model and context size can be overridden with environment variables', async () => {
  process.env.AGENT_MONITOR_MODEL = 'gemma4:e4b'
  process.env.AGENT_MONITOR_NUM_CTX = '8192'
  fake = await startFake((req, body, res) => { res.end(ndjson(done)) })
  await llm.chat({ user: 'x' })
  assert.equal(requests[0].body.model, 'gemma4:e4b')
  assert.equal(requests[0].body.options.num_ctx, 8192)
})

test('chunks are reassembled even when a JSON line is split across network writes', async () => {
  fake = await startFake((req, body, res) => {
    const line = JSON.stringify(chunk('hello world')) + '\n'
    res.write(line.slice(0, 15))
    setTimeout(() => { res.write(line.slice(15)); res.end(ndjson(chunk('!'), done)) }, 30)
  })
  assert.equal(await llm.chat({ user: 'x' }), 'hello world!')
})

test('an HTTP error surfaces Ollama\'s message (e.g. model not pulled)', async () => {
  fake = await startFake((req, body, res) => {
    res.statusCode = 404
    res.end(JSON.stringify({ error: "model 'gemma4:12b' not found" }))
  })
  await assert.rejects(llm.chat({ user: 'x' }), /404.*model 'gemma4:12b' not found/)
})

test('an error object in the middle of the stream rejects', async () => {
  fake = await startFake((req, body, res) => {
    res.end(ndjson(chunk('par'), { error: 'out of memory' }))
  })
  await assert.rejects(llm.chat({ user: 'x' }), /out of memory/)
})

test('a connection cut before the stream finishes rejects instead of returning partial text', async () => {
  fake = await startFake((req, body, res) => {
    res.writeHead(200)
    res.write(ndjson(chunk('partial')))
    setTimeout(() => res.destroy(), 20)
  })
  await assert.rejects(llm.chat({ user: 'x' }))
})

test('Ollama not running gives an actionable message', async () => {
  process.env.AGENT_MONITOR_OLLAMA_URL = 'http://127.0.0.1:1' // nothing listens on port 1
  await assert.rejects(llm.chat({ user: 'x' }), /Ollama is not running/)
})

test('getStatus: running with the model installed', async () => {
  fake = await startFake((req, body, res) => { res.end(JSON.stringify({ models: [{ name: 'gemma4:12b' }, { name: 'other:latest' }] })) })
  assert.deepEqual(await llm.getStatus(), { running: true, model: 'gemma4:12b', installed: true, models: ['gemma4:12b', 'other:latest'] })
})

test('getStatus: running but the model is not pulled', async () => {
  fake = await startFake((req, body, res) => { res.end(JSON.stringify({ models: [{ name: 'gemma4:e4b' }] })) })
  const s = await llm.getStatus()
  assert.equal(s.running, true)
  assert.equal(s.installed, false)
})

test('getStatus: not running', async () => {
  process.env.AGENT_MONITOR_OLLAMA_URL = 'http://127.0.0.1:1'
  const s = await llm.getStatus()
  assert.equal(s.running, false)
  assert.equal(s.installed, false)
  assert.equal(s.model, 'gemma4:12b')
})
