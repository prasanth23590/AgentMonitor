export interface SubTask {
  id: string
  subject: string
  activeForm?: string
  status: 'pending' | 'in_progress' | 'completed'
  blocks: string[]
  blockedBy: string[]
}

export interface AgentSession {
  pid: number
  sessionId: string
  cwd: string
  name: string
  slug: string
  status: 'busy' | 'waiting' | 'idle'
  waitingFor?: string
  startedAt: number
  updatedAt: number
  runtimeMs: number
  alive: boolean
  tasks: SubTask[]
  kind: string
  version: string
}

export type KanbanColumn = 'idle' | 'busy' | 'waiting' | 'done'

export function getColumn(session: AgentSession): KanbanColumn {
  if (!session.alive) return 'done'
  if (session.status === 'waiting') return 'waiting'
  if (session.status === 'busy') return 'busy'
  return 'idle'
}

// Accent colours cycled by index
const ACCENTS = ['#5D36FF', '#1B90FF', '#049F9A', '#36A41D', '#7858FF', '#E76500', '#EE3939']
export function accentColor(index: number): string {
  return ACCENTS[index % ACCENTS.length]
}

export function formatRuntime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  if (m === 0) return `${s}s`
  return `${m}m ${s % 60}s`
}
