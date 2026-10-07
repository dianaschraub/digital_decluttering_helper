import { useState } from 'react'
import { CalendarPlus, Check, ChevronDown, ChevronRight, Paperclip, Plus, X } from 'lucide-react'
import { findArea } from '../data'
import { formatDate, todayIso } from '../lib/dates'
import type { CleaningTask } from '../types'

interface TaskHandlers {
  onToggle: (task: CleaningTask) => void
  onDelete: (task: CleaningTask) => void
  onAttachment: (task: CleaningTask) => void
  onCalendar: (task: CleaningTask) => void
}

export function TasksView({ openTasks, doneTasks, onNew, ...handlers }: TaskHandlers & {
  openTasks: CleaningTask[]
  doneTasks: CleaningTask[]
  onNew: () => void
}) {
  const [showDone, setShowDone] = useState(false)
  // Fällige zuerst, dann nach Wiedervorlage, Aufgaben ohne Termin zuletzt.
  const sortedOpen = [...openTasks].sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
  return (
    <section>
      <div className="page-heading">
        <div><p className="eyebrow">GTD · Nächste Handlungen</p><h1>Aufgaben & Wiedervorlagen</h1><p>Was länger als zwei Minuten dauert, bekommt eine konkrete nächste Handlung.</p></div>
        <button className="button primary" onClick={onNew}><Plus size={17} /> Neue Aufgabe</button>
      </div>
      <div className="task-list">
        {sortedOpen.length === 0 && <div className="empty-state"><span><Check size={22} /></span><h3>Keine offenen Aufgaben</h3><p>Alles geklärt – oder bereit für die nächste Cleaning-Einheit.</p></div>}
        {sortedOpen.map((task) => <TaskRow key={task.id} task={task} {...handlers} />)}
      </div>
      {doneTasks.length > 0 && <div className="done-section">
        <button className="done-toggle" onClick={() => setShowDone((value) => !value)} aria-expanded={showDone}>
          {showDone ? <ChevronDown size={16} /> : <ChevronRight size={16} />} Erledigt ({doneTasks.length})
        </button>
        {showDone && <div className="task-list done-list">{doneTasks.map((task) => <TaskRow key={task.id} task={task} {...handlers} />)}</div>}
      </div>}
    </section>
  )
}

function TaskRow({ task, onToggle, onDelete, onAttachment, onCalendar }: TaskHandlers & { task: CleaningTask }) {
  const today = todayIso()
  const open = task.status === 'open'
  const overdue = open && task.due_date && task.due_date < today
  const dueToday = open && task.due_date === today
  const area = findArea(task.area_id)
  return (
    <article className={`task-row ${open ? '' : 'done'}`}>
      <button className="check-button" onClick={() => onToggle(task)} aria-label={open ? 'Als erledigt markieren' : 'Wieder öffnen'}>{!open && <Check size={16} strokeWidth={3} />}</button>
      <div className="task-main">
        <strong>{task.title}</strong>
        <div className="task-meta">
          {area && <span>{area.title} · {area.subtitle}</span>}
          <span className={overdue ? 'overdue' : dueToday ? 'due-today' : ''}>{task.due_date ? `${overdue ? 'Überfällig · ' : dueToday ? 'Heute · ' : ''}${formatDate(task.due_date)}` : 'Keine Wiedervorlage'}</span>
          {task.attachment_name && <button onClick={() => onAttachment(task)}><Paperclip size={12} /> {task.attachment_name}</button>}
        </div>
      </div>
      <div className="task-actions">
        {open && <button className="icon-button" onClick={() => onCalendar(task)} title="In Google Kalender eintragen" aria-label="In Google Kalender eintragen"><CalendarPlus size={16} /></button>}
        <button className="icon-button danger" onClick={() => onDelete(task)} title="Aufgabe löschen" aria-label="Aufgabe löschen"><X size={16} /></button>
      </div>
    </article>
  )
}
