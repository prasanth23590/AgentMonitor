import { useState, useEffect, useRef } from 'react'
import './styles/global.css'
import { useSSE } from './useSSE'
import { Shell } from './components/Shell'
import { NavSidebar } from './components/NavSidebar'
import { KanbanBoard } from './components/KanbanBoard'
import { StatsPanel } from './components/StatsPanel'
import { PastSessions } from './components/PastSessions'
import { InsightsPanel } from './components/InsightsPanel'
import { ToolsPanel } from './components/ToolsPanel'
import { KnowledgeGraphPanel } from './components/KnowledgeGraphPanel'
import { SkillPopup, type Skill } from './components/ToolsPanel'

export interface LaunchCapabilities {
  platform: 'darwin' | 'win32' | string
  terminal: boolean
  iterm: boolean
  powershell: boolean
  vscode: boolean
}

export function useLaunchCapabilities(): LaunchCapabilities {
  const [caps, setCaps] = useState<LaunchCapabilities>({ platform: 'darwin', terminal: true, iterm: false, powershell: false, vscode: false })
  useEffect(() => {
    fetch('/api/launch/capabilities').then(r => r.json()).then(setCaps).catch(() => {})
  }, [])
  return caps
}

function useTheme(): [string, () => void] {
  const manualOverride = useRef(!!localStorage.getItem('am-theme'))
  const [theme, setTheme] = useState<string>(() => {
    const saved = localStorage.getItem('am-theme')
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    if (manualOverride.current) {
      localStorage.setItem('am-theme', theme)
    }
  }, [theme])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      if (!manualOverride.current) {
        setTheme(e.matches ? 'dark' : 'light')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggle = () => {
    manualOverride.current = true
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark'
      localStorage.setItem('am-theme', next)
      return next
    })
  }
  return [theme, toggle]
}

function useKnowledgeBadge() {
  const [badge, setBadge] = useState(0)
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const [graph, past] = await Promise.all([
          fetch('/api/wiki/graph').then(r => r.json()),
          fetch('/api/sessions/past').then(r => r.json()),
        ])
        if (graph.empty || !Array.isArray(graph.sessionsAtCompile)) { setBadge(0); return }
        const pastCount = Array.isArray(past) ? past.length : 0
        setBadge(Math.max(0, pastCount - graph.sessionsAtCompile.length))
      } catch { setBadge(0) }
    }, 2000) // defer so initial render isn't blocked
    return () => clearTimeout(t)
  }, [])
  return badge
}

export function App() {
  const { sessions, connected } = useSSE('/api/sessions/stream')
  const caps = useLaunchCapabilities()
  const [activeTab, setActiveTab] = useState<'live' | 'history' | 'insights' | 'knowledge' | 'tools'>('live')
  const [theme, toggleTheme] = useTheme()
  const [showSlug, setShowSlug] = useState<boolean>(() =>
    localStorage.getItem('am-show-slug') === 'true'
  )
  const [stopped, setStopped] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const knowledgeBadge = useKnowledgeBadge()

  function toggleSlug() {
    setShowSlug(v => {
      const next = !v
      localStorage.setItem('am-show-slug', String(next))
      return next
    })
  }

  if (stopped) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 16, color: 'var(--text-dim)',
        fontFamily: '"DM Mono",monospace',
      }}>
        <span style={{ fontSize: 32 }}>⏻</span>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Agent Monitor stopped</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          Run <code style={{ color: 'var(--am-violet)' }}>npm run dev</code> in the AgentMonitor directory to restart.
        </div>
      </div>
    )
  }

  return (
    <>
      <Shell sessions={sessions} theme={theme} onToggleTheme={toggleTheme} showSlug={showSlug} onToggleSlug={toggleSlug} connected={connected} onStopped={() => setStopped(true)} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <NavSidebar activeTab={activeTab} onTabChange={setActiveTab} knowledgeBadge={knowledgeBadge} />
        {activeTab === 'live' ? (
          <>
            <KanbanBoard sessions={sessions} showSlug={showSlug} caps={caps} />
            <StatsPanel sessions={sessions} />
          </>
        ) : activeTab === 'insights' ? (
          <InsightsPanel />
        ) : activeTab === 'knowledge' ? (
          <KnowledgeGraphPanel />
        ) : activeTab === 'tools' ? (
          <ToolsPanel onSelectSkill={setSelectedSkill} />
        ) : (
          <PastSessions showSlug={showSlug} caps={caps} />
        )}
      </div>
      {selectedSkill && (
        <SkillPopup skill={selectedSkill} onClose={() => setSelectedSkill(null)} />
      )}
    </>
  )
}
