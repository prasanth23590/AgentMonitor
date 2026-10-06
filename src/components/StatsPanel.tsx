import { useEffect, useRef, useState } from 'react'
import type { AgentSession } from '../types'
import { getColumn, formatRuntime } from '../types'

interface Props { sessions: AgentSession[] }

interface Event { msg: string; color: string; time: string }

interface TokenTotals {
  input: number; output: number; cacheCreation: number; cacheRead: number
  total: number; cacheHitPct: number
  byModel: Record<string, { input: number; output: number; cacheCreation: number; cacheRead: number }>
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function shortModelName(model: string): string {
  if (model.includes('opus')) return 'Opus'
  if (model.includes('sonnet')) return 'Sonnet'
  if (model.includes('haiku')) return 'Haiku'
  return model.split('-').slice(0, 2).join(' ')
}

export function StatsPanel({ sessions }: Props) {
  const idle    = sessions.filter(s => getColumn(s) === 'idle').length
  const busy    = sessions.filter(s => getColumn(s) === 'busy').length
  const waiting = sessions.filter(s => getColumn(s) === 'waiting').length
  const done    = sessions.filter(s => getColumn(s) === 'done').length
  const total   = sessions.length
  const subagents = sessions.reduce((acc, s) => acc + s.tasks.filter(t => t.status === 'in_progress').length, 0)
  const avgRuntime = total > 0
    ? formatRuntime(sessions.reduce((a, s) => a + s.runtimeMs, 0) / total)
    : '—'

  const activePct = total > 0 ? Math.round(((idle + busy) / total) * 100) : 0

  // Running arc: out of 220 circumference (r=35)
  const circ = 2 * Math.PI * 35  // ≈ 219.9

  const [tokens, setTokens] = useState<TokenTotals | null>(null)
  useEffect(() => {
    const refresh = () => fetch('/api/tokens').then(r => r.json()).then(setTokens).catch(() => {})
    refresh()
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, [])
  const busyArc = (busy / Math.max(total, 1)) * circ
  const idleArc = (idle / Math.max(total, 1)) * circ
  const waitArc = (waiting / Math.max(total, 1)) * circ

  // Recent events feed
  const [events, setEvents] = useState<Event[]>([])
  const prevRef = useRef<AgentSession[]>([])

  useEffect(() => {
    const prev = prevRef.current
    const newEvents: Event[] = []
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    sessions.forEach(s => {
      const p = prev.find(x => x.pid === s.pid)
      if (!p) {
        newEvents.push({ msg: `${s.name} started`, color: '#7ddd5a', time: now })
      } else if (p.status !== 'waiting' && s.status === 'waiting') {
        newEvents.push({ msg: `${s.name} waiting for approval`, color: '#ffb066', time: now })
      } else if (p.status === 'waiting' && s.status !== 'waiting') {
        newEvents.push({ msg: `${s.name} resumed`, color: 'var(--am-violet)', time: now })
      }
      const prevActive = p?.tasks.filter(t => t.status === 'in_progress').length ?? 0
      const currActive = s.tasks.filter(t => t.status === 'in_progress').length
      if (currActive > prevActive) {
        newEvents.push({ msg: `${s.name} spawned subagent`, color: 'var(--am-violet)', time: now })
      }
    })
    prev.forEach(p => {
      if (!sessions.find(s => s.pid === p.pid)) {
        newEvents.push({ msg: `${p.name} completed`, color: 'var(--text-dim)', time: now })
      }
    })

    if (newEvents.length > 0) {
      setEvents(e => [...newEvents, ...e].slice(0, 10))
    }
    prevRef.current = sessions
  }, [sessions])

  return (
    <aside style={{
      width: 'var(--panel-w)', flexShrink: 0,
      minWidth: 0,
      overflowY: 'auto', overflowX: 'hidden',
      background: 'var(--panel-bg)',
      borderLeft: '1px solid var(--border-faint)',
      padding: '20px 12px',
      display: 'flex', flexDirection: 'column', gap: 20,
      position: 'relative', zIndex: 2,
    }}>
      {/* Donut */}
      <div>
        <PanelTitle>Session</PanelTitle>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', width: 90, height: 90 }}>
            <svg viewBox="0 0 90 90" width="90" height="90" style={{ transform: 'rotate(-90deg)' }}>
              <defs>
                <linearGradient id="dg" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7C3AED" />
                  <stop offset="100%" stopColor="#5D36FF" />
                </linearGradient>
              </defs>
              <circle cx="45" cy="45" r="35" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="10" />
              <circle cx="45" cy="45" r="35" fill="none" stroke="url(#dg)" strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${busyArc} ${circ - busyArc}`}
                strokeDashoffset="0" />
              <circle cx="45" cy="45" r="35" fill="none" stroke="#7ddd5a" strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${idleArc} ${circ - idleArc}`}
                strokeDashoffset={`${-busyArc}`} />
              <circle cx="45" cy="45" r="35" fill="none" stroke="#E76500" strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${waitArc} ${circ - waitArc}`}
                strokeDashoffset={`${-(busyArc + idleArc)}`} />
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--white)' }}>{activePct}%</span>
              <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: '"DM Mono",monospace' }}>active</span>
            </div>
          </div>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[
              { label: 'Busy',    color: 'var(--am-violet)', val: busy },
              { label: 'Idle',    color: '#7ddd5a',             val: idle },
              { label: 'Waiting', color: '#ffb066',             val: waiting },
              { label: 'Done',    color: 'var(--text-dim)',     val: done },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--text-muted)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                {r.label}
                <span style={{ marginLeft: 'auto', fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--text-dim)' }}>
                  {r.val}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div>
        <PanelTitle>Totals</PanelTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            { num: total,      lbl: 'Total agents' },
            { num: subagents,  lbl: 'Subagents' },
            { num: waiting,    lbl: 'Approvals' },
            { num: avgRuntime, lbl: 'Avg runtime' },
          ].map(s => (
            <div key={s.lbl} style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              borderRadius: 10, padding: '9px 10px', minWidth: 0,
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--white)', lineHeight: 1, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.num}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: '"DM Mono",monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.lbl}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Token usage */}
      {tokens !== null && (
        <div>
          <PanelTitle>Tokens (all-time)</PanelTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              { num: fmtTokens(tokens.total),      lbl: 'Total tokens' },
              { num: `${tokens.cacheHitPct}%`,      lbl: 'Cache hit' },
              { num: fmtTokens(tokens.input),       lbl: 'Input' },
              { num: fmtTokens(tokens.output),      lbl: 'Output' },
            ].map(s => (
              <div key={s.lbl} style={{
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                borderRadius: 10, padding: '9px 10px', minWidth: 0,
              }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--white)', lineHeight: 1, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.num}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: '"DM Mono",monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.lbl}
                </div>
              </div>
            ))}
          </div>
          {/* Per-model breakdown */}
          {Object.keys(tokens.byModel).length > 0 && (() => {
            const models = Object.entries(tokens.byModel)
              .filter(([model]) => !model.startsWith('<'))
              .map(([model, t]) => ({ model, total: t.input + t.output }))
              .sort((a, b) => b.total - a.total)
            const grandTotal = models.reduce((s, m) => s + m.total, 0)
            return (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {models.map(({ model, total: mt }) => {
                  const pct = grandTotal > 0 ? Math.round((mt / grandTotal) * 100) : 0
                  return (
                    <div key={model}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3, color: 'var(--text-muted)', fontFamily: '"DM Mono",monospace' }}>
                        <span>{shortModelName(model)}</span>
                        <span>{fmtTokens(mt)} · {pct}%</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--card-border)' }}>
                        <div style={{
                          height: '100%', borderRadius: 2,
                          width: `${pct}%`,
                          background: model.includes('opus') ? 'var(--am-purple)'
                            : model.includes('sonnet') ? 'var(--am-violet)'
                            : '#049F9A',
                          transition: 'width .4s ease',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* Events feed */}
      <div>
        <PanelTitle>Recent events</PanelTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {events.length === 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: '"DM Mono",monospace' }}>
              Waiting for events…
            </span>
          )}
          {events.map((ev, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: ev.color, flexShrink: 0, marginTop: 3 }} />
              <div>
                <div>{ev.msg}</div>
                <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 9, color: 'var(--text-dim)', marginTop: 1 }}>
                  {ev.time}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
      textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 12,
    }}>
      {children}
    </div>
  )
}
