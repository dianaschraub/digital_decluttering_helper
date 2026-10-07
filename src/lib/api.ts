import type {
  CleaningSession,
  CleaningTask,
  Progress,
  ProgressType,
  SessionCounts,
  TaskDraft,
  WeeklyCheck,
} from '../types'

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
  return parseResponse<{
    progress: Progress[]
    sessions: CleaningSession[]
    tasks: CleaningTask[]
    checks: WeeklyCheck[]
  }>(response)
}

export async function finishCleaningSession(input: {
  areaId: string
  durationMinutes: number
  counts: SessionCounts
  progressType: ProgressType
  progressValue: string
  note?: string
}) {
  return post<{ progress: Progress; session: CleaningSession }>('finish_session', input)
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
