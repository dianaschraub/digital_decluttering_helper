import { Check, Download } from 'lucide-react'
import { AREAS, findArea } from '../data'
import { formatDate, formatProgress } from '../lib/dates'
import type { CleaningSession, Progress, WeeklyCheck } from '../types'
import { AreaSign } from './ui'

export function HistoryView(props: {
  sessions: CleaningSession[]
  progress: Progress[]
  checks: WeeklyCheck[]
  weeklyDue: boolean
  weeklyNote: string
  busy: boolean
  onWeeklyNote: (value: string) => void
  onWeeklyDone: () => void
  onExport: () => void
}) {
  const totalMinutes = props.sessions.reduce((sum, session) => sum + session.duration_minutes, 0)
  const totalDecisions = props.sessions.reduce((sum, session) => sum + session.deleted_count + session.sorted_count + session.quick_done_count, 0)
  return (
    <section>
      <div className="page-heading">
        <div><p className="eyebrow">Rückblick & Sicherung</p><h1>Verlauf</h1><p>Deine gespeicherten Stände und erledigten Einheiten.</p></div>
        <button className="button secondary" onClick={props.onExport}><Download size={17} /> CSV-Sicherung</button>
      </div>
      <div className="stats-grid">
        <div><span>{props.sessions.length}</span><small>Einheiten</small></div>
        <div><span>{totalMinutes}</span><small>Minuten</small></div>
        <div><span>{totalDecisions}</span><small>Entscheidungen</small></div>
        <div><span>{props.progress.length}/{AREAS.length}</span><small>Bereiche begonnen</small></div>
      </div>

      <section className={`weekly-card ${props.weeklyDue ? 'due' : ''}`}>
        <div><p className="eyebrow">Wöchentlicher Kontrollhinweis</p><h2>{props.weeklyDue ? 'Zeit für den kurzen Wochencheck' : 'Wochencheck ist aktuell'}</h2><p>Gibt es noch E-Mails, Dateien, Aufgaben oder Sicherungen, bei denen eine Entscheidung fehlt?</p></div>
        {props.weeklyDue
          ? <div className="weekly-action"><input value={props.weeklyNote} onChange={(event) => props.onWeeklyNote(event.target.value)} placeholder="Kurze Notiz (optional)" aria-label="Notiz zum Wochencheck" /><button className="button primary" onClick={props.onWeeklyDone} disabled={props.busy}><Check size={17} /> Check erledigt</button></div>
          : <span className="last-check">Zuletzt: {formatDate(props.checks[0]?.checked_at, true)}</span>}
      </section>

      <div className="history-list">
        <h2>Letzte Cleaning-Einheiten</h2>
        {props.sessions.length === 0 && <p className="muted">Noch keine Einheit gespeichert.</p>}
        {props.sessions.map((session) => {
          const area = findArea(session.area_id)
          return (
            <article key={session.id}>
              {area && <AreaSign area={area} size="small" />}
              <div>
                <strong>{area?.title ?? session.area_id} <small>{area?.subtitle}</small></strong>
                <p>{formatDate(session.finished_at, true)} · bis {formatProgress(session.progress_type, session.progress_value)} · {session.duration_minutes} Min.</p>
              </div>
              <div className="history-counts">
                <span>{session.deleted_count} gelöscht</span>
                <span>{session.sorted_count} einsortiert</span>
                {session.quick_done_count > 0 && <span>{session.quick_done_count} erledigt</span>}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
