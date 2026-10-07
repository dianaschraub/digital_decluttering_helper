import { getStore } from '@netlify/blobs'
import type { AppData } from '../../../src/types'

// Jede Person hat genau ein Datendokument unter ihrer Identity-ID.
// Anhänge liegen getrennt unter `<userId>/<taskId>`.
const DATA_STORE = 'user-data'
const ATTACHMENT_STORE = 'task-attachments'
const MAX_SESSIONS = 2000
const MAX_TASKS = 1000
const MAX_CHECKS = 200

export function emptyData(): AppData {
  return { settings: null, progress: [], sessions: [], tasks: [], checks: [], calendarToken: null }
}

function dataStore() {
  return getStore({ name: DATA_STORE, consistency: 'strong' })
}

export function attachmentStore() {
  return getStore({ name: ATTACHMENT_STORE, consistency: 'strong' })
}

function dataKey(userId: string) {
  return `users/${userId}`
}

function normalize(value: Partial<AppData> | null | undefined): AppData {
  return {
    settings: value?.settings ?? null,
    progress: Array.isArray(value?.progress) ? value.progress : [],
    sessions: Array.isArray(value?.sessions) ? value.sessions : [],
    tasks: Array.isArray(value?.tasks) ? value.tasks : [],
    checks: Array.isArray(value?.checks) ? value.checks : [],
    calendarToken: typeof value?.calendarToken === 'string' ? value.calendarToken : null,
  }
}

export async function loadUserData(userId: string) {
  const result = await dataStore().getWithMetadata(dataKey(userId), { type: 'json', consistency: 'strong' })
  return result ? { data: normalize(result.data as Partial<AppData>), etag: result.etag ?? null, exists: true } : { data: emptyData(), etag: null, exists: false }
}

/**
 * Liest das Dokument, wendet `change` an und schreibt nur, wenn es zwischendurch
 * niemand verändert hat (z. B. Handy und Tablet gleichzeitig). Sonst neuer Versuch.
 */
export async function updateUserData<T>(userId: string, change: (data: AppData) => T): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, etag, exists } = await loadUserData(userId)
    const result = change(data)
    data.sessions = data.sessions.slice(-MAX_SESSIONS)
    data.tasks = data.tasks.slice(0, MAX_TASKS)
    data.checks = data.checks.slice(0, MAX_CHECKS)
    const write = exists && etag
      ? await dataStore().setJSON(dataKey(userId), data, { onlyIfMatch: etag })
      : await dataStore().setJSON(dataKey(userId), data, { onlyIfNew: true })
    if (write.modified) return result
  }
  throw new Error('Die Daten wurden gerade auf einem anderen Gerät geändert. Bitte versuche es noch einmal.')
}

/** Legt das Dokument nur an, wenn es noch nicht existiert (für den einmaligen Import). */
export async function createUserData(userId: string, data: AppData) {
  const write = await dataStore().setJSON(dataKey(userId), data, { onlyIfNew: true })
  return write.modified
}

// Merkt sich, dass das alte Google Sheet bereits übernommen wurde – damit nach
// einer Kontolöschung und Neuregistrierung nichts erneut importiert wird.
const LEGACY_MARKER = 'meta/legacy-sheet-imported'

export async function legacyImportDone() {
  return (await dataStore().get(LEGACY_MARKER, { consistency: 'strong' })) != null
}

export async function markLegacyImported() {
  await dataStore().set(LEGACY_MARKER, new Date().toISOString())
}

// ---------- Kalender-Abo ----------
// Der Token im Abo-Link verweist über `calendar/<token>` auf die Person.

function newCalendarToken() {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '').slice(0, 32)
}

export async function userIdForCalendarToken(token: string) {
  const userId = await dataStore().get(`calendar/${token}`, { consistency: 'strong' })
  return typeof userId === 'string' && userId ? userId : null
}

/** Liefert den bestehenden Token oder legt einen an; mit `reset` wird ein neuer erzeugt und der alte ungültig. */
export async function ensureCalendarToken(userId: string, reset = false) {
  const { previous, token } = await updateUserData(userId, (data) => {
    const old = data.calendarToken ?? null
    if (old && !reset) return { previous: null, token: old }
    data.calendarToken = newCalendarToken()
    return { previous: old, token: data.calendarToken }
  })
  await dataStore().set(`calendar/${token}`, userId)
  if (previous) await dataStore().delete(`calendar/${previous}`)
  return token
}

/** Löscht das Datendokument, den Kalender-Link und alle Anhänge einer Person. */
export async function deleteUserData(userId: string) {
  const attachments = attachmentStore()
  const { blobs } = await attachments.list({ prefix: `${userId}/` })
  await Promise.all(blobs.map((blob) => attachments.delete(blob.key)))
  const { data } = await loadUserData(userId)
  if (data.calendarToken) await dataStore().delete(`calendar/${data.calendarToken}`)
  await dataStore().delete(dataKey(userId))
}
