import { GoogleAuth } from 'google-auth-library'
import type { CleaningSession, CleaningTask, Progress, WeeklyCheck } from '../../../src/types'

const TABLES = {
  progress: ['id', 'user_id', 'area_id', 'progress_type', 'progress_value', 'note', 'updated_at'],
  sessions: ['id', 'user_id', 'area_id', 'finished_at', 'duration_minutes', 'deleted_count', 'sorted_count', 'quick_done_count', 'progress_type', 'progress_value'],
  tasks: ['id', 'user_id', 'area_id', 'title', 'due_date', 'status', 'created_at', 'completed_at', 'attachment_name', 'attachment_key', 'attachment_mime', 'attachment_size'],
  weekly_checks: ['id', 'user_id', 'checked_at', 'note'],
} as const

type TableName = keyof typeof TABLES
type RowObject = Record<string, string>

interface SheetRecord {
  rowNumber: number
  value: RowObject
}

interface SpreadsheetMetadata {
  sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>
}

interface ValuesResponse {
  values?: unknown[][]
}

interface BatchValuesResponse {
  valueRanges?: ValuesResponse[]
}

let authClientPromise: ReturnType<GoogleAuth['getClient']> | null = null
let setupPromise: Promise<void> | null = null

function requireEnvironment(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Die Netlify-Umgebungsvariable ${name} fehlt.`)
  return value
}

function spreadsheetId() {
  return requireEnvironment('GOOGLE_SHEET_ID')
}

function getGoogleClient() {
  if (authClientPromise) return authClientPromise
  const email = requireEnvironment('GOOGLE_SERVICE_ACCOUNT_EMAIL')
  const key = requireEnvironment('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n')
  const auth = new GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  authClientPromise = auth.getClient()
  return authClientPromise
}

async function googleRequest<T>(path: string, options: { method?: 'GET' | 'POST' | 'PUT'; data?: unknown } = {}) {
  const client = await getGoogleClient()
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId())}${path}`
  const response = await client.request<T>({ url, method: options.method ?? 'GET', data: options.data })
  return response.data
}

function columnName(index: number) {
  let value = index
  let name = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }
  return name
}

async function ensureSpreadsheet() {
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    const metadata = await googleRequest<SpreadsheetMetadata>('?fields=sheets.properties(sheetId,title)')
    const existing = new Set((metadata.sheets ?? []).map((sheet) => sheet.properties?.title).filter(Boolean))
    const missing = (Object.keys(TABLES) as TableName[]).filter((name) => !existing.has(name))

    if (!missing.length) return

    await googleRequest(':batchUpdate', {
      method: 'POST',
      data: { requests: missing.map((title) => ({ addSheet: { properties: { title } } })) },
    })
    // Kopfzeilen nur für neu angelegte Blätter schreiben – alle in einer Anfrage.
    await googleRequest('/values:batchUpdate', {
      method: 'POST',
      data: {
        valueInputOption: 'RAW',
        data: missing.map((name) => ({
          range: `${name}!A1:${columnName(TABLES[name].length)}1`,
          majorDimension: 'ROWS',
          values: [[...TABLES[name]]],
        })),
      },
    })
  })().catch((error) => {
    setupPromise = null
    throw error
  })
  return setupPromise
}

function tableRange(table: TableName) {
  return `${table}!A:${columnName(TABLES[table].length)}`
}

function toRecords(table: TableName, rows: unknown[][]): SheetRecord[] {
  const columns = TABLES[table]
  return rows.slice(1).map((rawRow, index) => {
    const value: RowObject = {}
    columns.forEach((column, columnIndex) => {
      value[column] = rawRow[columnIndex] == null ? '' : String(rawRow[columnIndex])
    })
    return { rowNumber: index + 2, value }
  }).filter((record) => record.value.id)
}

async function readRecords(table: TableName): Promise<SheetRecord[]> {
  await ensureSpreadsheet()
  const result = await googleRequest<ValuesResponse>(`/values/${encodeURIComponent(tableRange(table))}?majorDimension=ROWS`)
  return toRecords(table, result.values ?? [])
}

/** Liest mehrere Tabellenblätter mit einer einzigen Anfrage. */
async function readTables<T extends TableName>(tables: T[]): Promise<Record<T, SheetRecord[]>> {
  await ensureSpreadsheet()
  const query = tables.map((table) => `ranges=${encodeURIComponent(tableRange(table))}`).join('&')
  const result = await googleRequest<BatchValuesResponse>(`/values:batchGet?${query}&majorDimension=ROWS`)
  const ranges = result.valueRanges ?? []
  return Object.fromEntries(tables.map((table, index) => [table, toRecords(table, ranges[index]?.values ?? [])])) as Record<T, SheetRecord[]>
}

function valuesFor(table: TableName, value: RowObject) {
  return TABLES[table].map((column) => value[column] ?? '')
}

async function appendRecord(table: TableName, value: RowObject) {
  await ensureSpreadsheet()
  await googleRequest(`/values/${encodeURIComponent(tableRange(table))}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    data: { majorDimension: 'ROWS', values: [valuesFor(table, value)] },
  })
}

async function updateRecord(table: TableName, rowNumber: number, value: RowObject) {
  const end = columnName(TABLES[table].length)
  const rawRange = `${table}!A${rowNumber}:${end}${rowNumber}`
  await googleRequest(`/values/${encodeURIComponent(rawRange)}?valueInputOption=RAW`, {
    method: 'PUT',
    data: { range: rawRange, majorDimension: 'ROWS', values: [valuesFor(table, value)] },
  })
}

async function clearRecord(table: TableName, rowNumber: number) {
  const end = columnName(TABLES[table].length)
  const rawRange = `${table}!A${rowNumber}:${end}${rowNumber}`
  await googleRequest(`/values/${encodeURIComponent(rawRange)}:clear`, { method: 'POST', data: {} })
}

function nullable(value: string) {
  return value || null
}

function numberValue(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toProgress(value: RowObject): Progress {
  return {
    id: value.id,
    user_id: value.user_id,
    area_id: value.area_id,
    progress_type: value.progress_type === 'date' ? 'date' : 'month',
    progress_value: value.progress_value,
    note: nullable(value.note),
    updated_at: value.updated_at,
  }
}

function toSession(value: RowObject): CleaningSession {
  return {
    id: value.id,
    user_id: value.user_id,
    area_id: value.area_id,
    finished_at: value.finished_at,
    duration_minutes: numberValue(value.duration_minutes),
    deleted_count: numberValue(value.deleted_count),
    sorted_count: numberValue(value.sorted_count),
    quick_done_count: numberValue(value.quick_done_count),
    progress_type: value.progress_type === 'date' ? 'date' : 'month',
    progress_value: value.progress_value,
  }
}

function toTask(value: RowObject): CleaningTask {
  return {
    id: value.id,
    user_id: value.user_id,
    area_id: nullable(value.area_id),
    title: value.title,
    due_date: nullable(value.due_date),
    status: value.status === 'done' ? 'done' : 'open',
    created_at: value.created_at,
    completed_at: nullable(value.completed_at),
    attachment_name: nullable(value.attachment_name),
    attachment_key: nullable(value.attachment_key),
    attachment_mime: nullable(value.attachment_mime),
    attachment_size: value.attachment_size ? numberValue(value.attachment_size) : null,
  }
}

function toCheck(value: RowObject): WeeklyCheck {
  return {
    id: value.id,
    user_id: value.user_id,
    checked_at: value.checked_at,
    note: nullable(value.note),
  }
}

// Die App hat genau ein erlaubtes Konto (ALLOWED_EMAIL). Daten werden deshalb
// nicht nach user_id gefiltert: So bleiben sie sichtbar, auch wenn das
// Netlify-Identity-Konto einmal neu angelegt wird und eine neue ID bekommt.
// user_id wird weiterhin mitgeschrieben, um nachvollziehen zu können, wer gespeichert hat.

export async function readAppData() {
  const tables = await readTables(['progress', 'sessions', 'tasks', 'weekly_checks'])
  // Pro Bereich nur den jüngsten Stand liefern, falls es (etwa nach Kontowechsel) mehrere gibt.
  const progress = tables.progress.map((record) => toProgress(record.value)).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  return {
    progress: progress.filter((item, index) => progress.findIndex((other) => other.area_id === item.area_id) === index),
    sessions: tables.sessions.map((record) => toSession(record.value)).sort((a, b) => b.finished_at.localeCompare(a.finished_at)).slice(0, 100),
    tasks: tables.tasks.map((record) => toTask(record.value)).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    checks: tables.weekly_checks.map((record) => toCheck(record.value)).sort((a, b) => b.checked_at.localeCompare(a.checked_at)).slice(0, 25),
  }
}

export async function saveCleaningSession(userId: string, input: {
  areaId: string
  durationMinutes: number
  counts: { deleted: number; sorted: number; quickDone: number }
  progressType: 'month' | 'date'
  progressValue: string
  note?: string
}) {
  const now = new Date().toISOString()
  const progressRows = await readRecords('progress')
  const previous = progressRows
    .filter((record) => record.value.area_id === input.areaId)
    .sort((a, b) => b.value.updated_at.localeCompare(a.value.updated_at))[0]
  const progressValue: RowObject = {
    id: previous?.value.id || crypto.randomUUID(), user_id: userId, area_id: input.areaId,
    progress_type: input.progressType, progress_value: input.progressValue,
    note: input.note ?? '', updated_at: now,
  }
  if (previous) await updateRecord('progress', previous.rowNumber, progressValue)
  else await appendRecord('progress', progressValue)

  const sessionValue: RowObject = {
    id: crypto.randomUUID(), user_id: userId, area_id: input.areaId, finished_at: now,
    duration_minutes: String(input.durationMinutes), deleted_count: String(input.counts.deleted),
    sorted_count: String(input.counts.sorted), quick_done_count: String(input.counts.quickDone),
    progress_type: input.progressType, progress_value: input.progressValue,
  }
  await appendRecord('sessions', sessionValue)
  return { progress: toProgress(progressValue), session: toSession(sessionValue) }
}

export async function saveTask(userId: string, input: {
  id: string
  areaId?: string
  title: string
  dueDate?: string
  attachmentName?: string
  attachmentKey?: string
  attachmentMime?: string
  attachmentSize?: number
}) {
  const value: RowObject = {
    id: input.id, user_id: userId, area_id: input.areaId ?? '', title: input.title,
    due_date: input.dueDate ?? '', status: 'open', created_at: new Date().toISOString(), completed_at: '',
    attachment_name: input.attachmentName ?? '', attachment_key: input.attachmentKey ?? '',
    attachment_mime: input.attachmentMime ?? '', attachment_size: input.attachmentSize == null ? '' : String(input.attachmentSize),
  }
  await appendRecord('tasks', value)
  return toTask(value)
}

export async function setTaskDone(userId: string, taskId: string, done: boolean) {
  const rows = await readRecords('tasks')
  const record = rows.find((item) => item.value.id === taskId)
  if (!record) throw new Error('Die Aufgabe wurde nicht gefunden.')
  record.value.user_id = userId
  record.value.status = done ? 'done' : 'open'
  record.value.completed_at = done ? new Date().toISOString() : ''
  await updateRecord('tasks', record.rowNumber, record.value)
  return toTask(record.value)
}

export async function removeTask(taskId: string) {
  const rows = await readRecords('tasks')
  const record = rows.find((item) => item.value.id === taskId)
  if (!record) throw new Error('Die Aufgabe wurde nicht gefunden.')
  await clearRecord('tasks', record.rowNumber)
  return toTask(record.value)
}

export async function saveCheck(userId: string, note: string) {
  const value: RowObject = {
    id: crypto.randomUUID(), user_id: userId, checked_at: new Date().toISOString(), note,
  }
  await appendRecord('weekly_checks', value)
  return toCheck(value)
}
