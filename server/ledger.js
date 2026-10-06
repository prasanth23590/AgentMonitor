// server/ledger.js — remembers token totals from session files that Claude Code has since pruned,
// so "all-time" usage doesn't shrink when old JSONL files disappear.
// State: { snapshot: <last per-file totals seen>, lost: <cumulative totals of files no longer present> }

const fs = require('fs')
const os = require('os')
const path = require('path')

const DEFAULT_FILE = path.join(os.homedir(), '.claude', 'agent-monitor-ledger.json')

const zero = () => ({ input: 0, output: 0, cacheCreation: 0, cacheRead: 0 })
const addInto = (target, src) => {
  target.input         += src.input         || 0
  target.output        += src.output        || 0
  target.cacheCreation += src.cacheCreation || 0
  target.cacheRead     += src.cacheRead     || 0
}
// How much each counter went down from prev to cur (0 where it didn't)
const shrink = (prev, cur) => ({
  input:         Math.max(0, (prev.input         || 0) - (cur.input         || 0)),
  output:        Math.max(0, (prev.output        || 0) - (cur.output        || 0)),
  cacheCreation: Math.max(0, (prev.cacheCreation || 0) - (cur.cacheCreation || 0)),
  cacheRead:     Math.max(0, (prev.cacheRead     || 0) - (cur.cacheRead     || 0)),
})
const addModels = (target, models = {}) => {
  for (const [model, counts] of Object.entries(models)) {
    if (!target[model]) target[model] = zero()
    addInto(target[model], counts)
  }
}
const emptyState = () => ({ snapshot: {}, lost: { ...zero(), byModel: {} } })

function load(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (s && s.snapshot && typeof s.snapshot === 'object' && s.lost && typeof s.lost === 'object') {
      s.lost.byModel = s.lost.byModel || {}
      return s
    }
  } catch { /* missing or corrupt → start fresh */ }
  return emptyState()
}

function save(file, state) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(state))
    fs.renameSync(tmp, file)
  } catch { /* best effort — this call's totals are still correct */ }
}

function reconcile(snapshot, file = DEFAULT_FILE) {
  const state = load(file)
  // An empty scan (projects dir missing/unreadable) is indistinguishable from "everything was pruned".
  // Treat it as a failed scan: otherwise one bad read would move all history into `lost` and it would be
  // counted twice once the files are readable again.
  if (Object.keys(snapshot).length === 0) return state.lost

  const next = { ...snapshot }
  for (const [key, prev] of Object.entries(state.snapshot)) {
    const cur = next[key]
    if (cur === undefined) {
      // pruned: everything it reported moves to `lost`
      addInto(state.lost, prev)
      addModels(state.lost.byModel, prev.byModel)
    } else if (cur === null) {
      // unreadable this scan (EBUSY / antivirus / OneDrive): remember the last good totals so a
      // transient failure can't erase this file's history
      next[key] = prev
    } else {
      // totals shrank (file rewritten/truncated): tokens already reported stay in the all-time count
      const dropped = shrink(prev, cur)
      addInto(state.lost, dropped)
      for (const [model, p] of Object.entries(prev.byModel || {})) {
        const d = shrink(p, (cur.byModel || {})[model] || zero())
        if (d.input || d.output || d.cacheCreation || d.cacheRead) {
          if (!state.lost.byModel[model]) state.lost.byModel[model] = zero()
          addInto(state.lost.byModel[model], d)
        }
      }
    }
  }
  for (const key of Object.keys(next)) if (next[key] === null) delete next[key] // new file we couldn't read yet
  state.snapshot = next
  save(file, state)
  return state.lost
}

module.exports = { reconcile }
