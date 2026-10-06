import { useState } from 'react'

interface Props {
  activeTab: 'live' | 'history' | 'insights' | 'knowledge' | 'tools'
  onTabChange: (tab: 'live' | 'history' | 'insights' | 'knowledge' | 'tools') => void
  knowledgeBadge?: number
}

const TABS: { id: 'live' | 'history' | 'insights' | 'knowledge' | 'tools'; icon: string; label: string }[] = [
  { id: 'live',      icon: '⊞', label: 'Live' },
  { id: 'history',   icon: '▤', label: 'History' },
  { id: 'insights',  icon: '◈', label: 'Insights' },
  { id: 'knowledge', icon: '⌘', label: 'Graph' },
  { id: 'tools',     icon: '⚙', label: 'Tools' },
]

export function NavSidebar({ activeTab, onTabChange, knowledgeBadge = 0 }: Props) {
  const [expanded, setExpanded] = useState(true)
  const w = expanded ? 130 : 52

  return (
    <nav style={{
      width: w, flexShrink: 0,
      background: 'rgba(13,8,24,0.85)',
      borderRight: '1px solid var(--border-faint)',
      display: 'flex', flexDirection: 'column', alignItems: 'stretch',
      padding: '12px 0', gap: 4,
      transition: 'width .2s ease',
      overflow: 'hidden',
    }}>
      {TABS.map(tab => {
        const active = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            title={tab.label}
            style={{
              display: 'flex', alignItems: 'center',
              gap: expanded ? 10 : 0,
              justifyContent: expanded ? 'flex-start' : 'center',
              padding: expanded ? '9px 14px' : '9px 0',
              margin: '0 8px', borderRadius: 9,
              border: 'none', cursor: 'pointer',
              background: active
                ? 'linear-gradient(135deg,var(--am-purple),var(--am-violet))'
                : 'transparent',
              color: active ? '#fff' : 'var(--text-dim)',
              boxShadow: active ? '0 4px 14px rgba(93,54,255,.3)' : undefined,
              transition: 'background .18s, color .18s, padding .2s',
              whiteSpace: 'nowrap', overflow: 'hidden',
            }}
          >
            <span style={{ fontSize: 15, flexShrink: 0, position: 'relative' }}>
              {tab.icon}
              {tab.id === 'knowledge' && knowledgeBadge > 0 && (
                <span style={{
                  position: 'absolute', top: -3, right: -5,
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--am-violet)',
                  border: '1.5px solid var(--am-dark)',
                }} />
              )}
            </span>
            {expanded && (
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.01em' }}>
                {tab.label}
              </span>
            )}
          </button>
        )
      })}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Collapse / expand toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        title={expanded ? 'Collapse' : 'Expand'}
        style={{
          display: 'flex', alignItems: 'center',
          justifyContent: expanded ? 'flex-start' : 'center',
          gap: expanded ? 10 : 0,
          padding: expanded ? '9px 14px' : '9px 0',
          margin: '0 8px', borderRadius: 9,
          border: 'none', cursor: 'pointer',
          background: 'transparent',
          color: 'var(--text-dim)',
          transition: 'color .18s, padding .2s',
          whiteSpace: 'nowrap', overflow: 'hidden',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
      >
        <span style={{ fontSize: 13, flexShrink: 0 }}>{expanded ? '←' : '→'}</span>
        {expanded && <span style={{ fontSize: 11, fontFamily: '"DM Mono",monospace' }}>Collapse</span>}
      </button>
    </nav>
  )
}
