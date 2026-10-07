import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Decision, SessionCounts } from '../types'

export const SESSION_MS = 20 * 60 * 1000
const STORAGE_KEY = 'digital-cleaning:session-v1'

interface StoredSession {
  areaId: string
  /** Zeitpunkt, an dem die Einheit endet – nur gesetzt, solange der Timer läuft. */
  endAt: number | null
  /** Verbleibende Zeit, solange der Timer pausiert ist. */
  remainingMs: number
  log: Decision[]
}

function freshSession(areaId: string): StoredSession {
  return { areaId, endAt: null, remainingMs: SESSION_MS, log: [] }
}

function readStored(fallbackAreaId: string): StoredSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return freshSession(fallbackAreaId)
    const parsed = JSON.parse(raw) as Partial<StoredSession>
    if (typeof parsed.areaId !== 'string') return freshSession(fallbackAreaId)
    return {
      areaId: parsed.areaId,
      endAt: typeof parsed.endAt === 'number' ? parsed.endAt : null,
      remainingMs: typeof parsed.remainingMs === 'number' ? Math.min(SESSION_MS, Math.max(0, parsed.remainingMs)) : SESSION_MS,
      log: Array.isArray(parsed.log) ? parsed.log.filter((entry): entry is Decision => entry === 'deleted' || entry === 'sorted' || entry === 'quickDone') : [],
    }
  } catch {
    return freshSession(fallbackAreaId)
  }
}

function countLog(log: Decision[]): SessionCounts {
  return log.reduce<SessionCounts>((counts, entry) => ({ ...counts, [entry]: counts[entry] + 1 }), { deleted: 0, sorted: 0, quickDone: 0 })
}

/**
 * Timer und Zähler einer Cleaning-Einheit.
 *
 * Der Timer zählt nicht Sekunde für Sekunde herunter, sondern merkt sich die
 * Endzeit. Dadurch stimmt er auch dann, wenn der Browser die Seite im
 * Hintergrund anhält – etwa während du in der Foto- oder Mail-App aufräumst –
 * und er übersteht ein Neuladen der Seite.
 */
export function useCleaningSession(fallbackAreaId: string, isValidArea: (id: string) => boolean, onComplete: () => void) {
  const [session, setSession] = useState<StoredSession>(() => {
    const stored = readStored(fallbackAreaId)
    return isValidArea(stored.areaId) ? stored : freshSession(fallbackAreaId)
  })
  const [now, setNow] = useState(() => Date.now())
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)) } catch { /* privater Modus: dann eben ohne Wiederherstellung */ }
  }, [session])

  const running = session.endAt != null
  const remainingMs = running ? Math.max(0, session.endAt! - now) : session.remainingMs

  useEffect(() => {
    if (!running) return
    const tick = () => setNow(Date.now())
    tick()
    const interval = window.setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [running])

  useEffect(() => {
    if (running && remainingMs <= 0) {
      setSession((current) => ({ ...current, endAt: null, remainingMs: 0 }))
      onCompleteRef.current()
    }
  }, [running, remainingMs])

  const start = useCallback(() => {
    setSession((current) => current.endAt != null || current.remainingMs <= 0
      ? current
      : { ...current, endAt: Date.now() + current.remainingMs })
    setNow(Date.now())
  }, [])

  const pause = useCallback(() => {
    setSession((current) => current.endAt == null
      ? current
      : { ...current, endAt: null, remainingMs: Math.max(0, current.endAt - Date.now()) })
  }, [])

  const resetTimer = useCallback(() => {
    setSession((current) => ({ ...current, endAt: null, remainingMs: SESSION_MS }))
  }, [])

  const switchArea = useCallback((areaId: string) => setSession(freshSession(areaId)), [])
  const record = useCallback((decision: Decision) => setSession((current) => ({ ...current, log: [...current.log, decision] })), [])
  const undo = useCallback(() => setSession((current) => ({ ...current, log: current.log.slice(0, -1) })), [])
  const clear = useCallback(() => setSession((current) => freshSession(current.areaId)), [])

  const counts = useMemo(() => countLog(session.log), [session.log])
  const elapsedMinutes = Math.max(1, Math.round((SESSION_MS - remainingMs) / 60000))

  return {
    areaId: session.areaId,
    running,
    remainingMs,
    progress: 1 - remainingMs / SESSION_MS,
    counts,
    lastDecision: session.log[session.log.length - 1] ?? null,
    elapsedMinutes,
    start,
    pause,
    resetTimer,
    switchArea,
    record,
    undo,
    clear,
  }
}

export function formatClock(ms: number) {
  const total = Math.ceil(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
