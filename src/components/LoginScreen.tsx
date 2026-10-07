import { useState } from 'react'
import { acceptInvite, login, requestPasswordRecovery, updateUser } from '../lib/auth'
import type { CallbackResult, User } from '../lib/auth'
import { BrandMark } from './ui'

export function LoginScreen({ flow, initialError, onAuthenticated, onFlowComplete }: {
  flow: CallbackResult | null
  initialError: string
  onAuthenticated: (user: User) => void
  onFlowComplete: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordRepeat, setPasswordRepeat] = useState('')
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [sent, setSent] = useState('')
  const [error, setError] = useState(initialError)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (flow?.type === 'invite') {
        if (!flow.token) throw new Error('Der Einladungslink ist unvollständig.')
        if (password.length < 8) throw new Error('Das Passwort muss mindestens acht Zeichen lang sein.')
        if (password !== passwordRepeat) throw new Error('Die Passwörter stimmen nicht überein.')
        const nextUser = await acceptInvite(flow.token, password)
        onAuthenticated(nextUser)
        onFlowComplete()
      } else if (flow?.type === 'recovery') {
        if (password.length < 8) throw new Error('Das Passwort muss mindestens acht Zeichen lang sein.')
        if (password !== passwordRepeat) throw new Error('Die Passwörter stimmen nicht überein.')
        const nextUser = await updateUser({ password })
        onAuthenticated(nextUser)
        onFlowComplete()
      } else if (recoveryMode) {
        await requestPasswordRecovery(email.trim())
        setSent('Du erhältst eine E-Mail zum Festlegen eines neuen Passworts.')
      } else {
        onAuthenticated(await login(email.trim(), password))
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Die Anmeldung ist fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  const passwordFlow = flow?.type === 'invite' || flow?.type === 'recovery'
  const heading = flow?.type === 'invite'
    ? 'Einladung annehmen'
    : flow?.type === 'recovery'
      ? 'Neues Passwort festlegen'
      : recoveryMode
        ? 'Passwort zurücksetzen'
        : 'Bei Digital Cleaning anmelden'

  return (
    <main className="login-page">
      <section className="login-intro">
        <BrandMark tone="light" />
        <p className="eyebrow light-text">20 Minuten. Ein Bereich. Klarer Kopf.</p>
        <h1>Digitale Ordnung, die auch morgen noch funktioniert.</h1>
        <p>Arbeite dich von den ältesten Dateien nach vorn. Entscheide nur: löschen, einsortieren oder eine nächste Handlung notieren.</p>
      </section>
      <section className="login-card">
        <p className="eyebrow">Privater Zugang</p>
        <h2>{sent ? 'Schau in dein Postfach' : heading}</h2>
        {sent ? (
          <>
            <p>{sent}</p>
            <button className="button secondary full" onClick={() => { setSent(''); setRecoveryMode(false) }}>Zur Anmeldung</button>
          </>
        ) : (
          <form onSubmit={submit} className="stack-form">
            {!passwordFlow && <label>E-Mail-Adresse<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@beispiel.de" autoComplete="email" required /></label>}
            {!recoveryMode && <label>{passwordFlow ? 'Neues Passwort' : 'Passwort'}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete={passwordFlow ? 'new-password' : 'current-password'} required /></label>}
            {passwordFlow && <label>Passwort wiederholen<input type="password" value={passwordRepeat} onChange={(event) => setPasswordRepeat(event.target.value)} minLength={8} autoComplete="new-password" required /></label>}
            {error && <p className="error-box">{error}</p>}
            <button className="button primary full" disabled={busy}>{busy ? 'Bitte warten …' : passwordFlow ? 'Passwort speichern' : recoveryMode ? 'E-Mail senden' : 'Anmelden'}</button>
            {!passwordFlow && <button type="button" className="text-button" onClick={() => { setRecoveryMode((value) => !value); setError('') }}>{recoveryMode ? 'Zurück zur Anmeldung' : 'Passwort vergessen?'}</button>}
            <p className="small muted">Neue Konten werden nur über eine Einladung im Netlify-Dashboard angelegt.</p>
          </form>
        )}
      </section>
    </main>
  )
}
