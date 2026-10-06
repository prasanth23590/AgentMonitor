import type { AgentSession } from '../types'
import { getColumn } from '../types'
import { AgentGroup } from './AgentGroup'
import type { LaunchCapabilities } from '../App'

interface Props {
  sessions: AgentSession[]
  showSlug: boolean
  caps: LaunchCapabilities
}

export function KanbanBoard({ sessions, showSlug, caps }: Props) {
  const idle    = sessions.filter(s => getColumn(s) === 'idle')
  const busy    = sessions.filter(s => getColumn(s) === 'busy')
  const waiting = sessions.filter(s => getColumn(s) === 'waiting')
  const done    = sessions.filter(s => getColumn(s) === 'done')

  // Global index for accent colour cycling (stable across columns)
  const indexMap = new Map(sessions.map((s, i) => [s.pid, i]))

  return (
    <div style={{
      flex: 1, overflowX: 'auto', overflowY: 'auto',
      padding: '20px 20px 32px',
      display: 'flex', gap: 14, alignItems: 'flex-start',
      position: 'relative', zIndex: 2,
    }}>
      <Column label="Idle" dot="#7ddd5a" dotGlow="#36a41d" count={idle.length}>
        {idle.map(s => <AgentGroup key={s.pid} session={s} index={indexMap.get(s.pid)!} showSlug={showSlug} caps={caps} />)}
        {idle.length === 0 && <EmptyState>No idle sessions</EmptyState>}
      </Column>

      <Column label="Busy" dot="#1B90FF" dotGlow="#1B90FF" count={busy.length}>
        {busy.map(s => <AgentGroup key={s.pid} session={s} index={indexMap.get(s.pid)!} showSlug={showSlug} caps={caps} />)}
        {busy.length === 0 && <EmptyState>No active sessions</EmptyState>}
      </Column>

      <Column label="Waiting for Approval" dot="#ffb066" count={waiting.length}>
        {waiting.map(s => <AgentGroup key={s.pid} session={s} index={indexMap.get(s.pid)!} showSlug={showSlug} caps={caps} />)}
        {waiting.length === 0 && <EmptyState>No sessions waiting</EmptyState>}
      </Column>

      <Column label="Done" dot="var(--text-dim)" count={done.length}>
        {done.map(s => <AgentGroup key={s.pid} session={s} index={indexMap.get(s.pid)!} showSlug={showSlug} caps={caps} />)}
        {done.length === 0 && <EmptyState>Completed sessions appear here</EmptyState>}
      </Column>
    </div>
  )
}

function Column({ label, dot, dotGlow, count, children }: {
  label: string; dot: string; dotGlow?: string; count: number; children: React.ReactNode
}) {
  return (
    <div style={{ flexShrink: 0, width: 272, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '7px 12px', borderRadius: 10,
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        fontFamily: '"DM Mono",monospace', fontSize: 10, fontWeight: 500,
        letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-dim)',
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: dot,
          boxShadow: dotGlow ? `0 0 5px ${dotGlow}` : undefined,
        }} />
        {label}
        <span style={{
          marginLeft: 'auto',
          background: 'rgba(93,54,255,.1)', border: '1px solid var(--border-faint)',
          borderRadius: 10, fontSize: 10, padding: '1px 7px', color: 'var(--text-muted)',
        }}>
          {count}
        </span>
      </div>
      {children}
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      border: '1px dashed rgba(93,54,255,.15)', borderRadius: 12,
      padding: '28px 16px', textAlign: 'center',
      fontSize: 11, color: 'var(--text-dim)', fontFamily: '"DM Mono",monospace',
    }}>
      {children}
    </div>
  )
}
