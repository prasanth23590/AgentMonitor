import { useState, useEffect } from 'react'

interface InsightsMeta {
  exists: boolean
  lastModified: string | null
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

export function InsightsPanel() {
  const [meta, setMeta] = useState<InsightsMeta | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(true)

  async function fetchMeta() {
    setLoading(true)
    try {
      const res = await fetch('/api/insights/meta')
      const data = await res.json()
      setMeta(data)
    } catch {
      setMeta({ exists: false, lastModified: null })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMeta() }, [])

  function handleRefresh() {
    setRefreshKey(k => k + 1)
    fetchMeta()
  }

  const isStale = meta?.lastModified
    ? Date.now() - new Date(meta.lastModified).getTime() > SEVEN_DAYS_MS
    : false

  const age = meta?.lastModified ? daysAgo(meta.lastModified) : 0

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', position: 'relative',
    }}>
      {/* Top bar */}
      <div style={{
        flexShrink: 0,
        padding: '12px 24px',
        borderBottom: '1px solid var(--border-faint)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            Insights Report
          </span>
          {meta?.lastModified && (
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: '"DM Mono",monospace' }}>
              Generated {age === 0 ? 'today' : `${age}d ago`}
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          style={{
            fontFamily: '"DM Mono",monospace', fontSize: 11, fontWeight: 500,
            padding: '4px 12px', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer',
            background: 'transparent', color: loading ? 'var(--text-dim)' : 'var(--text-muted)',
            border: '1px solid var(--border-faint)',
            transition: 'color .2s, border-color .2s',
          }}
          onMouseEnter={e => {
            if (!loading) {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-glow)'
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-faint)'
          }}
        >
          {loading ? 'checking…' : '↻ refresh'}
        </button>
      </div>

      {/* Staleness banner */}
      {isStale && (
        <div style={{
          flexShrink: 0,
          padding: '8px 24px',
          background: 'rgba(231,101,0,0.10)',
          borderBottom: '1px solid rgba(231,101,0,0.20)',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: '#ffb066',
          fontFamily: '"DM Mono",monospace',
        }}>
          <span>⚠</span>
          <span>
            Report is {age} days old — run{' '}
            <code style={{ background: 'rgba(231,101,0,0.15)', padding: '1px 6px', borderRadius: 4 }}>
              /insights
            </code>
            {' '}in any Claude Code session, then click ↻ refresh.
          </span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: '"DM Mono",monospace' }}>
            loading…
          </span>
        </div>
      ) : !meta?.exists ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          padding: 40,
        }}>
          <div style={{ fontSize: 32, opacity: 0.3 }}>◈</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            No insights report found
          </div>
          <div style={{
            fontSize: 12, color: 'var(--text-muted)', textAlign: 'center',
            maxWidth: 380, lineHeight: 1.7,
          }}>
            Run{' '}
            <code style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              padding: '2px 8px', borderRadius: 5,
              fontFamily: '"DM Mono",monospace', fontSize: 12,
              color: 'var(--am-violet)',
            }}>
              /insights
            </code>
            {' '}in any Claude Code session to generate your report,
            then click{' '}
            <strong style={{ color: 'var(--text-primary)' }}>↻ refresh</strong>{' '}
            above.
          </div>
          <div style={{
            fontSize: 11, color: 'var(--text-dim)', fontFamily: '"DM Mono",monospace',
            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
            borderRadius: 8, padding: '8px 16px',
          }}>
            ~/.claude/usage-data/report.html
          </div>
        </div>
      ) : (
        <iframe
          key={refreshKey}
          src={`/api/insights/report?v=${refreshKey}`}
          sandbox="allow-scripts allow-popups"
          style={{
            flex: 1, border: 'none', width: '100%',
            background: '#fff',
          }}
          title="Claude Code Insights"
        />
      )}
    </div>
  )
}
