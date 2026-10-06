import { useState, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface McpServer {
  name: string
  type: 'stdio' | 'http'
  command?: string
  args?: string[]
  url?: string
  description?: string
}

export interface Skill {
  name: string
  description: string
  plugin?: string
}

interface ToolsData {
  mcpServers: McpServer[]
  skills: {
    user: Skill[]
    builtin: Skill[]
  }
}

export function ToolsPanel({ onSelectSkill }: { onSelectSkill: (skill: Skill) => void }) {
  const [data, setData] = useState<ToolsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    fetch('/api/tools')
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setFetchError(true); setLoading(false) })
  }, [])

  const totalSkills = data ? data.skills.user.length + data.skills.builtin.length : 0

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
      {loading && (
        <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--text-dim)' }}>
          Loading…
        </div>
      )}

      {!loading && fetchError && (
        <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--text-dim)' }}>
          Failed to load tools data.
        </div>
      )}

      {!loading && data && (
        <>
          {/* MCP Servers section */}
          <SectionHeader label="MCP Servers" count={data.mcpServers.length} />
          {data.mcpServers.length === 0 ? (
            <Empty>No MCP servers configured in ~/.claude/settings.json</Empty>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 10,
              marginBottom: 32,
            }}>
              {data.mcpServers.map(server => (
                <McpCard key={server.name} server={server} />
              ))}
            </div>
          )}

          {/* Skills section */}
          <SectionHeader label="Skills" count={totalSkills} />

          {data.skills.user.length > 0 && (
            <SkillGroup label="User" count={data.skills.user.length}>
              {data.skills.user.map(skill => (
                <SkillCard key={skill.name} skill={skill} onClick={() => onSelectSkill(skill)} />
              ))}
            </SkillGroup>
          )}

          {data.skills.builtin.length > 0 && (
            <SkillGroup label="Built-in" count={data.skills.builtin.length}>
              {data.skills.builtin.map(skill => (
                <SkillCard key={skill.name} skill={skill} onClick={() => onSelectSkill(skill)} />
              ))}
            </SkillGroup>
          )}
        </>
      )}
    </div>
  )
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div style={{
      fontFamily: '"DM Mono",monospace', fontSize: 10, fontWeight: 500,
      textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-dim)',
      marginBottom: 14,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {label}
      <span style={{
        background: 'rgba(93,54,255,.1)', border: '1px solid var(--border-faint)',
        borderRadius: 10, fontSize: 10, padding: '1px 7px', color: 'var(--text-muted)',
      }}>
        {count}
      </span>
    </div>
  )
}

function SkillGroup({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontFamily: '"DM Mono",monospace', fontSize: 9, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-dim)',
        marginBottom: 10, paddingBottom: 6,
        borderBottom: '1px solid rgba(255,255,255,.06)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {label}
        <span style={{ opacity: 0.6 }}>{count}</span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 10,
      }}>
        {children}
      </div>
    </div>
  )
}

function SkillCard({ skill, onClick }: { skill: Skill; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 10, padding: '12px 14px',
        cursor: 'pointer',
        transition: 'border-color .18s, background .18s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'var(--card-border-h)'
        el.style.background = 'var(--card-bg-hover)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = ''
        el.style.background = ''
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>
          {skill.name}
        </span>
        <SkillBadge skill={skill} />
      </div>

      {skill.description && (
        <div style={{
          fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--text-muted)',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {skill.description}
        </div>
      )}
    </div>
  )
}

function SkillBadge({ skill }: { skill: Skill }) {
  const isUser = !skill.plugin
  return (
    <span style={{
      fontFamily: '"DM Mono",monospace', fontSize: 9, fontWeight: 500,
      padding: '2px 7px', borderRadius: 4, letterSpacing: '.04em', flexShrink: 0,
      background: isUser ? 'rgba(54,164,29,.12)' : 'rgba(93,54,255,.1)',
      color: isUser ? '#7ddd5a' : 'var(--am-violet)',
      border: `1px solid ${isUser ? 'rgba(54,164,29,.2)' : 'rgba(93,54,255,.18)'}`,
    }}>
      {isUser ? 'user' : skill.plugin}
    </span>
  )
}

export function SkillPopup({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
        padding: '24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--modal-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 14, padding: '20px 22px',
          width: '100%', maxWidth: 520,
          maxHeight: '70vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
            {skill.name}
          </span>
          <SkillBadge skill={skill} />
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)', fontSize: 16, lineHeight: 1,
              padding: '2px 6px', borderRadius: 4,
              transition: 'color .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Description */}
        <div style={{
          fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--text-muted)',
          lineHeight: 1.65, overflowY: 'auto',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {skill.description || 'No description available.'}
        </div>
      </div>
    </div>,
    document.body
  )
}

function McpCard({ server }: { server: McpServer }) {
  const [expanded, setExpanded] = useState(false)
  const hasArgs = server.args && server.args.length > 0

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      borderRadius: 10, padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>
          {server.name}
        </span>
        <TransportBadge type={server.type} />
      </div>

      {/* Command or URL */}
      <div style={{
        fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--text-dim)',
        marginBottom: hasArgs ? 6 : 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {server.type === 'stdio' ? server.command : server.url}
      </div>

      {/* Args — truncated, expandable */}
      {hasArgs && (
        <div
          onClick={() => setExpanded(e => !e)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpanded(v => !v) }}
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          style={{ cursor: 'pointer' }}
          title={expanded ? 'Click to collapse' : 'Click to expand args'}
        >
          <div style={{
            fontFamily: '"DM Mono",monospace', fontSize: 9, color: 'var(--text-dim)',
            overflow: expanded ? 'visible' : 'hidden',
            textOverflow: expanded ? 'clip' : 'ellipsis',
            whiteSpace: expanded ? 'pre-wrap' : 'nowrap',
            wordBreak: 'break-all',
          }}>
            {server.args!.join(' ')}
          </div>
        </div>
      )}

      {/* Optional description */}
      {server.description && (
        <div style={{
          fontFamily: '"DM Mono",monospace', fontSize: 9, color: 'var(--text-dim)',
          marginTop: 6, fontStyle: 'italic',
        }}>
          {server.description}
        </div>
      )}
    </div>
  )
}

function TransportBadge({ type }: { type: 'stdio' | 'http' }) {
  const isHttp = type === 'http'
  return (
    <span style={{
      fontFamily: '"DM Mono",monospace', fontSize: 9, fontWeight: 500,
      padding: '2px 7px', borderRadius: 4, letterSpacing: '.04em',
      flexShrink: 0,
      background: isHttp ? 'rgba(27,144,255,.12)' : 'rgba(93,54,255,.12)',
      color: isHttp ? '#6fc6ff' : 'var(--am-violet)',
      border: `1px solid ${isHttp ? 'rgba(27,144,255,.2)' : 'rgba(93,54,255,.2)'}`,
    }}>
      {type}
    </span>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--text-dim)',
      marginBottom: 28,
    }}>
      {children}
    </div>
  )
}

