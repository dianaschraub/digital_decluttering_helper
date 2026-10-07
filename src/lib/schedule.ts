// Berechnet die kommenden Aufräum-Termine. Ohne DOM-Abhängigkeiten, damit
// App (Vorschau) und Netlify-Funktion (Kalender-Abo) dieselbe Logik nutzen.
import type { Area, Progress, ReminderSettings } from '../types'

const DAY = 24 * 60 * 60 * 1000

export interface PlannedSlot {
  start: Date
  end: Date
  /** Lokales Datum YYYY-MM-DD in der gewählten Zeitzone */
  localDate: string
  area: Area
}

interface LocalParts { year: number; month: number; day: number; hour: number; minute: number; weekday: number }

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function localParts(timestamp: number, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(new Date(timestamp))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '0'
  return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')), hour: Number(get('hour')), minute: Number(get('minute')), weekday: WEEKDAY_INDEX[get('weekday')] ?? 0 }
}

/** Wandelt eine Ortszeit in der Zeitzone in einen UTC-Zeitpunkt um (berücksichtigt Sommerzeit). */
export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string) {
  const target = Date.UTC(year, month - 1, day, hour, minute)
  let guess = target
  for (let i = 0; i < 2; i += 1) {
    const parts = localParts(guess, timeZone)
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
    guess -= asUtc - target
  }
  return guess
}

/** Wochennummer seit Montag, 5. Januar 1970 – fester Bezugspunkt für „alle 2 Wochen“. */
function weekIndex(year: number, month: number, day: number) {
  return Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(1970, 0, 5)) / (7 * DAY))
}

/** Termine (ohne Bereich) ab jetzt, höchstens `count` Stück. */
export function upcomingSlots(reminders: ReminderSettings, now = Date.now(), count = 12) {
  const [hour, minute] = reminders.time.split(':').map(Number)
  const today = localParts(now, reminders.timezone)
  const slots: { start: Date; end: Date; localDate: string }[] = []
  for (let offset = 0; offset < 400 && slots.length < count; offset += 1) {
    // Kalendertag in der Zeitzone; Mittag als Anker, damit Sommerzeitwechsel nicht stören
    const noon = Date.UTC(today.year, today.month - 1, today.day + offset, 12)
    const date = new Date(noon)
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth() + 1
    const day = date.getUTCDate()
    const weekday = date.getUTCDay()
    if (!reminders.weekdays.includes(weekday)) continue
    if (reminders.frequency === 'biweekly' && (weekIndex(year, month, day) + reminders.weekOffset) % 2 !== 0) continue
    if (reminders.frequency === 'monthly' && day > 7) continue
    const start = zonedToUtc(year, month, day, hour, minute, reminders.timezone)
    if (start <= now) continue
    slots.push({
      start: new Date(start),
      end: new Date(start + reminders.durationMinutes * 60 * 1000),
      localDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    })
  }
  return slots
}

/**
 * Ordnet jedem Termin den Bereich zu, der dann gemessen an seinem Rhythmus am
 * stärksten überfällig ist. Nach jeder Zuordnung gilt der Bereich als erledigt,
 * sodass sich die Bereiche über die Wochen abwechseln.
 */
export function planSlots(reminders: ReminderSettings, areas: Area[], progress: Progress[], now = Date.now(), count = 12): PlannedSlot[] {
  const active = areas.filter((area) => area.status === 'active')
  if (!reminders.enabled || active.length === 0) return []
  const last = new Map<string, number>()
  for (const area of active) {
    const item = progress.find((entry) => entry.area_id === area.id)
    const time = item ? new Date(item.updated_at).getTime() : NaN
    last.set(area.id, Number.isNaN(time) ? -Infinity : time)
  }
  return upcomingSlots(reminders, now, count).map((slot) => {
    let best = active[0]
    let bestScore = -Infinity
    for (const area of active) {
      const score = (slot.start.getTime() - (last.get(area.id) ?? -Infinity)) / (area.intervalDays * DAY)
      if (score > bestScore) { best = area; bestScore = score }
    }
    last.set(best.id, slot.start.getTime())
    return { ...slot, area: best }
  })
}
