// ── PLOT VISITS, slice 1 (BETA M61, play / Jin df2d4e1e, 11-21): a party mate walks your whole plot, read-only ───────────────────
// PROD ONLY (the game socket + the party lobby are behind the tunnel). Three browsers:
//   A = the host: a two-storey house (walls, stairs, a paid upper floor) + a Goldwood Table, standing on their own plot in party P.
//   B = a party mate on their own plot (one Goldwood Stool of their own).  C = a stranger (no party, then another party).
// PASS =
//   1. A on its plot in a party HOSTS: socket zone open:plot:<A>, live
//   2. B opens Options › Play together: the party list shows A 'on their plot' with a Visit button; B clicks it (real click)
//   3. B arrives on A's plot: the snapshot lands, B's socket is in open:plot:<A>, the works B's page DRAWS are A's (the table, not
//      B's stool), walls + upper level counts equal A's save; A sees B on its plot
//   4. upstairs: B set down on the upper floor STAYS one storey up (the upper level is ground in B's walk world)
//   5. read-only: B's E at A's table is refused (one line, no panel); A's save still holds the table; B's own save is untouched
//   5b. live: A picks its table up (real E + click): B's view loses it within seconds (slice 2)
//   6. a stranger: no party = the visit link is refused; another party = no plot reaches them, home in ~15 s, A never sees them
//   7. B goes home (H, or the pill's Home button with --phone): B's own works again (the stool), socket back to open:plot:<B>
//   8. 0 page errors
// Hooks: __mp / __visit / __lobby / __ather.works|state READ; __ather.tp to set B down (as lift-check); real clicks + keys.
//   npx tsx scripts/plot-visit-check.mts [--url https://ather.games] [--phone]
import puppeteer, { type Page } from 'puppeteer-core'
import { KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
import { findRooms } from '../src/app/shimmer/open/ather/plot-walls'
import { STOREY } from '../src/app/shimmer/open/ather/plot-floors'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), PHONE = process.argv.includes('--phone')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = []
const CODE = 'PV' + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z2-9]/g, 'X'), OTHER = 'PQ' + CODE.slice(2)

// a clear held spot for the house (railing-check's search)
const held = new Set(STARTING_SQUARES)
const isHeld = (x: number, z: number) => { const s = squareAt(x, z); return !!s && held.has(sqId(s.i, s.j)) }
let spot: { x: number; z: number } | null = null
for (const R of [12, 10, 8]) {
  for (let z = -150; z <= 150 && !spot; z++) for (let x = -150; x <= 150 && !spot; x++) {
    let good = KEEP_CLEAR.every(c => Math.hypot(c.x - x, c.z - z) > c.r + R)
    for (let a = 0; a < 16 && good; a++) for (const d of [0, R / 2, R]) { if (!isHeld(x + Math.cos(a * Math.PI / 8) * d, z + Math.sin(a * Math.PI / 8) * d)) good = false }
    if (good) spot = { x, z }
  }
  if (spot) break
}
if (!spot) { console.log('no clear held spot'); process.exit(1) }
const X0 = spot.x - 3, X1 = spot.x + 3, Z0 = spot.z - 4, Z1 = spot.z + 4
const walls: Record<string, { mat: string; kind?: string }> = {}
for (let x = X0; x < X1; x++) { walls[`h,${x},${Z0}`] = { mat: 'goldwood' }; walls[`h,${x},${Z1}`] = { mat: 'goldwood' } }
for (let z = Z0; z < Z1; z++) { walls[`v,${X0},${z}`] = { mat: 'goldwood' }; walls[`v,${X1},${z}`] = { mat: 'goldwood' } }
walls[`h,${X0 + 3},${Z1}`] = { mat: 'goldwood', kind: 'door' }; walls[`h,${X0 + 4},${Z1}`] = { mat: 'goldwood', kind: 'door' }
const rk = findRooms(walls as any)[0].key, paid = { [rk]: 48 }
const SI = X0 + 1, SJ = Z1 - 1
const TABLE_AT = { x: X1 - 1.5, z: Z0 + 1.5 }
const HOST = { v: 1, rooms: [], chests: [], walls, paid, roof: 'flat', stairs: { [`${SI},${SJ}`]: { mat: 'brick', dir: 0 } }, upper: [{ walls, paid }],
  pieces: [{ id: 'pv-table', item: 'goldwood_table', x: TABLE_AT.x, z: TABLE_AT.z, q: 0, placedAt: 1 }] }
const MINE = { v: 1, rooms: [], chests: [], pieces: [{ id: 'pv-stool', item: 'goldwood_stool', x: spot.x, z: spot.z, q: 0, placedAt: 1 }] }

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const poll = async (fn: () => Promise<boolean>, ms = 90000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(400) } return false }
const ev = (p: Page, obj: string, f: string) => p.evaluate((o: string, k: string) => (window as any)[o]?.[k]?.(), obj, f)
const store = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('open.works.v1') ?? 'null'))
async function open(tag: string, party: string | null, works: object, phone = false): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 900, height: 560 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((c: string | null, w: string) => {
    if (sessionStorage.getItem('pvc')) return; sessionStorage.setItem('pvc', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    if (c) localStorage.setItem('ather:mp:party', c)
    localStorage.setItem('open.works.v1', w)
  }, party, JSON.stringify(works))
  return p
}
async function load(p: Page, q = '') {
  await p.goto(`${url}/shimmer/open/ather?hour=13${q}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.works && !!(window as any).__mp && !!(window as any).__visit, { timeout: 240000, polling: 1000 })
  await sleep(1500)
}
const clickSel = async (p: Page, sel: string) => { const b = await p.evaluate((s: string) => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; if (PHONE) await p.touchscreen.tap(b.x, b.y); else await p.mouse.click(b.x, b.y); return true }
const clickText = (p: Page, sel: string, text: string) => p.evaluate((s: string, t: string) => { const e = [...document.querySelectorAll<HTMLElement>(s)].find(x => x.textContent?.includes(t)); e?.click(); return !!e }, sel, text)
async function panel(p: Page) {
  for (let i = 0; i < 4; i++) {
    if (await p.$('[data-panel="play-together"]')) return true
    if (!(await p.$('[data-panel="options"]'))) { await p.keyboard.press('KeyO'); await poll(async () => !!(await p.$('[data-panel="options"]')), 8000) }
    await clickText(p, '[data-panel="options"] button', 'Play together')
    if (await poll(async () => !!(await p.$('[data-panel="play-together"]')), 6000)) return true
  }
  return false
}
try {
  // 1 · the host
  const a = await open('A', CODE, HOST); await load(a)
  const idA = await a.evaluate(() => localStorage.getItem('ather:mp:id'))
  ok(await poll(async () => (await ev(a, '__mp', 'zone')) === `open:plot:${idA}` && (await ev(a, '__mp', 'status')) === 'live', 120000), `1. A hosts: zone ${await ev(a, '__mp', 'zone')}, ${await ev(a, '__mp', 'status')}`)
  ok(await ev(a, '__visit', 'hosting') === true, '1. A __visit.hosting')
  const aSave = await store(a)

  // 2 · B finds A in the party list and clicks Visit
  const b = await open('B', CODE, MINE, PHONE); await load(b)
  const idB = await b.evaluate(() => localStorage.getItem('ather:mp:id'))
  ok(JSON.stringify(((await ev(b, '__ather', 'works')) as any).pieces) === '["goldwood_stool"]', '2. B starts on its own plot (its stool)')
  ok(await panel(b), '2. B opened Play together')
  const row = `[data-mate="${idA}"]`
  ok(await poll(async () => !!(await b.$(`${row} [data-act="visit-plot"]`)), 60000), `2. A is listed with a Visit button (${await b.evaluate((s: string) => document.querySelector(s)?.textContent ?? 'no row', row)})`)
  ok(await clickSel(b, `${row} [data-act="visit-plot"]`), '2. B clicked Visit (real click)')

  // 3 · B on A's plot
  ok(await poll(async () => (await ev(b, '__visit', 'hasSnap')) === true, 45000), `3. the snapshot landed (${JSON.stringify(await ev(b, '__visit', 'net'))})`)
  ok(await poll(async () => (await ev(b, '__mp', 'zone')) === `open:plot:${idA}`, 20000), `3. B's socket is in A's plot zone (${await ev(b, '__mp', 'zone')})`)
  const shownB = await ev(b, '__ather', 'works') as any
  ok(JSON.stringify(shownB.pieces) === '["goldwood_table"]', `3. B's page draws A's works (pieces ${JSON.stringify(shownB.pieces)})`)
  const sum = await ev(b, '__visit', 'shown') as any
  ok(!!sum && sum.walls === Object.keys(walls).length && sum.upper === 1 && sum.upperWalls[0] === Object.keys(walls).length, `3. walls ${sum?.walls}/${Object.keys(walls).length}, upper levels ${sum?.upper}, upper walls ${sum?.upperWalls}`)
  ok(!!(await b.$('[data-visit-pill]')), '3. the visit pill says whose plot this is')
  ok(await poll(async () => ((await ev(a, '__mp', 'peers')) as { id: string }[] ?? []).some(q => q.id === idB), 30000), '3. A sees B on its plot')

  // 4 · upstairs
  await b.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, 0, y), spot.x, spot.z, GROUND_Y + STOREY + 0.4)
  let py = 0; for (let n = 0; n < 12; n++) { await sleep(1000); py = (await b.evaluate(() => (window as any).__ather.state())).py }
  ok(Math.abs(py - (GROUND_Y + STOREY)) < 0.3, `4. B stands on A's upper floor: feet ${py.toFixed(2)} vs ${(GROUND_Y + STOREY).toFixed(2)}`)

  // 5 · read-only
  await b.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), TABLE_AT.x - 1.3, TABLE_AT.z)
  await sleep(2500)
  const r0 = await ev(b, '__visit', 'refusals') as number
  for (let n = 0; n < 3 && (await ev(b, '__visit', 'refusals')) === r0; n++) { await aimAt(b, TABLE_AT.x, TABLE_AT.z, 0.5); await b.keyboard.press('KeyE'); await sleep(900) }
  ok((await ev(b, '__visit', 'refusals') as number) > r0, `5. B's E at A's table is refused (${r0} -> ${await ev(b, '__visit', 'refusals')})`)
  ok(!(await b.$('[data-panel="work"]')) && !(await b.$('[data-panel="piece"]')), '5. no panel opened')
  ok(JSON.stringify(await store(a)) === JSON.stringify(aSave), "5. A's save is unchanged (the table stands)")
  ok(JSON.stringify((await store(b))?.pieces?.map((x: any) => x.item)) === '["goldwood_stool"]', "5. B's own save is untouched (its stool, nothing of A's)")

  // 5b · LIVE (slice 2): the host picks its table up (real E, real Pick up click); the guest's view loses it
  await a.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), TABLE_AT.x - 1.3, TABLE_AT.z)
  await sleep(2500)
  let panelUp = false
  for (let n = 0; n < 3 && !panelUp; n++) { await aimAt(a, TABLE_AT.x, TABLE_AT.z, 0.5); await a.keyboard.press('KeyE'); panelUp = await poll(async () => !!(await a.$('[data-act="pickup-piece"]')), 4000) }
  ok(panelUp, '5b. A opened its table (E)')
  const tClick = Date.now()
  ok(await clickSel(a, '[data-act="pickup-piece"]') && await poll(async () => ((await store(a))?.pieces ?? []).length === 0, 8000), '5b. A picked its table up (real click)')
  ok(await poll(async () => JSON.stringify(((await ev(b, '__ather', 'works')) as any).pieces) === '[]', 20000), `5b. B's view loses the table live (${((Date.now() - tClick) / 1000).toFixed(1)} s; host pushed ${((await ev(a, '__visit', 'net')) as any).pushed}x)`)
  ok(JSON.stringify((await store(b))?.pieces?.map((x: any) => x.item)) === '["goldwood_stool"]', "5b. B's own save still untouched")

  // 6 · strangers
  const c = await open('C', null, MINE); await load(c, `&visit=${idA}&vn=Host`)
  const log1 = await ev(c, '__visit', 'log') as string[]
  ok(log1.includes('refused:no-party') && !log1.some(e => e.startsWith('start:')) && (await ev(c, '__visit', 'visiting')) === false, `6. no party: the visit link is refused (${log1})`)
  await c.evaluate((o: string) => localStorage.setItem('ather:mp:party', o), OTHER)
  await load(c, `&visit=${idA}&vn=Host`)
  ok(((await ev(c, '__visit', 'log')) as string[]).includes(`start:${idA}`), '6. another party: the visit starts…')
  ok(await poll(async () => ((await ev(c, '__visit', 'log')) as string[]).includes('end:timeout'), 25000), `6. …no plot reaches them, home on the timeout (${await ev(c, '__visit', 'log')})`)
  ok(((await ev(c, '__visit', 'net')) as any).got === 0 && (await ev(c, '__visit', 'visiting')) === false, '6. never got a snapshot, not visiting')
  const idC = await c.evaluate(() => localStorage.getItem('ather:mp:id'))
  ok(!((await ev(a, '__mp', 'peers')) as { id: string }[] ?? []).some(q => q.id === idC), '6. A never saw the stranger')

  // 7 · home
  if (PHONE) ok(await clickSel(b, '[data-act="visit-home"]'), '7. B tapped Home on the pill (phone)')
  else { await b.mouse.click(450, 280); await b.keyboard.press('KeyH') }
  ok(await poll(async () => (await ev(b, '__visit', 'visiting')) === false, 15000), '7. B is home')
  ok(await poll(async () => JSON.stringify(((await ev(b, '__ather', 'works')) as any).pieces) === '["goldwood_stool"]', 15000), "7. B's own plot again (its stool)")
  ok(await poll(async () => (await ev(b, '__mp', 'zone')) === `open:plot:${idB}`, 20000), `7. B hosts its own plot again (${await ev(b, '__mp', 'zone')})`)
  ok(errs.length === 0, `8. page errors: ${errs.length} ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
