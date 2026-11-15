const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename)
const { weeklyDemand, stockTrend } = require('../src/lib/stock.ts')
const { planSlots } = require('../src/lib/schedule.ts')
const { sanitizeSettings, defaultReminders } = require('../src/lib/settingsSchema.ts')
const { buildFeed } = require('../netlify/functions/_shared/feed.ts')
const now = Date.parse('2026-11-09T00:00:00Z')
const area = (values = [], extra = {}) => ({ id: 'documents', title: 'Dokumente', subtitle: 'Computer', group: 'Computer', icon: 'documents', kind: 'files', intervalDays: 30, color: '#24342d', status: 'active', adaptive: true, stock: values.map((value, i) => ({ value, date: `2026-11-0${i + 1}`, unit: 'count' })), ...extra })
const settings = (areas, reminders = {}) => ({ areas, destinations: [], reminders: { ...defaultReminders('Europe/Berlin'), ...reminders } })

test('Wachstum erhöht Bedarf; stabile/sinkende Bestände und deaktivierte Automatik setzen zurück', () => {
  assert.equal(weeklyDemand(area([100])), 0)
  assert.equal(weeklyDemand(area([100, 101])), 2)
  assert.equal(weeklyDemand(area([100, 105])), 3)
  assert.equal(weeklyDemand(area([100, 101, 102])), 5)
  assert.equal(weeklyDemand(area([100, 110, 110])), 0)
  assert.equal(weeklyDemand(area([100, 110, 90])), 0)
  assert.equal(weeklyDemand(area([0, 1])), 3)
  assert.equal(weeklyDemand(area([100, 200], { adaptive: false })), 0)
})

test('MB/GB werden verglichen, Anzahlen nicht mit Speichergrößen', () => {
  const a = area([], { stock: [{ date: '2026-11-01', value: 1000, unit: 'MB' }, { date: '2026-11-02', value: 1.2, unit: 'GB' }] })
  assert.equal(stockTrend(a).difference, 200)
  assert.equal(weeklyDemand(a), 3)
  a.stock.push({ date: '2026-11-03', value: 50, unit: 'count' })
  assert.equal(stockTrend(a), null)
})

test('Gemeinsame Obergrenze 5 pro Montag–Sonntag-Woche, auch bei sieben Grundtagen und vielen Rubriken', () => {
  const areas = [area([100, 101, 102]), area([20, 30, 40], { id: 'photos', title: 'Fotos' })]
  for (const weekdays of [[3], [0, 1, 2, 3, 4, 5, 6]]) {
    const s = settings(areas, { weekdays })
    const slots = planSlots(s.reminders, areas, [], now, 60)
    const weeks = new Map()
    for (const slot of slots) {
      const day = new Date(`${slot.localDate}T12:00:00Z`)
      const monday = new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10)
      weeks.set(monday, (weeks.get(monday) || 0) + 1)
    }
    assert.equal(Math.max(...weeks.values()), 5)
    assert.ok(slots.some((slot) => slot.area.id === 'photos'))
    assert.ok(slots.some((slot) => slot.area.id === 'documents'))
    assert.equal(new Set(slots.map((slot) => slot.localDate)).size, slots.length)
  }
})

test('Kalender-Vorschau folgt Wachstum und kehrt zum monatlichen Grundrhythmus zurück', () => {
  const a = area([100, 110])
  const s = settings([a], { frequency: 'monthly' })
  const grown = planSlots(s.reminders, s.areas, [], now, 12)
  assert.equal(grown[0].localDate, '2026-11-09')
  assert.equal(grown[0].start.toISOString(), '2026-11-09T17:00:00.000Z')
  a.stock.push({ date: '2026-11-04', value: 110, unit: 'count' })
  const normal = planSlots(s.reminders, s.areas, [], now, 12)
  assert.equal(normal[0].localDate, '2026-12-02')
  assert.deepEqual(planSlots({ ...s.reminders, enabled: false }, [a], [], now), [])
  assert.deepEqual(planSlots(s.reminders, [{ ...a, status: 'paused' }], [], now), [])
})

test('Kalender-Export enthält dieselben Termine, stabile UIDs und Erinnerung', () => {
  const s = settings([area([100, 110])])
  const data = { settings: s, progress: [], sessions: [], tasks: [], checks: [], calendarToken: null }
  const feed = buildFeed(data, 'https://example.com', now)
  const slots = planSlots(s.reminders, s.areas, [], now, 12)
  assert.equal((feed.match(/BEGIN:VEVENT/g) || []).length, slots.length)
  for (const slot of slots) assert.ok(feed.includes(`UID:slot-${slot.localDate}@digital-cleaning`))
  assert.ok(feed.includes('TRIGGER:-PT10M'))
})

test('Einstellungen erhalten Messverlauf, verwerfen ungültige Werte und begrenzen Historie', () => {
  const a = area([100, 110])
  a.stock.push({ date: 'bad', value: -1, unit: 'TB' })
  assert.equal(sanitizeSettings(settings([a])).areas[0].stock.length, 2)
  assert.equal(sanitizeSettings(settings([area([], { stock: Array.from({ length: 150 }, () => ({ date: '2026-11-01', value: 0, unit: 'MB' })) })])).areas[0].stock.length, 100)
  assert.equal(sanitizeSettings(settings([area([], { stock: undefined, adaptive: undefined })])).areas[0].adaptive, false)
})

test('Obergrenze bleibt beim Kalenderabgleich mitten in derselben Woche stabil', () => {
  const s = settings([area([100, 101, 102])], { weekdays: [0, 1, 2, 3, 4, 5, 6] })
  const mondayPlan = planSlots(s.reminders, s.areas, [], now, 20)
  const thursdayPlan = planSlots(s.reminders, s.areas, [], now + 3 * 86400000, 20)
  const weekEnd = '2026-11-15'
  const combined = new Set([...mondayPlan, ...thursdayPlan].filter((slot) => slot.localDate <= weekEnd).map((slot) => slot.localDate))
  assert.equal(combined.size, 5)
})

test('API validiert Bestände und korrigiert denselben Tag ohne Verlust anderer Rubriken', async () => {
  const Module = require('node:module')
  const original = Module._load
  let current = { settings: settings([area([100]), area([], { id: 'photos' })]) }
  Module._load = function(request, ...args) {
    if (request === '@netlify/identity') return { getUser: async () => ({ id: 'test-user', email: 'test@example.com' }), verifyRequestOrigin: () => {} }
    if (request === './_shared/store') return { updateUserData: async (id, change) => { assert.equal(id, 'test-user'); return change(current) } }
    if (request === './_shared/legacySheet') return {}
    return original.call(this, request, ...args)
  }
  const handler = require('../netlify/functions/app-data.ts').default
  Module._load = original
  const send = (action, payload) => handler(new Request('https://example.com/.netlify/functions/app-data', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,payload})}), {})
  const payload = { areaId: 'documents', value: 110, unit: 'count', date: '2026-11-02', adaptive: true }
  for (const patch of [{value:-1},{value:1.5},{value:null},{unit:'TB'},{date:'2026-02-31'},{date:'2099-01-01'},{areaId:'unknown'}]) assert.equal((await send('record_stock',{...payload,...patch})).status,400)
  assert.equal((await send('record_stock',payload)).status,200)
  assert.equal((await send('record_stock',{...payload,value:120})).status,200)
  assert.equal(current.settings.areas[0].stock.length,2)
  assert.equal(current.settings.areas[0].stock.at(-1).value,120)
  assert.equal(current.settings.areas[1].stock.length,0)
  const stale = settings([area([5], { adaptive: false }), area([], { id:'photos' })])
  assert.equal((await send('save_settings',{settings:stale})).status,200)
  assert.equal(current.settings.areas[0].stock.at(-1).value,120)
  assert.equal(current.settings.areas[0].adaptive,true)
})


test('Bestandsübersicht zeigt Anzahl und Speicher getrennt, nach Datum und einschließlich Null', () => {
  const { latestStockByKind, stockCountLabel } = require('../src/lib/stock.ts')
  const a = area([], { icon: 'photos', stock: [
    { date: '2026-11-10', value: 0, unit: 'count' },
    { date: '2026-11-09', value: 4.5, unit: 'GB' },
    { date: '2026-11-01', value: 42, unit: 'count' },
    { date: '2026-11-02', value: 800, unit: 'MB' },
  ] })
  assert.equal(latestStockByKind(a).count.value, 0)
  assert.equal(latestStockByKind(a).storage.value, 4.5)
  assert.equal(stockCountLabel(a), 'Fotos')
  assert.equal(stockCountLabel({ ...a, icon: 'screenshots' }), 'Screenshots')
  assert.equal(latestStockByKind(area()).count, undefined)
})

test('Sitzungskorrektur erhält Identität und Datum; nur die neueste Einheit ändert den aktuellen Stand', () => {
  const { editSession } = require('../src/lib/sessionEditing.ts')
  const old = { id:'old', area_id:'documents', user_id:'u', finished_at:'2026-11-01T12:00:00Z', duration_minutes:20, deleted_count:0, sorted_count:0, quick_done_count:0, progress_type:'month', progress_value:'2026-01' }
  const latest = { ...old, id:'latest', finished_at:'2026-11-02T12:00:00Z', progress_value:'2026-02' }
  const progress = { id:'p', area_id:'documents', user_id:'u', progress_type:'month', progress_value:'2026-02', note:'bisher', updated_at:latest.finished_at }
  const data = { sessions:[old,latest], progress:[progress] }
  const input = { durationMinutes:25, deletedCount:12, sortedCount:3, quickDoneCount:1, progressType:'date', progressValue:'2026-01-12', note:'Ergänzung' }
  const result = editSession(data,'old',input)
  assert.equal(result.session.id,'old')
  assert.equal(result.session.finished_at,old.finished_at)
  assert.equal(result.session.deleted_count,12)
  assert.equal(result.progress,null)
  assert.equal(progress.progress_value,'2026-02')
  const newest = editSession(data,'latest',{...input,progressValue:'2026-03-12'})
  assert.equal(newest.progress.progress_value,'2026-03-12')
  assert.equal(newest.progress.updated_at,latest.finished_at)
  assert.equal(newest.progress.note,'Ergänzung')
  assert.equal(data.sessions.length,2)
})

test('Sitzung bearbeiten lehnt ungültige Daten ab und verändert dabei nichts', () => {
  const { editSession } = require('../src/lib/sessionEditing.ts')
  const data = { sessions:[{id:'s',area_id:'documents',finished_at:'2026-11-01T12:00:00Z'}],progress:[] }
  const input = { durationMinutes:20, deletedCount:0, sortedCount:0, quickDoneCount:0, progressType:'date', progressValue:'2026-01-12', note:'' }
  const before = JSON.stringify(data)
  for (const patch of [{durationMinutes:0},{deletedCount:-1},{sortedCount:1.5},{progressValue:'2026-02-31'},{progressValue:'2099-01-01'},{progressType:'other'},{note:'x'.repeat(1001)}]) {
    assert.throws(()=>editSession(data,'s',{...input,...patch}))
    assert.equal(JSON.stringify(data),before)
  }
  assert.throws(()=>editSession(data,'unknown',input))
})
