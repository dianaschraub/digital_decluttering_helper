import { latestStockByKind, stockCountLabel } from '../lib/stock'
import { StockForm } from './StockForm'
import { ArrowRight } from 'lucide-react'
import { useSettings } from '../lib/settingsContext'
import { rhythmLabel } from '../lib/settingsSchema'
import { areaPoint, backlogDays, formatBacklog, formatProgress, nextProgressLabel } from '../lib/dates'
import type { Progress, UserSettings } from '../types'
import { AreaSign, BacklogBar } from './ui'

export function AreasView({ progress, selectedAreaId, onChoose, onSettings, onStockSaved }: { progress: Progress[]; selectedAreaId: string; onChoose: (id: string) => void; onSettings: () => void; onStockSaved: (settings: UserSettings) => void }) {
  const { activeAreas } = useSettings()
  const groups = [...new Set(activeAreas.map((area) => area.group))]
  return (
    <section>
      <div className="page-heading"><div><p className="eyebrow">Deine {activeAreas.length} Eingänge</p><h1>Bereiche</h1><p>Bestand und Bearbeitungsstand je Bereich. Trage Anzahl oder Speichergröße unter „Bestand & automatische Termine“ ein.</p></div><button className="button ghost" onClick={onSettings}>Bereiche bearbeiten</button></div>
      {groups.map((group) => (
        <div className="area-group" key={group}>
          <h2 className="group-title">{group}</h2>
          <div className="area-grid">
            {activeAreas.filter((area) => area.group === group).map((area) => {
              const stored = progress.find((item) => item.area_id === area.id)
              const point = areaPoint(stored, area.startMonth)
              const backlog = point ? backlogDays(point.type, point.value) : null
              const stock = latestStockByKind(area)
              const stockDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('de-DE')
              return (
                <div key={area.id}><button className={`area-card ${selectedAreaId === area.id ? 'selected' : ''}`} onClick={() => onChoose(area.id)}>
                  <span className="area-card-top"><AreaSign area={area} size="small" /><span className="rhythm">{rhythmLabel(area.intervalDays)}</span></span>
                  <span className="area-card-title"><strong>{area.title}</strong><small>{area.subtitle}</small></span>
                  <span className="area-stock">
                    <span className="area-stock-label">Zuletzt erfasster Bestand</span>
                    {stock.count && <span><strong>{stock.count.value.toLocaleString('de-DE')} {stockCountLabel(area)}</strong><small>Stand {stockDate(stock.count.date)}</small></span>}
                    {stock.storage && <span><strong>{stock.storage.value.toLocaleString('de-DE')} {stock.storage.unit}</strong><small>Stand {stockDate(stock.storage.date)}</small></span>}
                    {!stock.count && !stock.storage && <small>Noch nicht erfasst · unten Bestand eintragen</small>}
                  </span>
                  <span className="area-progress">
                    <span className="area-progress-label">{formatBacklog(backlog)}</span>
                    <BacklogBar days={backlog} intervalDays={area.intervalDays} />
                    <span className="area-progress-detail">{stored ? <>bis <strong>{formatProgress(stored.progress_type, stored.progress_value)}</strong></> : nextProgressLabel('month', '', area.startMonth)}</span>
                  </span>
                </button><details className="stock-details"><summary>Bestand & automatische Termine</summary><StockForm area={area} onSaved={onStockSaved} /></details></div>
              )
            })}
          </div>
        </div>
      ))}
      <div className="principle-card"><ArrowRight size={24} /><div><strong>Immer von alt nach neu</strong><p>Beginne beim ältesten noch ungeprüften Zeitraum. So entsteht keine Lücke, und der gespeicherte Stand bleibt eindeutig.</p></div></div>
    </section>
  )
}
