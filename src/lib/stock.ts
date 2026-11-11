import type { Area, StockMeasurement } from '../types'

export const MAX_WEEKLY_SESSIONS = 5

/** Speichergrößen sind vergleichbar; Anzahlen bilden eine eigene Messreihe. */
export function comparableStock(area: Area): StockMeasurement[] {
  const entries = area.stock ?? []
  const latest = entries.at(-1)
  return latest ? entries.filter((item) => (item.unit === 'count') === (latest.unit === 'count')) : []
}

export function stockValue(item: StockMeasurement) {
  return item.unit === 'GB' ? item.value * 1000 : item.value
}

export function stockTrend(area: Area) {
  const entries = comparableStock(area)
  const latest = entries.at(-1)
  const previous = entries.at(-2)
  if (!latest || !previous) return null
  const difference = stockValue(latest) - stockValue(previous)
  const ratio = stockValue(previous) === 0 ? (difference > 0 ? 1 : 0) : difference / stockValue(previous)
  const before = entries.at(-3)
  const repeated = !!before && stockValue(previous) > stockValue(before) && difference > 0
  return { latest, previous, difference, ratio, repeated }
}

/** Ein Anstieg: 2 Termine, ab 5 %: 3, wiederholtes Wachstum: bis zu 5. */
export function weeklyDemand(area: Area) {
  const trend = stockTrend(area)
  if (!area.adaptive || !trend || trend.difference <= 0) return 0
  return trend.repeated ? 5 : trend.ratio >= 0.05 ? 3 : 2
}

export function effectiveInterval(area: Area) {
  const demand = weeklyDemand(area)
  return demand ? Math.min(area.intervalDays, 7 / demand) : area.intervalDays
}
