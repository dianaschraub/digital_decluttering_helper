import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Bell, CalendarPlus, FolderInput, ListPlus, Pause, Play, RotateCcw, Trash2, Zap } from 'lucide-react'
import { destinationsFor } from '../data'
import { rhythmLabel } from '../lib/settingsSchema'
import { useSettings } from '../lib/settingsContext'
import { areaPoint, backlogDays, formatBacklog, formatProgress, nextProgressLabel } from '../lib/dates'
import type { Area, CleaningTask, Progress } from '../types'
import { AreaSign, TimerRing } from './ui'

const WHERE_TO_WORK: Record<Area['icon'], string> = {
  photos: 'die Galerie',
  screenshots: 'das Screenshot-Album',
  downloads: 'den Downloads-Ordner',
  videos: 'die Galerie',
  desktop: 'den Desktop',
  documents: 'den Dokumente-Ordner',
  other: 'den Ordner',
  mail: 'dein Postfach',
}

export function TodayView(props: {
  focusArea: Area
  selectedArea: Area
  selectedProgress?: Progress
  clock: string
  timerProgress: number
  running: boolean
  started: boolean
  dueTasks: CleaningTask[]
  weeklyDue: boolean
  onChooseArea: (id: string) => void
  onToggleTimer: () => void
  onResetTimer: () => void
  onNewTask: () => void
  onFinish: () => void
  onCalendar: () => void
  onAttention: () => void
}) {
  const { selectedArea, selectedProgress } = props
  const { activeAreas, destinations } = useSettings()
  const places = destinationsFor(destinations, selectedArea.kind)
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

  const point = areaPoint(selectedProgress, selectedArea.startMonth)
  const backlog = point ? backlogDays(point.type, point.value) : null
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
            <small>{props.focusArea.subtitle} · {rhythmLabel(props.focusArea.intervalDays)}</small>
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
            <p>{selectedProgress ? `Vollständig bis ${formatProgress(selectedProgress.progress_type, selectedProgress.progress_value)} · ${formatBacklog(backlog)}` : selectedArea.startMonth ? `Noch nicht begonnen · Daten ab ${formatProgress('month', selectedArea.startMonth)} · ${formatBacklog(backlog)}` : 'Noch kein Stand gespeichert'}</p>
          </div>
          <select value={selectedArea.id} onChange={(event) => props.onChooseArea(event.target.value)} aria-label="Bereich auswählen">{activeAreas.map((area) => <option key={area.id} value={area.id}>{area.title} · {area.subtitle}</option>)}</select>
        </div>

        <div className="work-grid">
          <div className="timer-panel">
            <span className="timer-label">20-Minuten-Einheit</span>
            <div ref={timerRef}><TimerRing progress={props.timerProgress} label={props.clock} running={props.running} /></div>
            <p>{nextProgressLabel(selectedProgress?.progress_type ?? 'month', selectedProgress?.progress_value ?? '', selectedArea.startMonth)}</p>
            <div className="timer-actions">
              <button className="button primary" onClick={props.onToggleTimer}>
                {props.running ? <><Pause size={17} /> Pause</> : <><Play size={17} /> {props.started && props.timerProgress < 1 ? 'Weiter' : 'Starten'}</>}
              </button>
              <button className="button ghost" onClick={props.onResetTimer} disabled={!props.started} aria-label="Timer zurücksetzen"><RotateCcw size={17} /></button>
            </div>
            <button className="calendar-link" onClick={props.onCalendar}><CalendarPlus size={14} /> In Google Kalender planen</button>
          </div>

          <div className="guide-panel">
            <h3>{isEmail ? 'Für jede E-Mail kurz entscheiden' : 'Für jede Datei kurz entscheiden'}</h3>
            <p className="guide-lead">Öffne {WHERE_TO_WORK[selectedArea.icon]} und starte mit dem Ältesten.</p>
            <ol className="guide-steps">
              <li>
                <span className="guide-icon delete"><Trash2 size={18} /></span>
                <div><strong>Nicht mehr nötig? Löschen.</strong><small>{isEmail ? 'Newsletter, Werbung, erledigte Vorgänge' : 'Doppelte, unscharfe oder erledigte Dateien'}</small></div>
              </li>
              <li>
                <span className="guide-icon sort"><FolderInput size={18} /></span>
                <div>
                  <strong>{isEmail ? 'Zum Nachschlagen behalten? Archivieren.' : 'Behalten? An genau einen Ort.'}</strong>
                  {places.length > 0
                    ? <span className="guide-chips">{places.map((destination) => <span key={destination.id} title={destination.note}>{destination.label}</span>)}</span>
                    : <small>Lege deine Ablageorte in den Einstellungen fest.</small>}
                </div>
              </li>
              {isEmail && <li>
                <span className="guide-icon quick"><Zap size={18} /></span>
                <div><strong>Unter 2 Minuten? Sofort erledigen.</strong><small>Antworten, weiterleiten, bestätigen – dann archivieren</small></div>
              </li>}
              <li>
                <span className="guide-icon task"><ListPlus size={18} /></span>
                <div>
                  <strong>Dauert länger? Nächste Handlung notieren.</strong>
                  <small>{isEmail ? 'Mit Wiedervorlage – danach ist die Mail aus dem Eingang' : 'Etwa Rechnung bezahlen oder Formular ausfüllen'}</small>
                  <button className="guide-action" onClick={props.onNewTask}>Nächste Handlung notieren</button>
                </div>
              </li>
            </ol>
            {!isEmail && <p className="small muted guide-note">Eine Sicherungskopie ist kein Ablageort – sie erhält nur Kopien deiner Hauptablage.</p>}
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
