import type { ProgressType } from '../types'

const DAY = 24 * 60 * 60 * 1000

function pad(value: number) {
  return String(value).padStart(2, '0')
}

/** Heutiges Datum als YYYY-MM-DD in lokaler Zeit (nicht UTC). */
export function todayIso(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Aktueller Monat als YYYY-MM in lokaler Zeit (nicht UTC). */
export function currentMonthIso(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

/** Letzter Moment des Zeitraums, der als vollständig bearbeitet gilt. */
export function progressBoundary(type: ProgressType, value: string) {
  if (type === 'date') return new Date(`${value}T23:59:59`).getTime()
  const [year, month] = value.split('-').map(Number)
  return new Date(year, month, 0, 23, 59, 59).getTime()
}

/** Tage zwischen dem gespeicherten Stand und heute. */
export function backlogDays(type: ProgressType, value: string, now = Date.now()) {
  if (!value) return null
  const boundary = progressBoundary(type, value)
  if (Number.isNaN(boundary)) return null
  return Math.max(0, Math.floor((now - boundary) / DAY))
}

export function daysSince(iso: string, now = Date.now()) {
  const time = new Date(iso).getTime()
  return Number.isNaN(time) ? Infinity : Math.max(0, (now - time) / DAY)
}

export function formatBacklog(days: number | null) {
  if (days == null) return 'Noch nicht begonnen'
  if (days <= 1) return 'Auf dem aktuellen Stand'
  if (days < 60) return `${days} Tage Rückstand`
  const months = Math.round(days / 30.4)
  if (months < 24) return `${months} Monate Rückstand`
  return `${Math.floor(months / 12)} Jahre Rückstand`
}

export function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return 'ohne Termin'
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value)
  return new Intl.DateTimeFormat('de-DE', withTime
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export function formatProgress(type: ProgressType, value: string) {
  if (!value) return 'Noch kein Stand gespeichert'
  const date = new Date(`${value}${type === 'month' ? '-01' : ''}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return type === 'month'
    ? new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(date)
    : new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export function nextProgressLabel(type: ProgressType, value: string, startMonth?: string) {
  if (!value) {
    return startMonth
      ? `Beginne bei ${formatProgress('month', startMonth)} – mit den ältesten Dateien oder Nachrichten.`
      : 'Beginne mit den ältesten Dateien oder Nachrichten.'
  }
  const date = new Date(`${value}${type === 'month' ? '-01' : ''}T12:00:00`)
  if (type === 'month') {
    date.setMonth(date.getMonth() + 1)
    return `Weiter ab ${new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(date)}.`
  }
  date.setDate(date.getDate() + 1)
  return `Weiter ab ${new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)}.`
}

export interface ProgressPoint {
  type: ProgressType
  value: string
}

/**
 * Ausgangspunkt eines Bereichs, bevor ein Stand gespeichert ist: das Ende des
 * Monats vor dem Startmonat. So zählt der Startmonat selbst schon zum Rückstand.
 */
export function startPoint(startMonth: string | undefined): ProgressPoint | null {
  if (!startMonth || !/^\d{4}-\d{2}$/.test(startMonth)) return null
  const [year, month] = startMonth.split('-').map(Number)
  return { type: 'month', value: currentMonthIso(new Date(year, month - 2, 1)) }
}

/** Gespeicherter Stand eines Bereichs – oder, wenn noch keiner da ist, sein Ausgangspunkt. */
export function areaPoint(stored: { progress_type: ProgressType; progress_value: string } | undefined, startMonth: string | undefined): ProgressPoint | null {
  return stored ? { type: stored.progress_type, value: stored.progress_value } : startPoint(startMonth)
}

/**
 * Wandelt einen Stand beim Umschalten zwischen Monat und Datum um, ohne mehr
 * als erledigt zu markieren: Aus einem Monat wird sein letzter Tag, aus einem
 * Datum der letzte vollständig enthaltene Monat.
 */
export function convertProgressValue(value: string, to: ProgressType) {
  if (to === 'date' && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-').map(Number)
    return todayIso(new Date(year, month, 0))
  }
  if (to === 'month' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    return currentMonthIso(new Date(year, day === lastDay ? month - 1 : month - 2, 1))
  }
  return value
}

export interface CoveredPeriod {
  /** z. B. „April – Juni 2025“ */
  range: string
  /** z. B. „3 Monate“ oder „11 Tage“; leer, wenn kein neuer Zeitraum dazukam */
  amount: string
  days: number
}

const monthFormat = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })
const monthOnlyFormat = new Intl.DateTimeFormat('de-DE', { month: 'long' })
const dayFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dayShortFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' })

function monthIndex(value: string) {
  const [year, month] = value.split('-').map(Number)
  return year * 12 + month - 1
}

/**
 * Welcher Zeitraum wurde zwischen zwei gespeicherten Ständen aufgeräumt?
 * Ohne vorherigen Stand lässt sich kein Beginn bestimmen – dann nur „bis …“.
 */
export function coveredPeriod(previous: ProgressPoint | null | undefined, current: ProgressPoint): CoveredPeriod {
  const endBoundary = progressBoundary(current.type, current.value)
  if (!previous?.value || Number.isNaN(endBoundary)) {
    return { range: `bis ${formatProgress(current.type, current.value)}`, amount: '', days: 0 }
  }
  const startBoundary = progressBoundary(previous.type, previous.value)
  const days = Math.round((endBoundary - startBoundary) / DAY)
  if (Number.isNaN(days) || days <= 0) {
    return { range: `bis ${formatProgress(current.type, current.value)}`, amount: '', days: 0 }
  }
  const start = new Date(startBoundary + 1000) // erster Tag nach dem alten Stand
  const end = new Date(endBoundary)

  if (previous.type === 'month' && current.type === 'month') {
    const months = monthIndex(current.value) - monthIndex(previous.value)
    const sameYear = start.getFullYear() === end.getFullYear()
    const range = months === 1
      ? monthFormat.format(end)
      : `${sameYear ? monthOnlyFormat.format(start) : monthFormat.format(start)} – ${monthFormat.format(end)}`
    return { range, amount: months === 1 ? '1 Monat' : `${months} Monate`, days }
  }

  const sameYear = start.getFullYear() === end.getFullYear()
  const range = days === 1
    ? dayFormat.format(end)
    : `${sameYear ? dayShortFormat.format(start) : dayFormat.format(start)} – ${dayFormat.format(end)}`
  return { range, amount: formatSpan(days), days }
}

export function formatSpan(days: number) {
  if (days < 60) return days === 1 ? '1 Tag' : `${days} Tage`
  const months = Math.round(days / 30.4)
  return `${months} Monate`
}
