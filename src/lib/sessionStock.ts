import type { AppData, CleaningSession, RemainingStock } from '../types'

export function validateRemaining(input: Record<string, unknown>, previous: RemainingStock = {}): RemainingStock {
  const count = input.remaining_count === undefined ? previous.remaining_count : input.remaining_count
  const storage = input.remaining_storage === undefined ? previous.remaining_storage : input.remaining_storage
  if (count != null && (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 1e12)) throw new Error('Bitte eine gültige Anzahl der verbleibenden Objekte eingeben.')
  let size: RemainingStock['remaining_storage'] = null
  if (storage != null) {
    const item = storage as { value?: unknown; unit?: unknown }
    if (typeof item.value !== 'number' || !Number.isFinite(item.value) || item.value < 0 || item.value > 1e12 || (item.unit !== 'MB' && item.unit !== 'GB')) throw new Error('Bitte eine gültige verbleibende Speichergröße in MB oder GB eingeben.')
    size = { value: item.value, unit: item.unit }
  }
  return { remaining_count: count as number | null | undefined ?? null, remaining_storage: size }
}

/** Jede Sitzung hat eigene Messpunkte, auch wenn zwei Sitzungen am selben Tag stattfinden. */
export function syncSessionStock(data: AppData, session: CleaningSession) {
  const area = data.settings?.areas.find((item) => item.id === session.area_id)
  if (!area) return
  const base = { date: session.finished_at.slice(0, 10), recordedAt: session.finished_at, sessionId: session.id }
  const stock = (area.stock ?? []).filter((item) => item.sessionId !== session.id)
  if (session.remaining_count != null) stock.push({ ...base, value: session.remaining_count, unit: 'count' })
  if (session.remaining_storage != null) stock.push({ ...base, ...session.remaining_storage })
  area.stock = stock.sort((a, b) => (a.recordedAt ?? a.date).localeCompare(b.recordedAt ?? b.date)).slice(-100)
}

/** Vorherige Sitzung mit einem erfassten Wert derselben Art; fehlende Werte sind keine Null. */
export function remainingChanges(session: CleaningSession, sessions: CleaningSession[]) {
  const earlier = sessions.filter((item) => item.area_id === session.area_id && item.id !== session.id && item.finished_at < session.finished_at)
    .sort((a, b) => b.finished_at.localeCompare(a.finished_at))
  const count = earlier.find((item) => item.remaining_count != null)
  const storage = earlier.find((item) => item.remaining_storage != null)
  const mb = (value: NonNullable<RemainingStock['remaining_storage']>) => value.value * (value.unit === 'GB' ? 1000 : 1)
  return {
    count: count && session.remaining_count != null ? session.remaining_count - count.remaining_count! : null,
    storageMB: storage?.remaining_storage && session.remaining_storage ? mb(session.remaining_storage) - mb(storage.remaining_storage) : null,
  }
}
