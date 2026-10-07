import type { Context } from '@netlify/functions'
import { buildFeed } from './_shared/feed'
import { loadUserData, userIdForCalendarToken } from './_shared/store'

// Öffentlich erreichbar, aber nur mit dem geheimen, persönlichen Token im Link.
// Kalender-Apps können sich nicht anmelden – der Token ersetzt das Passwort.
export default async (request: Request, _context: Context) => {
  const url = new URL(request.url)
  const token = url.searchParams.get('token') ?? ''
  if (!/^[a-f0-9]{32}$/.test(token)) return new Response('Nicht gefunden.', { status: 404 })
  const userId = await userIdForCalendarToken(token)
  if (!userId) return new Response('Nicht gefunden.', { status: 404 })
  const { data } = await loadUserData(userId)
  return new Response(buildFeed(data, url.origin), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="digital-cleaning.ics"',
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
