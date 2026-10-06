// server/llm.js — LLM access for the Knowledge Graph (wiki compile + Q&A) via a local Ollama server.
//
// Uses node:http, not fetch: fetch (undici) gives up after 5 minutes without response headers, and Ollama
// sends no headers until the first generated token — on a CPU, reading a large prompt can take longer.
//
// Config (all optional): AGENT_MONITOR_OLLAMA_URL, AGENT_MONITOR_MODEL, AGENT_MONITOR_NUM_CTX.

const http = require('http')

const DEFAULT_URL = 'http://127.0.0.1:11434'
const DEFAULT_MODEL = 'gemma4:12b'
// Ollama's own default context is 4096 tokens and it silently truncates anything longer, which would
// quietly ruin a compile. Always ask for an explicit window.
const DEFAULT_NUM_CTX = 16384

const baseUrl = () => (process.env.AGENT_MONITOR_OLLAMA_URL || DEFAULT_URL).replace(/\/+$/, '')
const getModel = () => process.env.AGENT_MONITOR_MODEL || DEFAULT_MODEL
const getNumCtx = () => Number(process.env.AGENT_MONITOR_NUM_CTX) || DEFAULT_NUM_CTX

function friendly(err) {
  if (err && (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT')) {
    return new Error(`Ollama is not running at ${baseUrl()} — start the Ollama app`)
  }
  return err
}

function getJson(pathname, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const req = http.get(new URL(baseUrl() + pathname), res => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', c => { data += c })
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`Ollama ${res.statusCode}`))
        try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
      })
    })
    req.setTimeout(timeoutMs, () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })))
    req.on('error', err => reject(friendly(err)))
  })
}

// { running, model, installed, models } — never throws
async function getStatus() {
  const model = getModel()
  try {
    const tags = await getJson('/api/tags')
    const models = (tags.models || []).map(m => m.name)
    const installed = models.some(n => n === model || n === `${model}:latest`)
    return { running: true, model, installed, models }
  } catch {
    return { running: false, model, installed: false, models: [] }
  }
}

// Send one system+user exchange; resolves with the full reply text. json: true constrains the output to JSON.
function chat({ system, user, json = false }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: getModel(),
      stream: true,
      think: false, // thinking mode costs minutes on a CPU and these tasks don't need it
      ...(json ? { format: 'json' } : {}),
      options: { num_ctx: getNumCtx(), temperature: 0.2 },
      messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: user }],
    })

    const req = http.request(new URL(`${baseUrl()}/api/chat`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, res => {
      res.setEncoding('utf8')
      let buf = ''
      let text = ''
      let errBody = ''
      let streamError = null

      const handleLine = line => {
        if (!line.trim()) return
        let obj
        try { obj = JSON.parse(line) } catch { return }
        if (obj.error) { streamError = new Error(`Ollama: ${obj.error}`); return }
        if (obj.message && obj.message.content) text += obj.message.content
      }

      res.on('data', c => {
        if (res.statusCode !== 200) { errBody += c; return }
        buf += c
        let i
        while ((i = buf.indexOf('\n')) >= 0) { handleLine(buf.slice(0, i)); buf = buf.slice(i + 1) }
      })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          let msg = errBody.slice(0, 200)
          try { msg = JSON.parse(errBody).error || msg } catch { /* not JSON */ }
          return reject(new Error(`Ollama ${res.statusCode}: ${msg}`))
        }
        handleLine(buf)
        if (streamError) return reject(streamError)
        resolve(text.trim())
      })
      // the socket closed before the response completed: don't return partial text as if it were the answer
      res.on('close', () => { if (!res.complete) reject(new Error('Ollama closed the connection before finishing')) })
      res.on('error', reject)
    })
    req.on('error', err => reject(friendly(err)))
    req.write(payload)
    req.end()
  })
}

module.exports = { chat, getStatus, getModel }
