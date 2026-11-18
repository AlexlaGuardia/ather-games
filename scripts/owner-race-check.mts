// ── THE ACCOUNT LANDS LATE: the page must draw the ACCOUNT's plot, not the anonymous one (Alex 11-18 playtest: built three
// rooms, refreshed, saw only the planning table + a Keepstone) ─────────────────────────────────────────────────────────
// SETUP (stated): /api/auth/session is answered LATE (2.5 s) with a fake signed-in user. The anonymous slot holds a plot
// with no rooms; the account's slot (u:<id>:open.works.v1) holds one raised Farm. A birth rune in both so no gate opens.
// PASS = once the page is up, the live works store (read-only __ather.works) holds the account's Farm, and the account's
// saved works still has it after 8 s of play (nothing wrote the anonymous view over it). The fake user has no cookie, so
// the cloud save's 401s are expected and not counted.
//   npx tsx scripts/owner-race-check.mts [--url http://localhost:3203]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const UID = 'u_racecheck'
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage()
await p.setViewport({ width: 1000, height: 640 })
const errs: string[] = []
p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.setRequestInterception(true)
p.on('request', r => {
  if (r.url().includes('/api/auth/session')) { setTimeout(() => r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ session: { user_id: UID } }) }).catch(() => {}), 2500); return }
  r.continue().catch(() => {})
})
await p.evaluateOnNewDocument((uid: string) => {
  if (sessionStorage.getItem('race')) return; sessionStorage.setItem('race', '1')
  const now = Date.now()
  const farm = { id: 'farm-race', kind: 'farm', x: -114, z: 113, q: 2, placedAt: now - 600000, doneAt: now - 500000, store: [] }
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  localStorage.setItem(`u:${uid}:ather:shimmer:birthRune`, 'star')
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [] }))
  localStorage.setItem(`u:${uid}:open.works.v1`, JSON.stringify({ v: 1, rooms: [farm], chests: [], pieces: [] }))
}, UID)
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.works, { timeout: 180000 })
const drawn = await p.evaluate(() => (window as any).__ather.works())
await sleep(8000)
const saved = await p.evaluate((uid: string) => (JSON.parse(localStorage.getItem(`u:${uid}:open.works.v1`) ?? '{"rooms":[]}').rooms as { kind: string }[]).map(r => r.kind), UID)
const pass = drawn.rooms.includes('farm') && saved.includes('farm') && errs.length === 0
console.log(JSON.stringify({ url, drawn, savedAccountRooms: saved, errs }, null, 1))
console.log(pass ? 'PASS owner-race: the page draws the account plot and keeps it' : 'FAIL owner-race')
await br.close()
process.exit(pass ? 0 : 1)
