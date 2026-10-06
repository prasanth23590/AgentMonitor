import { useState } from 'react'
import type { AgentSession } from '../types'
import icon from '../../assets/icon.svg'

interface Props {
  sessions: AgentSession[]
  theme: string
  onToggleTheme: () => void
  showSlug: boolean
  onToggleSlug: () => void
  connected: boolean
  onStopped: () => void
}

export function Shell({ sessions, theme, onToggleTheme, showSlug, onToggleSlug, connected, onStopped }: Props) {
  const active  = sessions.filter(s => s.alive && s.status !== 'waiting').length
  const waiting = sessions.filter(s => s.alive && s.status === 'waiting').length
  const [stopping, setStopping] = useState(false)

  async function handleStop() {
    if (!confirm('Stop Agent Monitor? This will shut down the server.')) return
    // Desktop app: ask Electron to quit (closes the window and the embedded server)
    if (window.agentMonitor) { window.agentMonitor.quit(); return }
    setStopping(true)
    try {
      await fetch('/api/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    } catch {
      // expected — server closes the connection
    }
    onStopped()
  }

  return (
    <header style={{
      position: 'relative', zIndex: 10,
      background: 'var(--shell-bg)',
      backdropFilter: 'blur(24px)',
      borderBottom: '1px solid var(--border-faint)',
      height: 'var(--shell-h)', padding: '0 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <img src={icon} width="22" height="22" style={{ borderRadius: 6 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '.01em' }}>
            Agent Monitor
          </span>
        </a>
        <div style={{ width: 1, height: 18, background: 'var(--border-faint)' }} />
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: '"DM Mono",monospace' }}>
          Claude Code · live
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {!connected && (
          <Pill color="#ff6b6b" bg="rgba(238,57,57,.12)" border="rgba(238,57,57,.25)">
            disconnected
          </Pill>
        )}
        <Pill color="#7ddd5a" bg="rgba(54,164,29,.12)" border="rgba(54,164,29,.2)" pulse>
          {active} live
        </Pill>
        <Pill color="#ffb066" bg="rgba(231,101,0,.12)" border="rgba(231,101,0,.2)">
          {waiting} waiting
        </Pill>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: '"DM Mono",monospace' }}>
          ↻ 1s
        </span>
        <button
          onClick={onToggleSlug}
          title={showSlug ? 'Switch to folder name' : 'Switch to /rename title'}
          style={{
            fontFamily: '"DM Mono",monospace', fontSize: 11, fontWeight: 500,
            padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
            background: showSlug ? 'rgba(93,54,255,.15)' : 'transparent',
            color: showSlug ? 'var(--am-violet)' : 'var(--text-muted)',
            border: showSlug ? '1px solid rgba(93,54,255,.4)' : '1px solid var(--border-faint)',
            transition: 'color .2s, border-color .2s, background .2s',
            lineHeight: 1,
          }}
        >
          {showSlug ? '/rename' : 'folder'}
        </button>
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            fontFamily: '"DM Mono",monospace', fontSize: 13, fontWeight: 500,
            padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
            background: 'transparent', color: 'var(--text-muted)',
            border: '1px solid var(--border-faint)',
            transition: 'color .2s, border-color .2s',
            lineHeight: 1,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-glow)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-faint)'
          }}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <button
          onClick={handleStop}
          disabled={stopping}
          style={{
            fontFamily: '"DM Mono",monospace', fontSize: 11, fontWeight: 500,
            padding: '4px 11px', borderRadius: 6, cursor: stopping ? 'not-allowed' : 'pointer',
            background: 'transparent', color: stopping ? 'var(--text-dim)' : 'var(--text-muted)',
            border: '1px solid var(--border-faint)',
            transition: 'color .2s, border-color .2s',
          }}
          onMouseEnter={e => {
            if (!stopping) {
              (e.currentTarget as HTMLButtonElement).style.color = '#ff6b6b'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(238,57,57,.35)'
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-faint)'
          }}
        >
          {stopping ? 'stopping…' : '⏻ stop'}
        </button>
      </div>
    </header>
  )
}

function Pill({ children, color, bg, border, pulse }: {
  children: React.ReactNode
  color: string; bg: string; border: string; pulse?: boolean
}) {
  return (
    <span style={{
      fontFamily: '"DM Mono",monospace', fontSize: 11, fontWeight: 500,
      padding: '3px 10px', borderRadius: 20,
      background: bg, color, border: `1px solid ${border}`,
      display: 'flex', alignItems: 'center', gap: 5,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0,
        animation: pulse ? 'pulse-dot 2s ease-in-out infinite' : undefined,
      }} />
      {children}
    </span>
  )
}
