import { useState, useEffect } from 'react'
import type { LaunchCapabilities } from '../App'

interface PastSession {
  sessionId: string
  cwd: string
  name: string
  slug: string
  lastActiveAt: number
  version: string
  turnCount: number
  summary: string
}

interface DateGroup {
  label: string
  sessions: PastSession[]
}

function groupByDate(sessions: PastSession[]): DateGroup[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 86400000

  const groups = new Map<string, PastSession[]>()

  for (const s of sessions) {
    let label: string
    if (!s.lastActiveAt) {
      label = 'Unknown'
    } else if (s.lastActiveAt >= today) {
      label = 'Today'
    } else if (s.lastActiveAt >= yesterday) {
      label = 'Yesterday'
    } else {
      label = new Date(s.lastActiveAt).toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
      })
    }
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(s)
  }

  return Array.from(groups.entries()).map(([label, sessions]) => ({ label, sessions }))
}

export function PastSessions({ showSlug, caps }: { showSlug: boolean; caps: LaunchCapabilities }) {
  const [sessions, setSessions] = useState<PastSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/sessions/past')
      .then(r => r.json())
      .then(data => { setSessions(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const groups = groupByDate(sessions)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
      <div style={{
        fontFamily: '"DM Mono",monospace', fontSize: 10, fontWeight: 500,
        textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-dim)',
        marginBottom: 18,
      }}>
        Past Sessions · {sessions.length}
      </div>

      {loading && (
        <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--text-dim)' }}>
          Loading…
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--text-dim)' }}>
          No past sessions found in ~/.claude/projects/
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
        {groups.map(group => (
          <div key={group.label}>
            <div style={{
              fontFamily: '"DM Mono",monospace', fontSize: 10, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-dim)',
              marginBottom: 10, paddingBottom: 6,
              borderBottom: '1px solid rgba(255,255,255,.06)',
              position: 'sticky', top: 0,
              background: 'var(--am-dark)', zIndex: 1,
            }}>
              {group.label}
              <span style={{ marginLeft: 8, fontSize: 9, color: 'var(--text-dim)', opacity: 0.6 }}>
                {group.sessions.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {group.sessions.map(s => (
                <SessionRow key={s.sessionId} session={s} showSlug={showSlug} caps={caps} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SessionRow({ session, showSlug, caps }: { session: PastSession; showSlug: boolean; caps: LaunchCapabilities }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [launching, setLaunching] = useState<string | null>(null)
  const cmd = `cd "${session.cwd}" && claude --resume ${session.sessionId}`

  function copy() {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function launch(app: string) {
    setLaunching(app)
    fetch('/api/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd: session.cwd, sessionId: session.sessionId, app }),
    }).finally(() => setTimeout(() => setLaunching(null), 1500))
  }

  const time = session.lastActiveAt
    ? new Date(session.lastActiveAt).toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit',
      })
    : '—'

  const shortCwd = session.cwd
    .replace(/^\/Users\/[^/]+\/Library\/CloudStorage\/[^/]+/, '~')
    .replace(/^\/Users\/[^/]+/, '~')

  const primaryTitle = showSlug && session.slug ? session.slug : session.name
  const secondaryLine = showSlug && session.slug
    ? shortCwd
    : session.slug
      ? `${session.slug} · ${shortCwd}`
      : shortCwd

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      borderRadius: 10, padding: '11px 14px',
      display: 'flex', flexDirection: 'column', gap: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Title block — wraps freely, no truncation */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
            marginBottom: 2, lineHeight: 1.35,
            wordBreak: 'break-word',
          }}>
            {primaryTitle}
          </div>
          <div style={{
            fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--text-dim)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} title={session.cwd}>
            {secondaryLine}
          </div>
        </div>

        {/* Right-side controls — shrink but don't wrap */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--text-dim)',
            whiteSpace: 'nowrap',
          }}>
            {time}
          </div>

          {session.turnCount > 0 && (
            <div title={`${session.turnCount} user messages in this conversation`} style={{
              fontFamily: '"DM Mono",monospace', fontSize: 9,
              color: 'var(--am-violet)', background: 'rgba(93,54,255,.1)',
              border: '1px solid rgba(93,54,255,.2)',
              borderRadius: 4, padding: '2px 0',
              whiteSpace: 'nowrap', width: 60, textAlign: 'center',
            }}>
              {session.turnCount} msg{session.turnCount !== 1 ? 's' : ''}
            </div>
          )}

          <code style={{
            fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--text-muted)',
            width: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {session.sessionId.slice(0, 8)}…
          </code>

          <button onClick={copy} title="Copy command to resume this session in your terminal" style={{
            fontFamily: '"DM Mono",monospace', fontSize: 9,
            background: copied ? 'rgba(54,164,29,.15)' : 'rgba(255,255,255,.08)',
            color: copied ? '#7ddd5a' : 'var(--text-muted)',
            border: `1px solid ${copied ? 'rgba(54,164,29,.4)' : 'rgba(255,255,255,.22)'}`,
            borderRadius: 4, padding: '3px 9px', cursor: 'pointer',
            transition: 'background .2s, color .2s, border-color .2s',
          }}>
            {copied ? 'copied!' : 'copy cmd'}
          </button>

          <button onClick={launch.bind(null, 'terminal')} title="Open a new Terminal tab and resume this session" style={{
            fontFamily: '"DM Mono",monospace', fontSize: 9,
            background: launching === 'terminal' ? 'rgba(27,144,255,.15)' : 'rgba(255,255,255,.08)',
            color: launching === 'terminal' ? '#1B90FF' : 'var(--text-muted)',
            border: `1px solid ${launching === 'terminal' ? 'rgba(27,144,255,.4)' : 'rgba(255,255,255,.22)'}`,
            borderRadius: 4, padding: '3px 9px', cursor: 'pointer',
            transition: 'background .2s, color .2s, border-color .2s',
          }}>
            {launching === 'terminal' ? 'launching…' : caps.platform === 'win32' ? 'cmd' : 'terminal'}
          </button>

          {caps.iterm && (
            <button onClick={launch.bind(null, 'iterm')} title="Open a new iTerm2 tab and resume this session" style={{
              fontFamily: '"DM Mono",monospace', fontSize: 9,
              background: launching === 'iterm' ? 'rgba(27,144,255,.15)' : 'rgba(255,255,255,.08)',
              color: launching === 'iterm' ? '#1B90FF' : 'var(--text-muted)',
              border: `1px solid ${launching === 'iterm' ? 'rgba(27,144,255,.4)' : 'rgba(255,255,255,.22)'}`,
              borderRadius: 4, padding: '3px 9px', cursor: 'pointer',
              transition: 'background .2s, color .2s, border-color .2s',
            }}>
              {launching === 'iterm' ? 'launching…' : 'iterm'}
            </button>
          )}

          {caps.powershell && (
            <button onClick={launch.bind(null, 'powershell')} title="Open a new PowerShell tab and resume this session" style={{
              fontFamily: '"DM Mono",monospace', fontSize: 9,
              background: launching === 'powershell' ? 'rgba(27,144,255,.15)' : 'rgba(255,255,255,.08)',
              color: launching === 'powershell' ? '#1B90FF' : 'var(--text-muted)',
              border: `1px solid ${launching === 'powershell' ? 'rgba(27,144,255,.4)' : 'rgba(255,255,255,.22)'}`,
              borderRadius: 4, padding: '3px 9px', cursor: 'pointer',
              transition: 'background .2s, color .2s, border-color .2s',
            }}>
              {launching === 'powershell' ? 'launching…' : 'powershell'}
            </button>
          )}

          {caps.vscode && (
            <button onClick={launch.bind(null, 'vscode')} title="Open project folder in a new VS Code window (does not resume the Claude session)" style={{
              fontFamily: '"DM Mono",monospace', fontSize: 9,
              background: launching === 'vscode' ? 'rgba(0,122,204,.15)' : 'rgba(255,255,255,.08)',
              color: launching === 'vscode' ? '#4FC1FF' : 'var(--text-muted)',
              border: `1px solid ${launching === 'vscode' ? 'rgba(0,122,204,.4)' : 'rgba(255,255,255,.22)'}`,
              borderRadius: 4, padding: '3px 9px', cursor: 'pointer',
              transition: 'background .2s, color .2s, border-color .2s',
            }}>
              {launching === 'vscode' ? 'opening…' : 'vscode'}
            </button>
          )}

          {session.summary && (
            <button onClick={() => setExpanded(e => !e)} style={{
              fontFamily: '"DM Mono",monospace', fontSize: 9,
              background: expanded ? 'rgba(93,54,255,.15)' : 'rgba(255,255,255,.08)',
              color: expanded ? 'var(--am-violet)' : 'var(--text-muted)',
              border: `1px solid ${expanded ? 'rgba(93,54,255,.4)' : 'rgba(255,255,255,.22)'}`,
              borderRadius: 4, padding: '3px 9px', cursor: 'pointer',
              transition: 'background .2s, color .2s, border-color .2s',
            }}>
              {expanded ? '▾ summary' : '▸ summary'}
            </button>
          )}
        </div>
      </div>

      {expanded && session.summary && (
        <div style={{
          marginTop: 10, padding: '9px 12px',
          background: 'rgba(255,255,255,.03)',
          border: '1px solid var(--card-border)',
          borderRadius: 8,
          fontFamily: '"DM Mono",monospace', fontSize: 10,
          color: 'var(--text-muted)', lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {session.summary}
        </div>
      )}
    </div>
  )
}
