import { useState } from 'react'
import type { RemainingStock } from '../types'

export function RemainingStockFields({ value, onChange, label = 'Objekte' }: { value: RemainingStock; onChange: (patch: RemainingStock) => void; label?: string }) {
  const [unit, setUnit] = useState<'MB' | 'GB'>(value.remaining_storage?.unit ?? 'GB')
  return <section className="remaining-stock-fields">
    <h3>Was ist insgesamt noch übrig?</h3>
    <p className="small muted">Trage den gesamten Restbestand nach dieser Sitzung ein. Anzahl und belegter Speicher sind unabhängig und freiwillig. Ab zwei Sitzungen mit Werten vergleicht die App, ob der Bestand wächst oder schrumpft. Leer bedeutet „nicht erfasst“.</p>
    <div className="field-row">
      <label>Noch vorhandene {label}<input type="number" min="0" max="1000000000000" step="1" value={value.remaining_count ?? ''} onChange={(event) => onChange({ remaining_count: event.target.value === '' ? null : Number(event.target.value) })} placeholder="z. B. 2400" /></label>
      <label>Noch belegter Speicher<input type="number" min="0" max="1000000000000" step="any" value={value.remaining_storage?.value ?? ''} onChange={(event) => onChange({ remaining_storage: event.target.value === '' ? null : { value: Number(event.target.value), unit } })} placeholder="z. B. 6,2" /></label>
      <label>Speichereinheit<select aria-label="Speichereinheit" value={unit} onChange={(event) => {
        const unit = event.target.value as 'MB' | 'GB'
        setUnit(unit)
        const current = value.remaining_storage
        if (current) onChange({ remaining_storage: { value: current.value * (current.unit === 'GB' ? 1000 : 1) / (unit === 'GB' ? 1000 : 1), unit } })
      }}><option value="MB">MB</option><option value="GB">GB</option></select></label>
    </div>
  </section>
}
