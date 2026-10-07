import { GoogleAuth } from 'google-auth-library'
import { defaultReminders } from '../../../src/lib/settingsSchema'
import type { CleaningSession, CleaningTask, Progress, UserSettings, WeeklyCheck } from '../../../src/types'

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

interface ValuesResponse {
  values?: unknown[][]
}

interface BatchValuesResponse {
  valueRanges?: ValuesResponse[]
}

let authClientPromise: ReturnType<GoogleAuth['getClient']> | null = null

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
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
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

/** Liest mehrere Tabellenblätter mit einer einzigen Anfrage. */
async function readTables<T extends TableName>(tables: T[]): Promise<Record<T, SheetRecord[]>> {
  const query = tables.map((table) => `ranges=${encodeURIComponent(tableRange(table))}`).join('&')
  const result = await googleRequest<BatchValuesResponse>(`/values:batchGet?${query}&majorDimension=ROWS`)
  const ranges = result.valueRanges ?? []
  return Object.fromEntries(tables.map((table, index) => [table, toRecords(table, ranges[index]?.values ?? [])])) as Record<T, SheetRecord[]>
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

/**
 * Liest die Daten der früheren Google-Sheet-Version (nur lesend, für den
 * einmaligen Import in den neuen Speicher). Gibt null zurück, wenn kein Sheet
 * eingerichtet ist.
 */
export async function readLegacySheet() {
  if (!process.env.GOOGLE_SHEET_ID?.trim()) return null
  const tables = await readTables(['progress', 'sessions', 'tasks', 'weekly_checks'])
  const progress = tables.progress.map((record) => toProgress(record.value)).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  return {
    progress: progress.filter((item, index) => progress.findIndex((other) => other.area_id === item.area_id) === index),
    sessions: tables.sessions.map((record) => toSession(record.value)).sort((a, b) => a.finished_at.localeCompare(b.finished_at)),
    tasks: tables.tasks.map((record) => toTask(record.value)).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    checks: tables.weekly_checks.map((record) => toCheck(record.value)).sort((a, b) => b.checked_at.localeCompare(a.checked_at)),
  }
}

/** Bereiche und Ablageorte der ursprünglichen, persönlichen Version – IDs passend zu den Sheet-Daten. */
export const LEGACY_SETTINGS: UserSettings = {
  areas: [
    { id: 'phone-photos', title: 'Bilder', subtitle: 'Handy', group: 'Handy', icon: 'photos', kind: 'files', intervalDays: 30, color: '#5e9b72', status: 'active' },
    { id: 'phone-screenshots', title: 'Screenshots', subtitle: 'Handy', group: 'Handy', icon: 'screenshots', kind: 'files', intervalDays: 30, color: '#c19a4f', status: 'active' },
    { id: 'phone-downloads', title: 'Downloads & PDFs', subtitle: 'Handy', group: 'Handy', icon: 'downloads', kind: 'files', intervalDays: 30, color: '#7d74c4', status: 'active' },
    { id: 'tablet-photos', title: 'Bilder', subtitle: 'Tablet', group: 'Tablet', icon: 'photos', kind: 'files', intervalDays: 30, color: '#5e9b72', status: 'active' },
    { id: 'tablet-screenshots', title: 'Screenshots', subtitle: 'Tablet', group: 'Tablet', icon: 'screenshots', kind: 'files', intervalDays: 30, color: '#c19a4f', status: 'active' },
    { id: 'tablet-downloads', title: 'Downloads & PDFs', subtitle: 'Tablet', group: 'Tablet', icon: 'downloads', kind: 'files', intervalDays: 30, color: '#7d74c4', status: 'active' },
    { id: 'essen-email', title: 'Essener Postfach', subtitle: 'Musikschule', group: 'E-Mail', icon: 'mail', kind: 'email', intervalDays: 7, color: '#4f8bb8', status: 'active' },
    { id: 'webde-email', title: 'WEB.DE-Postfach', subtitle: 'Privat', group: 'E-Mail', icon: 'mail', kind: 'email', intervalDays: 14, color: '#c46b78', status: 'active' },
  ],
  destinations: [
    { id: 'mail-archive', label: 'Im Postfach archivieren', note: 'E-Mail ohne offene Aufgabe', kinds: ['email'] },
    { id: 'private-cloud', label: 'Private Cloud', note: 'private Hauptablage', kinds: ['files', 'email'] },
    { id: 'terabox-work', label: 'TeraBox', note: 'Arbeit', kinds: ['files'] },
    { id: 'spacebite-work', label: 'Space Bite', note: 'Arbeit', kinds: ['files'] },
    { id: 'photo-archive', label: 'SSD Fotoarchiv', note: 'alte Fotos', kinds: ['files'] },
  ],
  reminders: defaultReminders(),
}
