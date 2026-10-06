import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  enabled: boolean
  onSelectSlug: (slug: string) => void
}

export function WikiQA({ enabled, onSelectSlug }: Props) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function ask() {
    if (!question.trim() || loading) return
    setLoading(true); setError(''); setAnswer('')
    try {
      const r = await fetch('/api/wiki/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      setAnswer(data.answer || '_No answer._')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const transformed = answer.replace(/\[\[([a-z0-9-]+)\]\]/g, (_, s) => `[${s}](#wiki/${s})`)

  return (
    <div style={{
      borderTop: '1px solid var(--border-faint)', padding: '12px 24px',
      maxHeight: 200, overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          type="text"
          placeholder={enabled ? 'Ask a question about your work…' : 'Compile a wiki first.'}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') ask() }}
          disabled={!enabled || loading}
          style={{
            flex: 1, background: 'var(--card-bg)', color: 'var(--text-primary)',
            border: '1px solid var(--card-border)', borderRadius: 4,
            padding: '6px 10px', fontSize: 12, fontFamily: '"DM Mono",monospace',
          }}
        />
        <button
          onClick={ask}
          disabled={!enabled || loading || !question.trim()}
          style={{
            background: 'var(--am-violet)', color: '#fff', border: 'none',
            borderRadius: 4, padding: '6px 14px', cursor: 'pointer',
            opacity: !enabled || loading || !question.trim() ? 0.5 : 1,
            fontSize: 11, fontWeight: 600, fontFamily: '"DM Mono",monospace',
          }}
        >
          {loading ? 'asking…' : 'Ask'}
        </button>
      </div>
      {error && <div style={{ color: '#EE3939', fontSize: 11, fontFamily: '"DM Mono",monospace' }}>{error}</div>}
      {answer && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            urlTransform={(url) => {
              if (url.startsWith('#wiki/')) return url
              if (/^(https?:|mailto:)/.test(url)) return url
              return ''
            }}
            components={{
              a: ({ href, children }: any) => {
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
    </div>
  )
}
