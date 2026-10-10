import type { Area, AreaIconName, AreaKind, Destination, Progress, UserSettings } from './types'
import { areaPoint, backlogDays, daysSince } from './lib/dates'
import { EMAIL_COLORS, areaType, defaultReminders, makeId } from './lib/settingsSchema'

// ---------- Vorlagen für die Einrichtung ----------

export interface DevicePreset {
  id: string
  label: string
  /** Inhalte, die bei diesem Gerät angeboten werden; die ersten `defaults` sind vorausgewählt. */
  contents: AreaIconName[]
  defaults: AreaIconName[]
}

export const DEVICE_PRESETS: DevicePreset[] = [
  { id: 'phone', label: 'Handy', contents: ['photos', 'screenshots', 'downloads', 'videos'], defaults: ['photos', 'screenshots', 'downloads'] },
  { id: 'tablet', label: 'Tablet', contents: ['photos', 'screenshots', 'downloads', 'videos'], defaults: ['photos', 'screenshots', 'downloads'] },
  { id: 'computer', label: 'Computer / Laptop', contents: ['downloads', 'desktop', 'documents', 'photos', 'screenshots', 'videos'], defaults: ['downloads', 'desktop', 'documents'] },
]

export const CUSTOM_DEVICE_CONTENTS: AreaIconName[] = ['photos', 'screenshots', 'downloads', 'videos', 'desktop', 'documents', 'other']

export const EMAIL_SUGGESTIONS = ['Gmail', 'GMX', 'WEB.DE', 'Outlook', 'iCloud Mail', 'T-Online', 'Arbeit']

export const DESTINATION_PRESETS: { label: string; note: string; kinds: AreaKind[] }[] = [
  { label: 'Google Drive', note: 'Cloud', kinds: ['files', 'email'] },
  { label: 'OneDrive', note: 'Cloud', kinds: ['files', 'email'] },
  { label: 'iCloud Drive', note: 'Cloud', kinds: ['files', 'email'] },
  { label: 'Dropbox', note: 'Cloud', kinds: ['files', 'email'] },
  { label: 'Ordner auf dem Computer', note: 'lokal', kinds: ['files', 'email'] },
  { label: 'Externe Festplatte', note: 'Archiv', kinds: ['files'] },
  { label: 'USB-Stick', note: 'Archiv', kinds: ['files'] },
  { label: 'NAS', note: 'Netzwerkspeicher', kinds: ['files'] },
]

export const MAIL_ARCHIVE: Omit<Destination, 'id'> = { label: 'Im Postfach archivieren', note: 'E-Mail ohne offene Aufgabe', kinds: ['email'] }

export interface OnboardingChoice {
  devices: { label: string; contents: AreaIconName[]; startMonth?: string }[]
  emails: { name: string; intervalDays: number; startMonth?: string }[]
  destinations: { label: string; note: string; kinds: AreaKind[] }[]
  timezone: string
}

export function buildSettings(choice: OnboardingChoice): UserSettings {
  const areas: Area[] = []
  for (const device of choice.devices) {
    for (const icon of device.contents) {
      const type = areaType(icon)
      areas.push({ id: makeId(icon), title: type.label, subtitle: device.label, group: device.label, icon, kind: 'files', intervalDays: 30, color: type.color, status: 'active', ...(device.startMonth ? { startMonth: device.startMonth } : {}) })
    }
  }
  choice.emails.forEach((email, index) => {
    areas.push({ id: makeId('mail'), title: email.name, subtitle: 'E-Mail', group: 'E-Mail', icon: 'mail', kind: 'email', intervalDays: email.intervalDays, color: EMAIL_COLORS[index % EMAIL_COLORS.length], status: 'active', ...(email.startMonth ? { startMonth: email.startMonth } : {}) })
  })
  const destinations: Destination[] = choice.destinations.map((destination) => ({ id: makeId('ziel'), ...destination }))
  if (choice.emails.length) destinations.unshift({ id: makeId('ziel'), ...MAIL_ARCHIVE })
  return { areas, destinations, reminders: defaultReminders(choice.timezone) }
}

// ---------- Hilfen für die gespeicherten Einstellungen ----------

export function destinationsFor(destinations: Destination[], kind: AreaKind) {
  return destinations.filter((destination) => destination.kinds.includes(kind))
}

export const MEMOS = {
  files: [
    'Erst entscheiden, dann ablegen.',
    'Der Downloadordner ist ein Eingang, kein dauerhafter Ablageort.',
    'Jede Datei braucht genau einen verbindlichen Ablageort.',
    'Ein Bereich und ein Zeitraum reichen für heute.',
    'Ein verständlicher Dateiname erspart späteres Suchen.',
  ],
  email: [
    'Ein Postfach ist ein Eingang – keine Aufgabenliste.',
    'Dauert es länger als zwei Minuten? Notiere die nächste konkrete Handlung.',
    'Wartest du auf eine Antwort? Setze eine Wiedervorlage.',
    'Keine Handlung erforderlich? Archivieren oder löschen.',
  ],
}

/**
 * Schlägt den aktiven Bereich vor, der gemessen an seinem eigenen Rhythmus am
 * stärksten überfällig ist. Nie bearbeitete Bereiche kommen zuerst;
 * bei Gleichstand entscheidet der größere Rückstand (ab dem Startmonat, falls bekannt).
 */
export function suggestArea(areas: Area[], progress: Progress[]) {
  const scored = areas.map((area, index) => {
    const item = progress.find((entry) => entry.area_id === area.id)
    if (!item) {
      const start = areaPoint(undefined, area.startMonth)
      return { area, score: Infinity, backlog: start ? backlogDays(start.type, start.value) ?? Infinity : Infinity, index }
    }
    return {
      area,
      score: daysSince(item.updated_at) / area.intervalDays,
      backlog: backlogDays(item.progress_type, item.progress_value) ?? 0,
      index,
    }
  })
  scored.sort((a, b) => (b.score - a.score) || (b.backlog - a.backlog) || (a.index - b.index))
  return scored[0]?.area
}
