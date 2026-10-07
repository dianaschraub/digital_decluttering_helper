import { useEffect, useMemo, useState } from 'react'
import { CircleAlert, Cloud, History, LayoutGrid, ListChecks, LoaderCircle, LogOut, Timer } from 'lucide-react'
import { AREAS, MEMOS, findArea, suggestArea } from '../data'
import { createTask, completeTask, deleteTask, finishCleaningSession, loadAppData, openAttachment, saveWeeklyCheck } from '../lib/api'
import { logout } from '../lib/auth'
import { openCleaningCalendar, openTaskCalendar } from '../lib/calendar'
import { coveredPeriod, currentMonthIso, progressBoundary, todayIso } from '../lib/dates'
import type { CoveredPeriod } from '../lib/dates'
import { exportCsv } from '../lib/export'
import { formatClock, useCleaningSession } from '../hooks/useCleaningSession'
import type { AppView, CleaningSession, CleaningTask, Progress, ProgressType, SyncState, TaskDraft, WeeklyCheck } from '../types'
import { AreasView } from './AreasView'
import { HistoryView } from './HistoryView'
import { TasksView } from './TasksView'
import { TodayView } from './TodayView'
import { BrandMark, CenteredMessage, Modal, vibrate } from './ui'

const EMPTY_TASK: TaskDraft = { title: '', dueDate: '', areaId: '', file: null }
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const BASE_TITLE = 'Digital Cleaning'

export function CleaningApp() {
  const [view, setView] = useState<AppView>('today')
  const [progress, setProgress] = useState<Progress[]>([])
  const [sessions, setSessions] = useState<CleaningSession[]>([])
  const [tasks, setTasks] = useState<CleaningTask[]>([])
  const [checks, setChecks] = useState<WeeklyCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [sync, setSync] = useState<SyncState>('saved')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [finishOpen, setFinishOpen] = useState(false)
  const [finishRequested, setFinishRequested] = useState(false)
  const [timeUp, setTimeUp] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [memo, setMemo] = useState<{ text: string; covered: CoveredPeriod } | null>(null)
  const [progressType, setProgressType] = useState<ProgressType>('month')
  const [progressValue, setProgressValue] = useState(currentMonthIso())
  const [progressNote, setProgressNote] = useState('')
  // Freiwillige, grob geschätzte Zahlen – leer lassen ist ausdrücklich in Ordnung.
  const [roughDeleted, setRoughDeleted] = useState('')
  const [roughSorted, setRoughSorted] = useState('')
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(EMPTY_TASK)
  const [busy, setBusy] = useState(false)
  const [weeklyNote, setWeeklyNote] = useState('')

  const session = useCleaningSession(AREAS[0].id, (id) => Boolean(findArea(id)), () => {
    vibrate([200, 100, 200, 100, 400])
    setTimeUp(true)
    setNotice('Die 20 Minuten sind geschafft. Speichere jetzt deinen Stand.')
    setFinishRequested(true)
  })

  const selectedArea = findArea(session.areaId) ?? AREAS[0]
  const selectedProgress = progress.find((item) => item.area_id === selectedArea.id)
  const openTasks = tasks.filter((task) => task.status === 'open')
  const doneTasks = tasks.filter((task) => task.status === 'done')
  const today = todayIso()
  const dueTasks = openTasks.filter((task) => task.due_date && task.due_date <= today)
  const weeklyDue = !checks[0] || Date.now() - new Date(checks[0].checked_at).getTime() > WEEK_MS
  const focusArea = useMemo(() => suggestArea(progress), [progress])

  useEffect(() => {
    loadAppData()
      .then((data) => {
        setProgress(data.progress)
        setSessions(data.sessions)
        setTasks(data.tasks)
        setChecks(data.checks)
      })
      .catch((caught: Error) => { setError(caught.message); setSync('error') })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const clock = formatClock(session.remainingMs)
  useEffect(() => {
    document.title = session.running ? `${clock} · ${BASE_TITLE}` : timeUp ? `✓ Zeit um · ${BASE_TITLE}` : BASE_TITLE
  }, [clock, session.running, timeUp])

  function fillProgressForm(stored: Progress | undefined) {
    setProgressType(stored?.progress_type ?? 'month')
    setProgressValue(stored?.progress_value ?? currentMonthIso())
  }

  function openFinish() {
    fillProgressForm(selectedProgress)
    setFinishOpen(true)
  }

  // Ist die Zeit abgelaufen, während die App geschlossen war, öffnet sich der
  // Abschlussdialog, sobald die Daten geladen sind.
  useEffect(() => {
    if (!finishRequested || loading) return
    setFinishRequested(false)
    openFinish()
  })

  async function withSync<T>(action: () => Promise<T>, fallback: string): Promise<T | undefined> {
    setSync('saving')
    setError('')
    try {
      const result = await action()
      setSync('saved')
      return result
    } catch (caught) {
      setSync('error')
      setError(caught instanceof Error ? caught.message : fallback)
      return undefined
    }
  }

  function chooseArea(areaId: string) {
    setView('today')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (areaId === session.areaId) return
    if (session.progress > 0 && !window.confirm('Die laufende Einheit ist noch nicht gespeichert. Trotzdem den Bereich wechseln?')) return
    session.switchArea(areaId)
    setTimeUp(false)
    fillProgressForm(progress.find((item) => item.area_id === areaId))
  }

  const previousPoint = selectedProgress ? { type: selectedProgress.progress_type, value: selectedProgress.progress_value } : null
  const covered = progressValue ? coveredPeriod(previousPoint, { type: progressType, value: progressValue }) : null

  function roughNumber(value: string) {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }

  async function saveSession(event: React.FormEvent) {
    event.preventDefault()
    if (!progressValue) return
    if (selectedProgress && progressBoundary(progressType, progressValue) < progressBoundary(selectedProgress.progress_type, selectedProgress.progress_value)) {
      if (!window.confirm('Der neue Stand liegt vor dem bisher gespeicherten Stand. Möchtest du ihn wirklich rückwärts korrigieren?')) return
    }
    setBusy(true)
    const result = await withSync(() => finishCleaningSession({
      areaId: selectedArea.id,
      durationMinutes: session.elapsedMinutes,
      counts: { deleted: roughNumber(roughDeleted), sorted: roughNumber(roughSorted), quickDone: 0 },
      progressType,
      progressValue,
      note: progressNote,
    }), 'Der Stand konnte nicht gespeichert werden.')
    setBusy(false)
    if (!result) return
    setProgress((items) => [result.progress, ...items.filter((item) => item.area_id !== selectedArea.id)])
    setSessions((items) => [result.session, ...items])
    setFinishOpen(false)
    setProgressNote('')
    setRoughDeleted('')
    setRoughSorted('')
    setTimeUp(false)
    session.clear()
    const options = MEMOS[selectedArea.kind]
    setMemo({ text: options[Math.floor(Math.random() * options.length)], covered: coveredPeriod(previousPoint, { type: progressType, value: progressValue }) })
  }

  function openNewTask(areaId = selectedArea.id) {
    setTaskDraft({ ...EMPTY_TASK, areaId })
    setTaskOpen(true)
  }

  async function saveTask(event: React.FormEvent) {
    event.preventDefault()
    if (!taskDraft.title.trim()) return
    if (taskDraft.file && taskDraft.file.size > 4 * 1024 * 1024) {
      setError('Der Anhang darf höchstens 4 MB groß sein.')
      return
    }
    setBusy(true)
    const saved = await withSync(() => createTask(taskDraft), 'Die Aufgabe konnte nicht gespeichert werden.')
    setBusy(false)
    if (!saved) return
    setTasks((items) => [saved, ...items])
    setTaskOpen(false)
    setTaskDraft(EMPTY_TASK)
    setNotice('Die nächste Handlung ist gespeichert.')
  }

  async function toggleTask(task: CleaningTask) {
    const updated = await withSync(() => completeTask(task), 'Die Aufgabe konnte nicht geändert werden.')
    if (updated) setTasks((items) => items.map((item) => item.id === updated.id ? updated : item))
  }

  async function removeTask(task: CleaningTask) {
    if (!window.confirm(`„${task.title}“ wirklich löschen?`)) return
    const done = await withSync(async () => { await deleteTask(task); return true }, 'Die Aufgabe konnte nicht gelöscht werden.')
    if (done) setTasks((items) => items.filter((item) => item.id !== task.id))
  }

  async function finishWeeklyCheck() {
    setBusy(true)
    const saved = await withSync(() => saveWeeklyCheck(weeklyNote), 'Der Wochencheck konnte nicht gespeichert werden.')
    setBusy(false)
    if (!saved) return
    setChecks((items) => [saved, ...items])
    setWeeklyNote('')
    setNotice('Wochencheck erledigt.')
  }

  if (loading) return <CenteredMessage title="Digital Cleaning" text="Deine Daten werden geladen …" />

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-button" onClick={() => setView('today')}><BrandMark size="small" /><span>Digital Cleaning</span></button>
        <div className="top-actions">
          <SyncBadge state={sync} />
          <button className="icon-button" title="Abmelden" aria-label="Abmelden" onClick={() => logout()}><LogOut size={17} /></button>
        </div>
      </header>

      <main className="content">
        {error && <div className="error-banner" role="alert"><CircleAlert size={18} /><span>{error}</span><button onClick={() => setError('')} aria-label="Meldung schließen">×</button></div>}
        {notice && <div className="notice-banner" role="status">{notice}</div>}

        {view === 'today' && <TodayView
          focusArea={focusArea}
          selectedArea={selectedArea}
          selectedProgress={selectedProgress}
          clock={clock}
          timerProgress={session.progress}
          running={session.running}
          started={session.progress > 0}
          dueTasks={dueTasks}
          weeklyDue={weeklyDue}
          onChooseArea={chooseArea}
          onToggleTimer={() => {
            if (session.running) session.pause()
            else { setTimeUp(false); if (session.remainingMs <= 0) session.resetTimer(); session.start() }
          }}
          onResetTimer={() => { session.resetTimer(); setTimeUp(false) }}
          onNewTask={() => openNewTask()}
          onFinish={openFinish}
          onCalendar={() => openCleaningCalendar(`${selectedArea.title} (${selectedArea.subtitle})`)}
          onAttention={() => setView(dueTasks.length > 0 ? 'tasks' : 'history')}
        />}

        {view === 'areas' && <AreasView progress={progress} selectedAreaId={selectedArea.id} onChoose={chooseArea} />}

        {view === 'tasks' && <TasksView
          openTasks={openTasks}
          doneTasks={doneTasks}
          onNew={() => openNewTask('')}
          onToggle={toggleTask}
          onDelete={removeTask}
          onAttachment={openAttachment}
          onCalendar={openTaskCalendar}
        />}

        {view === 'history' && <HistoryView
          sessions={sessions}
          progress={progress}
          checks={checks}
          weeklyDue={weeklyDue}
          weeklyNote={weeklyNote}
          busy={busy}
          onWeeklyNote={setWeeklyNote}
          onWeeklyDone={finishWeeklyCheck}
          onExport={() => exportCsv({ progress, sessions, tasks, checks })}
        />}
      </main>

      <nav className="bottom-nav" aria-label="Hauptnavigation">
        <NavButton active={view === 'today'} icon={<Timer size={20} />} label="Heute" onClick={() => setView('today')} />
        <NavButton active={view === 'areas'} icon={<LayoutGrid size={20} />} label="Bereiche" onClick={() => setView('areas')} />
        <NavButton active={view === 'tasks'} icon={<ListChecks size={20} />} label="Aufgaben" badge={dueTasks.length} onClick={() => setView('tasks')} />
        <NavButton active={view === 'history'} icon={<History size={20} />} label="Verlauf" onClick={() => setView('history')} />
      </nav>

      {finishOpen && <Modal title="Einheit abschließen" onClose={() => setFinishOpen(false)}>
        <form onSubmit={saveSession} className="stack-form">
          <p className="modal-lead">Bis wohin hast du <strong>{selectedArea.title} · {selectedArea.subtitle}</strong> vollständig bearbeitet?</p>
          <div className="segment-control">
            <button type="button" className={progressType === 'month' ? 'active' : ''} onClick={() => { setProgressType('month'); setProgressValue(currentMonthIso()) }}>Monat</button>
            <button type="button" className={progressType === 'date' ? 'active' : ''} onClick={() => { setProgressType('date'); setProgressValue(todayIso()) }}>Genaues Datum</button>
          </div>
          <label>{progressType === 'month' ? 'Vollständig geprüft bis Monat' : 'Vollständig geprüft bis Datum'}
            <input type={progressType === 'month' ? 'month' : 'date'} value={progressValue} onChange={(event) => setProgressValue(event.target.value)} required />
          </label>
          <label>Notiz <span className="optional">optional</span><textarea value={progressNote} onChange={(event) => setProgressNote(event.target.value)} placeholder="Was ist beim nächsten Mal wichtig?" rows={2} /></label>
          {covered && <div className={`covered-preview ${covered.days > 0 ? '' : 'neutral'}`}>
            <span>Diese Einheit · {session.elapsedMinutes} Min.</span>
            <strong>{covered.days > 0 ? `${covered.amount} aufgeräumt` : covered.range}</strong>
            {covered.days > 0 && <small>{covered.range}</small>}
          </div>}
          <details className="rough-counts">
            <summary>Zahlen ergänzen <span className="optional">freiwillig, grob geschätzt</span></summary>
            <div className="rough-grid">
              <label>ca. gelöscht<input type="number" inputMode="numeric" min={0} value={roughDeleted} onChange={(event) => setRoughDeleted(event.target.value)} placeholder="–" /></label>
              <label>ca. {selectedArea.kind === 'email' ? 'archiviert' : 'einsortiert'}<input type="number" inputMode="numeric" min={0} value={roughSorted} onChange={(event) => setRoughSorted(event.target.value)} placeholder="–" /></label>
            </div>
          </details>
          <button className="button primary full" disabled={busy}>{busy ? 'Wird gespeichert …' : 'Stand speichern'}</button>
        </form>
      </Modal>}

      {taskOpen && <Modal title="Nächste Handlung notieren" onClose={() => setTaskOpen(false)}>
        <form onSubmit={saveTask} className="stack-form">
          <label>Was ist die nächste konkrete Handlung?<input value={taskDraft.title} onChange={(event) => setTaskDraft((draft) => ({ ...draft, title: event.target.value }))} placeholder="z. B. Vertrag prüfen und antworten" required autoFocus /></label>
          <label>Wiedervorlage <span className="optional">optional</span><input type="date" value={taskDraft.dueDate} onChange={(event) => setTaskDraft((draft) => ({ ...draft, dueDate: event.target.value }))} /></label>
          <label>Gehört zu <select value={taskDraft.areaId} onChange={(event) => setTaskDraft((draft) => ({ ...draft, areaId: event.target.value }))}><option value="">Kein bestimmter Bereich</option>{AREAS.map((area) => <option key={area.id} value={area.id}>{area.title} · {area.subtitle}</option>)}</select></label>
          <label className="file-field">Bild oder Datei <span className="optional">optional, maximal 4 MB</span><input type="file" onChange={(event) => setTaskDraft((draft) => ({ ...draft, file: event.target.files?.[0] ?? null }))} /></label>
          <button className="button primary full" disabled={busy}>{busy ? 'Wird gespeichert …' : 'Handlung speichern'}</button>
        </form>
      </Modal>}

      {memo && <Modal title="Gut gemacht" onClose={() => setMemo(null)} compact>
        {memo.covered.days > 0 && <p className="memo-covered"><strong>{memo.covered.amount} aufgeräumt</strong><span>{memo.covered.range}</span></p>}
        <blockquote>{memo.text}</blockquote>
        <button className="button primary full" onClick={() => setMemo(null)}>Verstanden</button>
      </Modal>}
    </div>
  )
}

function SyncBadge({ state }: { state: SyncState }) {
  if (state === 'saving') return <span className="sync-state saving"><LoaderCircle size={14} className="spin" /> wird gespeichert</span>
  if (state === 'error') return <span className="sync-state error"><CircleAlert size={14} /> nicht gespeichert</span>
  return <span className="sync-state"><Cloud size={14} /> gespeichert</span>
}

function NavButton({ active, icon, label, badge, onClick }: { active: boolean; icon: React.ReactNode; label: string; badge?: number; onClick: () => void }) {
  return (
    <button className={active ? 'active' : ''} onClick={onClick} aria-current={active ? 'page' : undefined}>
      <span className="nav-icon">{icon}{Boolean(badge) && <i aria-label={`${badge} fällig`}>{badge}</i>}</span>
      <small>{label}</small>
    </button>
  )
}
