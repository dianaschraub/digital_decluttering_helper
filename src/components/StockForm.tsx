import { useState } from 'react'
import type { Area, StockUnit } from '../types'
import { recordStock } from '../lib/api'
import { stockTrend, weeklyDemand } from '../lib/stock'
import { todayIso } from '../lib/dates'
import type { UserSettings } from '../types'

export function StockForm({ area, onSaved }: { area: Area; onSaved: (settings: UserSettings) => void }) {
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState<StockUnit>(area.stock?.at(-1)?.unit ?? 'count')
  const [date, setDate] = useState(todayIso())
  const [adaptive, setAdaptive] = useState(area.adaptive ?? false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const trend = stockTrend(area)
  const demand = weeklyDemand(area)
  const latest = area.stock?.at(-1)
  return <form className="stock-form" onSubmit={async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setMessage('')
    try {
      onSaved(await recordStock(area.id, Number(value.replace(',', '.')), unit, date, adaptive))
      setValue(''); setMessage('Bestand gespeichert. Die Kalenderplanung wurde aktualisiert.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.') }
    finally { setBusy(false) }
  }}>
    <h3>Bestand messen · {area.title}</h3>
    <p className="small muted">Freiwillig, möglichst nach dem Aufräumen. MB und GB werden umgerechnet (1 GB = 1.000 MB). Anzahlen werden nur mit Anzahlen verglichen.</p>
    {latest && <p>Letzter Bestand: <strong>{latest.value.toLocaleString('de-DE')} {latest.unit === 'count' ? 'Dateien / E-Mails' : latest.unit}</strong> · {latest.date}</p>}
    <p>{trend ? trend.difference > 0 ? `Gewachsen: +${Math.round(trend.ratio * 100)} % seit ${trend.previous.date}.` : trend.difference < 0 ? 'Der Bestand ist gesunken.' : 'Der Bestand ist gleich geblieben.' : 'Für einen Vergleich fehlen zwei Messungen derselben Art.'}</p>
    <div className="field-row">
      <label>Bestand<input required type="number" min="0" max="1000000000000" step={unit === 'count' ? '1' : 'any'} value={value} onChange={(event) => setValue(event.target.value)} /></label>
      <label>Einheit<select value={unit} onChange={(event) => setUnit(event.target.value as StockUnit)}><option value="count">Anzahl Dateien / E-Mails</option><option value="MB">MB</option><option value="GB">GB</option></select></label>
      <label>Messdatum<input required type="date" max={todayIso()} value={date} onChange={(event) => setDate(event.target.value)} /></label>
    </div>
    <label className="switch-row"><input type="checkbox" checked={adaptive} onChange={(event) => setAdaptive(event.target.checked)} /><span>Bei Wachstum automatisch häufiger aufräumen</span></label>
    <p className="small muted">Ein Anstieg: 2 Einheiten/Woche, ab 5 %: 3, bei zwei Anstiegen hintereinander: 5. Insgesamt höchstens 5 Termine/Woche für alle Rubriken. Zusätzliche Tage werden zur gewählten Uhrzeit ergänzt. Bei stabilem oder sinkendem Bestand gilt wieder dein normaler Rhythmus.</p>
    {area.adaptive && demand > 0 && <p className="hint-box">Erhöhter Bedarf: {demand} Einheiten/Woche für diesen Bereich, verteilt innerhalb der gemeinsamen Obergrenze.</p>}
    <button className="button secondary" disabled={busy}>{busy ? 'Speichert …' : 'Bestand speichern'}</button>
    {message && <p role="status">{message}</p>}
    {!!area.stock?.length && <details><summary>Messverlauf ({area.stock.length})</summary><ul>{[...area.stock].reverse().map((item) => <li key={`${item.date}-${item.unit}`}>{item.date}: {item.value.toLocaleString('de-DE')} {item.unit === 'count' ? 'Dateien / E-Mails' : item.unit}</li>)}</ul></details>}
  </form>
}
