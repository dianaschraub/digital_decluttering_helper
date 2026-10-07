import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Bell, CalendarPlus, CheckCheck, FolderInput, Pause, Play, Plus, RotateCcw, Trash2, Undo2 } from 'lucide-react'
import { AREAS } from '../data'
import { backlogDays, formatBacklog, formatProgress, nextProgressLabel } from '../lib/dates'
import type { Area, CleaningTask, Progress, SessionCounts } from '../types'
import { AreaSign, TimerRing } from './ui'

export function TodayView(props: {
  focusArea: Area
  selectedArea: Area
  selectedProgress?: Progress
  clock: string
  timerProgress: number
  running: boolean
  started: boolean
  counts: SessionCounts
  canUndo: boolean
  dueTasks: CleaningTask[]
  weeklyDue: boolean
  onChooseArea: (id: string) => void
  onToggleTimer: () => void
  onResetTimer: () => void
  onDelete: () => void
  onSort: () => void
  onQuickDone: () => void
  onUndo: () => void
  onNewTask: () => void
  onFinish: () => void
  onCalendar: () => void
  onAttention: () => void
}) {
  const { selectedArea, selectedProgress, counts } = props
  const isEmail = selectedArea.kind === 'email'
  const timerRef = useRef<HTMLDivElement>(null)
  const [timerVisible, setTimerVisible] = useState(true)

  // Auf dem Handy erscheint ein kleiner mitlaufender Timer, sobald der große aus dem Bild scrollt.
  useEffect(() => {
    const element = timerRef.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    // Gilt als sichtbar, solange mindestens die Hälfte des Rings unterhalb der Kopfleiste zu sehen ist.
    const observer = new IntersectionObserver(([entry]) => setTimerVisible(entry.intersectionRatio >= 0.5), { rootMargin: '-72px 0px 0px 0px', threshold: [0, 0.5, 1] })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const backlog = selectedProgress ? backlogDays(selectedProgress.progress_type, selectedProgress.progress_value) : null
  const focusIsSelected = props.focusArea.id === selectedArea.id

  return (
    <>
      <section className="hero-row">
        <div><p className="eyebrow">Heute</p><h1>Was ist jetzt dran?</h1><p>Eine ruhige Einheit. Eine Datei nach der anderen.</p></div>
        <button className="focus-card" onClick={() => props.onChooseArea(props.focusArea.id)} disabled={focusIsSelected}>
          <AreaSign area={props.focusArea} size="small" />
          <span className="focus-text">
            <span className="focus-label">{focusIsSelected ? 'Vorschlag · ausgewählt' : 'Vorschlag'}</span>
            <strong>{props.focusArea.title}</strong>
            <small>{props.focusArea.subtitle} · {props.focusArea.rhythm}</small>
          </span>
          {!focusIsSelected && <ArrowRight className="focus-arrow" size={20} />}
        </button>
      </section>

      {(props.weeklyDue || props.dueTasks.length > 0) && <section className="attention-strip">
        <span className="attention-icon"><Bell size={16} /></span>
        <div>
          <strong>{props.dueTasks.length > 0 ? `${props.dueTasks.length} Aufgabe${props.dueTasks.length === 1 ? '' : 'n'} fällig` : 'Kurzer Wochencheck'}</strong>
          <p>{props.dueTasks.length > 0 ? 'Sieh deine nächsten Handlungen und Wiedervorlagen durch.' : 'Gibt es Dateien, E-Mails oder Sicherungen ohne Entscheidung?'}</p>
        </div>
        <button onClick={props.onAttention}>{props.dueTasks.length > 0 ? 'Zu den Aufgaben' : 'Zum Wochencheck'}</button>
      </section>}

      <section className="workspace-card">
        <div className="workspace-heading">
          <AreaSign area={selectedArea} />
          <div>
            <p className="eyebrow">Aktuelle Einheit</p>
            <h2>{selectedArea.title} <span>{selectedArea.subtitle}</span></h2>
            <p>{selectedProgress ? `Vollständig bis ${formatProgress(selectedProgress.progress_type, selectedProgress.progress_value)} · ${formatBacklog(backlog)}` : 'Noch kein Stand gespeichert'}</p>
          </div>
          <select value={selectedArea.id} onChange={(event) => props.onChooseArea(event.target.value)} aria-label="Bereich auswählen">{AREAS.map((area) => <option key={area.id} value={area.id}>{area.title} · {area.subtitle}</option>)}</select>
        </div>

        <div className="work-grid">
          <div className="timer-panel">
            <span className="timer-label">20-Minuten-Einheit</span>
            <div ref={timerRef}><TimerRing progress={props.timerProgress} label={props.clock} running={props.running} /></div>
            <p>{nextProgressLabel(selectedProgress?.progress_type ?? 'month', selectedProgress?.progress_value ?? '')}</p>
            <div className="timer-actions">
              <button className="button primary" onClick={props.onToggleTimer}>
                {props.running ? <><Pause size={17} /> Pause</> : <><Play size={17} /> {props.started && props.timerProgress < 1 ? 'Weiter' : 'Starten'}</>}
              </button>
              <button className="button ghost" onClick={props.onResetTimer} disabled={!props.started} aria-label="Timer zurücksetzen"><RotateCcw size={17} /></button>
            </div>
            <button className="calendar-link" onClick={props.onCalendar}><CalendarPlus size={14} /> In Google Kalender planen</button>
          </div>

          <div className="decision-panel">
            <h3>{isEmail ? 'Was braucht diese E-Mail?' : 'Was soll mit dieser Datei geschehen?'}</h3>
            <div className="decision-buttons">
              <button className="decision delete" onClick={props.onDelete}><span><Trash2 size={22} /></span><strong>Löschen</strong><small>nicht mehr nötig</small></button>
              <button className="decision sort" onClick={props.onSort}><span><FolderInput size={22} /></span><strong>{isEmail ? 'Archivieren' : 'Einsortieren'}</strong><small>an den richtigen Ort</small></button>
            </div>
            {isEmail && <div className="email-actions">
              <button onClick={props.onQuickDone}><CheckCheck size={20} /><div><strong>Unter 2 Minuten erledigt</strong><small>direkt beantworten oder ausführen</small></div></button>
              <button onClick={props.onNewTask}><Plus size={20} /><div><strong>Nächste Handlung</strong><small>Aufgabe, Wiedervorlage und Anhang</small></div></button>
            </div>}
            <div className="counter-row">
              <span><b key={`d${counts.deleted}`}>{counts.deleted}</b> gelöscht</span>
              <span><b key={`s${counts.sorted}`}>{counts.sorted}</b> einsortiert</span>
              {isEmail && <span><b key={`q${counts.quickDone}`}>{counts.quickDone}</b> erledigt</span>}
              <button className="undo-button" onClick={props.onUndo} disabled={!props.canUndo}><Undo2 size={15} /> Rückgängig</button>
            </div>
            <button className="button dark full" onClick={props.onFinish}>Einheit abschließen & Stand speichern</button>
          </div>
        </div>
      </section>

      {props.running && !timerVisible && <div className="floating-timer" role="timer">
        <span className="floating-dot" />
        <strong>{props.clock}</strong>
        <button onClick={props.onToggleTimer} aria-label="Timer pausieren"><Pause size={16} /></button>
      </div>}
    </>
  )
}
