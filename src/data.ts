import type { Area, AreaKind, Destination, Progress } from './types'
import { backlogDays, daysSince } from './lib/dates'

// `color` ist eine kräftige Grundfarbe; die Oberfläche mischt sie
// je nach hellem oder dunklem Modus mit dem Hintergrund ab.
export const AREAS: Area[] = [
  { id: 'phone-photos', title: 'Bilder', subtitle: 'Handy', group: 'Handy', icon: 'photos', kind: 'files', rhythm: 'monatlich', intervalDays: 30, color: '#5e9b72' },
  { id: 'phone-screenshots', title: 'Screenshots', subtitle: 'Handy', group: 'Handy', icon: 'screenshots', kind: 'files', rhythm: 'monatlich', intervalDays: 30, color: '#c19a4f' },
  { id: 'phone-downloads', title: 'Downloads & PDFs', subtitle: 'Handy', group: 'Handy', icon: 'downloads', kind: 'files', rhythm: 'monatlich', intervalDays: 30, color: '#7d74c4' },
  { id: 'tablet-photos', title: 'Bilder', subtitle: 'Tablet', group: 'Tablet', icon: 'photos', kind: 'files', rhythm: 'monatlich', intervalDays: 30, color: '#5e9b72' },
  { id: 'tablet-screenshots', title: 'Screenshots', subtitle: 'Tablet', group: 'Tablet', icon: 'screenshots', kind: 'files', rhythm: 'monatlich', intervalDays: 30, color: '#c19a4f' },
  { id: 'tablet-downloads', title: 'Downloads & PDFs', subtitle: 'Tablet', group: 'Tablet', icon: 'downloads', kind: 'files', rhythm: 'monatlich', intervalDays: 30, color: '#7d74c4' },
  { id: 'essen-email', title: 'Essener Postfach', subtitle: 'Musikschule', group: 'E-Mail', icon: 'mail', kind: 'email', rhythm: 'wöchentlich', intervalDays: 7, color: '#4f8bb8' },
  { id: 'webde-email', title: 'WEB.DE-Postfach', subtitle: 'Privat', group: 'E-Mail', icon: 'mail', kind: 'email', rhythm: 'alle 14 Tage', intervalDays: 14, color: '#c46b78' },
]

export const DESTINATIONS: Destination[] = [
  { id: 'mail-archive', label: 'Im Postfach archivieren', note: 'E-Mail ohne offene Aufgabe', kinds: ['email'] },
  { id: 'private-cloud', label: 'Private Cloud', note: 'private Hauptablage', kinds: ['files', 'email'] },
  { id: 'terabox-work', label: 'TeraBox', note: 'Arbeit', kinds: ['files'] },
  { id: 'spacebite-work', label: 'Space Bite', note: 'Arbeit', kinds: ['files'] },
  { id: 'photo-archive', label: 'SSD Fotoarchiv', note: 'alte Fotos', kinds: ['files'] },
]

export function destinationsFor(kind: AreaKind) {
  return DESTINATIONS.filter((destination) => destination.kinds.includes(kind))
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

export function findArea(areaId: string | null | undefined) {
  return AREAS.find((area) => area.id === areaId)
}

/**
 * Schlägt den Bereich vor, der gemessen an seinem eigenen Rhythmus am
 * stärksten überfällig ist. Nie bearbeitete Bereiche kommen zuerst;
 * bei Gleichstand entscheidet der größere Rückstand.
 */
export function suggestArea(progress: Progress[]) {
  const scored = AREAS.map((area, index) => {
    const item = progress.find((entry) => entry.area_id === area.id)
    if (!item) return { area, score: Infinity, backlog: Infinity, index }
    return {
      area,
      score: daysSince(item.updated_at) / area.intervalDays,
      backlog: backlogDays(item.progress_type, item.progress_value) ?? 0,
      index,
    }
  })
  scored.sort((a, b) => (b.score - a.score) || (b.backlog - a.backlog) || (a.index - b.index))
  return scored[0].area
}
