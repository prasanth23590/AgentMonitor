import { useEffect, useMemo, useRef, useState } from 'react'
import { WikiCompileBar } from './WikiCompileBar'
import { WikiGraph, type GraphData } from './WikiGraph'
import { WikiArticle } from './WikiArticle'
import { WikiQA } from './WikiQA'

interface WikiResponse {
  empty?: boolean
  version?: number
  lastCompiledAt?: string
  sessionsAtCompile?: string[]
  nodes?: GraphData['nodes']
  edges?: GraphData['edges']
}

interface PastSession {
  sessionId: string; cwd: string; name: string; slug: string
  lastActiveAt: number; turnCount: number; summary: string
}

function CompileProgress({ message }: { message: string }) {
  const [elapsed, setElapsed] = useState(0)
  const [dots, setDots] = useState('.')
  const startRef = useRef(Date.now())

  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
      setDots(d => d.length >= 3 ? '.' : d + '.')
    }, 500)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{
      padding: '10px 24px', fontFamily: '"DM Mono",monospace', fontSize: 11,
      color: 'var(--am-violet)', background: 'rgba(93,54,255,.08)',
      display: 'flex', alignItems: 'center', gap: 12,
      borderBottom: '1px solid rgba(93,54,255,.15)',
    }}>
      <span style={{
        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
        background: 'var(--am-violet)',
        animation: 'pulse-dot 1s ease-in-out infinite',
      }} />
      <span style={{ flex: 1 }}>{message}{dots}</span>
      <span style={{ color: 'rgba(93,54,255,.5)', fontSize: 10 }}>{elapsed}s</span>
    </div>
  )
}

export function KnowledgeGraphPanel() {
  const [wiki, setWiki] = useState<WikiResponse | null>(null)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [progress, setProgress] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [pastSessionCount, setPastSessionCount] = useState<number>(0)
  const [pastSessions, setPastSessions] = useState<PastSession[]>([])

  function reload() {
    fetch('/api/wiki/graph').then(r => r.json()).then(setWiki).catch(() => setWiki({ empty: true }))
  }

  useEffect(() => {
    reload()
    fetch('/api/sessions/past').then(r => r.json()).then(arr => {
      if (Array.isArray(arr)) { setPastSessionCount(arr.length); setPastSessions(arr) }
    }).catch(() => {})
  }, [])

  const newSessionsSince = wiki && !wiki.empty && wiki.sessionsAtCompile
    ? Math.max(0, pastSessionCount - wiki.sessionsAtCompile.length)
    : 0

  const hasWiki = wiki && !wiki.empty && Array.isArray(wiki.nodes) && wiki.nodes.length > 0

  // Stable reference — only changes when wiki data actually changes, not on every render.
  // Without this, every selectedSlug change creates a new object, invalidating WikiGraph's
  // graphData memo and resetting the zoom via onEngineStop.
  const graphData = useMemo<GraphData>(() => ({
    nodes: wiki?.nodes ?? [],
    edges: wiki?.edges ?? [],
  }), [wiki])

  const selectedNode = wiki?.nodes?.find(n => n.slug === selectedSlug)
  const contributingSessions = selectedNode
    ? pastSessions.filter(s =>
        (selectedNode.sessionIds || []).some(id =>
          s.sessionId === id || s.sessionId.startsWith(id) || id.startsWith(s.sessionId.slice(0, 8))
        )
      )
    : []

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <WikiCompileBar
        lastCompiledAt={hasWiki ? wiki!.lastCompiledAt! : null}
        newSessionsSince={newSessionsSince}
        onCompileStart={() => { setProgress('Starting…'); setError('') }}
        onCompileProgress={setProgress}
        onCompileComplete={() => { setProgress(''); reload() }}
        onCompileError={msg => { setProgress(''); setError(msg) }}
      />

      {progress && <CompileProgress message={progress} />}

      {error && <div style={{
        padding: '8px 24px', fontFamily: '"DM Mono",monospace', fontSize: 11,
        color: '#EE3939', background: 'rgba(238,57,57,.08)',
      }}>{error}</div>}

      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {!hasWiki ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 12, color: 'var(--text-dim)',
            fontFamily: '"DM Mono",monospace', fontSize: 12,
          }}>
            <span style={{ fontSize: 32 }}>⌘</span>
            <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>No wiki compiled yet</div>
            <div>Click <strong>Compile wiki</strong> to generate concept articles from your {pastSessionCount} past sessions.</div>
          </div>
        ) : (
          <>
            <WikiGraph
              data={graphData}
              selectedSlug={selectedSlug}
              onSelect={setSelectedSlug}
            />
            {selectedSlug && (
              <WikiArticle
                slug={selectedSlug}
                onSelectSlug={setSelectedSlug}
                onClose={() => setSelectedSlug(null)}
                contributingSessions={contributingSessions}
              />
            )}
          </>
        )}
      </div>

      <WikiQA enabled={!!hasWiki} onSelectSlug={setSelectedSlug} />
    </div>
  )
}
