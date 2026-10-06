const fs = require('fs')
const path = require('path')
const os = require('os')
const { reconcile } = require('./ledger')

const SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions')
const TASKS_DIR = path.join(os.homedir(), '.claude', 'tasks')
const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects')

function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function readTasks(sessionId) {
  const dir = path.join(TASKS_DIR, sessionId)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }
      catch { return null }
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.id) - Number(b.id))
}

// Read the custom title (/rename label) for a sessionId by scanning its JSONL
function readSlug(sessionId) {
  if (!fs.existsSync(PROJECTS_DIR)) return ''
  for (const projectDir of fs.readdirSync(PROJECTS_DIR)) {
    const projectPath = path.join(PROJECTS_DIR, projectDir)
    if (!fs.statSync(projectPath).isDirectory()) continue
    const filePath = path.join(projectPath, `${sessionId}.jsonl`)
    if (!fs.existsSync(filePath)) continue
    try {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean)
      let customTitle = ''
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line)
          if (parsed.type === 'custom-title' && parsed.customTitle) customTitle = parsed.customTitle
        } catch { /* skip */ }
      }
      if (customTitle) return customTitle
    } catch { /* skip */ }
  }
  return ''
}

function readSessions() {
  if (!fs.existsSync(SESSIONS_DIR)) return []
  return fs.readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf8'))
        const alive = isAlive(data.pid)
        const tasks = readTasks(data.sessionId)
        const name = path.basename(data.cwd || 'Unknown')
        const slug = readSlug(data.sessionId)
        const runtimeMs = Math.max(0, (data.updatedAt || Date.now()) - data.startedAt)
        // VS Code extension sessions may not update status in the session file;
        // infer busy from active subagent tasks or a very recent updatedAt timestamp
        const hasActiveTasks = tasks.some(t => t.status === 'in_progress')
        const recentlyUpdated = data.updatedAt && (Date.now() - data.updatedAt) < 5000
        const status = (data.status === 'idle' && (hasActiveTasks || recentlyUpdated)) ? 'busy' : data.status
        return { ...data, name, slug, alive, tasks, runtimeMs, status }
      } catch { return null }
    })
    .filter(Boolean)
}

let pastSessionsCache = null
let pastSessionsCacheAt = 0
const PAST_SESSIONS_TTL = 10000 // 10s

function readPastSessions() {
  if (pastSessionsCache && Date.now() - pastSessionsCacheAt < PAST_SESSIONS_TTL) return pastSessionsCache
  if (!fs.existsSync(PROJECTS_DIR)) return []
  const results = []
  for (const projectDir of fs.readdirSync(PROJECTS_DIR)) {
    const projectPath = path.join(PROJECTS_DIR, projectDir)
    if (!fs.statSync(projectPath).isDirectory()) continue
    for (const file of fs.readdirSync(projectPath)) {
      if (!file.endsWith('.jsonl')) continue
      const sessionId = file.replace('.jsonl', '')
      const filePath = path.join(projectPath, file)
      try {
        const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean)
        let cwd = ''
        let sessionIdFromFile = sessionId
        let timestamp = 0
        let version = ''
        let slug = ''
        let turnCount = 0
        let lastPrompt = ''
        let firstHumanMsg = ''
        const awaySummaries = []
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line)
            if (!cwd && parsed.cwd) cwd = parsed.cwd
            if (!sessionIdFromFile && parsed.sessionId) sessionIdFromFile = parsed.sessionId
            if (parsed.timestamp && (parsed.type === 'user' || parsed.type === 'assistant')) {
              timestamp = new Date(parsed.timestamp).getTime()
            }
            if (parsed.version) version = parsed.version
            if (parsed.type === 'custom-title' && parsed.customTitle) slug = parsed.customTitle
            // away_summary — richer, phase-completion summaries
            if (parsed.type === 'system' && parsed.subtype === 'away_summary' && parsed.content) {
              awaySummaries.push(parsed.content)
            }
            // last-prompt — most recent user message
            if (parsed.type === 'last-prompt' && parsed.lastPrompt && !parsed.lastPrompt.startsWith('<')) {
              lastPrompt = parsed.lastPrompt
            }
            // count actual human turns (exclude skill/system injections)
            if (parsed.type === 'user' && parsed.message?.role === 'user') {
              const content = parsed.message.content
              const text = Array.isArray(content)
                ? (content.find(c => c?.type === 'text')?.text || '')
                : (typeof content === 'string' ? content : '')
              if (text && !text.startsWith('<command') && !text.startsWith('<local-command') && !text.startsWith('Base directory') && !text.startsWith('This session is being continued')) {
                if (!firstHumanMsg) firstHumanMsg = text
                turnCount++
              }
            }
          } catch { /* skip unparseable lines */ }
        }
        const summary = awaySummaries.length > 0
          ? awaySummaries[awaySummaries.length - 1]
          : (lastPrompt || firstHumanMsg || '')
        if (!cwd && !sessionIdFromFile) continue
        results.push({
          sessionId: sessionIdFromFile,
          cwd,
          name: cwd ? path.basename(cwd) : projectDir,
          slug,
          lastActiveAt: timestamp,
          version,
          turnCount,
          summary,
        })
      } catch { /* skip malformed files */ }
    }
  }
  // sort newest first
  const sorted = results.sort((a, b) => b.lastActiveAt - a.lastActiveAt)
  pastSessionsCache = sorted
  pastSessionsCacheAt = Date.now()
  return sorted
}

function readTokenTotals() {
  const live = { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 }
  const liveByModel = {}
  // Per-file snapshot for ledger reconciliation: { [fileKey]: { input, output, cacheCreation, cacheRead, byModel } }
  const snapshot = {}

  if (fs.existsSync(PROJECTS_DIR)) {
    for (const projectDir of fs.readdirSync(PROJECTS_DIR)) {
      const projectPath = path.join(PROJECTS_DIR, projectDir)
      if (!fs.statSync(projectPath).isDirectory()) continue
      for (const file of fs.readdirSync(projectPath)) {
        if (!file.endsWith('.jsonl')) continue
        const fileKey = `${projectDir}/${file}`
        const fileTotals = { input: 0, output: 0, cacheCreation: 0, cacheRead: 0, byModel: {} }
        let unreadable = false
        try {
          const content = fs.readFileSync(path.join(projectPath, file), 'utf8')
          for (const line of content.split('\n')) {
            if (!line.trim()) continue
            try {
              const parsed = JSON.parse(line)
              const usage = parsed.message?.usage
              if (!usage) continue
              const input         = usage.input_tokens                || 0
              const output        = usage.output_tokens               || 0
              const cacheCreation = usage.cache_creation_input_tokens || 0
              const cacheRead     = usage.cache_read_input_tokens     || 0
              fileTotals.input         += input
              fileTotals.output        += output
              fileTotals.cacheCreation += cacheCreation
              fileTotals.cacheRead     += cacheRead
              const model = parsed.message?.model
              if (model) {
                if (!fileTotals.byModel[model]) fileTotals.byModel[model] = { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 }
                fileTotals.byModel[model].input         += input
                fileTotals.byModel[model].output        += output
                fileTotals.byModel[model].cacheCreation += cacheCreation
                fileTotals.byModel[model].cacheRead     += cacheRead
              }
            } catch { /* skip unparseable lines */ }
          }
        } catch { unreadable = true }
        if (unreadable) {
          // null = "couldn't read it this time": the ledger keeps this file's last known totals
          // instead of recording zeros (which would erase its history if it's pruned before the next read)
          snapshot[fileKey] = null
          continue
        }
        snapshot[fileKey] = fileTotals
        live.input         += fileTotals.input
        live.output        += fileTotals.output
        live.cacheCreation += fileTotals.cacheCreation
        live.cacheRead     += fileTotals.cacheRead
        for (const [model, counts] of Object.entries(fileTotals.byModel)) {
          if (!liveByModel[model]) liveByModel[model] = { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 }
          liveByModel[model].input         += counts.input
          liveByModel[model].output        += counts.output
          liveByModel[model].cacheCreation += counts.cacheCreation
          liveByModel[model].cacheRead     += counts.cacheRead
        }
      }
    }
  }

  // Absorb tokens from any JSONL files that have been pruned since last poll
  const lost = reconcile(snapshot)

  const totals = {
    input:         live.input         + lost.input,
    output:        live.output        + lost.output,
    cacheCreation: live.cacheCreation + lost.cacheCreation,
    cacheRead:     live.cacheRead     + lost.cacheRead,
  }
  const byModel = { ...liveByModel }
  for (const [model, counts] of Object.entries(lost.byModel || {})) {
    if (!byModel[model]) byModel[model] = { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 }
    byModel[model].input         += counts.input         || 0
    byModel[model].output        += counts.output        || 0
    byModel[model].cacheCreation += counts.cacheCreation || 0
    byModel[model].cacheRead     += counts.cacheRead     || 0
  }

  const total = totals.input + totals.output
  const cacheHitPct = (totals.cacheCreation + totals.cacheRead) > 0
    ? Math.round((totals.cacheRead / (totals.cacheRead + totals.cacheCreation)) * 100)
    : 0
  return { ...totals, total, cacheHitPct, byModel }
}

function readTools() {
  const home = os.homedir()
  const settingsPath = path.join(home, '.claude', 'settings.json')
  const pluginsPath  = path.join(home, '.claude', 'plugins', 'installed_plugins.json')
  const userSkillsDir = path.join(home, '.claude', 'skills')

  // --- MCP Servers ---
  let mcpServers = []
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    const raw = settings.mcpServers || {}
    mcpServers = Object.entries(raw).map(([name, cfg]) => {
      const isStdio = typeof cfg.command === 'string' && cfg.command.trim() !== ''
      return {
        name,
        type: isStdio ? 'stdio' : 'http',
        command: isStdio ? cfg.command : undefined,
        args: isStdio ? (cfg.args || []) : undefined,
        url: !isStdio ? cfg.url : undefined,
        description: cfg.description || undefined,
      }
    })
  } catch { /* settings.json missing or malformed — return empty */ }

  // --- Skills ---
  function parseFrontmatter(filepath) {
    try {
      const content = fs.readFileSync(filepath, 'utf8')
      const match = content.match(/^---\n([\s\S]*?)\n---/)
      if (!match) return {}
      const fm = {}
      for (const line of match[1].split('\n')) {
        const colon = line.indexOf(':')
        if (colon === -1) continue
        const key = line.slice(0, colon).trim()
        const val = line.slice(colon + 1).trim().replace(/^"|"$/g, '')
        fm[key] = val
      }
      return fm
    } catch { return {} }
  }

  function readSkillsDir(dir) {
    if (!fs.existsSync(dir)) return []
    const skills = []
    for (const entry of fs.readdirSync(dir)) {
      const skillPath = path.join(dir, entry)
      try {
        if (!fs.statSync(skillPath).isDirectory()) continue
      } catch { continue }
      const skillMd = path.join(skillPath, 'SKILL.md')
      if (!fs.existsSync(skillMd)) continue
      const fm = parseFrontmatter(skillMd)
      skills.push({ name: fm.name || entry, description: fm.description || '' })
    }
    return skills.sort((a, b) => a.name.localeCompare(b.name))
  }

  const userSkills = readSkillsDir(userSkillsDir)

  // Built-in skills from installed plugins
  const builtinSkills = []
  try {
    const pluginsData = JSON.parse(fs.readFileSync(pluginsPath, 'utf8'))
    const plugins = pluginsData.plugins || {}
    for (const [pluginKey, installs] of Object.entries(plugins)) {
      if (!Array.isArray(installs)) continue
      // Strip "@marketplace" suffix for display: "superpowers@claude-plugins-official" → "superpowers"
      const pluginName = pluginKey.split('@')[0]
      for (const install of installs) {
        if (!install.installPath) continue
        const skillsDir = path.join(install.installPath, 'skills')
        const skills = readSkillsDir(skillsDir)
        for (const skill of skills) {
          builtinSkills.push({ ...skill, plugin: pluginName })
        }
      }
    }
  } catch { /* plugins file missing — return empty */ }
  builtinSkills.sort((a, b) => a.name.localeCompare(b.name))

  return { mcpServers, skills: { user: userSkills, builtin: builtinSkills } }
}

module.exports = { readSessions, readPastSessions, readTokenTotals, readTools }
