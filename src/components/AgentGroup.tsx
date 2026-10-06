import { useState } from 'react'
import type { AgentSession } from '../types'
import { accentColor, formatRuntime } from '../types'
import type { LaunchCapabilities } from '../App'

interface Props {
  session: AgentSession
  index: number
  showSlug: boolean
  caps: LaunchCapabilities
}

export function AgentGroup({ session, index, showSlug, caps }: Props) {
  const accent = accentColor(index)
  const activeTasks = session.tasks.filter(t => t.status === 'in_progress')
  const totalTasks = session.tasks.length
  const doneTasks = session.tasks.filter(t => t.status === 'completed').length
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const isDone = !session.alive
  const isWaiting = session.alive && session.status === 'waiting'

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      borderRadius: 14, overflow: 'hidden',
      opacity: isDone ? 0.45 : 1,
      transition: 'transform .2s ease, border-color .2s, box-shadow .2s, background .2s',
      cursor: 'pointer',
    }}
      onMouseEnter={e => {
        if (isDone) return
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(-3px)'
        el.style.borderColor = 'var(--card-border-h)'
        el.style.background = 'var(--card-bg-hover)'
        el.style.boxShadow = '0 12px 36px rgba(0,0,0,.45)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = ''
        el.style.borderColor = ''
        el.style.background = ''
        el.style.boxShadow = ''
      }}
    >
      {/* Coloured left accent */}
      <div style={{ display: 'flex' }}>
        <div style={{ width: 4, flexShrink: 0, background: accent }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Agent card header */}
          <div style={{ padding: '14px 16px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--white)', letterSpacing: '-.01em', lineHeight: 1.3 }}>
                  {showSlug && session.slug ? session.slug : session.name}
                </span>
                {session.slug && (
                  <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                    {showSlug ? session.name : session.slug}
                  </div>
                )}
              </div>
              <StatusBadge status={session.status} alive={session.alive} />
            </div>

            <div style={{
              fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--text-dim)',
              display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 11,
            }}>
              <span>pid {session.pid}</span>
              <span>{formatRuntime(session.runtimeMs)}</span>
            </div>

            {totalTasks > 0 && (
              <>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--text-dim)',
                  marginBottom: 5,
                }}>
                  <span>Task {doneTasks} of {totalTasks}</span>
                  <span>{progress}%</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: accent, borderRadius: 3, transition: 'width .4s ease' }} />
                </div>
              </>
            )}

            {/* Avatar stack: one per active subagent */}
            {activeTasks.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {activeTasks.slice(0, 3).map((t, i) => (
                  <div key={t.id} style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: accentColor(i + 1),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, color: '#fff',
                    border: '2px solid var(--am-dark)',
                    fontFamily: '"DM Mono",monospace',
                    marginLeft: i === 0 ? 0 : -6, flexShrink: 0,
                  }}>
                    {t.subject.charAt(0).toUpperCase()}
                  </div>
                ))}
                {activeTasks.length > 3 && (
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'rgba(93,54,255,.25)', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700,
                    border: '2px solid var(--am-dark)',
                    fontFamily: '"DM Mono",monospace', marginLeft: -6,
                  }}>
                    +{activeTasks.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Waiting alert */}
          {isWaiting && session.waitingFor && (
            <div style={{
              margin: '0 16px 12px',
              background: 'rgba(231,101,0,.07)',
              border: '1px solid rgba(231,101,0,.2)',
              borderRadius: 8, padding: '8px 12px',
              fontSize: 11, color: '#ffb066',
              display: 'flex', alignItems: 'flex-start', gap: 7,
            }}>
              <span>⏸</span>
              <div>
                <span>Waiting for approval</span>
                <code style={{
                  fontFamily: '"DM Mono",monospace', fontSize: 10,
                  color: 'var(--text-muted)', display: 'block', marginTop: 2,
                  wordBreak: 'break-all', overflowWrap: 'anywhere',
                }}>
                  {session.waitingFor}
                </code>
              </div>
            </div>
          )}

          {/* Resume hint for done sessions */}
          {isDone && (
            <ResumeRow sessionId={session.sessionId} cwd={session.cwd} caps={caps} />
          )}

          {/* Subagent rows */}
          {activeTasks.length > 0 && (
            <div style={{
              borderTop: '1px solid rgba(255,255,255,.05)',
              background: 'rgba(0,0,0,.18)',
              padding: '10px 16px 12px',
            }}>
              <div style={{
                fontFamily: '"DM Mono",monospace', fontSize: 9, fontWeight: 500,
                textTransform: 'uppercase', letterSpacing: '.09em', color: 'var(--text-dim)',
                marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ display: 'inline-block', width: 10, height: 1, background: 'rgba(93,54,255,.4)' }} />
                Subagents · {activeTasks.length}
              </div>
              {activeTasks.map((t, i) => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 9px', borderRadius: 8, marginBottom: 5,
                  background: 'rgba(255,255,255,.035)',
                  border: '1px solid rgba(255,255,255,.055)',
                  transition: 'border-color .18s, background .18s',
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: `${accentColor(i + 1)}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, color: accentColor(i + 1),
                    fontFamily: '"DM Mono",monospace', flexShrink: 0,
                  }}>
                    {t.subject.charAt(0).toUpperCase()}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
                    flex: 1, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {t.subject}
                  </span>
                  <span style={{
                    fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--text-dim)',
                    flexShrink: 0, whiteSpace: 'nowrap',
                  }}>
                    {t.activeForm ?? t.status}
                  </span>
                  {isWaiting && (
                    <span style={{
                      fontFamily: '"DM Mono",monospace', fontSize: 9,
                      padding: '1px 6px', borderRadius: 4,
                      background: 'rgba(231,101,0,.1)', color: '#ffb066',
                      border: '1px solid rgba(231,101,0,.18)',
                    }}>
                      blocked
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ResumeRow({ sessionId, cwd, caps }: { sessionId: string; cwd: string; caps: LaunchCapabilities }) {
  const [copied, setCopied] = useState(false)
  const [launching, setLaunching] = useState<string | null>(null)
  const cmd = `cd "${cwd}" && claude --resume ${sessionId}`

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
      body: JSON.stringify({ cwd, sessionId, app }),
    }).finally(() => setTimeout(() => setLaunching(null), 1500))
  }

  const btnStyle = (active: boolean) => ({
    fontFamily: '"DM Mono",monospace', fontSize: 9, flexShrink: 0,
    background: active ? 'rgba(27,144,255,.15)' : 'rgba(255,255,255,.06)',
    color: active ? '#1B90FF' : 'var(--text-muted)',
    border: `1px solid ${active ? 'rgba(27,144,255,.4)' : 'rgba(255,255,255,.1)'}`,
    borderRadius: 4, padding: '2px 7px', cursor: 'pointer',
    transition: 'background .2s, color .2s, border-color .2s',
  })

  return (
    <div style={{
      margin: '0 16px 12px',
      background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 8, padding: '7px 10px',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ fontFamily: '"DM Mono",monospace', fontSize: 9, color: 'var(--text-dim)', flexShrink: 0 }}>
        resume
      </span>
      <code style={{
        fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--text-muted)',
        flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {sessionId.slice(0, 8)}…
      </code>
      <button onClick={copy} style={{
        ...btnStyle(false),
        background: copied ? 'rgba(54,164,29,.15)' : 'rgba(255,255,255,.06)',
        color: copied ? '#7ddd5a' : 'var(--text-muted)',
        border: `1px solid ${copied ? 'rgba(54,164,29,.25)' : 'rgba(255,255,255,.1)'}`,
      }} title="Copy command to resume this session">
        {copied ? 'copied!' : 'copy cmd'}
      </button>
      <button onClick={() => launch('terminal')} style={btnStyle(launching === 'terminal')}
        title={caps.platform === 'win32' ? 'Open in cmd' : 'Open in Terminal.app'}>
        {launching === 'terminal' ? 'launching…' : caps.platform === 'win32' ? 'cmd' : 'terminal'}
      </button>
      {caps.iterm && (
        <button onClick={() => launch('iterm')} style={btnStyle(launching === 'iterm')} title="Open in iTerm2">
          {launching === 'iterm' ? 'launching…' : 'iterm'}
        </button>
      )}
      {caps.powershell && (
        <button onClick={() => launch('powershell')} style={btnStyle(launching === 'powershell')} title="Open in PowerShell">
          {launching === 'powershell' ? 'launching…' : 'powershell'}
        </button>
      )}
    </div>
  )
}

function StatusBadge({ status, alive }: { status: string; alive: boolean }) {
  if (!alive) return <Badge bg="rgba(92,85,128,.15)" color="var(--text-dim)" border="var(--border-faint)">✓ done</Badge>
  if (status === 'waiting') return <Badge bg="rgba(231,101,0,.12)" color="#ffb066" border="rgba(231,101,0,.2)">⏸ waiting</Badge>
  if (status === 'busy') return <Badge bg="rgba(27,144,255,.12)" color="#6fc6ff" border="rgba(27,144,255,.2)">◎ busy</Badge>
  return <Badge bg="rgba(54,164,29,.12)" color="#7ddd5a" border="rgba(54,164,29,.2)">● idle</Badge>
}

function Badge({ children, bg, color, border }: { children: React.ReactNode; bg: string; color: string; border: string }) {
  return (
    <span style={{
      fontFamily: '"DM Mono",monospace', fontSize: 9, fontWeight: 500,
      padding: '2px 7px', borderRadius: 4, letterSpacing: '.04em', textTransform: 'uppercase',
      flexShrink: 0, marginLeft: 8, marginTop: 1,
      background: bg, color, border: `1px solid ${border}`,
    }}>
      {children}
    </span>
  )
}
