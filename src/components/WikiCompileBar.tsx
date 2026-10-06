import { useEffect, useState } from 'react'

interface LlmStatus { running: boolean; installed: boolean; model: string }

interface Props {
  onCompileStart: () => void
  onCompileProgress: (msg: string) => void
  onCompileComplete: (conceptCount: number) => void
  onCompileError: (msg: string) => void
  lastCompiledAt: string | null
  newSessionsSince: number
}

export function WikiCompileBar({
  onCompileStart, onCompileProgress, onCompileComplete, onCompileError,
  lastCompiledAt, newSessionsSince,
}: Props) {
  const [llm, setLlm] = useState<LlmStatus>({ running: false, installed: false, model: '' })
  const [compiling, setCompiling] = useState(false)
  const [llmLoaded, setLlmLoaded] = useState(false)
  const [, setTick] = useState(0)

  function checkLlm() {
    fetch('/api/llm/status').then(r => r.json()).then(s => { setLlm(s); setLlmLoaded(true) }).catch(() => { setLlmLoaded(true) })
  }

  useEffect(() => {
    checkLlm()
    // Check if a compile is already running (e.g. started in another tab/window)
    fetch('/api/wiki/status').then(r => r.json()).then(s => { if (s.compiling) setCompiling(true) }).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  async function compile() {
    setCompiling(true)
    onCompileStart()
    try {
      const r = await fetch('/api/wiki/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const reader = r.body?.getReader()
      if (!reader) throw new Error('no stream')
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const json = line.slice(5).trim()
          if (!json) continue
          try {
            const ev = JSON.parse(json)
            if (ev.type === 'progress') onCompileProgress(ev.message)
            if (ev.type === 'complete') onCompileComplete(ev.conceptCount)
            if (ev.type === 'error') {
              if (ev.message === 'Compile already in progress') {
                setCompiling(true) // keep button disabled, don't surface as error
              } else {
                onCompileError(ev.message)
              }
            }
          } catch {}
        }
      }
    } catch (e) {
      onCompileError((e as Error).message)
    } finally {
      setCompiling(false)
    }
  }

  const notReady = !(llm.running && llm.installed)
  const compiledLabel = lastCompiledAt
    ? `Compiled ${formatRelative(lastCompiledAt)}${newSessionsSince > 0 ? ` · ${newSessionsSince} new since` : ''}`
    : 'Not compiled yet'

  return (
    <>
      {llmLoaded && notReady && (
        <div style={{
          padding: '8px 24px', fontFamily: '"DM Mono",monospace', fontSize: 10,
          color: 'var(--text-dim)', background: 'rgba(255,255,255,.02)',
          borderBottom: '1px solid var(--border-faint)',
          lineHeight: 1.8,
        }}>
          {!llm.running ? (
            <>Ollama is not running. Start the Ollama app, then </>
          ) : (
            <>Model not installed. Run <code style={{ color: 'var(--am-violet)' }}>ollama pull {llm.model}</code>, then </>
          )}
          <button onClick={checkLlm} style={{
            fontFamily: 'inherit', fontSize: 'inherit', color: 'var(--am-violet)',
            background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline',
          }}>re-check</button>
        </div>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 24px', borderBottom: '1px solid var(--border-faint)',
        fontFamily: '"DM Mono",monospace', fontSize: 11,
      }}>
        <span style={{ color: 'var(--text-dim)', flex: 1 }}>{compiledLabel}</span>

        <button
          onClick={compile}
          disabled={notReady || compiling}
          style={{
            background: compiling ? 'rgba(93,54,255,.15)' : 'var(--am-violet)',
            color: compiling ? 'var(--am-violet)' : '#fff',
            border: 'none', borderRadius: 4, padding: '6px 14px',
            cursor: notReady || compiling ? 'not-allowed' : 'pointer',
            opacity: notReady ? 0.5 : 1,
            fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          {compiling ? 'compiling…' : 'Compile wiki ▸'}
        </button>
      </div>
    </>
  )
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  return `${d}d ago`
}
