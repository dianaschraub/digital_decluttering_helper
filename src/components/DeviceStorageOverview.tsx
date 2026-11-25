import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Smartphone, Tablet } from 'lucide-react'
import type { DeviceStorage, StorageDevice, UserSettings } from '../types'
import { useSettings } from '../lib/settingsContext'
import { recordDeviceStorage } from '../lib/api'
import { storageUsage } from '../lib/deviceStorage'

const number = (value: number) => value.toLocaleString('de-DE', { maximumFractionDigits: 2 })

export function DeviceStorageOverview({ onSaved }: { onSaved: (settings: UserSettings) => void }) {
  const { deviceStorage } = useSettings()
  return <section className="device-storage-overview" aria-labelledby="device-storage-heading">
    <h2 id="device-storage-heading">Speicher deiner Geräte</h2>
    <p className="muted">Gesamter Gerätespeicher inklusive Apps und System. Übernimm die belegten und gesamten GB aus den Speichereinstellungen deines Geräts.</p>
    <div className="device-storage-grid">
      <DeviceStorageCard device="phone" label="Handy" saved={deviceStorage.phone} onSaved={onSaved} />
      <DeviceStorageCard device="tablet" label="Tablet" saved={deviceStorage.tablet} onSaved={onSaved} />
    </div>
  </section>
}

function DeviceStorageCard({ device, label, saved, onSaved }: { device: StorageDevice; label: string; saved?: DeviceStorage; onSaved: (settings: UserSettings) => void }) {
  const [used, setUsed] = useState(saved ? String(saved.usedGB) : '')
  const [total, setTotal] = useState(saved ? String(saved.totalGB) : '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const usage = saved ? storageUsage(saved.usedGB, saved.totalGB) : null
  const Icon = device === 'phone' ? Smartphone : Tablet
  return <article className="device-storage-card" aria-label={`Speicher ${label}`}>
    <h3><Icon size={22} aria-hidden="true" />{label}</h3>
    <div className="device-storage-visual">
      <div className={`storage-donut ${usage ? '' : 'unknown'}`} style={{ '--usage': `${usage?.percent ?? 0}%` } as CSSProperties} role={usage ? 'meter' : undefined} aria-label={usage ? `Belegter Speicher ${label}` : undefined} aria-valuemin={usage ? 0 : undefined} aria-valuemax={usage ? 100 : undefined} aria-valuenow={usage ? usage.percent : undefined} aria-valuetext={usage ? `${number(usage.percent)} Prozent, ${number(usage.usedGB)} von ${number(usage.totalGB)} GB belegt` : undefined}>
        <span>{usage ? `${number(usage.percent)} %` : '–'}</span>
      </div>
      <div>{usage ? <><strong className="storage-gb">{number(usage.usedGB)} GB belegt</strong><p>von {number(usage.totalGB)} GB</p><p>{number(usage.freeGB)} GB frei</p></> : <p>Noch keine Speicherwerte eingetragen.</p>}</div>
    </div>
    {saved && <p className="small muted">Zuletzt eingetragen: {new Date(saved.updatedAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
    <details className="device-storage-editor"><summary>Speicher {saved ? 'aktualisieren' : 'eintragen'}</summary>
      <form className="stack-form" onSubmit={async (event) => {
        event.preventDefault()
        if (busy) return
        setBusy(true); setMessage('')
        try {
          const usedGB = Number(used), totalGB = Number(total)
          storageUsage(usedGB, totalGB)
          onSaved(await recordDeviceStorage(device, usedGB, totalGB))
          setMessage('Speicherwerte gespeichert.')
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.') }
        finally { setBusy(false) }
      }}>
        <fieldset disabled={busy} className="device-storage-fields">
          <label>Belegt (GB)<input aria-label={`${label}: belegt in GB`} type="number" required min="0" max="1000000" step="any" value={used} onChange={(event) => setUsed(event.target.value)} /></label>
          <label>Gesamtspeicher (GB)<input aria-label={`${label}: Gesamtspeicher in GB`} type="number" required min="0.001" max="1000000" step="any" value={total} onChange={(event) => setTotal(event.target.value)} /></label>
        </fieldset>
        <button className="button secondary" disabled={busy}>{busy ? 'Speichert …' : 'Speicher speichern'}</button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  </article>
}
