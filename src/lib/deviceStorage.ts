import type { DeviceStorage, StorageDevice } from '../types'

export function storageUsage(usedGB: unknown, totalGB: unknown) {
  if (typeof usedGB !== 'number' || typeof totalGB !== 'number' || !Number.isFinite(usedGB) || !Number.isFinite(totalGB) || totalGB <= 0 || usedGB < 0 || usedGB > totalGB || totalGB > 1e6) throw new Error('Bitte gültige GB-Werte eingeben: Gesamtspeicher größer als null, belegter Speicher zwischen null und Gesamtspeicher.')
  return { usedGB, totalGB, percent: usedGB / totalGB * 100, freeGB: totalGB - usedGB }
}

export function sanitizeDeviceStorage(input: unknown): Partial<Record<StorageDevice, DeviceStorage>> {
  const result: Partial<Record<StorageDevice, DeviceStorage>> = {}
  if (!input || typeof input !== 'object') return result
  for (const device of ['phone', 'tablet'] as const) {
    const item = (input as Record<string, unknown>)[device] as DeviceStorage | undefined
    if (!item || typeof item.updatedAt !== 'string' || !Number.isFinite(Date.parse(item.updatedAt))) continue
    try {
      const usage = storageUsage(item.usedGB, item.totalGB)
      result[device] = { usedGB: usage.usedGB, totalGB: usage.totalGB, updatedAt: item.updatedAt }
    } catch { /* Ungültige Altwerte bleiben unbekannt statt als 0 angezeigt zu werden. */ }
  }
  return result
}
