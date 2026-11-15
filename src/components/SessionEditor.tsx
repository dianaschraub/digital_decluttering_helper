import { useState } from 'react'
import type { CleaningSession } from '../types'
import { todayIso } from '../lib/dates'
import { RemainingStockFields } from './RemainingStockFields'
import { Modal } from './ui'

export function SessionEditor({ session, onClose, onSave, countLabel }: {
  countLabel?: string
  session: CleaningSession
  onClose: () => void
  onSave: (session: CleaningSession) => Promise<void>
}) {
  const [draft, setDraft] = useState(session)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const change = (patch: Partial<CleaningSession>) => setDraft((current) => ({ ...current, ...patch }))
  return <Modal title="Sitzung bearbeiten" onClose={() => { if (!busy) onClose() }}>
    <form className="stack-form" onSubmit={async (event) => {
      event.preventDefault()
      if (busy) return
      setBusy(true); setError('')
      try { await onSave(draft); onClose() }
      catch (caught) { setError(caught instanceof Error ? caught.message : 'Speichern fehlgeschlagen.') }
      finally { setBusy(false) }
    }}>
      <p>Ergänze oder korrigiere deine Angaben. Bei der letzten Sitzung dieses Bereichs wird auch der aktuelle Bearbeitungsstand angepasst. Das Abschlussdatum bleibt erhalten.</p>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 14 }}>
        <label>Dauer in Minuten<input type="number" required min="1" max="600" step="1" value={Number.isNaN(draft.duration_minutes) ? '' : draft.duration_minutes} onChange={(event) => change({ duration_minutes: event.target.value === '' ? NaN : Number(event.target.value) })} /></label>
        <label>Stand angeben als<select value={draft.progress_type} onChange={(event) => change({ progress_type: event.target.value as 'month' | 'date', progress_value: event.target.value === 'month' ? draft.progress_value.slice(0, 7) : `${draft.progress_value}-01` })}><option value="month">Monat</option><option value="date">Genaues Datum</option></select></label>
        <label>Vollständig geprüft bis<input required type={draft.progress_type} max={draft.progress_type === 'month' ? todayIso().slice(0, 7) : todayIso()} value={draft.progress_value} onChange={(event) => change({ progress_value: event.target.value })} /></label>
        <RemainingStockFields label={countLabel} value={draft} onChange={change} />
        <label>Notiz (optional)<textarea aria-label="Notiz zur Sitzung" maxLength={1000} rows={3} value={draft.note ?? ''} onChange={(event) => change({ note: event.target.value })} /></label>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="button primary full" disabled={busy}>{busy ? 'Wird gespeichert …' : 'Änderungen speichern'}</button>
      <button type="button" className="button ghost" disabled={busy} onClick={onClose}>Abbrechen</button>
    </form>
  </Modal>
}
