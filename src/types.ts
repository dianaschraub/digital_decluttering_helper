export type AreaKind = 'files' | 'email'
export type AreaIconName = 'photos' | 'screenshots' | 'downloads' | 'videos' | 'desktop' | 'documents' | 'mail' | 'other'
export type AreaStatus = 'active' | 'paused' | 'removed'
export type ProgressType = 'month' | 'date'
export type TaskStatus = 'open' | 'done'

export interface Area {
  id: string
  title: string
  /** Gerät oder Konto, z. B. „Handy“ oder „E-Mail“ */
  subtitle: string
  /** Überschrift, unter der der Bereich gruppiert wird */
  group: string
  icon: AreaIconName
  kind: AreaKind
  intervalDays: number
  color: string
  status: AreaStatus
}

export interface Destination {
  id: string
  label: string
  note: string
  kinds: AreaKind[]
}

export type ReminderFrequency = 'weekly' | 'biweekly' | 'monthly'

export interface ReminderSettings {
  /** Aufräum-Termine im Kalender-Abo anzeigen */
  enabled: boolean
  /** Wochentage, 0 = Sonntag … 6 = Samstag */
  weekdays: number[]
  /** Uhrzeit „HH:MM“ */
  time: string
  frequency: ReminderFrequency
  /** Bei „alle 2 Wochen“: 0 oder 1 – verschiebt den Rhythmus um eine Woche */
  weekOffset: number
  durationMinutes: number
  /** IANA-Zeitzone, z. B. Europe/Berlin */
  timezone: string
  /** Aufgaben mit Wiedervorlage ebenfalls ins Abo */
  includeTasks: boolean
  /** Erledigte Aufgaben ausblenden oder mit „✓“ stehen lassen */
  doneTasks: 'hide' | 'mark'
}

export interface UserSettings {
  areas: Area[]
  destinations: Destination[]
  reminders: ReminderSettings
}

export interface Progress {
  id: string
  user_id: string
  area_id: string
  progress_type: ProgressType
  progress_value: string
  note: string | null
  updated_at: string
}

export interface CleaningSession {
  id: string
  user_id: string
  area_id: string
  finished_at: string
  duration_minutes: number
  deleted_count: number
  sorted_count: number
  quick_done_count: number
  progress_type: ProgressType
  progress_value: string
}

export interface CleaningTask {
  id: string
  user_id: string
  area_id: string | null
  title: string
  due_date: string | null
  status: TaskStatus
  created_at: string
  completed_at: string | null
  attachment_name: string | null
  attachment_key: string | null
  attachment_mime: string | null
  attachment_size: number | null
}

export interface WeeklyCheck {
  id: string
  user_id: string
  checked_at: string
  note: string | null
}

/** Alles, was zu einer Person gespeichert ist. */
export interface AppData {
  settings: UserSettings | null
  progress: Progress[]
  sessions: CleaningSession[]
  tasks: CleaningTask[]
  checks: WeeklyCheck[]
  /** Geheimer Teil des persönlichen Kalender-Abo-Links; null, solange keiner erzeugt wurde */
  calendarToken: string | null
}

export interface SessionCounts {
  deleted: number
  sorted: number
  quickDone: number
}

export interface TaskDraft {
  title: string
  dueDate: string
  areaId: string
  file: File | null
}

export type AppView = 'today' | 'areas' | 'tasks' | 'history' | 'settings'
export type SyncState = 'saved' | 'saving' | 'error'
