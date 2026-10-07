import { ArrowRight } from 'lucide-react'
import { useSettings } from '../lib/settingsContext'
import { rhythmLabel } from '../lib/settingsSchema'
import { backlogDays, formatBacklog, formatProgress, nextProgressLabel } from '../lib/dates'
import type { Progress } from '../types'
import { AreaSign, BacklogBar } from './ui'

export function AreasView({ progress, selectedAreaId, onChoose, onSettings }: { progress: Progress[]; selectedAreaId: string; onChoose: (id: string) => void; onSettings: () => void }) {
  const { activeAreas } = useSettings()
  const groups = [...new Set(activeAreas.map((area) => area.group))]
  return (
    <section>
      <div className="page-heading"><div><p className="eyebrow">Deine {activeAreas.length} Eingänge</p><h1>Bereiche</h1><p>Jeder Bereich merkt sich seinen eigenen Bearbeitungsstand.</p></div><button className="button ghost" onClick={onSettings}>Bereiche bearbeiten</button></div>
      {groups.map((group) => (
        <div className="area-group" key={group}>
          <h2 className="group-title">{group}</h2>
          <div className="area-grid">
            {activeAreas.filter((area) => area.group === group).map((area) => {
              const stored = progress.find((item) => item.area_id === area.id)
              const backlog = stored ? backlogDays(stored.progress_type, stored.progress_value) : null
              return (
                <button key={area.id} className={`area-card ${selectedAreaId === area.id ? 'selected' : ''}`} onClick={() => onChoose(area.id)}>
                  <span className="area-card-top"><AreaSign area={area} size="small" /><span className="rhythm">{rhythmLabel(area.intervalDays)}</span></span>
                  <span className="area-card-title"><strong>{area.title}</strong><small>{area.subtitle}</small></span>
                  <span className="area-progress">
                    <span className="area-progress-label">{formatBacklog(backlog)}</span>
                    <BacklogBar days={backlog} intervalDays={area.intervalDays} />
                    <span className="area-progress-detail">{stored ? <>bis <strong>{formatProgress(stored.progress_type, stored.progress_value)}</strong></> : nextProgressLabel('month', '')}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <div className="principle-card"><ArrowRight size={24} /><div><strong>Immer von alt nach neu</strong><p>Beginne beim ältesten noch ungeprüften Zeitraum. So entsteht keine Lücke, und der gespeicherte Stand bleibt eindeutig.</p></div></div>
    </section>
  )
}
