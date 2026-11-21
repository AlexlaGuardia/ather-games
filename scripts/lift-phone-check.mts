// M48 PHONE leg (lift-phone-check, sprites 11-21): the lift by TOUCH at 390 x 844 (isMobile, hasTouch). Every input is a real tap.
//   SETUP (stated): a built 2-level 4x3 house with a LIFT already standing on a cell inside it (car at level 1); crafting it is the
//   desktop lift-check's job. Hooks: __ather.tp / state / look (movement + aim only).
//   1. on the car, aim at the floor-2 pull-cord, TAP it: the car carries the keeper up  2. tap the floor-1 cord: back down
//   3. on floor 2 beside the shaft, the phone's 'use' chip shows; a tap calls the car up  4. reload keeps it  5. 0 page errors
//   npx tsx scripts/lift-phone-check.mts [--url ...] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { planRun, runKeys, findRooms, type Walls } from '../src/app/shimmer/open/ather/plot-walls'
import { cordsOf } from '../src/app/shimmer/open/ather/lift'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/lift-phone')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const STOREY = 5.0   // M50: WALL_H 4.8 + slab 0.2 (was 3.4)

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
const HOUSE = { walls, paid: { [rk]: 12 }, upper: [{ walls: box(), paid: { [rk]: 12 } }], roof: 'gable' }
const CELL = { x: X0 + 2.5, z: Z0 + 1.5 }   // the shaft cell, inside the room
console.log(`house ${X0}..${X1} x ${Z0}..${Z1}, shaft cell ${CELL.x},${CELL.z}`)

const W = 390, H = 844
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H, isMobile: true, hasTouch: true })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  const LIFT = { id: 'lift-phone', item: 'lift', x: CELL.x, z: CELL.z, q: 0, placedAt: 1, lv: 0 }
  await p.evaluateOnNewDocument((house: unknown, lift: unknown) => {
    if (sessionStorage.getItem('lpc')) return; sessionStorage.setItem('lpc', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [lift], ...(house as object) }))
  }, HOUSE, LIFT)
  const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
  const lifts = async () => (((await read('open.works.v1'))?.pieces ?? []) as { item: string; x: number; z: number; q: number; lv?: number }[]).filter(x => x.item === 'lift')
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => /Click to play|Tap to play/.test(d.textContent ?? '')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const tp = async (x: number, z: number, yaw: number, y?: number) => { await p.evaluate((a, b, c, d) => (window as any).__ather.tp(a, b, c, d), x, z, yaw, y); await sleep(1500) }
  const poll = async (fn: () => Promise<boolean>, ms = 150000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(500) } return false }
  const state = () => p.evaluate(() => (window as any).__ather.state())
  const settle = async () => { let last = 1e9, st: any = null; for (let n = 0; n < 40; n++) { st = await state(); if (Math.abs(st.py - last) < 0.005) break; last = st.py; await sleep(1000) } return st }
  // a real tap on the canvas at the screen centre (where the aim points); overlays in the way step aside, as under a finger
  const tapCentre = async () => {
    const x = W / 2, y = H / 2
    await p.evaluate((px: number, py: number) => { for (const e of document.elementsFromPoint(px, py)) { if (e.tagName === 'CANVAS') break; (e as HTMLElement).style.pointerEvents = 'none'; (e as HTMLElement).dataset.pe = '1' } }, x, y)
    await p.touchscreen.tap(x, y); await sleep(300)
    await p.evaluate(() => document.querySelectorAll<HTMLElement>('[data-pe]').forEach(e => { e.style.pointerEvents = ''; delete e.dataset.pe }))
  }
  const tapCord = async (level: number, carY: number) => {
    const c = cordsOf({ id: 'l', item: 'lift', x: LIFT.x, z: LIFT.z, q: 0, placedAt: 1 }, carY, 2)[level]
    const st = await state(), ey = st.py + (st.eye ?? 1.6), dx = c.x - st.px, dz = c.z - st.pz, dy = c.y0 + 0.3 - ey
    await p.evaluate((yw, pt) => (window as any).__ather.look(yw, pt), Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)))
    await sleep(900); await hideCard(); await tapCentre()
  }
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  await p.touchscreen.tap(W / 2, H - 200); await sleep(600)
  // 1. on the car: tap the floor-2 cord
  await tp(LIFT.x, LIFT.z, 0); let st = await settle()
  ok(Math.abs(st.py - GROUND_Y) < 0.25, `   standing on the car at the ground (feet ${st.py.toFixed(2)})`)
  for (let t = 0; t < 3 && ((await lifts())[0]?.lv ?? 0) !== 1; t++) { await tapCord(1, GROUND_Y); await sleep(1500) }
  ok(await poll(async () => ((await lifts())[0]?.lv ?? 0) === 1, 20000), '1. a TAP on the floor-2 cord sends the car up')
  ok(await poll(async () => Math.abs((await state()).py - (GROUND_Y + STOREY)) < 0.15, 60000), '   and the keeper rides it to floor 2')
  st = await settle(); await shot('liftph-1-up')
  // 2. tap the floor-1 cord
  for (let t = 0; t < 3 && ((await lifts())[0]?.lv ?? 1) !== 0; t++) { await tapCord(0, GROUND_Y + STOREY); await sleep(1500) }
  ok(await poll(async () => ((await lifts())[0]?.lv ?? 1) === 0, 20000), '2. a TAP on the floor-1 cord sends it back')
  ok(await poll(async () => Math.abs((await state()).py - GROUND_Y) < 0.15, 60000), '   and the keeper is back on the ground')
  // 3. floor 2 beside the shaft: the 'use' chip calls it
  await tp(LIFT.x - 1.1, LIFT.z, -Math.PI / 2, GROUND_Y + STOREY + 0.8); st = await settle()
  ok(Math.abs(st.py - (GROUND_Y + STOREY)) < 0.25, `   on floor 2 beside the shaft (feet ${st.py.toFixed(2)}), the car below`)
  const chip = await poll(() => p.evaluate(() => !!document.querySelector('[data-touch="use"][data-touch-near]')), 10000)
  ok(chip, '3. the phone shows its "use" chip by the shaft')
  const b = await p.evaluate(() => { const e = document.querySelector<HTMLElement>('[data-touch="use"][data-touch-near]'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  if (b) await p.touchscreen.tap(b.x, b.y)
  ok(await poll(async () => ((await lifts())[0]?.lv ?? 0) === 1, 15000), '   a TAP on it calls the car up to floor 2')
  await sleep(2500); await shot('liftph-2-called')
  // 4. reload
  await p.reload({ waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
  const L2 = await lifts(); ok(L2.length === 1 && L2[0].lv === 1, `4. a reload keeps the car at floor 2 (${JSON.stringify(L2.map(l => l.lv))})`)
  ok(errs.length === 0, `5. 0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
