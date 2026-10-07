import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { Area, Destination, UserSettings } from '../types'

interface SettingsValue {
  /** Alle Bereiche, auch pausierte und entfernte – für Verlauf und Aufgaben. */
  allAreas: Area[]
  /** Bereiche, die gerade bearbeitet werden. */
  activeAreas: Area[]
  destinations: Destination[]
  findArea: (id: string | null | undefined) => Area | undefined
}

const SettingsContext = createContext<SettingsValue | null>(null)

export function SettingsProvider({ settings, children }: { settings: UserSettings; children: ReactNode }) {
  const value = useMemo<SettingsValue>(() => {
    const byId = new Map(settings.areas.map((area) => [area.id, area]))
    return {
      allAreas: settings.areas,
      activeAreas: settings.areas.filter((area) => area.status === 'active'),
      destinations: settings.destinations,
      findArea: (id) => (id ? byId.get(id) : undefined),
    }
  }, [settings])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettings außerhalb von SettingsProvider')
  return value
}
