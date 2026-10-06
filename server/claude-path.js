// server/claude-path.js — locate the `claude` executable. Used only to RESUME Claude Code sessions from the
// History tab; LLM chat for the wiki goes through Ollama (see llm.js).

const cp = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const IS_WIN = process.platform === 'win32'

// Where the native Windows installer puts claude.exe. A Start-menu launch may not inherit the shell PATH
// that contains it, so this is checked when `where.exe` finds nothing.
function claudeFallbackPath(home = os.homedir(), exists = fs.existsSync) {
  const p = path.join(home, '.local', 'bin', 'claude.exe')
  return exists(p) ? p : null
}

// Resolve the claude executable. `where` (Windows) can return several matches, including npm's
// extensionless shell shim and claude.cmd; prefer a real .exe.
function resolveClaude() {
  let matches = []
  try {
    matches = cp.execFileSync(IS_WIN ? 'where.exe' : 'which', ['claude'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  } catch { /* not on PATH */ }
  if (!IS_WIN) return matches[0] || null
  return matches.find(p => /\.exe$/i.test(p)) || matches.find(p => /\.(cmd|bat)$/i.test(p)) || claudeFallbackPath()
}

module.exports = { resolveClaude, claudeFallbackPath }
