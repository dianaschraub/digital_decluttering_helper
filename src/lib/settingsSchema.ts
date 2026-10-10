// Gemeinsame Regeln für Bereiche und Ablageorte – genutzt von der App und der
// Netlify-Funktion. Ohne DOM-Abhängigkeiten, damit beide Seiten sie importieren können.
import type { Area, AreaIconName, AreaKind, AreaStatus, Destination, ReminderFrequency, ReminderSettings, UserSettings } from '../types'

export const MAX_AREAS = 40
export const MAX_DESTINATIONS = 40

export const AREA_TYPES: { icon: AreaIconName; label: string; kind: AreaKind; color: string }[] = [
  { icon: 'photos', label: 'Bilder', kind: 'files', color: '#5e9b72' },
  { icon: 'screenshots', label: 'Screenshots', kind: 'files', color: '#c19a4f' },
  { icon: 'downloads', label: 'Downloads & PDFs', kind: 'files', color: '#7d74c4' },
  { icon: 'videos', label: 'Videos', kind: 'files', color: '#b8735a' },
  { icon: 'desktop', label: 'Desktop', kind: 'files', color: '#5a8fa3' },
  { icon: 'documents', label: 'Dokumente', kind: 'files', color: '#8a8f5c' },
  { icon: 'other', label: 'Sonstiger Ordner', kind: 'files', color: '#8b7f99' },
  { icon: 'mail', label: 'E-Mail-Postfach', kind: 'email', color: '#4f8bb8' },
]

export const EMAIL_COLORS = ['#4f8bb8', '#c46b78', '#6f9a5e', '#b0894a', '#7d74c4']

export const RHYTHMS: { days: number; label: string }[] = [
  { days: 7, label: 'wöchentlich' },
  { days: 14, label: 'alle 14 Tage' },
  { days: 30, label: 'monatlich' },
  { days: 90, label: 'vierteljährlich' },
]

export const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
/** Reihenfolge für die Anzeige: Montag zuerst */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export const FREQUENCIES: { value: ReminderFrequency; label: string }[] = [
  { value: 'weekly', label: 'jede Woche' },
  { value: 'biweekly', label: 'alle 2 Wochen' },
  { value: 'monthly', label: 'einmal im Monat' },
]

export function defaultReminders(timezone = 'Europe/Berlin'): ReminderSettings {
  return { enabled: true, weekdays: [3], time: '18:00', frequency: 'weekly', weekOffset: 0, durationMinutes: 20, timezone, includeTasks: true, doneTasks: 'hide' }
}

function validTimezone(value: unknown) {
  if (typeof value !== 'string' || value.length > 64) return null
  try {
    new Intl.DateTimeFormat('de-DE', { timeZone: value })
    return value
  } catch {
    return null
  }
}

export function sanitizeReminders(input: unknown): ReminderSettings {
  const value = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const fallback = defaultReminders()
  const weekdays = Array.isArray(value.weekdays)
    ? [...new Set(value.weekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort()
    : fallback.weekdays
  const duration = Math.round(Number(value.durationMinutes))
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : fallback.enabled,
    weekdays: weekdays.length ? weekdays : fallback.weekdays,
    time: typeof value.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time) ? value.time : fallback.time,
    frequency: FREQUENCIES.some((item) => item.value === value.frequency) ? value.frequency as ReminderFrequency : fallback.frequency,
    weekOffset: value.weekOffset === 1 ? 1 : 0,
    durationMinutes: Number.isFinite(duration) ? Math.min(240, Math.max(5, duration)) : fallback.durationMinutes,
    timezone: validTimezone(value.timezone) ?? fallback.timezone,
    includeTasks: typeof value.includeTasks === 'boolean' ? value.includeTasks : fallback.includeTasks,
    doneTasks: value.doneTasks === 'mark' ? 'mark' : 'hide',
  }
}

export function rhythmLabel(days: number) {
  return RHYTHMS.find((rhythm) => rhythm.days === days)?.label ?? `alle ${days} Tage`
}

export function areaType(icon: AreaIconName) {
  return AREA_TYPES.find((type) => type.icon === icon) ?? AREA_TYPES[AREA_TYPES.length - 2]
}

const ICONS = new Set<AreaIconName>(AREA_TYPES.map((type) => type.icon))
const STATUSES = new Set<AreaStatus>(['active', 'paused', 'removed'])
const ID = /^[a-z0-9-]{1,48}$/
const MONTH = /^(19[89]\d|2\d{3})-(0[1-9]|1[0-2])$/

/** Startmonat „YYYY-MM“ ab 1980 und nicht in der Zukunft – sonst leer. */
export function validStartMonth(value: unknown, now = new Date()) {
  if (typeof value !== 'string' || !MONTH.test(value)) return ''
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return value <= current ? value : ''
}

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

export function makeId(prefix: string) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${random}`
}

/** Prüft und bereinigt Einstellungen; wirft einen Fehler mit verständlicher Meldung. */
export function sanitizeSettings(input: unknown): UserSettings {
  const raw = (input && typeof input === 'object' ? input : {}) as { areas?: unknown; destinations?: unknown; reminders?: unknown }
  const rawAreas = Array.isArray(raw.areas) ? raw.areas.slice(0, MAX_AREAS) : []
  const rawDestinations = Array.isArray(raw.destinations) ? raw.destinations.slice(0, MAX_DESTINATIONS) : []
  const seen = new Set<string>()

  const areas: Area[] = []
  for (const item of rawAreas) {
    const value = (item ?? {}) as Record<string, unknown>
    const id = typeof value.id === 'string' && ID.test(value.id) ? value.id : ''
    const icon = ICONS.has(value.icon as AreaIconName) ? value.icon as AreaIconName : 'other'
    const title = text(value.title, 40)
    if (!id || seen.has(id) || !title) continue
    seen.add(id)
    const interval = Math.round(Number(value.intervalDays))
    const startMonth = validStartMonth(value.startMonth)
    areas.push({
      id,
      title,
      subtitle: text(value.subtitle, 40),
      group: text(value.group, 30) || text(value.subtitle, 30) || 'Weitere',
      icon,
      kind: icon === 'mail' ? 'email' : 'files',
      intervalDays: Number.isFinite(interval) ? Math.min(365, Math.max(1, interval)) : 30,
      color: typeof value.color === 'string' && /^#[0-9a-f]{6}$/i.test(value.color) ? value.color : areaType(icon).color,
      status: STATUSES.has(value.status as AreaStatus) ? value.status as AreaStatus : 'active',
      ...(startMonth ? { startMonth } : {}),
    })
  }
  if (!areas.some((area) => area.status === 'active')) throw new Error('Mindestens ein Bereich muss aktiv sein.')

  const destinations: Destination[] = []
  for (const item of rawDestinations) {
    const value = (item ?? {}) as Record<string, unknown>
    const id = typeof value.id === 'string' && ID.test(value.id) ? value.id : ''
    const label = text(value.label, 40)
    const kinds = Array.isArray(value.kinds) ? value.kinds.filter((kind): kind is AreaKind => kind === 'files' || kind === 'email') : []
    if (!id || seen.has(id) || !label || kinds.length === 0) continue
    seen.add(id)
    destinations.push({ id, label, note: text(value.note, 60), kinds: [...new Set(kinds)] })
  }
  return { areas, destinations, reminders: sanitizeReminders(raw.reminders) }
}

/** Ältere gespeicherte Einstellungen ohne Erinnerungen ergänzen. */
export function withDefaults(settings: UserSettings | null): UserSettings | null {
  return settings ? { ...settings, reminders: sanitizeReminders(settings.reminders) } : null
}
