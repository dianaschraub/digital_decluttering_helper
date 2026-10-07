import { useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { FileDown, FileText, Folder, Image, Mail, Monitor, Scan, Video, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Area, AreaIconName } from '../types'

const AREA_ICONS: Record<AreaIconName, LucideIcon> = {
  photos: Image,
  screenshots: Scan,
  downloads: FileDown,
  videos: Video,
  desktop: Monitor,
  documents: FileText,
  other: Folder,
  mail: Mail,
}

export function AreaSign({ area, size = 'normal' }: { area: Pick<Area, 'icon' | 'color'>; size?: 'normal' | 'small' }) {
  const Icon = AREA_ICONS[area.icon]
  return (
    <span className={`area-sign ${size}`} style={{ '--area': area.color } as CSSProperties} aria-hidden="true">
      <Icon size={size === 'small' ? 19 : 22} strokeWidth={1.8} />
    </span>
  )
}

export function BrandMark({ size = 'normal', tone = 'dark' }: { size?: 'normal' | 'small'; tone?: 'dark' | 'light' }) {
  return <span className={`brand-mark ${size} ${tone}`} aria-hidden="true">dc</span>
}

export function CenteredMessage({ title, text }: { title: string; text: string }) {
  return <main className="center-page"><section className="setup-card"><BrandMark /><h1>{title}</h1><p>{text}</p></section></main>
}

export function Modal({ title, children, onClose, compact = false }: { title: string; children: ReactNode; onClose: () => void; compact?: boolean }) {
  // Über eine Ref bleibt der Listener stabil, auch wenn onClose bei jedem Render neu entsteht.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    function close(event: KeyboardEvent) { if (event.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className={`modal ${compact ? 'compact' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button onClick={onClose} aria-label="Schließen"><X size={18} /></button></header>
        {children}
      </section>
    </div>
  )
}

export function TimerRing({ progress, label, running }: { progress: number; label: string; running: boolean }) {
  const radius = 92
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(1, Math.max(0, progress))
  return (
    <div className={`timer-ring ${running ? 'running' : ''}`} role="timer" aria-label={`Restzeit ${label}`}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle className="timer-track" cx="100" cy="100" r={radius} />
        <circle
          className="timer-progress"
          cx="100"
          cy="100"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * clamped}
        />
      </svg>
      <span className="timer">{label}</span>
    </div>
  )
}

export function BacklogBar({ days, intervalDays }: { days: number | null; intervalDays: number }) {
  // Ein Jahr Rückstand füllt den Balken komplett; alles innerhalb des Rhythmus gilt als im Plan.
  const ratio = days == null ? 1 : Math.min(1, days / 365)
  const state = days == null ? 'none' : days <= intervalDays ? 'ok' : days > 90 ? 'high' : 'mid'
  return <span className={`backlog-bar ${state}`} aria-hidden="true"><i style={{ width: `${Math.max(4, ratio * 100)}%` }} /></span>
}

export function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern) } catch { /* nicht jedes Gerät unterstützt Vibration */ }
}
