import type {
  AppData,
  CleaningSession,
  CleaningTask,
  Progress,
  ProgressType,
  SessionCounts,
  TaskDraft,
  UserSettings,
  WeeklyCheck,
} from '../types'

export async function recordStock(areaId: string, value: number, unit: 'count' | 'MB' | 'GB', date: string, adaptive: boolean, stockGoal: 'maintain' | 'reduce' = 'maintain') {
  const result = await post<{ settings: UserSettings }>('record_stock', { areaId, value, unit, date, adaptive, stockGoal })
  return result.settings
}

export async function recordDeviceStorage(device: 'phone' | 'tablet', usedGB: number, totalGB: number) {
  const result = await post<{ settings: UserSettings }>('record_device_storage', { device, usedGB, totalGB })
  return result.settings
}

const API_URL = '/.netlify/functions/app-data'

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) return response.json() as Promise<T>
  let message = `Fehler ${response.status}`
  try {
    const body = await response.json() as { error?: string }
    if (body.error) message = body.error
  } catch {
    // A plain-text platform error is already represented by the HTTP status.
  }
  if (response.status === 401) message = 'Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.'
  throw new Error(message)
}

async function post<T>(action: string, payload: unknown) {
  const response = await fetch(API_URL, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  })
  return parseResponse<T>(response)
}

export async function loadAppData() {
  const response = await fetch(API_URL, { credentials: 'include' })
  return parseResponse<AppData>(response)
}

export async function saveSettings(settings: UserSettings) {
  const result = await post<{ settings: UserSettings }>('save_settings', { settings })
  return result.settings
}

/** Liefert den geheimen Token für das Kalender-Abo; mit `reset` wird der alte Link ungültig. */
export async function fetchCalendarToken(reset = false) {
  const result = await post<{ calendarToken: string }>('calendar_link', { reset })
  return result.calendarToken
}

export async function deleteAccount() {
  await post<{ ok: true }>('delete_account', { confirm: 'LÖSCHEN' })
}

/** Lädt einen Anhang als Datei, etwa um ihn über das Teilen-Menü weiterzugeben. */
export async function fetchAttachmentFile(task: CleaningTask) {
  if (!task.attachment_key) return null
  const url = new URL(API_URL, window.location.origin)
  url.searchParams.set('attachment', task.attachment_key)
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) return null
  const blob = await response.blob()
  return new File([blob], task.attachment_name ?? 'anhang', { type: task.attachment_mime || blob.type || 'application/octet-stream' })
}

export async function finishCleaningSession(input: {
  areaId: string
  durationMinutes: number
  counts: SessionCounts
  progressType: ProgressType
  progressValue: string
  note?: string
  remaining_count?: number | null
  remaining_storage?: { value: number; unit: 'MB' | 'GB' } | null
}) {
  return post<{ progress: Progress; session: CleaningSession; settings: UserSettings | null }>('finish_session', input)
}

export async function createTask(draft: TaskDraft) {
  const form = new FormData()
  form.set('action', 'create_task')
  form.set('payload', JSON.stringify({
    title: draft.title.trim(),
    dueDate: draft.dueDate,
    areaId: draft.areaId,
  }))
  if (draft.file) form.set('file', draft.file)

  const response = await fetch(API_URL, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  return parseResponse<CleaningTask>(response)
}

export async function completeTask(task: CleaningTask) {
  return post<CleaningTask>('toggle_task', { taskId: task.id, done: task.status !== 'done' })
}

export async function deleteTask(task: CleaningTask) {
  await post<{ ok: true }>('delete_task', { taskId: task.id })
}

export function openAttachment(task: CleaningTask) {
  if (!task.attachment_key) return
  const url = new URL(API_URL, window.location.origin)
  url.searchParams.set('attachment', task.attachment_key)
  window.open(url.toString(), '_blank', 'noopener,noreferrer')
}

export async function saveWeeklyCheck(note: string) {
  return post<WeeklyCheck>('weekly_check', { note: note.trim() })
}

export async function updateCleaningSession(session: CleaningSession) {
  return post<{ session: CleaningSession; progress: Progress | null; settings: UserSettings | null }>('edit_session', {
    sessionId: session.id,
    remaining_count: session.remaining_count ?? null,
    remaining_storage: session.remaining_storage ?? null,
    durationMinutes: session.duration_minutes,
    deletedCount: session.deleted_count,
    sortedCount: session.sorted_count,
    quickDoneCount: session.quick_done_count,
    progressType: session.progress_type,
    progressValue: session.progress_value,
    note: session.note ?? '',
  })
}
