// BETA M61 slice 3 check (plot-visit-s3-check): riding a mate's lift, Send home, the host gone.
//   SETUP (stated): two party mates. A's plot = a built 2-level house with a LIFT on a shaft cell (car at the ground), seeded in
//   open.works.v1 (lift-check's house); B's plot = one stool. B visits by the visit link (?visit=, the Party tab's own route,
//   which plot-visit-check drives by real click).
//   1. B stands on A's car, aims at the floor-2 cord IN THE WORLD, clicks: B rides up. A's car and A's save never move; B's save
//      untouched. 2. B clicks the floor-1 cord: down again, the overlay clears. 3. B upstairs beside the shaft, E calls the car up
//      (the E path a guest used to be refused on). 4. A sees B in "On your plot", clicks Send home (real click): B goes home.
//   5. B visits again, A's tab closes (host offline): B goes home by itself. 6. 0 page errors.
//   Hooks: __mp / __visit / __lift / __ather.tp|state|look READ + movement; real clicks + keys.
//   npx tsx scripts/plot-visit-s3-check.mts [--url https://ather.games] [--phone]
import puppeteer, { type Page } from 'puppeteer-core'
import { KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { planRun, runKeys, findRooms, type Walls } from '../src/app/shimmer/open/ather/plot-walls'
import { cordsOf } from '../src/app/shimmer/open/ather/lift'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), PHONE = process.argv.includes('--phone')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = []
const STOREY = 5.0
const CODE = 'PL' + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z2-9]/g, 'X')

const held = new Set(STARTING_SQUARES)
const isHeld = (x: number, z: number) => { const s = squareAt(x, z); return !!s && held.has(sqId(s.i, s.j)) }
let spot: { x: number; z: number } | null = null
for (const R of [10, 8]) {
  for (let z = -150; z <= 150 && !spot; z++) for (let x = -150; x <= 150 && !spot; x++) {
    let good = KEEP_CLEAR.every(c => Math.hypot(c.x - x, c.z - z) > c.r + R)
    for (let a = 0; a < 16 && good; a++) for (const d of [0, R / 2, R]) { if (!isHeld(x + Math.cos(a * Math.PI / 8) * d, z + Math.sin(a * Math.PI / 8) * d)) good = false }
    if (good) spot = { x, z }
  }
  if (spot) break
}
if (!spot) { console.log('no clear held spot'); process.exit(1) }
const X0 = spot.x - 2, X1 = spot.x + 2, Z0 = spot.z - 1, Z1 = spot.z + 2
const box = (): Walls => {
  let ws: Walls = {}
  for (const [a, b] of [[{ i: X0, j: Z0 }, { i: X1, j: Z0 }], [{ i: X0, j: Z1 }, { i: X1, j: Z1 }], [{ i: X0, j: Z0 }, { i: X0, j: Z1 }], [{ i: X1, j: Z0 }, { i: X1, j: Z1 }]]) ws = planRun(ws, runKeys(a, b), 'goldwood')
  return Object.fromEntries(Object.entries(ws).map(([k, v]) => [k, { mat: v.mat }]))
}
const walls = box(), rk = findRooms(walls)[0].key
const CELL = { x: X0 + 2.5, z: Z0 + 1.5 }
const LIFT = { id: 'pl-lift', item: 'lift', x: CELL.x, z: CELL.z, q: 0, placedAt: 1, lv: 0 }
const HOST = { v: 1, rooms: [], chests: [], walls, paid: { [rk]: 12 }, upper: [{ walls: box(), paid: { [rk]: 12 } }], roof: 'gable', pieces: [LIFT] }
const MINE = { v: 1, rooms: [], chests: [], pieces: [{ id: 'pl-stool', item: 'goldwood_stool', x: spot.x + 30, z: spot.z, q: 0, placedAt: 1 }] }
console.log(`house ${X0}..${X1} x ${Z0}..${Z1}, lift ${CELL.x},${CELL.z}, party ${CODE}`)

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const poll = async (fn: () => Promise<boolean>, ms = 90000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(400) } return false }
const ev = (p: Page, obj: string, f: string) => p.evaluate((o: string, k: string) => (window as any)[o]?.[k]?.(), obj, f)
const store = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('open.works.v1') ?? 'null'))
const state = (p: Page) => p.evaluate(() => (window as any).__ather.state())
const settle = async (p: Page) => { let last = 1e9, st: any = null; for (let n = 0; n < 40; n++) { st = await state(p); if (Math.abs(st.py - last) < 0.005) break; last = st.py; await sleep(1000) } return st }
const hideCard = (p: Page) => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const tp = async (p: Page, x: number, z: number, yaw: number, y?: number) => { await p.evaluate((a, b, c, d) => (window as any).__ather.tp(a, b, c, d), x, z, yaw, y); await sleep(1500) }
const carY = (p: Page) => p.evaluate((id: string) => (window as any).__lift?.ys?.get(id) ?? null, LIFT.id)
async function open(tag: string, works: object, phone = false): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1100, height: 760 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((c: string, w: string) => {
    if (sessionStorage.getItem('plc')) return; sessionStorage.setItem('plc', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('ather:mp:party', c); localStorage.setItem('open.works.v1', w)
  }, CODE, JSON.stringify(works))
  return p
}
async function load(p: Page, q = '') {
  await p.goto(`${url}/shimmer/open/ather?hour=13${q}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__mp && !!(window as any).__visit, { timeout: 240000, polling: 1000 })
  await sleep(1500); await hideCard(p)
}
const tapSel = async (p: Page, sel: string, phone: boolean) => { const b = await p.evaluate((s: string) => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; if (phone) await p.touchscreen.tap(b.x, b.y); else await p.mouse.click(b.x, b.y); return true }
// aim B's crosshair at the cord of `level` on the car at height cy, and click the canvas centre (lift-check's way)
async function clickCord(p: Page, level: number, cy: number) {
  const c = cordsOf(LIFT as any, cy, 2)[level]
  const st = await state(p), ey = st.py + (st.eye ?? 1.6), dx = c.x - st.px, dz = c.z - st.pz, dy = c.y0 + 0.3 - ey
  await p.evaluate((yw, pt) => (window as any).__ather.look(yw, pt), Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)))
  await sleep(800); await hideCard(p); await p.mouse.move(550, 380); await sleep(200); await p.mouse.click(550, 380)
}
async function visit(b: Page, idA: string) {
  await load(b, `&visit=${idA}&vn=Rin`)
  return poll(async () => (await ev(b, '__visit', 'hasSnap')) === true && (await ev(b, '__mp', 'zone')) === `open:plot:${idA}`, 60000)
}

try {
  const a = await open('A', HOST); await load(a)
  const idA = (await a.evaluate(() => localStorage.getItem('ather:mp:id')))!
  ok(await poll(async () => (await ev(a, '__mp', 'zone')) === `open:plot:${idA}` && (await ev(a, '__mp', 'status')) === 'live', 120000), `0. A hosts (${await ev(a, '__mp', 'zone')})`)
  const b = await open('B', MINE, PHONE)
  if (process.argv.includes('--probe')) {
    await b.goto(`${url}/shimmer/open/ather?hour=13&visit=${idA}&vn=Rin`, { waitUntil: 'load', timeout: 240000 })
    for (let i = 0; i < 40; i++) {
      const r = await b.evaluate(() => { const w = window as any; return { z: w.__mp?.zone?.(), s: w.__mp?.status?.(), party: w.__mp?.party?.(), v: w.__visit?.visiting?.(), net: w.__visit?.net?.(), log: w.__visit?.log?.(), zone: w.__ather?.state?.()?.zone } }).catch(e => String(e).slice(0, 80))
      const ra = await a.evaluate(() => { const w = window as any; return { z: w.__mp?.zone?.(), peers: (w.__mp?.peers?.() ?? []).map((p: any) => p.id), net: w.__visit?.net?.() } })
      console.log(i, JSON.stringify(r), '| A', JSON.stringify(ra)); await sleep(1000)
    }
    throw new Error('probe done')
  }
  ok(await visit(b, idA), `0. B is on A's plot with the snapshot (${JSON.stringify(await ev(b, '__visit', 'net'))})`)
  const idB = (await b.evaluate(() => localStorage.getItem('ather:mp:id')))!
  const aSave = JSON.stringify(await store(a)), bSave = JSON.stringify(await store(b))

  // 1 · ride up
  await tp(b, CELL.x, CELL.z, 0); let st = await settle(b)
  ok(Math.abs(st.py - GROUND_Y) < 0.3, `1. B stands on A's car at the ground (feet ${st.py.toFixed(2)})`)
  await clickCord(b, 1, GROUND_Y)
  ok(await poll(async () => ((await ev(b, '__visit', 'lifts')) as any)?.[LIFT.id] === 1, 20000), `1. B's click on the floor-2 cord sends the car up (overlay ${JSON.stringify(await ev(b, '__visit', 'lifts'))})`)
  ok(await poll(async () => Math.abs((await state(b)).py - (GROUND_Y + STOREY)) < 0.2, 60000), `1. and B rides it up (feet ${(await state(b)).py.toFixed(2)})`)
  ok(Math.abs(((await carY(a)) ?? GROUND_Y) - GROUND_Y) < 0.05, `1. A's car never moved (y ${await carY(a)})`)
  ok(JSON.stringify(await store(a)) === aSave && JSON.stringify(await store(b)) === bSave, "1. A's save and B's own save are untouched")
  // 2 · ride down
  await clickCord(b, 0, GROUND_Y + STOREY)
  ok(await poll(async () => Object.keys((await ev(b, '__visit', 'lifts')) as object ?? { x: 1 }).length === 0, 20000), '2. the floor-1 cord brings it back: the overlay clears')
  ok(await poll(async () => Math.abs((await state(b)).py - GROUND_Y) < 0.2, 60000), `2. B is back on the ground (feet ${(await state(b)).py.toFixed(2)})`)
  // 3 · E from upstairs calls the car (the guest's E used to be refused before callNearest)
  await tp(b, CELL.x - 1.1, CELL.z, 0, GROUND_Y + STOREY + 0.8); st = await settle(b)
  ok(Math.abs(st.py - (GROUND_Y + STOREY)) < 0.3, `3. B upstairs beside the shaft (feet ${st.py.toFixed(2)})`)
  const r0 = await ev(b, '__visit', 'refusals') as number
  await b.keyboard.press('e'); await sleep(900)
  ok(await poll(async () => ((await ev(b, '__visit', 'lifts')) as any)?.[LIFT.id] === 1, 15000), `3. E calls the car up to B (overlay ${JSON.stringify(await ev(b, '__visit', 'lifts'))})`)
  ok((await ev(b, '__visit', 'refusals')) === r0, '3. and nothing was refused')
  ok(JSON.stringify(await store(a)) === aSave && JSON.stringify(await store(b)) === bSave, '3. both saves still untouched')

  // 4 · Send home
  ok(await poll(async () => !!(await a.$(`[data-guests-pill] [data-guest="${idB}"]`)), 30000), `4. A's "On your plot" lists B (${await a.evaluate(() => document.querySelector('[data-guests-pill]')?.textContent ?? 'no pill')})`)
  ok(await tapSel(a, `[data-act="send-home"][data-guest="${idB}"]`, false), '4. A clicked Send home (real click)')
  ok(await poll(async () => ((await ev(b, '__visit', 'log')) as string[]).includes('end:sent-home'), 15000), `4. B was sent home (${JSON.stringify(await ev(b, '__visit', 'log'))})`)
  ok(await poll(async () => (await ev(b, '__mp', 'zone')) === `open:plot:${idB}` && JSON.stringify(((await ev(b, '__ather', 'works')) as any)?.pieces?.map((x: any) => x.item)) === '["goldwood_stool"]', 20000), `4. B is on its own plot again (${await ev(b, '__mp', 'zone')})`)
  ok(await poll(async () => !(await a.$('[data-guests-pill]')), 15000), "4. A's pill is gone (no guests)")

  // 5 · host offline
  ok(await visit(b, idA), '5. B visits again')
  const t0 = Date.now(); await a.close()
  ok(await poll(async () => ((await ev(b, '__visit', 'log')) as string[]).includes('end:host-left'), 30000), `5. A's tab closed: B goes home by itself in ${((Date.now() - t0) / 1000).toFixed(1)} s (${JSON.stringify(await ev(b, '__visit', 'log'))})`)
  ok(await poll(async () => (await ev(b, '__mp', 'zone')) === `open:plot:${idB}`, 20000), '5. B hosts its own plot again')
  if (PHONE) ok(await b.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '5. phone: no sideways scroll')
  ok(errs.length === 0, `6. page errors: ${errs.length} ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
