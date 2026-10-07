import type { Area, CleaningSession, CleaningTask, Progress, WeeklyCheck } from '../types'

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value)
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safeText.replace(/"/g, '""')}"`
}

export function exportCsv(data: {
  progress: Progress[]
  sessions: CleaningSession[]
  tasks: CleaningTask[]
  checks: WeeklyCheck[]
}, findArea: (id: string | null | undefined) => Area | undefined) {
  const areaName = (id: string | null) => {
    const area = findArea(id)
    return area ? `${area.title}${area.subtitle ? ` · ${area.subtitle}` : ''}` : id ?? ''
  }
  const rows: unknown[][] = [[
    'Typ',
    'Bereich',
    'Datum/Monat',
    'Status',
    'Titel/Notiz',
    'Gelöscht',
    'Einsortiert',
    'Unter 2 Minuten erledigt',
    'Anhang',
  ]]

  data.progress.forEach((item) => rows.push([
    'Bearbeitungsstand',
    areaName(item.area_id),
    item.progress_value,
    item.progress_type,
    item.note,
    '', '', '', '',
  ]))

  data.sessions.forEach((item) => rows.push([
    'Cleaning-Einheit',
    areaName(item.area_id),
    item.finished_at,
    `${item.duration_minutes} Minuten`,
    '',
    item.deleted_count,
    item.sorted_count,
    item.quick_done_count,
    '',
  ]))

  data.tasks.forEach((item) => rows.push([
    'Aufgabe',
    areaName(item.area_id),
    item.due_date,
    item.status === 'done' ? 'erledigt' : 'offen',
    item.title,
    '', '', '', item.attachment_name,
  ]))

  data.checks.forEach((item) => rows.push([
    'Wochencheck', '', item.checked_at, 'erledigt', item.note, '', '', '', '',
  ]))

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\n')}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `digital-cleaning-sicherung-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
