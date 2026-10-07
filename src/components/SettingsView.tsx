import { useMemo, useState } from 'react'
import { CalendarClock, CalendarPlus, Copy, Download, Pause, Pencil, Play, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { calendarFeedUrl, describeSeries, downloadSeriesIcs, openSeriesInGoogle } from '../lib/calendar'
import { planSlots } from '../lib/schedule'
import { AREA_TYPES, EMAIL_COLORS, FREQUENCIES, MAX_AREAS, MAX_DESTINATIONS, RHYTHMS, WEEKDAYS, WEEKDAY_ORDER, areaType, makeId, rhythmLabel } from '../lib/settingsSchema'
import type { Area, AreaIconName, AreaKind, Destination, Progress, ReminderSettings, UserSettings } from '../types'
import { AreaSign } from './ui'

const DURATIONS = [15, 20, 30, 45, 60]
const slotFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Wie viele Termine pro Monat bräuchten die aktiven Bereiche – und wie viele gibt es? */
function capacity(reminders: ReminderSettings, areas: Area[]) {
  const needed = areas.filter((area) => area.status === 'active').reduce((sum, area) => sum + 30.4 / area.intervalDays, 0)
  const perWeek = reminders.weekdays.length
  const available = reminders.frequency === 'weekly' ? perWeek * 4.35 : reminders.frequency === 'biweekly' ? perWeek * 2.17 : perWeek
  return { needed: Math.round(needed), available: Math.round(available) }
}

export function SettingsView(props: {
  settings: UserSettings
  progress: Progress[]
  email: string
  calendarToken: string | null
  busy: boolean
  onSave: (settings: UserSettings) => Promise<boolean>
  onCalendarToken: (reset: boolean) => void
  onNotice: (message: string) => void
  onLogout: () => void
  onDeleteAccount: () => void
}) {
  const [draft, setDraft] = useState<UserSettings>(props.settings)
  const [editingArea, setEditingArea] = useState<string | null>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(props.settings)
  const reminders = draft.reminders
  const visibleAreas = draft.areas.filter((area) => area.status !== 'removed')
  const groups = [...new Set(visibleAreas.map((area) => area.group))]
  const activeCount = draft.areas.filter((area) => area.status === 'active').length
  const plan = useMemo(() => planSlots(reminders, draft.areas, props.progress, Date.now(), 4), [reminders, draft.areas, props.progress])
  const load = capacity(reminders, draft.areas)

  function setReminders(change: Partial<ReminderSettings>) {
    setDraft((current) => ({ ...current, reminders: { ...current.reminders, ...change } }))
  }

  function updateArea(id: string, change: Partial<Area>) {
    setDraft((current) => ({ ...current, areas: current.areas.map((area) => area.id === id ? { ...area, ...change } : area) }))
  }

  function setAreaStatus(area: Area, status: Area['status']) {
    if (status !== 'active' && area.status === 'active' && activeCount <= 1) {
      props.onNotice('Mindestens ein Bereich muss aktiv bleiben.')
      return
    }
    if (status === 'removed' && !window.confirm(`„${area.title}“ entfernen? Dein bisheriger Verlauf bleibt erhalten.`)) return
    updateArea(area.id, { status })
  }

  function updateDestination(id: string, change: Partial<Destination>) {
    setDraft((current) => ({ ...current, destinations: current.destinations.map((item) => item.id === id ? { ...item, ...change } : item) }))
  }

  function toggleDestinationKind(destination: Destination, kind: AreaKind) {
    const kinds = destination.kinds.includes(kind) ? destination.kinds.filter((item) => item !== kind) : [...destination.kinds, kind]
    if (kinds.length) updateDestination(destination.id, { kinds })
  }

  async function save() {
    if (await props.onSave(draft)) setEditingArea(null)
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      props.onNotice('Link kopiert.')
    } catch {
      window.prompt('Link zum Kopieren:', url)
    }
  }

  const feedUrl = props.calendarToken ? calendarFeedUrl(props.calendarToken) : null
  const webcalUrl = feedUrl?.replace(/^https?:/, 'webcal:')

  return (
    <section className="settings-page">
      <div className="page-heading"><div><p className="eyebrow">Einstellungen</p><h1>Deine App</h1><p>Bereiche, Ablageorte und Erinnerungen so, wie es zu dir passt.</p></div></div>

      {/* ---------- Erinnerungen ---------- */}
      <section className="settings-card">
        <header><CalendarClock size={20} /><div><h2>Erinnerungen im Kalender</h2><p>Die App plant Aufräum-Termine und trägt sie über ein Kalender-Abo automatisch ein.</p></div></header>

        <label className="switch-row"><input type="checkbox" checked={reminders.enabled} onChange={(event) => setReminders({ enabled: event.target.checked })} /><span>Aufräum-Termine planen</span></label>

        {reminders.enabled && <>
          <div className="field-label">An welchen Tagen?</div>
          <div className="choice-chips compact">
            {WEEKDAY_ORDER.map((day) => {
              const active = reminders.weekdays.includes(day)
              return <button key={day} type="button" className={active ? 'active' : ''} aria-pressed={active} onClick={() => {
                const weekdays = active ? reminders.weekdays.filter((item) => item !== day) : [...reminders.weekdays, day].sort()
                if (weekdays.length) setReminders({ weekdays })
              }}>{WEEKDAYS[day].slice(0, 2)}</button>
            })}
          </div>
          <div className="field-row">
            <label>Wie oft?<select value={reminders.frequency} onChange={(event) => setReminders({ frequency: event.target.value as ReminderSettings['frequency'] })}>{FREQUENCIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label>Uhrzeit<input type="time" value={reminders.time} onChange={(event) => event.target.value && setReminders({ time: event.target.value })} /></label>
            <label>Dauer<select value={reminders.durationMinutes} onChange={(event) => setReminders({ durationMinutes: Number(event.target.value) })}>{DURATIONS.map((minutes) => <option key={minutes} value={minutes}>{minutes} Minuten</option>)}</select></label>
          </div>
          {reminders.frequency === 'biweekly' && <label className="inline-select">Beginnen
            <select value={reminders.weekOffset} onChange={(event) => setReminders({ weekOffset: Number(event.target.value) })}>
              {[0, 1].map((offset) => {
                const first = planSlots({ ...reminders, weekOffset: offset }, draft.areas, props.progress, Date.now(), 1)[0]
                return <option key={offset} value={offset}>{first ? `ab ${slotFormat.format(first.start)}` : `Variante ${offset + 1}`}</option>
              })}
            </select>
          </label>}
          {reminders.frequency === 'monthly' && <p className="small muted">Der Termin liegt jeweils am ersten gewählten Wochentag des Monats.</p>}

          {plan.length > 0 && <div className="plan-preview">
            <div className="field-label">Deine nächsten Termine</div>
            <ul>{plan.map((slot) => <li key={slot.localDate}><span>{slotFormat.format(slot.start)}</span><AreaSign area={slot.area} size="small" /><strong>{slot.area.title}</strong><small>{slot.area.subtitle}</small></li>)}</ul>
            {load.available < load.needed && <p className="hint-box">Für deine {activeCount} Bereiche bräuchtest du etwa {load.needed} Termine im Monat, geplant sind {load.available}. Wähle mehr Wochentage oder längere Rhythmen bei den Bereichen – sonst kommen manche seltener dran.</p>}
          </div>}
        </>}

        <label className="switch-row"><input type="checkbox" checked={reminders.includeTasks} onChange={(event) => setReminders({ includeTasks: event.target.checked })} /><span>Aufgaben mit Wiedervorlage ebenfalls eintragen</span></label>
        {reminders.includeTasks && <label className="inline-select">Erledigte Aufgaben
          <select value={reminders.doneTasks} onChange={(event) => setReminders({ doneTasks: event.target.value === 'mark' ? 'mark' : 'hide' })}>
            <option value="hide">aus dem Kalender entfernen</option>
            <option value="mark">mit ✓ stehen lassen</option>
          </select>
        </label>}

        <div className="subscribe-box">
          <h3>Kalender-Abo</h3>
          {!feedUrl ? <>
            <p>Einmal abonnieren – danach erscheinen neue Termine automatisch. Funktioniert mit Google Kalender, Apple Kalender und Outlook.</p>
            <button type="button" className="button secondary" onClick={() => props.onCalendarToken(false)} disabled={props.busy}><CalendarPlus size={17} /> Abo-Link erstellen</button>
          </> : <>
            <div className="link-field"><input readOnly value={feedUrl} aria-label="Abo-Link" onFocus={(event) => event.target.select()} /><button type="button" className="icon-button" onClick={() => copyLink(feedUrl)} aria-label="Link kopieren" title="Link kopieren"><Copy size={16} /></button></div>
            <div className="subscribe-actions">
              <a className="button secondary" href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl ?? '')}`} target="_blank" rel="noopener noreferrer">In Google Kalender abonnieren</a>
              <a className="button ghost" href={webcalUrl}>Apple Kalender / Outlook</a>
            </div>
            <ul className="small muted help-list">
              <li>Google Kalender: Das Abonnieren klappt nur im Browser (calendar.google.com), nicht in der Handy-App. Danach erscheinen die Termine auch dort.</li>
              <li>Google aktualisiert Abos nur alle paar Stunden – Änderungen und erledigte Aufgaben erscheinen also mit Verzögerung.</li>
              <li>Der Link ist dein persönlicher Schlüssel. Teile ihn nicht.</li>
            </ul>
            <button type="button" className="text-button subtle" onClick={() => { if (window.confirm('Neuen Link erstellen? Der alte Link funktioniert danach nicht mehr – du musst den Kalender neu abonnieren.')) props.onCalendarToken(true) }}><RefreshCw size={14} /> Link erneuern</button>
          </>}
          {dirty && <p className="small warn-text">Speichere deine Änderungen, damit das Abo sie übernimmt.</p>}
        </div>

        <div className="series-box">
          <h3>Lieber ein fester Serientermin?</h3>
          <p>Ein einmal angelegter Termin {describeSeries(reminders)}. Er passt sich danach nicht mehr an und nennt keinen Bereich – welcher dran ist, siehst du dann in der App unter „Heute“.</p>
          <div className="subscribe-actions">
            <button type="button" className="button ghost" onClick={() => openSeriesInGoogle(reminders)}><CalendarPlus size={16} /> In Google Kalender anlegen</button>
            <button type="button" className="button ghost" onClick={() => downloadSeriesIcs(reminders)}><Download size={16} /> Als Datei (Apple, Outlook)</button>
          </div>
        </div>
      </section>

      {/* ---------- Bereiche ---------- */}
      <section className="settings-card">
        <header><Pencil size={20} /><div><h2>Bereiche</h2><p>Was du aufräumst. Pausierte Bereiche erscheinen weder unter „Heute“ noch im Kalender.</p></div></header>
        {groups.map((group) => <div key={group} className="settings-group">
          <div className="field-label">{group}</div>
          {visibleAreas.filter((area) => area.group === group).map((area) => editingArea === area.id
            ? <AreaEditor key={area.id} area={area} groups={groups} onChange={(change) => updateArea(area.id, change)} onClose={() => setEditingArea(null)} />
            : <div key={area.id} className={`settings-row ${area.status === 'paused' ? 'paused' : ''}`}>
              <AreaSign area={area} size="small" />
              <div className="settings-row-main"><strong>{area.title}</strong><small>{area.subtitle} · {rhythmLabel(area.intervalDays)}{area.status === 'paused' ? ' · pausiert' : ''}</small></div>
              <div className="row-actions">
                <button type="button" className="icon-button small" onClick={() => setEditingArea(area.id)} aria-label={`${area.title} bearbeiten`} title="Bearbeiten"><Pencil size={14} /></button>
                {area.status === 'active'
                  ? <button type="button" className="icon-button small" onClick={() => setAreaStatus(area, 'paused')} aria-label={`${area.title} pausieren`} title="Pausieren"><Pause size={14} /></button>
                  : <button type="button" className="icon-button small" onClick={() => setAreaStatus(area, 'active')} aria-label={`${area.title} fortsetzen`} title="Fortsetzen"><Play size={14} /></button>}
                <button type="button" className="icon-button small danger" onClick={() => setAreaStatus(area, 'removed')} aria-label={`${area.title} entfernen`} title="Entfernen"><Trash2 size={14} /></button>
              </div>
            </div>)}
        </div>)}
        {draft.areas.length < MAX_AREAS && <NewAreaForm groups={groups} emailCount={draft.areas.filter((area) => area.kind === 'email').length} onAdd={(area) => setDraft((current) => ({ ...current, areas: [...current.areas, area] }))} />}
      </section>

      {/* ---------- Ablageorte ---------- */}
      <section className="settings-card">
        <header><Plus size={20} /><div><h2>Ablageorte</h2><p>Wohin Dinge kommen, die du behältst. Die App zeigt sie dir beim Aufräumen als Erinnerung.</p></div></header>
        {draft.destinations.map((destination) => <div key={destination.id} className="destination-row">
          <input value={destination.label} onChange={(event) => updateDestination(destination.id, { label: event.target.value })} aria-label="Name des Ablageorts" maxLength={40} />
          <input value={destination.note} onChange={(event) => updateDestination(destination.id, { note: event.target.value })} aria-label="Notiz" placeholder="Notiz, z. B. Arbeit" maxLength={60} />
          <div className="kind-toggles">
            <label><input type="checkbox" checked={destination.kinds.includes('files')} onChange={() => toggleDestinationKind(destination, 'files')} /> Dateien</label>
            <label><input type="checkbox" checked={destination.kinds.includes('email')} onChange={() => toggleDestinationKind(destination, 'email')} /> E-Mails</label>
          </div>
          <button type="button" className="icon-button small danger" aria-label={`${destination.label} entfernen`} onClick={() => setDraft((current) => ({ ...current, destinations: current.destinations.filter((item) => item.id !== destination.id) }))}><X size={14} /></button>
        </div>)}
        {draft.destinations.length < MAX_DESTINATIONS && <button type="button" className="button ghost" onClick={() => setDraft((current) => ({ ...current, destinations: [...current.destinations, { id: makeId('ziel'), label: 'Neuer Ablageort', note: '', kinds: ['files'] }] }))}><Plus size={16} /> Ablageort hinzufügen</button>}
      </section>

      {/* ---------- Konto ---------- */}
      <section className="settings-card">
        <header><div><h2>Konto</h2><p>Angemeldet als <strong>{props.email}</strong></p></div></header>
        <div className="subscribe-actions">
          <button type="button" className="button ghost" onClick={props.onLogout}>Abmelden</button>
          <button type="button" className="button ghost danger-text" onClick={props.onDeleteAccount}><Trash2 size={16} /> Konto und alle Daten löschen</button>
        </div>
      </section>

      {dirty && <div className="save-bar" role="region" aria-label="Ungespeicherte Änderungen">
        <span>Ungespeicherte Änderungen</span>
        <button type="button" className="button ghost" onClick={() => { setDraft(props.settings); setEditingArea(null) }}>Verwerfen</button>
        <button type="button" className="button primary" onClick={save} disabled={props.busy}>{props.busy ? 'Speichert …' : 'Speichern'}</button>
      </div>}
    </section>
  )
}

function AreaEditor({ area, groups, onChange, onClose }: { area: Area; groups: string[]; onChange: (change: Partial<Area>) => void; onClose: () => void }) {
  return (
    <div className="area-editor">
      <div className="field-row">
        <label>Name<input value={area.title} onChange={(event) => onChange({ title: event.target.value })} maxLength={40} /></label>
        <label>{area.kind === 'email' ? 'Zusatz' : 'Gerät'}<input value={area.subtitle} list="settings-groups" onChange={(event) => onChange(area.kind === 'email' ? { subtitle: event.target.value } : { subtitle: event.target.value, group: event.target.value || 'Weitere' })} maxLength={30} /></label>
      </div>
      <div className="field-row">
        <label>Art<select value={area.icon} onChange={(event) => {
          const icon = event.target.value as AreaIconName
          const kind: AreaKind = icon === 'mail' ? 'email' : 'files'
          onChange({ icon, kind, color: areaType(icon).color, ...(kind === 'email' ? { group: 'E-Mail' } : area.kind === 'email' ? { group: area.subtitle || 'Weitere' } : {}) })
        }}>{AREA_TYPES.map((type) => <option key={type.icon} value={type.icon}>{type.label}</option>)}</select></label>
        <label>Rhythmus<select value={area.intervalDays} onChange={(event) => onChange({ intervalDays: Number(event.target.value) })}>{RHYTHMS.map((rhythm) => <option key={rhythm.days} value={rhythm.days}>{rhythm.label}</option>)}</select></label>
      </div>
      <datalist id="settings-groups">{groups.filter((group) => group !== 'E-Mail').map((group) => <option key={group} value={group} />)}</datalist>
      <button type="button" className="button ghost" onClick={onClose}>Fertig</button>
    </div>
  )
}

function NewAreaForm({ groups, emailCount, onAdd }: { groups: string[]; emailCount: number; onAdd: (area: Area) => void }) {
  const [open, setOpen] = useState(false)
  const [icon, setIcon] = useState<AreaIconName>('downloads')
  const [title, setTitle] = useState('')
  const [device, setDevice] = useState('')
  const [intervalDays, setIntervalDays] = useState(30)
  const isMail = icon === 'mail'

  if (!open) return <button type="button" className="button ghost" onClick={() => setOpen(true)}><Plus size={16} /> Bereich hinzufügen</button>

  function add(event: React.FormEvent) {
    event.preventDefault()
    const type = areaType(icon)
    const name = title.trim() || type.label
    const where = device.trim()
    onAdd({
      id: makeId(icon),
      title: name,
      subtitle: isMail ? (where || 'E-Mail') : (where || 'Weitere'),
      group: isMail ? 'E-Mail' : (where || 'Weitere'),
      icon,
      kind: isMail ? 'email' : 'files',
      intervalDays,
      color: isMail ? EMAIL_COLORS[emailCount % EMAIL_COLORS.length] : type.color,
      status: 'active',
    })
    setTitle('')
    setOpen(false)
  }

  return (
    <form className="area-editor" onSubmit={add}>
      <div className="field-row">
        <label>Art<select value={icon} onChange={(event) => { const next = event.target.value as AreaIconName; setIcon(next); setIntervalDays(next === 'mail' ? 7 : 30) }}>{AREA_TYPES.map((type) => <option key={type.icon} value={type.icon}>{type.label}</option>)}</select></label>
        <label>{isMail ? 'Name des Postfachs' : 'Name'}<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={isMail ? 'z. B. Gmail privat' : areaType(icon).label} maxLength={40} required={isMail} /></label>
      </div>
      <div className="field-row">
        <label>{isMail ? 'Zusatz (optional)' : 'Gerät'}<input value={device} onChange={(event) => setDevice(event.target.value)} list="new-area-groups" placeholder={isMail ? 'z. B. Arbeit' : 'z. B. Handy'} maxLength={30} /></label>
        <label>Rhythmus<select value={intervalDays} onChange={(event) => setIntervalDays(Number(event.target.value))}>{RHYTHMS.map((rhythm) => <option key={rhythm.days} value={rhythm.days}>{rhythm.label}</option>)}</select></label>
      </div>
      <datalist id="new-area-groups">{groups.filter((group) => group !== 'E-Mail').map((group) => <option key={group} value={group} />)}</datalist>
      <div className="subscribe-actions">
        <button type="button" className="button ghost" onClick={() => setOpen(false)}>Abbrechen</button>
        <button className="button primary"><Plus size={16} /> Hinzufügen</button>
      </div>
    </form>
  )
}
