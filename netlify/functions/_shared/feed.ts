import { buildCalendar } from '../../../src/lib/ics'
import type { IcsEvent } from '../../../src/lib/ics'
import { planSlots } from '../../../src/lib/schedule'
import { sanitizeReminders } from '../../../src/lib/settingsSchema'
import type { AppData } from '../../../src/types'

const DAY = 24 * 60 * 60 * 1000

/** Inhalt des persönlichen Kalender-Abos: Aufräum-Termine und Wiedervorlagen. */
export function buildFeed(data: AppData, appUrl: string, now = Date.now()) {
  const events: IcsEvent[] = []
  const settings = data.settings
  if (settings) {
    const reminders = sanitizeReminders(settings.reminders)
    for (const slot of planSlots(reminders, settings.areas, data.progress, now, 12)) {
      const label = slot.area.subtitle ? `${slot.area.title} (${slot.area.subtitle})` : slot.area.title
      events.push({
        // Die UID hängt nur am Termin, nicht am Bereich: Ändert sich die Zuordnung,
        // aktualisiert der Kalender den bestehenden Termin statt einen neuen anzulegen.
        uid: `slot-${slot.localDate}@digital-cleaning`,
        start: slot.start,
        end: slot.end,
        summary: `Digital Cleaning: ${label}`,
        description: `${reminders.durationMinutes} Minuten aufräumen – älteste Dateien bzw. E-Mails zuerst.\n\nApp öffnen: ${appUrl}`,
        url: appUrl,
        alarmMinutes: 10,
      })
    }
    if (reminders.includeTasks) {
      for (const task of data.tasks) {
        if (!task.due_date) continue
        const done = task.status === 'done'
        if (done && (reminders.doneTasks === 'hide' || !task.completed_at || now - new Date(task.completed_at).getTime() > 30 * DAY)) continue
        events.push({
          uid: `task-${task.id}@digital-cleaning`,
          start: task.due_date,
          summary: done ? `✓ ${task.title}` : `Wiedervorlage: ${task.title}`,
          description: done ? 'In Digital Cleaning als erledigt markiert.' : `Nächste Handlung aus Digital Cleaning.\n\nApp öffnen: ${appUrl}`,
          url: appUrl,
        })
      }
    }
  }
  return buildCalendar('Digital Cleaning', events, { refreshHours: 6 })
}
