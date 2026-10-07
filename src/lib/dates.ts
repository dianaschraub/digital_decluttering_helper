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

export function nextProgressLabel(type: ProgressType, value: string) {
  if (!value) return 'Beginne mit den ältesten Dateien oder Nachrichten.'
  const date = new Date(`${value}${type === 'month' ? '-01' : ''}T12:00:00`)
  if (type === 'month') {
    date.setMonth(date.getMonth() + 1)
    return `Weiter ab ${new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(date)}.`
  }
  date.setDate(date.getDate() + 1)
  return `Weiter ab ${new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)}.`
}
