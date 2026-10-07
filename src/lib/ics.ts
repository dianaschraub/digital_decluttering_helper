// Erzeugt Kalenderdaten im iCalendar-Format (RFC 5545). Ohne DOM-Abhängigkeiten,
// damit sowohl das Kalender-Abo (Server) als auch der Serientermin-Download (App) sie nutzen.

export interface IcsEvent {
  uid: string
  /** Zeitpunkt (UTC) oder ganztägig als YYYY-MM-DD */
  start: Date | string
  end?: Date | string
  summary: string
  description?: string
  url?: string
  /** Erinnerung so viele Minuten vorher */
  alarmMinutes?: number
  /** z. B. FREQ=WEEKLY;INTERVAL=2;BYDAY=WE */
  rrule?: string
}

function escapeText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Zeilen über 75 Byte werden laut Standard umbrochen (Fortsetzung beginnt mit Leerzeichen). */
function fold(line: string) {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ''
  for (const char of line) {
    if (encoder.encode(current + char).length > (parts.length ? 74 : 75)) {
      parts.push(current)
      current = char
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts.join('\r\n ')
}

function utcStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function dateValue(value: string) {
  return value.replace(/-/g, '')
}

function nextDay(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}

function timeLine(name: 'DTSTART' | 'DTEND', value: Date | string) {
  return typeof value === 'string' ? `${name};VALUE=DATE:${dateValue(value)}` : `${name}:${utcStamp(value)}`
}

export function buildCalendar(name: string, events: IcsEvent[], options: { refreshHours?: number } = {}) {
  const stamp = utcStamp(new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Digital Cleaning//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
  ]
  if (options.refreshHours) {
    lines.push(`REFRESH-INTERVAL;VALUE=DURATION:PT${options.refreshHours}H`, `X-PUBLISHED-TTL:PT${options.refreshHours}H`)
  }
  for (const event of events) {
    const end = event.end ?? (typeof event.start === 'string' ? nextDay(event.start) : new Date(event.start.getTime() + 20 * 60 * 1000))
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      timeLine('DTSTART', event.start),
      timeLine('DTEND', end),
      `SUMMARY:${escapeText(event.summary)}`,
    )
    if (event.rrule) lines.push(`RRULE:${event.rrule}`)
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`)
    if (event.url) lines.push(`URL:${event.url}`)
    if (event.alarmMinutes != null) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(event.summary)}`, `TRIGGER:-PT${event.alarmMinutes}M`, 'END:VALARM')
    }
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
