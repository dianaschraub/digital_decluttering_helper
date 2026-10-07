import { buildCalendar } from './ics'
import { upcomingSlots } from './schedule'
import { WEEKDAYS } from './settingsSchema'
import type { CleaningTask, ReminderSettings } from '../types'

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

function googleDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function openGoogle(params: Record<string, string>) {
  const query = new URLSearchParams({ action: 'TEMPLATE', ...params })
  window.open(`https://calendar.google.com/calendar/render?${query.toString()}`, '_blank', 'noopener,noreferrer')
}

export function openCleaningCalendar(areaTitle: string) {
  const start = new Date()
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0)
  const end = new Date(start.getTime() + 20 * 60 * 1000)
  openGoogle({
    text: `Digital Cleaning: ${areaTitle}`,
    dates: `${googleDate(start)}/${googleDate(end)}`,
    details: '20 Minuten, älteste offene Dateien oder E-Mails zuerst.',
  })
}

export function openTaskCalendar(task: CleaningTask) {
  const base = task.due_date ? new Date(`${task.due_date}T09:00:00`) : new Date()
  const end = new Date(base.getTime() + 20 * 60 * 1000)
  openGoogle({ text: task.title, dates: `${googleDate(base)}/${googleDate(end)}`, details: 'Wiedervorlage aus Digital Cleaning.' })
}

// ---------- Fester Serientermin (Ausweichmöglichkeit zum Abo) ----------

/** Wiederholungsregel passend zu den Erinnerungs-Einstellungen. */
export function seriesRule(reminders: ReminderSettings) {
  const days = reminders.weekdays.map((day) => BYDAY[day]).join(',')
  if (reminders.frequency === 'monthly') return `FREQ=MONTHLY;BYDAY=${reminders.weekdays.map((day) => `1${BYDAY[day]}`).join(',')}`
  return `FREQ=WEEKLY;INTERVAL=${reminders.frequency === 'biweekly' ? 2 : 1};BYDAY=${days}`
}

export function describeSeries(reminders: ReminderSettings) {
  const days = reminders.weekdays.map((day) => WEEKDAYS[day]).join(' und ')
  const prefix = reminders.frequency === 'monthly' ? `am ersten ${days} im Monat` : reminders.frequency === 'biweekly' ? `alle 2 Wochen ${days}` : `jeden ${days}`
  return `${prefix}, ${reminders.time} Uhr`
}

function firstSeriesSlot(reminders: ReminderSettings) {
  return upcomingSlots({ ...reminders, enabled: true }, Date.now(), 1)[0]
}

const SERIES_DETAILS = 'Feste Aufräumzeit aus Digital Cleaning. Welcher Bereich dran ist, zeigt die App unter „Heute“.'

export function openSeriesInGoogle(reminders: ReminderSettings) {
  const slot = firstSeriesSlot(reminders)
  if (!slot) return
  openGoogle({
    text: 'Digital Cleaning',
    dates: `${googleDate(slot.start)}/${googleDate(slot.end)}`,
    details: `${SERIES_DETAILS}\n\n${window.location.origin}`,
    recur: `RRULE:${seriesRule(reminders)}`,
    ctz: reminders.timezone,
  })
}

/** Serientermin als .ics-Datei – für Apple Kalender, Outlook und andere. */
export function downloadSeriesIcs(reminders: ReminderSettings) {
  const slot = firstSeriesSlot(reminders)
  if (!slot) return
  const ics = buildCalendar('Digital Cleaning', [{
    uid: `serie-${Date.now()}@digital-cleaning`,
    start: slot.start,
    end: slot.end,
    summary: 'Digital Cleaning',
    description: `${SERIES_DETAILS}\n\n${window.location.origin}`,
    url: window.location.origin,
    rrule: seriesRule(reminders),
    alarmMinutes: 10,
  }])
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'digital-cleaning-serientermin.ics'
  link.click()
  URL.revokeObjectURL(url)
}

export function calendarFeedUrl(token: string) {
  return `${window.location.origin}/kalender/${token}/digital-cleaning.ics`
}
