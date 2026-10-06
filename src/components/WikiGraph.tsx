import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
// @ts-ignore — react-force-graph-2d has no bundled types
import ForceGraph2D from 'react-force-graph-2d'

export interface GraphNode {
  slug: string
  title: string
  cluster: string
  sessionIds: string[]
  summary: string
}
export interface GraphEdge { from: string; to: string; weight: number }
export interface GraphData { nodes: GraphNode[]; edges: GraphEdge[] }

interface Props {
  data: GraphData
  selectedSlug: string | null
  onSelect: (slug: string) => void
}

const PALETTE = ['#5D36FF', '#1B90FF', '#36A41D', '#E76500', '#7C3AED', '#049F9A', '#EE3939', '#D946EF', '#0EA5E9']

function isDarkTheme() {
  return document.documentElement.getAttribute('data-theme') !== 'light'
}

export function WikiGraph({ data, selectedSlug, onSelect }: Props) {
  const fgRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dark, setDark] = useState(isDarkTheme)
  const [dims, setDims] = useState({ width: 600, height: 400 })
  const hasInitialFit = useRef(false)

  // Keep mutable refs so canvas callbacks always read latest values without
  // needing to be recreated (avoids ForceGraph2D seeing new function refs → no flicker)
  const darkRef = useRef(dark)
  const selectedSlugRef = useRef(selectedSlug)
  const neighborSlugsRef = useRef<Set<string> | null>(null)

  useEffect(() => { darkRef.current = dark }, [dark])
  useEffect(() => { selectedSlugRef.current = selectedSlug }, [selectedSlug])

  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDarkTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setDims({ width, height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const nodeColors = useMemo(() => {
    const clusters = Array.from(new Set(data.nodes.map(n => n.cluster)))
    const multiCluster = clusters.length > 1
    const clusterMap: Record<string, string> = {}
    clusters.forEach((c, i) => { clusterMap[c] = PALETTE[i % PALETTE.length] })
    const result: Record<string, string> = {}
    data.nodes.forEach((n, i) => {
      result[n.slug] = multiCluster ? clusterMap[n.cluster] : PALETTE[i % PALETTE.length]
    })
    return result
  }, [data.nodes])

  const neighborSlugs = useMemo(() => {
    if (!selectedSlug) return null
    const set = new Set<string>()
    for (const e of data.edges) {
      if (e.from === selectedSlug) set.add(e.to)
      if (e.to === selectedSlug) set.add(e.from)
    }
    return set
  }, [selectedSlug, data.edges])

  // Keep ref in sync so stable callbacks can read it
  useEffect(() => { neighborSlugsRef.current = neighborSlugs }, [neighborSlugs])

  const clusters = useMemo(() => {
    const seen = new Set<string>()
    return data.nodes
      .filter(n => { if (seen.has(n.cluster)) return false; seen.add(n.cluster); return true })
      .map(n => ({ cluster: n.cluster, color: nodeColors[n.slug] }))
  }, [data.nodes, nodeColors])

  // graphData only rebuilds when the underlying data/colors change — not on selection change
  const graphData = useMemo(() => ({
    nodes: data.nodes.map(n => ({ ...n, id: n.slug, color: nodeColors[n.slug] })),
    links: data.edges.map(e => ({ source: e.from, target: e.to })),
  }), [data, nodeColors])

  useEffect(() => {
    const t = setTimeout(() => {
      if (!fgRef.current) return
      fgRef.current.d3Force('charge')?.strength(-300)
      fgRef.current.d3Force('link')?.distance(80)
    }, 0)
    // Reset fit flag when graph data changes so new data gets a fresh fit
    hasInitialFit.current = false
    return () => clearTimeout(t)
  }, [graphData])  // re-apply forces when data changes, not just theme

  useEffect(() => {
    if (!selectedSlug || !fgRef.current) return
    const node = (graphData.nodes as any[]).find(n => n.id === selectedSlug)
    if (node && node.x != null) {
      fgRef.current.centerAt(node.x, node.y, 600)
      fgRef.current.zoom(2.5, 600)
    }
  }, [selectedSlug])

  const bgColor = dark ? '#0D0818' : '#F5F3FF'

  // Stable callbacks — read from refs so they never need to be recreated
  const nodeCanvasObject = useCallback((n: any, ctx: CanvasRenderingContext2D, scale: number) => {
    const slug = selectedSlugRef.current
    const neighbors = neighborSlugsRef.current
    const isDarkMode = darkRef.current

    const isSelected = slug === n.id
    const isNeighbor = neighbors?.has(n.id)
    const isDimmed = neighbors && !isSelected && !isNeighbor
    const r = isSelected ? 9 : isNeighbor ? 6 : 5

    ctx.globalAlpha = isDimmed ? 0.25 : 1

    if (isSelected) {
      ctx.shadowBlur = 16
      ctx.shadowColor = n.color
    }
    ctx.fillStyle = n.color
    ctx.beginPath()
    ctx.arc(n.x, n.y, r, 0, 2 * Math.PI)
    ctx.fill()
    ctx.shadowBlur = 0

    const fontSize = Math.max(3, 10 / scale * 1.4)
    ctx.font = `${isSelected ? 'bold ' : ''}${fontSize}px "DM Mono", monospace`
    ctx.fillStyle = isSelected
      ? (isDarkMode ? '#FFFFFF' : '#1E1540')
      : (isDarkMode ? 'rgba(230,225,255,0.80)' : 'rgba(30,21,64,0.85)')
    ctx.fillText(n.title, n.x + r + 2, n.y + 3)

    ctx.globalAlpha = 1
  }, []) // intentionally empty — reads via refs

  const getLinkColor = useCallback((link: any) => {
    const slug = selectedSlugRef.current
    const neighbors = neighborSlugsRef.current
    const isDarkMode = darkRef.current
    if (!neighbors) return isDarkMode ? 'rgba(255,255,255,.22)' : 'rgba(93,54,255,.30)'
    const src = typeof link.source === 'object' ? link.source.id : link.source
    const tgt = typeof link.target === 'object' ? link.target.id : link.target
    const connected = src === slug || tgt === slug
    return connected
      ? (isDarkMode ? 'rgba(255,255,255,.7)' : 'rgba(93,54,255,.8)')
      : (isDarkMode ? 'rgba(255,255,255,.06)' : 'rgba(93,54,255,.08)')
  }, [])

  const getLinkWidth = useCallback((link: any) => {
    const slug = selectedSlugRef.current
    const neighbors = neighborSlugsRef.current
    if (!neighbors) return 1.5
    const src = typeof link.source === 'object' ? link.source.id : link.source
    const tgt = typeof link.target === 'object' ? link.target.id : link.target
    return (src === slug || tgt === slug) ? 2.5 : 1
  }, [])

  const handleNodeClick = useCallback((n: any) => onSelect(n.id), [onSelect])

  return (
    <div ref={containerRef} style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative', background: bgColor, overflow: 'hidden' }}>
      <ForceGraph2D
        key={dark ? 'dark' : 'light'}
        ref={fgRef}
        graphData={graphData}
        backgroundColor={bgColor}
        width={dims.width}
        height={dims.height}
        nodeLabel={(n: any) => n.title}
        nodeRelSize={6}
        linkColor={getLinkColor}
        linkWidth={getLinkWidth}
        warmupTicks={100}
        cooldownTicks={0}
        d3VelocityDecay={0.4}
        d3AlphaDecay={0.05}
        onEngineStop={() => {
          // Only fit once — subsequent engine stops (e.g. from resize) must not
          // override the user's zoom level
          if (hasInitialFit.current) return
          hasInitialFit.current = true
          fgRef.current?.zoomToFit(400, 80)
          fgRef.current?.pauseAnimation()
        }}
        onNodeClick={handleNodeClick}
        nodeCanvasObject={nodeCanvasObject}
      />

      {/* Cluster legend */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        display: 'flex', flexDirection: 'column', gap: 5,
        background: dark ? 'rgba(13,8,24,.75)' : 'rgba(245,243,255,.85)',
        border: `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(93,54,255,.15)'}`,
        borderRadius: 8, padding: '8px 12px',
        backdropFilter: 'blur(6px)',
        pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: 9, fontFamily: '"DM Mono",monospace', letterSpacing: '0.08em',
          color: dark ? 'rgba(230,225,255,.4)' : 'rgba(30,21,64,.4)',
          textTransform: 'uppercase', marginBottom: 2,
        }}>Clusters</div>
        {clusters.map(({ cluster, color }) => (
          <div key={cluster} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{
              fontSize: 10, fontFamily: '"DM Mono",monospace',
              color: dark ? 'rgba(230,225,255,.7)' : 'rgba(30,21,64,.75)',
            }}>{cluster}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
