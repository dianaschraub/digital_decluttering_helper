import { useEffect, useState } from 'react'
import { getUser, handleAuthCallback, onAuthChange } from './lib/auth'
import type { CallbackResult, User } from './lib/auth'
import { CleaningApp } from './components/CleaningApp'
import { LoginScreen } from './components/LoginScreen'
import { CenteredMessage } from './components/ui'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authFlow, setAuthFlow] = useState<CallbackResult | null>(null)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    let active = true
    const unsubscribe = onAuthChange((event, nextUser) => {
      if (!active) return
      setUser(nextUser)
      if (event !== 'recovery') setAuthFlow(null)
    })

    async function initializeAuth() {
      try {
        const callback = await handleAuthCallback()
        if (!active) return
        if (callback?.type === 'invite' || callback?.type === 'recovery') setAuthFlow(callback)
        setUser(callback?.user ?? await getUser())
      } catch (caught) {
        if (active) setAuthError(caught instanceof Error ? caught.message : 'Die Anmeldung konnte nicht geprüft werden.')
      } finally {
        if (active) setAuthLoading(false)
      }
    }
    initializeAuth()
    return () => { active = false; unsubscribe() }
  }, [])

  if (authLoading) return <CenteredMessage title="Digital Cleaning" text="Deine Anmeldung wird geprüft …" />
  if (!user || authFlow?.type === 'invite' || authFlow?.type === 'recovery') {
    return <LoginScreen
      flow={authFlow}
      initialError={authError}
      onAuthenticated={setUser}
      onFlowComplete={() => setAuthFlow(null)}
    />
  }
  return <CleaningApp key={user.id} email={user.email ?? ''} />
}

export default App
