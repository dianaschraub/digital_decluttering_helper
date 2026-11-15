import type { AppData, CleaningSession } from '../types'

/** Korrigiert eine bestehende Einheit, ohne eine neue Sitzung oder ein neues Abschlussdatum zu erzeugen. */
export function editSession(data: AppData, sessionId: string, input: Record<string, unknown>) {
  const session = data.sessions.find((item) => item.id === sessionId)
  if (!session) throw new Error('Diese Sitzung wurde nicht gefunden.')
  const integer = (value: unknown, min: number, max: number) => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new Error('Bitte gültige ganze Zahlen eingeben.')
    return value
  }
  const type = input.progressType
  const value = input.progressValue
  if ((type !== 'month' && type !== 'date') || typeof value !== 'string') throw new Error('Ungültiger Bearbeitungsstand.')
  const pattern = type === 'month' ? /^\d{4}-(0[1-9]|1[0-2])$/ : /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/
  const date = new Date(`${value}${type === 'month' ? '-01' : ''}T00:00:00Z`)
  if (!pattern.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, type === 'month' ? 7 : 10) !== value || date.getTime() > Date.now() + 86400000) throw new Error('Bitte einen gültigen Bearbeitungsstand ohne zukünftiges Datum eingeben.')
  if (typeof input.note !== 'string' || input.note.length > 1000) throw new Error('Die Notiz darf höchstens 1.000 Zeichen enthalten.')
  const updated: CleaningSession = {
    ...session,
    duration_minutes: integer(input.durationMinutes, 1, 600),
    deleted_count: integer(input.deletedCount, 0, 1e9),
    sorted_count: integer(input.sortedCount, 0, 1e9),
    quick_done_count: integer(input.quickDoneCount, 0, 1e9),
    progress_type: type,
    progress_value: value,
    note: input.note.trim() || null,
  }
  data.sessions = data.sessions.map((item) => item.id === sessionId ? updated : item)
  const latest = data.sessions.filter((item) => item.area_id === session.area_id)
    .reduce((best, item) => item.finished_at >= best.finished_at ? item : best)
  const progress = data.progress.find((item) => item.area_id === session.area_id)
  // Frühere Einheiten verändern nur den Verlauf. Der aktuelle Stand gehört zur letzten Einheit.
  if (latest.id === sessionId && progress) {
    progress.progress_type = type
    progress.progress_value = value
    progress.note = updated.note ?? null
    return { session: updated, progress }
  }
  return { session: updated, progress: null }
}
