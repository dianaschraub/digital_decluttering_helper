import { getStore } from '@netlify/blobs'
import { getUser, verifyRequestOrigin } from '@netlify/identity'
import type { Context } from '@netlify/functions'
import { readAppData, removeTask, saveCheck, saveCleaningSession, saveTask, setTaskDone } from './_shared/sheets'

const MAX_FILE_SIZE = 4 * 1024 * 1024

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}

function errorResponse(error: unknown) {
  console.error(error)
  const message = error instanceof Error ? error.message : 'Unbekannter Serverfehler.'
  const safeMessage = message.includes('GOOGLE_')
    ? 'Der Google-Sheet-Speicher ist noch nicht vollständig eingerichtet.'
    : message.includes('ALLOWED_EMAIL')
      ? 'Die erlaubte E-Mail-Adresse (ALLOWED_EMAIL) ist bei Netlify noch nicht eingetragen.'
      : message
  return json({ error: safeMessage }, 500)
}

function requireText(value: unknown, name: string, maxLength = 500) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} fehlt.`)
  return value.trim().slice(0, maxLength)
}

function optionalText(value: unknown, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function safeInteger(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback
}

async function requireUser() {
  // Pflicht: Ohne ALLOWED_EMAIL könnte jedes Identity-Konto alle Daten sehen.
  const allowedEmail = process.env.ALLOWED_EMAIL?.trim().toLowerCase()
  if (!allowedEmail) throw new Error('Die Netlify-Umgebungsvariable ALLOWED_EMAIL fehlt.')
  const user = await getUser()
  if (!user || user.email?.toLowerCase() !== allowedEmail) return null
  return user
}

function attachmentFileName(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.replace(/[\r\n"]/g, '').slice(0, 180) : 'anhang'
}

const ATTACHMENT_KEY = /^[A-Za-z0-9-]{1,80}\/[A-Za-z0-9-]{1,80}$/

async function serveAttachment(key: string) {
  if (!ATTACHMENT_KEY.test(key)) return json({ error: 'Nicht erlaubt.' }, 403)
  const store = getStore({ name: 'task-attachments', consistency: 'strong' })
  const result = await store.getWithMetadata(key, { type: 'blob', consistency: 'strong' })
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

    const url = new URL(request.url)
    if (request.method === 'GET' && url.searchParams.has('attachment')) {
      return serveAttachment(url.searchParams.get('attachment') ?? '')
    }
    if (request.method === 'GET') return json(await readAppData())
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

    if (action === 'finish_session') {
      const progressType = payload.progressType === 'date' ? 'date' : 'month'
      const countsRaw = payload.counts && typeof payload.counts === 'object' ? payload.counts as Record<string, unknown> : {}
      const result = await saveCleaningSession(user.id, {
        areaId: requireText(payload.areaId, 'Bereich', 80),
        durationMinutes: Math.min(600, Math.max(1, safeInteger(payload.durationMinutes, 20))),
        counts: {
          deleted: safeInteger(countsRaw.deleted),
          sorted: safeInteger(countsRaw.sorted),
          quickDone: safeInteger(countsRaw.quickDone),
        },
        progressType,
        progressValue: requireText(payload.progressValue, 'Bearbeitungsstand', 10),
        note: optionalText(payload.note, 1000),
      })
      return json(result)
    }

    if (action === 'create_task') {
      const taskId = crypto.randomUUID()
      let attachmentKey = ''
      if (upload && upload.size > 0) {
        if (upload.size > MAX_FILE_SIZE) return json({ error: 'Der Anhang darf höchstens 4 MB groß sein.' }, 413)
        attachmentKey = `${user.id}/${taskId}`
        const store = getStore({ name: 'task-attachments', consistency: 'strong' })
        await store.set(attachmentKey, upload, {
          onlyIfNew: true,
          metadata: { fileName: upload.name, contentType: upload.type || 'application/octet-stream', userId: user.id },
        })
      }
      try {
        const result = await saveTask(user.id, {
          id: taskId,
          areaId: optionalText(payload.areaId, 80),
          title: requireText(payload.title, 'Aufgabe'),
          dueDate: optionalText(payload.dueDate, 10),
          attachmentName: upload?.name,
          attachmentKey,
          attachmentMime: upload?.type,
          attachmentSize: upload?.size,
        })
        return json(result, 201)
      } catch (error) {
        if (attachmentKey) await getStore({ name: 'task-attachments' }).delete(attachmentKey)
        throw error
      }
    }

    if (action === 'toggle_task') {
      return json(await setTaskDone(user.id, requireText(payload.taskId, 'Aufgaben-ID', 80), Boolean(payload.done)))
    }

    if (action === 'delete_task') {
      const removed = await removeTask(requireText(payload.taskId, 'Aufgaben-ID', 80))
      if (removed.attachment_key) await getStore({ name: 'task-attachments' }).delete(removed.attachment_key)
      return json({ ok: true })
    }

    if (action === 'weekly_check') return json(await saveCheck(user.id, optionalText(payload.note, 1000)), 201)
    return json({ error: 'Unbekannte Aktion.' }, 400)
  } catch (error) {
    return errorResponse(error)
  }
}
