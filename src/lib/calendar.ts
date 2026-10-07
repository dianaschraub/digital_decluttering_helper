import type { CleaningTask } from '../types'

function googleDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function openCleaningCalendar(areaTitle: string) {
  const start = new Date()
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0)
  const end = new Date(start.getTime() + 20 * 60 * 1000)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Digital Cleaning: ${areaTitle}`,
    dates: `${googleDate(start)}/${googleDate(end)}`,
    details: '20 Minuten, älteste offene Dateien oder E-Mails zuerst.',
  })
  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank', 'noopener,noreferrer')
}

export function openTaskCalendar(task: CleaningTask) {
  const base = task.due_date ? new Date(`${task.due_date}T09:00:00`) : new Date()
  const end = new Date(base.getTime() + 20 * 60 * 1000)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: task.title,
    dates: `${googleDate(base)}/${googleDate(end)}`,
    details: 'Wiedervorlage aus Digital Cleaning.',
  })
  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank', 'noopener,noreferrer')
}
