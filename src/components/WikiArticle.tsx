import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface PastSession {
  sessionId: string; cwd: string; name: string; slug: string
  lastActiveAt: number; turnCount: number; summary: string
}

interface Props {
  slug: string
  onSelectSlug: (slug: string) => void
  onClose: () => void
  contributingSessions: PastSession[]
}

export function WikiArticle({ slug, onSelectSlug, onClose, contributingSessions }: Props) {
  const [markdown, setMarkdown] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'article' | 'sessions'>('article')

  useEffect(() => {
    setView('article')
    setLoading(true)
    fetch(`/api/wiki/article?slug=${encodeURIComponent(slug)}`)
      .then(r => r.ok ? r.text() : Promise.reject(r.statusText))
      .then(t => { setMarkdown(t); setLoading(false) })
      .catch(() => { setMarkdown('_Article not found._'); setLoading(false) })
  }, [slug])

  const transformed = markdown.replace(/\[\[([a-z0-9-]+)\]\]/g, (_, s) => `[${s}](#wiki/${s})`)

  return (
    <div style={{
      width: '40%', minWidth: 320, padding: '20px 24px', overflowY: 'auto',
      background: 'var(--am-dark)', borderLeft: '1px solid var(--border-faint)',
    }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center' }}>
          {(['article', 'sessions'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              fontFamily: '"DM Mono",monospace', fontSize: 10, padding: '3px 10px',
              borderRadius: 12, border: '1px solid var(--border-faint)', cursor: 'pointer',
              background: view === v ? 'var(--am-violet)' : 'transparent',
              color: view === v ? '#fff' : 'var(--text-dim)',
            }}>
              {v === 'article' ? 'Article' : `Sessions (${contributingSessions.length})`}
            </button>
          ))}
          <button onClick={onClose} title="Close" style={{
            marginLeft: 'auto', fontFamily: '"DM Mono",monospace', fontSize: 12,
            padding: '2px 7px', borderRadius: 12,
            border: '1px solid var(--border-faint)', cursor: 'pointer',
            background: 'transparent', color: 'var(--text-dim)', lineHeight: 1,
          }}>✕</button>
        </div>

      {view === 'article' && (
        <>
          {loading && <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>Loading…</div>}
          {!loading && (
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                urlTransform={(url) => {
                  if (url.startsWith('#wiki/')) return url
                  if (/^(https?:|mailto:)/.test(url)) return url
                  return ''
                }}
                components={{
                  a: ({ href, children }) => {
                    if (href?.startsWith('#wiki/')) {
                      const target = href.slice(6)
                      return (
                        <a
                          href="#"
                          onClick={(e) => { e.preventDefault(); onSelectSlug(target) }}
                          style={{ color: 'var(--am-violet)', textDecoration: 'none', borderBottom: '1px dashed var(--am-violet)' }}
                        >
                          {children}
                        </a>
                      )
                    }
                    return <a href={href} target="_blank" rel="noreferrer">{children}</a>
                  },
                }}
              >
                {transformed}
              </ReactMarkdown>
            </div>
          )}
        </>
      )}

      {view === 'sessions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {contributingSessions.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 11, fontFamily: '"DM Mono",monospace' }}>
              No session data found.
            </div>
          ) : contributingSessions.map(s => (
            <div key={s.sessionId} style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: '"DM Mono",monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name || s.slug}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: '"DM Mono",monospace', flexShrink: 0 }}>
                  {s.turnCount} msgs · {new Date(s.lastActiveAt).toLocaleDateString()}
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: '"DM Mono",monospace', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.cwd}
              </div>
              {s.summary && (
                <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)', fontFamily: '"DM Mono",monospace', lineHeight: 1.5 }}>
                  {s.summary.length > 220 ? s.summary.slice(0, 220) + '…' : s.summary}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
