import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Plus, X } from 'lucide-react'
import { CUSTOM_DEVICE_CONTENTS, DESTINATION_PRESETS, DEVICE_PRESETS, EMAIL_SUGGESTIONS, buildSettings } from '../data'
import { AREA_TYPES, RHYTHMS, areaType, validStartMonth } from '../lib/settingsSchema'
import { currentMonthIso } from '../lib/dates'
import type { AreaIconName, AreaKind, UserSettings } from '../types'
import { AreaSign, BrandMark } from './ui'

interface DeviceChoice { key: string; label: string; offered: AreaIconName[]; contents: AreaIconName[]; startMonth: string }

const STEPS = ['Geräte', 'E-Mail', 'Ablageorte', 'Fertig']

export function Onboarding({ onDone, busy, error }: { onDone: (settings: UserSettings) => void; busy: boolean; error: string }) {
  const [step, setStep] = useState(0)
  const [devices, setDevices] = useState<DeviceChoice[]>([])
  const [customDevice, setCustomDevice] = useState('')
  const [emails, setEmails] = useState<{ name: string; intervalDays: number; startMonth: string }[]>([])
  const [emailName, setEmailName] = useState('')
  const [destinations, setDestinations] = useState<{ label: string; note: string; kinds: AreaKind[] }[]>([])
  const [customDestination, setCustomDestination] = useState('')

  const fileAreaCount = devices.reduce((sum, device) => sum + device.contents.length, 0)
  const areaCount = fileAreaCount + emails.length

  function toggleDevice(preset: (typeof DEVICE_PRESETS)[number]) {
    setDevices((current) => current.some((device) => device.key === preset.id)
      ? current.filter((device) => device.key !== preset.id)
      : [...current, { key: preset.id, label: preset.label, offered: preset.contents, contents: [...preset.defaults], startMonth: '' }])
  }

  function addCustomDevice() {
    const label = customDevice.trim()
    if (!label) return
    setDevices((current) => [...current, { key: `custom-${Date.now()}`, label, offered: CUSTOM_DEVICE_CONTENTS, contents: ['downloads'], startMonth: '' }])
    setCustomDevice('')
  }

  function toggleContent(key: string, icon: AreaIconName) {
    setDevices((current) => current.map((device) => device.key !== key ? device : {
      ...device,
      contents: device.contents.includes(icon) ? device.contents.filter((item) => item !== icon) : [...device.contents, icon],
    }))
  }

  function addEmail(name: string) {
    const trimmed = name.trim()
    if (!trimmed || emails.some((email) => email.name.toLowerCase() === trimmed.toLowerCase())) return
    setEmails((current) => [...current, { name: trimmed, intervalDays: 7, startMonth: '' }])
    setEmailName('')
  }

  function toggleDestination(preset: (typeof DESTINATION_PRESETS)[number]) {
    setDestinations((current) => current.some((item) => item.label === preset.label)
      ? current.filter((item) => item.label !== preset.label)
      : [...current, { ...preset }])
  }

  function addCustomDestination() {
    const label = customDestination.trim()
    if (!label || destinations.some((item) => item.label.toLowerCase() === label.toLowerCase())) return
    setDestinations((current) => [...current, { label, note: 'eigener Ort', kinds: ['files', 'email'] }])
    setCustomDestination('')
  }

  function finish() {
    onDone(buildSettings({
      devices: devices.filter((device) => device.contents.length > 0).map((device) => ({ label: device.label, contents: device.contents, startMonth: validStartMonth(device.startMonth) })),
      emails: emails.map((email) => ({ ...email, startMonth: validStartMonth(email.startMonth) })),
      destinations,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin',
    }))
  }

  const canContinue = step === 0 ? fileAreaCount > 0 || devices.length === 0 : step === 1 ? areaCount > 0 : true

  return (
    <main className="onboarding-page">
      <section className="onboarding-card">
        <header className="onboarding-head">
          <BrandMark size="small" />
          <ol className="stepper" aria-label="Fortschritt">
            {STEPS.map((label, index) => <li key={label} className={index === step ? 'current' : index < step ? 'done' : ''}><span>{index < step ? <Check size={12} /> : index + 1}</span>{label}</li>)}
          </ol>
        </header>

        {step === 0 && <>
          <p className="eyebrow">Willkommen</p>
          <h1>Was möchtest du aufräumen?</h1>
          <p className="muted">Wähle deine Geräte und was du dort in Ordnung bringen willst. Wenn du weißt, seit wann es dort Daten gibt, trag den Monat ein – dort beginnt das Aufräumen. Alles lässt sich später in den Einstellungen ändern.</p>
          <div className="choice-chips">
            {DEVICE_PRESETS.map((preset) => {
              const active = devices.some((device) => device.key === preset.id)
              return <button key={preset.id} type="button" className={active ? 'active' : ''} aria-pressed={active} onClick={() => toggleDevice(preset)}>{active && <Check size={15} />}{preset.label}</button>
            })}
          </div>
          <form className="inline-add" onSubmit={(event) => { event.preventDefault(); addCustomDevice() }}>
            <input value={customDevice} onChange={(event) => setCustomDevice(event.target.value)} placeholder="Weiteres Gerät" maxLength={30} />
            <button className="button ghost" disabled={!customDevice.trim()}><Plus size={16} /> Hinzufügen</button>
          </form>
          <div className="device-list">
            {devices.map((device) => <div key={device.key} className="device-block">
              <div className="device-block-head">
                <strong>{device.label}</strong>
                <button type="button" className="icon-button small" aria-label={`${device.label} entfernen`} onClick={() => setDevices((current) => current.filter((item) => item.key !== device.key))}><X size={14} /></button>
              </div>
              <div className="content-grid">
                {device.offered.map((icon) => {
                  const selected = device.contents.includes(icon)
                  return <button key={icon} type="button" className={`content-option ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => toggleContent(device.key, icon)}>
                    <AreaSign area={{ icon, color: areaType(icon).color }} size="small" />
                    <span>{areaType(icon).label}</span>
                    {selected && <Check size={16} className="content-check" />}
                  </button>
                })}
              </div>
              <label className="start-month">Älteste Daten ab <span className="optional">optional, z. B. seit du das Gerät hast</span>
                <input type="month" value={device.startMonth} max={currentMonthIso()} onChange={(event) => setDevices((current) => current.map((item) => item.key === device.key ? { ...item, startMonth: event.target.value } : item))} />
              </label>
            </div>)}
          </div>
        </>}

        {step === 1 && <>
          <p className="eyebrow">E-Mail</p>
          <h1>Welche Postfächer räumst du auf?</h1>
          <p className="muted">Optional. Gib jedem Postfach einen Namen, an dem du es erkennst.</p>
          <div className="choice-chips">
            {EMAIL_SUGGESTIONS.filter((name) => !emails.some((email) => email.name === name)).map((name) => <button key={name} type="button" onClick={() => addEmail(name)}><Plus size={14} />{name}</button>)}
          </div>
          <form className="inline-add" onSubmit={(event) => { event.preventDefault(); addEmail(emailName) }}>
            <input value={emailName} onChange={(event) => setEmailName(event.target.value)} placeholder="Eigener Name" maxLength={40} />
            <button className="button ghost" disabled={!emailName.trim()}><Plus size={16} /> Hinzufügen</button>
          </form>
          <div className="row-list">
            {emails.map((email, index) => <div key={email.name} className="row-item">
              <AreaSign area={{ icon: 'mail', color: AREA_TYPES[AREA_TYPES.length - 1].color }} size="small" />
              <strong>{email.name}</strong>
              <select value={email.intervalDays} aria-label={`Rhythmus für ${email.name}`} onChange={(event) => setEmails((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, intervalDays: Number(event.target.value) } : item))}>
                {RHYTHMS.map((rhythm) => <option key={rhythm.days} value={rhythm.days}>{rhythm.label}</option>)}
              </select>
              <button type="button" className="icon-button small" aria-label={`${email.name} entfernen`} onClick={() => setEmails((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button>
              <label className="start-month row-start">Älteste Mails ab <span className="optional">optional</span>
                <input type="month" value={email.startMonth} max={currentMonthIso()} onChange={(event) => setEmails((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, startMonth: event.target.value } : item))} />
              </label>
            </div>)}
          </div>
        </>}

        {step === 2 && <>
          <p className="eyebrow">Ablageorte</p>
          <h1>Wo legst du Dinge ab, die du behalten willst?</h1>
          <p className="muted">Diese Orte zeigt dir die App beim Aufräumen als Erinnerung. Am besten hat jede Art von Datei genau einen festen Ort.</p>
          <div className="choice-chips">
            {DESTINATION_PRESETS.map((preset) => {
              const active = destinations.some((item) => item.label === preset.label)
              return <button key={preset.label} type="button" className={active ? 'active' : ''} aria-pressed={active} onClick={() => toggleDestination(preset)}>{active && <Check size={15} />}{preset.label}</button>
            })}
            {destinations.filter((item) => !DESTINATION_PRESETS.some((preset) => preset.label === item.label)).map((item) => (
              <button key={item.label} type="button" className="active" onClick={() => setDestinations((current) => current.filter((entry) => entry.label !== item.label))}><Check size={15} />{item.label}</button>
            ))}
          </div>
          <form className="inline-add" onSubmit={(event) => { event.preventDefault(); addCustomDestination() }}>
            <input value={customDestination} onChange={(event) => setCustomDestination(event.target.value)} placeholder="Eigener Ort" maxLength={40} />
            <button className="button ghost" disabled={!customDestination.trim()}><Plus size={16} /> Hinzufügen</button>
          </form>
          {emails.length > 0 && <p className="small muted">„Im Postfach archivieren“ nehme ich für deine E-Mails automatisch dazu.</p>}
        </>}

        {step === 3 && <>
          <p className="eyebrow">Fertig</p>
          <h1>Deine Bereiche stehen.</h1>
          <p className="muted">{areaCount} Bereich{areaCount === 1 ? '' : 'e'} und {destinations.length + (emails.length ? 1 : 0)} Ablageort{destinations.length + (emails.length ? 1 : 0) === 1 ? '' : 'e'}. In den Einstellungen kannst du jederzeit etwas ergänzen, umbenennen oder pausieren – und Erinnerungen für deinen Kalender einrichten.</p>
          <div className="summary-groups">
            {devices.filter((device) => device.contents.length).map((device) => <div key={device.key}><strong>{device.label}</strong><span>{device.contents.map((icon) => areaType(icon).label).join(' · ')}</span></div>)}
            {emails.length > 0 && <div><strong>E-Mail</strong><span>{emails.map((email) => email.name).join(' · ')}</span></div>}
            {destinations.length > 0 && <div><strong>Ablageorte</strong><span>{destinations.map((item) => item.label).join(' · ')}</span></div>}
          </div>
          {error && <p className="error-box">{error}</p>}
        </>}

        <footer className="onboarding-actions">
          {step > 0 ? <button type="button" className="button ghost" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Zurück</button> : <span />}
          {step < 3
            ? <button type="button" className="button primary" disabled={!canContinue || (step === 0 && devices.length > 0 && fileAreaCount === 0)} onClick={() => setStep(step + 1)}>{step === 1 && emails.length === 0 ? 'Überspringen' : step === 2 && destinations.length === 0 ? 'Überspringen' : 'Weiter'} <ArrowRight size={16} /></button>
            : <button type="button" className="button primary" disabled={busy || areaCount === 0} onClick={finish}>{busy ? 'Wird gespeichert …' : 'Los geht’s'} <ArrowRight size={16} /></button>}
        </footer>
        {step === 1 && areaCount === 0 && <p className="small muted onboarding-hint">Wähle mindestens ein Gerät oder ein Postfach, damit es losgehen kann.</p>}
      </section>
    </main>
  )
}
