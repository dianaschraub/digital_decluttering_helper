import { admin, getUser, verifyRequestOrigin } from '@netlify/identity'
import type { User } from '@netlify/identity'
import type { Context } from '@netlify/functions'
import { sanitizeSettings, withDefaults } from '../../src/lib/settingsSchema'
import type { AppData, CleaningSession, CleaningTask, Progress, WeeklyCheck } from '../../src/types'
import { LEGACY_SETTINGS, readLegacySheet } from './_shared/legacySheet'
import { attachmentStore, createUserData, deleteUserData, ensureCalendarToken, legacyImportDone, loadUserData, markLegacyImported, updateUserData } from './_shared/store'

const MAX_FILE_SIZE = 4 * 1024 * 1024
const SESSIONS_SENT = 300

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}

function errorResponse(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status)
  console.error(error)
  const message = error instanceof Error ? error.message : 'Unbekannter Serverfehler.'
  return json({ error: message.includes('GOOGLE_') ? 'Der Import aus dem Google Sheet ist fehlgeschlagen.' : message }, 500)
}

function requireText(value: unknown, name: string, maxLength = 500) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `${name} fehlt.`)
  return value.trim().slice(0, maxLength)
}

function optionalText(value: unknown, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function safeInteger(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback
}

function isoDate(value: unknown, pattern: RegExp, name: string) {
  const text = requireText(value, name, 10)
  if (!pattern.test(text)) throw new HttpError(400, `${name} hat ein ungültiges Format.`)
  return text
}

function emailList(name: string) {
  return (process.env[name] ?? '').split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean)
}

async function requireUser() {
  const user = await getUser()
  if (!user) return null
  // Optional: Zugang auf bestimmte Adressen beschränken (kommagetrennt). Leer = alle registrierten Konten.
  const allowed = emailList('ALLOWED_EMAILS')
  if (allowed.length && !allowed.includes(user.email?.toLowerCase() ?? '')) return null
  return user
}

/** E-Mail-Adresse, deren Daten einmalig aus dem früheren Google Sheet übernommen werden. */
function legacyOwner() {
  return (process.env.LEGACY_IMPORT_EMAIL || process.env.ALLOWED_EMAIL || '').trim().toLowerCase()
}

async function loadWithLegacyImport(user: User): Promise<AppData> {
  const loaded = await loadUserData(user.id)
  if (loaded.exists || !legacyOwner() || user.email?.toLowerCase() !== legacyOwner()) return loaded.data
  if (await legacyImportDone()) return loaded.data
  const legacy = await readLegacySheet()
  if (!legacy) return loaded.data
  const imported: AppData = { settings: LEGACY_SETTINGS, ...legacy, calendarToken: null }
  await createUserData(user.id, imported)
  await markLegacyImported()
  return (await loadUserData(user.id)).data
}

function forClient(data: AppData): AppData {
  return {
    settings: withDefaults(data.settings),
    progress: data.progress,
    sessions: [...data.sessions].sort((a, b) => b.finished_at.localeCompare(a.finished_at)).slice(0, SESSIONS_SENT),
    tasks: data.tasks,
    checks: data.checks.slice(0, 25),
    calendarToken: data.calendarToken,
  }
}

function attachmentFileName(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.replace(/[\r\n"]/g, '').slice(0, 180) : 'anhang'
}

async function serveAttachment(userId: string, key: string) {
  // Nur eigene Anhänge: Der Schlüssel beginnt immer mit der eigenen Identity-ID.
  if (!key.startsWith(`${userId}/`) || !/^[A-Za-z0-9-]{1,80}\/[A-Za-z0-9-]{1,80}$/.test(key)) return json({ error: 'Nicht erlaubt.' }, 403)
  const result = await attachmentStore().getWithMetadata(key, { type: 'blob', consistency: 'strong' })
  if (!result) return json({ error: 'Anhang nicht gefunden.' }, 404)
  const fileName = attachmentFileName(result.metadata.fileName)
  const contentType = typeof result.metadata.contentType === 'string' ? result.metadata.contentType : 'application/octet-stream'
  return new Response(result.data, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export default async (request: Request, _context: Context) => {
  try {
    const user = await requireUser()
    if (!user) return json({ error: 'Nicht angemeldet.' }, 401)
    const userId = user.id

    const url = new URL(request.url)
    if (request.method === 'GET' && url.searchParams.has('attachment')) {
      return serveAttachment(userId, url.searchParams.get('attachment') ?? '')
    }
    if (request.method === 'GET') return json(forClient(await loadWithLegacyImport(user)))
    if (request.method !== 'POST') return json({ error: 'Methode nicht erlaubt.' }, 405)

    verifyRequestOrigin(request)
    const contentType = request.headers.get('content-type') ?? ''
    let action = ''
    let payload: Record<string, unknown> = {}
    let upload: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      action = String(form.get('action') ?? '')
      payload = JSON.parse(String(form.get('payload') ?? '{}')) as Record<string, unknown>
      const candidate = form.get('file')
      upload = candidate && typeof candidate !== 'string' ? candidate : null
    } else {
      const body = await request.json() as { action?: unknown; payload?: unknown }
      action = String(body.action ?? '')
      payload = body.payload && typeof body.payload === 'object' ? body.payload as Record<string, unknown> : {}
    }

    if (action === 'save_settings') {
      let settings
      try {
        settings = sanitizeSettings(payload.settings)
      } catch (error) {
        throw new HttpError(400, error instanceof Error ? error.message : 'Ungültige Einstellungen.')
      }
      await updateUserData(userId, (data) => { data.settings = settings })
      return json({ settings })
    }

    if (action === 'finish_session') {
      const progressType = payload.progressType === 'date' ? 'date' : 'month'
      const areaId = requireText(payload.areaId, 'Bereich', 48)
      const progressValue = isoDate(payload.progressValue, progressType === 'date' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}$/, 'Bearbeitungsstand')
      const countsRaw = payload.counts && typeof payload.counts === 'object' ? payload.counts as Record<string, unknown> : {}
      const now = new Date().toISOString()
      const result = await updateUserData(userId, (data) => {
        if (!data.settings?.areas.some((area) => area.id === areaId)) throw new HttpError(400, 'Diesen Bereich gibt es nicht.')
        const previous = data.progress.find((item) => item.area_id === areaId)
        const progress: Progress = {
          id: previous?.id ?? crypto.randomUUID(), user_id: userId, area_id: areaId,
          progress_type: progressType, progress_value: progressValue,
          note: optionalText(payload.note, 1000) || null, updated_at: now,
        }
        const session: CleaningSession = {
          id: crypto.randomUUID(), user_id: userId, area_id: areaId, finished_at: now,
          duration_minutes: Math.min(600, Math.max(1, safeInteger(payload.durationMinutes, 20))),
          deleted_count: safeInteger(countsRaw.deleted), sorted_count: safeInteger(countsRaw.sorted), quick_done_count: safeInteger(countsRaw.quickDone),
          progress_type: progressType, progress_value: progressValue,
        }
        data.progress = [progress, ...data.progress.filter((item) => item.area_id !== areaId)]
        data.sessions.push(session)
        return { progress, session }
      })
      return json(result)
    }

    if (action === 'create_task') {
      const taskId = crypto.randomUUID()
      const title = requireText(payload.title, 'Aufgabe')
      const dueDate = optionalText(payload.dueDate, 10)
      if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new HttpError(400, 'Das Datum der Wiedervorlage ist ungültig.')
      let attachmentKey = ''
      if (upload && upload.size > 0) {
        if (upload.size > MAX_FILE_SIZE) return json({ error: 'Der Anhang darf höchstens 4 MB groß sein.' }, 413)
        attachmentKey = `${userId}/${taskId}`
        await attachmentStore().set(attachmentKey, upload, {
          onlyIfNew: true,
          metadata: { fileName: upload.name, contentType: upload.type || 'application/octet-stream', userId },
        })
      }
      const task: CleaningTask = {
        id: taskId, user_id: userId, area_id: optionalText(payload.areaId, 48) || null, title,
        due_date: dueDate || null, status: 'open', created_at: new Date().toISOString(), completed_at: null,
        attachment_name: upload?.name ?? null, attachment_key: attachmentKey || null,
        attachment_mime: upload?.type || null, attachment_size: upload?.size ?? null,
      }
      try {
        await updateUserData(userId, (data) => { data.tasks = [task, ...data.tasks] })
      } catch (error) {
        if (attachmentKey) await attachmentStore().delete(attachmentKey)
        throw error
      }
      return json(task, 201)
    }

    if (action === 'toggle_task') {
      const taskId = requireText(payload.taskId, 'Aufgaben-ID', 80)
      const updated = await updateUserData(userId, (data) => {
        const task = data.tasks.find((item) => item.id === taskId)
        if (!task) throw new HttpError(404, 'Die Aufgabe wurde nicht gefunden.')
        task.status = payload.done ? 'done' : 'open'
        task.completed_at = payload.done ? new Date().toISOString() : null
        return task
      })
      return json(updated)
    }

    if (action === 'delete_task') {
      const taskId = requireText(payload.taskId, 'Aufgaben-ID', 80)
      const removed = await updateUserData(userId, (data) => {
        const task = data.tasks.find((item) => item.id === taskId)
        if (!task) throw new HttpError(404, 'Die Aufgabe wurde nicht gefunden.')
        data.tasks = data.tasks.filter((item) => item.id !== taskId)
        return task
      })
      if (removed.attachment_key?.startsWith(`${userId}/`)) await attachmentStore().delete(removed.attachment_key)
      return json({ ok: true })
    }

    if (action === 'weekly_check') {
      const check: WeeklyCheck = { id: crypto.randomUUID(), user_id: userId, checked_at: new Date().toISOString(), note: optionalText(payload.note, 1000) || null }
      await updateUserData(userId, (data) => { data.checks = [check, ...data.checks] })
      return json(check, 201)
    }

    if (action === 'calendar_link') {
      return json({ calendarToken: await ensureCalendarToken(userId, payload.reset === true) })
    }

    if (action === 'delete_account') {
      if (payload.confirm !== 'LÖSCHEN') throw new HttpError(400, 'Bitte bestätige das Löschen.')
      await deleteUserData(userId)
      // Das Identity-Konto ebenfalls entfernen; schlägt das fehl, sind die Daten trotzdem gelöscht.
      try { await admin.deleteUser(userId) } catch (error) { console.error('Identity-Konto konnte nicht gelöscht werden', error) }
      return json({ ok: true })
    }

    return json({ error: 'Unbekannte Aktion.' }, 400)
  } catch (error) {
    return errorResponse(error)
  }
}
