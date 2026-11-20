// M48 slice 1 check (lift-check): the LIFT, from the carpentry bench to a real ride.
//   1. SETUP (stated): a carpentry room standing at (-100, 100) and a built 2-level 4x3 house (seeded in open.works.v1, like
//      plot-floors-check's result); the bag holds planks + Stone Brick. Hooks: __ather.tp / state / look, movement + reading only.
//   2. craft a Lift at the Carpentry station (planks + Stone Brick), hold it from the hotbar, E sets it on a cell inside the house
//   3. stand on the car, aim the crosshair at the floor-2 pull-cord IN THE WORLD, click: the car carries the keeper one storey up
//   4. click the floor-1 cord: back down. 5. teleport up to floor 2 (dev hook), E at the shaft calls the car up to it
//   6. reload keeps the lift and its car. 7. 0 page errors
//   npx tsx scripts/lift-check.mts [--url http://localhost:3201] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { benchOf, KEEP_CLEAR, type Room } from '../src/app/shimmer/open/ather/rooms'
import { planRun, runKeys, findRooms, type Walls } from '../src/app/shimmer/open/ather/plot-walls'
import { cordsOf } from '../src/app/shimmer/open/ather/lift'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/lift')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const STOREY = 5.0   // M50: WALL_H 4.8 + slab 0.2 (was 3.4)
const ROOM: Room = { id: 'carpentry-check', kind: 'carpentry', x: -100, z: 100, q: 0, placedAt: 1, doneAt: 2 }

const held = new Set(STARTING_SQUARES)
const isHeld = (x: number, z: number) => { const s = squareAt(x, z); return !!s && held.has(sqId(s.i, s.j)) }
let spot: { x: number; z: number } | null = null
for (const R of [10, 8]) {
  for (let z = -150; z <= 150 && !spot; z++) for (let x = -150; x <= 150 && !spot; x++) {
    let good = KEEP_CLEAR.every(c => Math.hypot(c.x - x, c.z - z) > c.r + R) && Math.hypot(x + 100, z - 100) > R + 14
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

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 760 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((room: Room, house: unknown) => {
    if (sessionStorage.getItem('lc')) return; sessionStorage.setItem('lc', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'goldwood_plank', n: 12 }; slots[9] = { id: 'stone_brick', n: 6 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [room], chests: [], pieces: [], ...(house as object) }))
  }, ROOM, HOUSE)
  const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
  const bag = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
  const lifts = async () => (((await read('open.works.v1'))?.pieces ?? []) as { item: string; x: number; z: number; q: number; lv?: number }[]).filter(x => x.item === 'lift')
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const tp = async (x: number, z: number, yaw: number, y?: number) => { await p.evaluate((a, b, c, d) => (window as any).__ather.tp(a, b, c, d), x, z, yaw, y); await sleep(1500); await shot('_f'); await shot('_f') }
  const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); return !!b }
  const poll = async (fn: () => Promise<boolean>, ms = 150000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(500) } return false }
  const outOf = async () => { const r: Record<string, number> = {}; for (const s of ((await read('open.works.v1'))?.rooms?.[0]?.out ?? []) as ({ id: string; n: number } | null)[]) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r }
  const state = () => p.evaluate(() => (window as any).__ather.state())
  const settle = async () => { let last = 1e9, st: any = null; for (let n = 0; n < 40; n++) { st = await state(); if (Math.abs(st.py - last) < 0.005) break; last = st.py; await sleep(1000) } return st }
  const boot = async () => { await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard() }
  await boot()

  // 1. craft a Lift at the Carpentry station
  const b = benchOf(ROOM)
  await tp(b.x, b.z - 1.2, 0)
  await p.keyboard.press('e'); await sleep(900)
  await click('[data-bench-tab="furniture"]'); await sleep(300)   // bench tabs (11-20): pieces live on their own tab
  await click('[data-job-pick="lift"]'); await sleep(300)
  await click('[data-src-item="goldwood_plank"] [data-move="all"]'); await sleep(400)
  await click('[data-src-item="stone_brick"] [data-move="all"]'); await sleep(400)
  await click('[data-qty="max"]'); await sleep(200)
  ok(await click('[data-act="focus"] button'), '1. carpentry: pick Lift, stock planks + Stone Brick, Focus')
  ok(await poll(async () => ((await outOf()).lift ?? 0) >= 1), '   the station makes a Lift')
  await sleep(500); await click('[data-act="collect-all"] button'); await sleep(600)
  const afterMake = await bag(); ok((afterMake.lift ?? 0) >= 1 && !afterMake.stone_brick, `   collected: a Lift in the bag, bricks spent (${JSON.stringify(afterMake)})`)
  await p.keyboard.press('Escape'); await sleep(500)

  // 2. hold it from the hotbar, E sets it on a house cell (ghost 1.7 m ahead of the keeper, facing +x)
  const slot = (((await read('open.inv.v1'))?.slots ?? []) as ({ id: string } | null)[]).findIndex(x => x?.id === 'lift'); ok(slot >= 0 && slot < 8, `2. the Lift lands on the hotbar (slot ${slot + 1})`)
  await tp(CELL.x - 1.7, CELL.z, -Math.PI / 2)
  await p.keyboard.press(`Digit${slot + 1}`); await sleep(1800)
  ok(await p.evaluate(() => !!document.querySelector('[data-placing]')), '   held: the placing ghost shows')
  await p.keyboard.press('e'); await sleep(1200)
  if (!(await lifts()).length) { await sleep(1500); await p.keyboard.press('e'); await sleep(1200) }   // the ghost can lag a slow swiftshader frame
  const L = await lifts(); ok(L.length === 1 && Math.floor(L[0].x) === Math.floor(CELL.x) && Math.floor(L[0].z) === Math.floor(CELL.z) && (await bag()).lift === undefined, `   placed on the cell (${JSON.stringify(L)})`)
  if (!L.length) throw new Error('no lift placed')
  const lp = L[0]

  // aim the crosshair at the cord of `level` from the car and click the canvas centre
  const clickCord = async (level: number, carY: number) => {
    const c = cordsOf({ id: 'l', item: 'lift', x: lp.x, z: lp.z, q: lp.q, placedAt: 1 }, carY, 2)[level]
    const st = await state(), ey = st.py + (st.eye ?? 1.6), dx = c.x - st.px, dz = c.z - st.pz, dy = c.y0 + 0.3 - ey
    await p.evaluate((yw, pt) => (window as any).__ather.look(yw, pt), Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)))
    await sleep(800); await hideCard(); await p.mouse.move(550, 380); await sleep(200); await p.mouse.click(550, 380)
    const st2 = await state(); console.log(`   [aim L${level}] feet ${st2.py.toFixed(2)} at ${st2.px.toFixed(2)},${st2.pz.toFixed(2)} cord ${c.x.toFixed(2)},${c.z.toFixed(2)} lv ${(await lifts())[0]?.lv}`)
  }
  // 3. stand on the car (ground), click the floor-2 cord
  await tp(lp.x, lp.z, 0); await settle(); await shot('lift-1-on-car')
  let st = await state(); ok(Math.abs(st.py - GROUND_Y) < 0.25, `3. standing on the car at the ground: feet ${st.py.toFixed(2)}`)
  await clickCord(1, GROUND_Y)
  ok(await poll(async () => ((await lifts())[0]?.lv ?? 0) === 1, 20000), '   click the floor-2 cord: the car is sent to level 2')
  ok(await poll(async () => Math.abs((await state()).py - (GROUND_Y + STOREY)) < 0.15, 60000), '   and the keeper rides it up')
  st = await settle(); ok(Math.abs(st.py - (GROUND_Y + STOREY)) < 0.25, `   feet one storey up: ${st.py.toFixed(2)} vs ${(GROUND_Y + STOREY).toFixed(2)}`)
  await shot('lift-2-upstairs')
  // 4. ride back
  await clickCord(0, GROUND_Y + STOREY)
  ok(await poll(async () => ((await lifts())[0]?.lv ?? 1) === 0, 20000), '4. click the floor-1 cord: the car is sent back')
  ok(await poll(async () => Math.abs((await state()).py - GROUND_Y) < 0.15, 60000), '   and the keeper is back on the ground')
  // 5. up by teleport (dev hook), call it from floor 2 with E
  await tp(lp.x - 1.1, lp.z, 0, GROUND_Y + STOREY + 0.8); st = await settle()
  ok(Math.abs(st.py - (GROUND_Y + STOREY)) < 0.25, `5. on floor 2 beside the shaft (feet ${st.py.toFixed(2)}), the car is below`)
  await p.keyboard.press('e'); await sleep(900)
  ok(await poll(async () => ((await lifts())[0]?.lv ?? 0) === 1, 15000), '   E at the shaft calls the car up to floor 2')
  await sleep(2500); await shot('lift-3-called')
  // 6. reload keeps it
  await p.reload({ waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
  const L2 = await lifts(); ok(L2.length === 1 && L2[0].lv === 1, `6. a reload keeps the lift and its car at level 2 (${JSON.stringify(L2)})`)
  ok(errs.length === 0, `7. 0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
