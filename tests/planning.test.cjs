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
  assert.equal(weeklyDemand(area([100, 101, 102])), 4)
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

test('Gemeinsame Obergrenze 4 pro Montag–Sonntag-Woche, auch bei sieben Grundtagen und vielen Rubriken', () => {
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
    assert.equal(Math.max(...weeks.values()), 4)
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
  assert.equal(combined.size, 4)
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
  const payload = { areaId: 'documents', value: 110, unit: 'count', date: '2026-11-02', adaptive: true, stockGoal: 'reduce' }
  for (const patch of [{value:-1},{value:1.5},{value:null},{unit:'TB'},{date:'2026-02-31'},{date:'2099-01-01'},{areaId:'unknown'},{stockGoal:'invalid'}]) assert.equal((await send('record_stock',{...payload,...patch})).status,400)
  assert.equal((await send('record_stock',payload)).status,200)
  assert.equal((await send('record_stock',{...payload,value:120})).status,200)
  assert.equal(current.settings.areas[0].stock.length,2)
  assert.equal(current.settings.areas[0].stock.at(-1).value,120)
  assert.equal(current.settings.areas[1].stock.length,0)
  const stale = settings([area([5], { adaptive: false }), area([], { id:'photos' })])
  assert.equal((await send('save_settings',{settings:stale})).status,200)
  assert.equal(current.settings.areas[0].stock.at(-1).value,120)
  assert.equal(current.settings.areas[0].adaptive,true)
  assert.equal(current.settings.areas[0].stockGoal,'reduce')
  assert.equal((await send('record_device_storage',{device:'phone',usedGB:64,totalGB:128})).status,200)
  assert.equal((await send('record_device_storage',{device:'tablet',usedGB:96,totalGB:256})).status,200)
  assert.equal(current.settings.deviceStorage.phone.usedGB,64)
  assert.equal(current.settings.deviceStorage.tablet.usedGB,96)
  assert.equal((await send('record_device_storage',{device:'phone',usedGB:200,totalGB:128})).status,400)
  assert.equal((await send('record_device_storage',{device:'other',usedGB:10,totalGB:128})).status,400)
  assert.equal(current.settings.deviceStorage.phone.usedGB,64)
  assert.equal((await send('save_settings',{settings:stale})).status,200)
  assert.equal(current.settings.deviceStorage.phone.usedGB,64)
  assert.equal(current.settings.deviceStorage.tablet.usedGB,96)
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


test('Verkleinern reagiert auf Stillstand, Halten nicht; leere und sinkende Bestände entlasten', () => {
  const shrink = (values) => area(values, { stockGoal: 'reduce' })
  assert.equal(weeklyDemand(shrink([100])), 0)
  assert.equal(weeklyDemand(shrink([100, 100])), 2)
  assert.equal(weeklyDemand(shrink([100, 100, 100])), 4)
  assert.equal(weeklyDemand(shrink([100, 110, 110])), 4)
  assert.equal(weeklyDemand(shrink([100, 90, 90])), 2)
  assert.equal(weeklyDemand(shrink([100, 100, 90])), 0)
  assert.equal(weeklyDemand(shrink([0, 0, 0])), 0)
  assert.equal(weeklyDemand(area([100,100], {stockGoal:'maintain'})), 0)
  assert.equal(weeklyDemand(area([100,100], {stockGoal:'reduce',adaptive:false})), 0)
  const s = settings([shrink([100,100,100])])
  const slots = planSlots(s.reminders,s.areas,[],now,8)
  assert.equal(slots.filter((slot)=>slot.localDate <= '2026-11-15').length,4)
})


test('Restbestand pro Sitzung: beide Werte, zwei Sitzungen am gleichen Tag, MB/GB und Korrektur', () => {
  const { syncSessionStock, validateRemaining, remainingChanges } = require('../src/lib/sessionStock.ts')
  const first = { id:'first',area_id:'documents',finished_at:'2026-11-01T10:00:00Z',...validateRemaining({remaining_count:2000,remaining_storage:{value:2,unit:'GB'}}) }
  const second = { id:'second',area_id:'documents',finished_at:'2026-11-01T11:00:00Z',...validateRemaining({remaining_count:2100,remaining_storage:{value:1800,unit:'MB'}}) }
  const a = area([])
  const data = {settings:settings([a]),sessions:[first,second]}
  syncSessionStock(data,first);syncSessionStock(data,second)
  assert.equal(a.stock.length,4)
  assert.deepEqual(remainingChanges(second,[first,second]),{count:100,storageMB:-200})
  assert.equal(weeklyDemand(a),3) // Anzahl wächst, obwohl Speicher sinkt.
  second.remaining_count = 1900
  syncSessionStock(data,second)
  assert.equal(a.stock.length,4)
  assert.equal(stockTrend(a,'count').difference,-100)
  assert.equal(weeklyDemand(a),0)
  syncSessionStock(data,first) // ältere Sitzung bearbeiten verschiebt sie nicht nach vorne
  assert.equal(stockTrend(a,'count').latest.sessionId,'second')
  assert.equal(remainingChanges(first,[first,second]).count,null)
  assert.equal(validateRemaining({remaining_count:0}).remaining_count,0)
  assert.equal(validateRemaining({}).remaining_count,null)
  for (const input of [{remaining_count:-1},{remaining_count:1.5},{remaining_storage:{value:NaN,unit:'GB'}},{remaining_storage:{value:1,unit:'TB'}}]) assert.throws(()=>validateRemaining(input))
})


test('Restbestände nachträglich löschen entfernt nur die Messpunkte dieser Sitzung', () => {
  const { editSession } = require('../src/lib/sessionEditing.ts')
  const { syncSessionStock } = require('../src/lib/sessionStock.ts')
  const session = { id:'s',area_id:'documents',finished_at:'2026-11-01T10:00:00Z',remaining_count:10,remaining_storage:{value:1,unit:'GB'} }
  const a = area([])
  const data = {settings:settings([a]),sessions:[session],progress:[]}
  syncSessionStock(data,session)
  a.stock.push({date:'2026-10-01',unit:'count',value:50})
  const input = {durationMinutes:20,deletedCount:0,sortedCount:0,quickDoneCount:0,progressType:'month',progressValue:'2026-01',note:'',remaining_count:null,remaining_storage:null}
  editSession(data,'s',input)
  assert.equal(a.stock.length,1)
  assert.equal(a.stock[0].value,50)
  assert.equal(data.sessions[0].remaining_count,null)
})


test('Gerätespeicher berechnet GB, freie Kapazität und Prozent und verwirft ungültige Werte', () => {
  const { storageUsage, sanitizeDeviceStorage } = require('../src/lib/deviceStorage.ts')
  assert.deepEqual(storageUsage(64,128),{usedGB:64,totalGB:128,freeGB:64,percent:50})
  assert.equal(storageUsage(0,128).percent,0)
  assert.equal(storageUsage(128,128).percent,100)
  assert.equal(storageUsage(12.5,25).percent,50)
  for (const values of [[-1,128],[129,128],[0,0],[NaN,128],[10,Infinity],['64',128]]) assert.throws(()=>storageUsage(...values))
  const valid={usedGB:64,totalGB:128,updatedAt:'2026-11-25T10:00:00Z'}
  assert.deepEqual(sanitizeDeviceStorage({phone:valid,tablet:{...valid,totalGB:0}}),{phone:valid})
  assert.deepEqual(sanitizeDeviceStorage(undefined),{})
})
