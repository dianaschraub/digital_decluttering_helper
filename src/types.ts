export type AreaKind = 'files' | 'email'
export type AreaIconName = 'photos' | 'screenshots' | 'downloads' | 'mail'
export type ProgressType = 'month' | 'date'
export type TaskStatus = 'open' | 'done'
export type Decision = 'deleted' | 'sorted' | 'quickDone'

export interface Area {
  id: string
  title: string
  subtitle: string
  group: string
  icon: AreaIconName
  kind: AreaKind
  rhythm: string
  intervalDays: number
  color: string
}

export interface Destination {
  id: string
  label: string
  note: string
  kinds: AreaKind[]
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

export type AppView = 'today' | 'areas' | 'tasks' | 'history'
export type SyncState = 'saved' | 'saving' | 'error'
