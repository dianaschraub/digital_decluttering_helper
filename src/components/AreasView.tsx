import { ArrowRight } from 'lucide-react'
import { AREAS } from '../data'
import { backlogDays, formatBacklog, formatProgress, nextProgressLabel } from '../lib/dates'
import type { Progress } from '../types'
import { AreaSign, BacklogBar } from './ui'

const GROUPS = [...new Set(AREAS.map((area) => area.group))]

export function AreasView({ progress, selectedAreaId, onChoose }: { progress: Progress[]; selectedAreaId: string; onChoose: (id: string) => void }) {
  return (
    <section>
      <div className="page-heading"><div><p className="eyebrow">Deine {AREAS.length} Eingänge</p><h1>Bereiche</h1><p>Jeder Bereich merkt sich seinen eigenen Bearbeitungsstand.</p></div></div>
      {GROUPS.map((group) => (
        <div className="area-group" key={group}>
          <h2 className="group-title">{group}</h2>
          <div className="area-grid">
            {AREAS.filter((area) => area.group === group).map((area) => {
              const stored = progress.find((item) => item.area_id === area.id)
              const backlog = stored ? backlogDays(stored.progress_type, stored.progress_value) : null
              return (
                <button key={area.id} className={`area-card ${selectedAreaId === area.id ? 'selected' : ''}`} onClick={() => onChoose(area.id)}>
                  <span className="area-card-top"><AreaSign area={area} size="small" /><span className="rhythm">{area.rhythm}</span></span>
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
