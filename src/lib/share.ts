import { fetchAttachmentFile } from './api'
import { formatDate } from './dates'
import type { Area, CleaningTask } from '../types'

export function taskShareText(task: CleaningTask, area?: Area) {
  const lines = [`Nächste Handlung: ${task.title}`]
  if (task.due_date) lines.push(`Wiedervorlage: ${formatDate(task.due_date)}`)
  if (area) lines.push(`Bereich: ${area.title}${area.subtitle ? ` · ${area.subtitle}` : ''}`)
  lines.push('', 'Aus Digital Cleaning')
  return lines.join('\n')
}

export function canShareNatively() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

// Safari erlaubt das Teilen-Menü nur unmittelbar nach dem Antippen. Anhänge werden
// deshalb vorab geladen, damit beim Tippen nichts mehr nachgeladen werden muss.
const prepared = new Map<string, File | null>()

export async function prepareAttachment(task: CleaningTask) {
  if (!task.attachment_key || prepared.has(task.id) || !canShareNatively()) return
  prepared.set(task.id, null)
  try {
    const file = await fetchAttachmentFile(task)
    if (file && navigator.canShare?.({ files: [file] })) prepared.set(task.id, file)
  } catch {
    // Anhang nicht verfügbar – geteilt wird dann nur der Text.
  }
}

/**
 * Öffnet das Teilen-Menü des Geräts (z. B. für Google Notizen). Ein vorab
 * geladener Anhang wird mitgegeben. Ohne Teilen-Menü (meist am Computer)
 * wird der Text in die Zwischenablage kopiert.
 */
export async function shareTask(task: CleaningTask, area?: Area): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const text = taskShareText(task, area)
  if (canShareNatively()) {
    const file = prepared.get(task.id)
    try {
      await navigator.share(file ? { title: task.title, text, files: [file] } : { title: task.title, text })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // Manche Ziel-Apps lehnen Dateien ab – dann beim nächsten Mal nur Text.
      if (file) prepared.set(task.id, null)
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
