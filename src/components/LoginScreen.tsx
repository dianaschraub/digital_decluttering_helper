import { useEffect, useState } from 'react'
import { acceptInvite, getSettings, login, requestPasswordRecovery, signup, updateUser } from '../lib/auth'
import type { CallbackResult, User } from '../lib/auth'
import { PrivacyLink } from './PrivacyNotice'
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
  const [mode, setMode] = useState<'login' | 'signup' | 'recovery'>('login')
  const [signupAllowed, setSignupAllowed] = useState(true)
  const [autoconfirm, setAutoconfirm] = useState(false)
  const recoveryMode = mode === 'recovery'

  useEffect(() => {
    getSettings()
      .then((settings) => { setSignupAllowed(!settings.disableSignup); setAutoconfirm(settings.autoconfirm) })
      .catch(() => { /* Ohne Einstellungen bleibt die Registrierung sichtbar; der Server meldet ggf. einen Fehler. */ })
  }, [])
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
      } else if (mode === 'signup') {
        if (password.length < 8) throw new Error('Das Passwort muss mindestens acht Zeichen lang sein.')
        if (password !== passwordRepeat) throw new Error('Die Passwörter stimmen nicht überein.')
        const created = await signup(email.trim(), password)
        if (autoconfirm) onAuthenticated(created)
        else setSent('Fast geschafft: Wir haben dir eine E-Mail geschickt. Bestätige darin deine Adresse, danach bist du direkt angemeldet.')
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
        : mode === 'signup'
          ? 'Konto erstellen'
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
        <p className="eyebrow">{mode === 'signup' ? 'Neu hier?' : 'Dein Zugang'}</p>
        <h2>{sent ? 'Schau in dein Postfach' : heading}</h2>
        {sent ? (
          <>
            <p>{sent}</p>
            <button className="button secondary full" onClick={() => { setSent(''); setMode('login') }}>Zur Anmeldung</button>
          </>
        ) : (
          <form onSubmit={submit} className="stack-form">
            {!passwordFlow && <label>E-Mail-Adresse<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@beispiel.de" autoComplete="email" required /></label>}
            {!recoveryMode && <label>{passwordFlow || mode === 'signup' ? 'Neues Passwort' : 'Passwort'}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete={passwordFlow || mode === 'signup' ? 'new-password' : 'current-password'} required /></label>}
            {(passwordFlow || mode === 'signup') && <label>Passwort wiederholen<input type="password" value={passwordRepeat} onChange={(event) => setPasswordRepeat(event.target.value)} minLength={8} autoComplete="new-password" required /></label>}
            {error && <p className="error-box">{error}</p>}
            <button className="button primary full" disabled={busy}>{busy ? 'Bitte warten …' : passwordFlow ? 'Passwort speichern' : recoveryMode ? 'E-Mail senden' : mode === 'signup' ? 'Konto erstellen' : 'Anmelden'}</button>
            {!passwordFlow && <div className="login-links">
              {mode !== 'login' && <button type="button" className="text-button" onClick={() => { setMode('login'); setError('') }}>Zurück zur Anmeldung</button>}
              {mode === 'login' && signupAllowed && <button type="button" className="text-button" onClick={() => { setMode('signup'); setError('') }}>Noch kein Konto? Jetzt registrieren</button>}
              {mode === 'login' && <button type="button" className="text-button subtle" onClick={() => { setMode('recovery'); setError('') }}>Passwort vergessen?</button>}
            </div>}
            {mode === 'signup' && <p className="small muted">Deine Daten sind nur für dich sichtbar. Du kannst dein Konto jederzeit in den Einstellungen samt allen Daten löschen.</p>}
            <div className="login-footer"><PrivacyLink /></div>
            {mode === 'login' && !signupAllowed && <p className="small muted">Neue Konten werden derzeit nur per Einladung angelegt.</p>}
          </form>
        )}
      </section>
    </main>
  )
}
