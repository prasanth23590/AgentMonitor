const express = require('express')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFileSync, spawn } = require('child_process')
const { readSessions, readPastSessions, readTokenTotals, readTools } = require('./reader')
const llm = require('./llm')
const { resolveClaude } = require('./claude-path')
const wiki = require('./wiki')
const { isSafeCwd, psQuote } = require('./launch-safety')

const IS_WIN = os.platform() === 'win32'

// All PATH matches for a command (`where.exe` on Windows, `which` elsewhere)
function whereAll(cmd) {
  try {
    return execFileSync(IS_WIN ? 'where.exe' : 'which', [cmd], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/).map(x => x.trim()).filter(Boolean)
  } catch { return [] }
}
const hasCmd = cmd => whereAll(cmd).length > 0

// VS Code CLI. On Windows `where code` lists an extensionless shell script plus code.cmd; only the .cmd is spawnable.
function findCode() {
  const matches = whereAll('code')
  if (IS_WIN) return matches.find(p => /\.(cmd|exe)$/i.test(p)) || null
  if (matches[0]) return matches[0]
  if (os.platform() === 'darwin') {
    const candidates = [
      '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
      `${os.homedir()}/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code`,
    ]
    return candidates.find(c => fs.existsSync(c)) || null
  }
  return null
}

const app = express()
const DEFAULT_PORT = 3001
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])
let stopEnabled = false

// Hostname part of a Host header: "localhost:5173" → "localhost", "[::1]:80" → "[::1]"
function hostnameOf(hostHeader = '') {
  const m = /^(\[[^\]]+\]|[^:]+)(?::\d+)?$/.exec(String(hostHeader).trim().toLowerCase())
  return m ? m[1] : ''
}

// DNS-rebinding guard: a hostile page can make its own domain resolve to 127.0.0.1, but the browser
// still sends that domain in Host. Exact-match on the hostname (never startsWith) so
// "localhost.evil.com" and "127.0.0.1.evil.com" are rejected.
app.use((req, res, next) => {
  if (!LOOPBACK_HOSTS.has(hostnameOf(req.headers.host))) return res.status(403).json({ error: 'forbidden host' })
  next()
})

app.use(express.json())
app.use((req, res, next) => {
  const allowed = ['http://localhost:5173', 'http://localhost:5174']
  const origin = req.headers.origin
  if (allowed.includes(origin)) res.header('Access-Control-Allow-Origin', origin)
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// One-shot snapshot
app.get('/api/sessions', (req, res) => {
  res.json(readSessions())
})

// SSE stream — pushes update every 3 seconds
app.get('/api/sessions/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = () => {
    try {
      const data = JSON.stringify(readSessions())
      res.write(`data: ${data}\n\n`)
    } catch (err) {
      console.error('SSE write error:', err)
    }
  }

  send()
  const interval = setInterval(send, 1000)
  req.on('close', () => clearInterval(interval))
})

// Past sessions from ~/.claude/projects/
app.get('/api/sessions/past', (req, res) => {
  res.json(readPastSessions())
})

// Token totals aggregated across all past session JSONL files
app.get('/api/tokens', (req, res) => {
  res.json(readTokenTotals())
})

// MCP servers and skills available in this Claude Code installation
app.get('/api/tools', (req, res) => {
  res.json(readTools())
})

// Insights report metadata
const INSIGHTS_REPORT = path.join(os.homedir(), '.claude', 'usage-data', 'report.html')

app.get('/api/insights/meta', (req, res) => {
  try {
    const stat = fs.statSync(INSIGHTS_REPORT)
    res.json({ exists: true, lastModified: stat.mtime.toISOString() })
  } catch {
    res.json({ exists: false, lastModified: null })
  }
})

app.get('/api/insights/report', (req, res) => {
  if (!fs.existsSync(INSIGHTS_REPORT)) {
    return res.status(404).json({ error: 'No insights report found. Run /insights in Claude Code.' })
  }
  res.sendFile(INSIGHTS_REPORT)
})

// Terminal capabilities — tells the frontend which launchers are available
app.get('/api/launch/capabilities', (req, res) => {
  const vscode = !!findCode()
  if (IS_WIN) {
    // cmd and Windows PowerShell (powershell.exe) ship with Windows; pwsh and wt are optional upgrades
    res.json({ platform: 'win32', terminal: true, iterm: false, powershell: true, vscode })
  } else {
    res.json({ platform: 'darwin', terminal: true, iterm: fs.existsSync('/Applications/iTerm.app'), powershell: false, vscode })
  }
})

// Launch Claude Code session in a new terminal tab/window
app.post('/api/launch', (req, res) => {
  if (!req.is('application/json')) return res.status(415).json({ error: 'Content-Type must be application/json' })
  const { cwd, sessionId, app: termApp = 'terminal' } = req.body || {}
  if (!cwd || !sessionId) return res.status(400).json({ error: 'cwd and sessionId required' })
  if (!fs.existsSync(cwd)) return res.status(400).json({ error: 'cwd does not exist' })
  if (!/^[a-f0-9-]+$/i.test(sessionId)) return res.status(400).json({ error: 'invalid sessionId' })
  // Windows paths legitimately contain backslashes; see launch-safety.js for what is rejected where
  if (!isSafeCwd(cwd, IS_WIN)) return res.status(400).json({ error: 'cwd contains unsafe characters' })

  const platform = os.platform()
  const claudePath = resolveClaude() || 'claude'

  // VS Code — open a new window at the project folder (cross-platform, no terminal needed)
  if (termApp === 'vscode') {
    const codePath = findCode()
    if (!codePath) return res.status(404).json({ error: 'VS Code CLI (code) not found' })
    const opts = { detached: true, stdio: 'ignore', windowsHide: true }
    if (IS_WIN && /\.cmd$/i.test(codePath)) {
      // .cmd files must run through cmd.exe; cwd is already screened for cmd metacharacters above
      spawn(`"${codePath}"`, ['--new-window', `"${cwd}"`], { ...opts, shell: true }).unref()
    } else {
      spawn(codePath, ['--new-window', cwd], opts).unref()
    }
    return res.json({ ok: true })
  }

  if (platform === 'win32') {
    const detach = { detached: true, stdio: 'ignore' }
    const wtAvailable = hasCmd('wt')
    if (termApp === 'powershell') {
      // -EncodedCommand (UTF-16LE base64) keeps the script itself out of wt/cmd argument parsing; inside it
      // psQuote makes single-quoted literals so `$` in paths is never interpolated and curly quotes can't escape.
      // (cwd is still passed raw to `wt --startingDirectory`, which is why isSafeCwd rejects `;`.)
      const script = `Set-Location -LiteralPath ${psQuote(cwd)}; & ${psQuote(claudePath)} --resume ${sessionId}`
      const shellArgs = ['-NoExit', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')]
      const shellExe = hasCmd('pwsh') ? 'pwsh' : 'powershell'
      if (wtAvailable) spawn('wt', ['new-tab', '--startingDirectory', cwd, shellExe, ...shellArgs], detach).unref()
      else spawn('cmd', ['/c', 'start', '""', shellExe, ...shellArgs], detach).unref()
    } else {
      // terminal (cmd)
      if (wtAvailable) {
        spawn('wt', ['new-tab', '--startingDirectory', cwd, 'cmd', '/k', claudePath, '--resume', sessionId], detach).unref()
      } else {
        spawn('cmd', ['/c', 'start', '""', '/D', cwd, 'cmd', '/k', claudePath, '--resume', sessionId], detach).unref()
      }
    }
  } else {
    // macOS
    const safeCwd = cwd.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    const safeClause = `cd \\"${safeCwd}\\" && \\"${claudePath}\\" --resume ${sessionId}`

    let script
    if (termApp === 'iterm') {
      // iTerm2: open a new tab in the current or frontmost window
      script = `tell application "iTerm"
  activate
  if (count of windows) > 0 then
    tell current window
      create tab with default profile
      tell current session
        write text "cd \\"${safeCwd}\\" && \\"${claudePath}\\" --resume ${sessionId}"
      end tell
    end tell
  else
    create window with default profile
    tell current window
      tell current session
        write text "cd \\"${safeCwd}\\" && \\"${claudePath}\\" --resume ${sessionId}"
      end tell
    end tell
  end if
end tell`
    } else {
      // Terminal.app: open a new tab in the frontmost window if possible, else new window
      script = `tell application "Terminal"
  activate
  if (count of windows) > 0 then
    tell application "System Events" to keystroke "t" using command down
    delay 0.3
    do script "${safeClause}" in front window
  else
    do script "${safeClause}"
  end if
end tell`
    }

    const proc = spawn('osascript', [], { detached: true, stdio: ['pipe', 'ignore', 'ignore'] })
    proc.stdin.write(script)
    proc.stdin.end()
    proc.unref()
  }

  res.json({ ok: true })
})

// Stop endpoint — standalone/dev only: kills the parent (npm/concurrently → Express + Vite). Disabled inside Electron.
app.post('/api/stop', (req, res) => {
  if (!stopEnabled) return res.status(404).json({ error: 'not found' })
  if (!req.is('application/json')) return res.status(415).json({ error: 'Content-Type must be application/json' })
  res.json({ ok: true })
  setTimeout(() => {
    try {
      process.kill(process.ppid, 'SIGTERM')
    } catch { /* ignore */ }
    process.exit(0)
  }, 150)
})

// Is Ollama reachable, and is the configured model pulled? (never errors — the UI shows a setup hint)
app.get('/api/llm/status', async (req, res) => {
  res.json(await llm.getStatus())
})

app.get('/api/wiki/status', (req, res) => {
  res.json({ compiling: wiki.isCompiling() })
})

app.post('/api/wiki/compile', async (req, res) => {
  if (!req.is('application/json')) return res.status(415).json({ error: 'Content-Type must be application/json' })
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)
  try {
    await wiki.compile({ onProgress: send })
    res.end()
  } catch (e) {
    if (e.status === 409) {
      res.statusCode = 409
      send({ type: 'error', message: 'Compile already in progress' })
    } else {
      send({ type: 'error', message: e.message || 'compile failed' })
    }
    res.end()
  }
})

app.get('/api/wiki/graph', (req, res) => {
  try {
    res.json(wiki.readGraph())
  } catch (e) {
    res.status(500).json({ error: 'failed to read graph' })
  }
})

app.get('/api/wiki/article', (req, res) => {
  const { slug } = req.query
  if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'invalid slug' })
  }
  try {
    const md = wiki.readArticle(slug)
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.send(md)
  } catch (e) {
    res.status(404).json({ error: 'not found' })
  }
})

app.post('/api/wiki/ask', async (req, res) => {
  if (!req.is('application/json')) return res.status(415).json({ error: 'Content-Type must be application/json' })
  const { question } = req.body || {}
  if (typeof question !== 'string' || !question.trim() || question.length > 2000) {
    return res.status(400).json({ error: 'invalid question' })
  }
  try {
    const answer = await wiki.ask(question)
    res.json({ answer })
  } catch (e) {
    console.error('[wiki/ask]', e)
    res.status(500).json({ error: 'ask failed' })
  }
})

// Start the API (and, when staticDir is given, the built UI) and resolve with { port, close }.
// port 0 = let the OS pick a free port. Call once per process.
function start({ port = DEFAULT_PORT, host = '127.0.0.1', staticDir, enableStop = false } = {}) {
  stopEnabled = enableStop
  if (staticDir) {
    app.use(express.static(staticDir))
    // SPA fallback: anything that isn't an API route gets index.html. Using `root` (not a joined path)
    // stops sendFile refusing install paths that contain a dot-directory.
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile('index.html', { root: staticDir }))
  }
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host)
    server.once('error', reject)
    server.once('listening', () => {
      resolve({
        port: server.address().port,
        // closeAllConnections: open SSE streams would otherwise keep close() pending forever
        close: () => new Promise(done => { server.close(() => done()); server.closeAllConnections() }),
      })
    })
  })
}

if (require.main === module) {
  start({ enableStop: true }).then(({ port }) => console.log(`Agent Monitor API → http://127.0.0.1:${port}`))
}

module.exports = { start }
