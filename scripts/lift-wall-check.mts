// lift-wall-check (BETA M48 leftover): the wall tool refuses a run through a lift SHAFT on an upper floor (the shaft goes up
// through every level; the ground already refused it via the lift piece). SETUP (stated): a built 2-level 4x3 house + a lift in
// one cell, seeded in open.works.v1. Real plan mode: E at the table, Plan, Walls, the floor-2 switch, real drags.
//   1. floor 2: a 2 m interior run along the shaft cell's edge is refused (nothing saved) and the tool says why
//   2. control: the same run one cell away from the shaft is laid (a draft on floor 2)
//   3. floor 1: a run along the shaft cell is refused too. 0 page errors.
//   npx tsx scripts/lift-wall-check.mts [--url http://localhost:3203] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { planRun, runKeys, findRooms, type Walls } from '../src/app/shimmer/open/ather/plot-walls'
import { SHAFT_WHY } from '../src/app/shimmer/open/ather/lift'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/lift-wall-check')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const W = 1100, H = 680, PITCH = 0.98   // = build-mode.tsx BUILD_CAM.PITCH

const held = new Set(STARTING_SQUARES)
const isHeld = (x: number, z: number) => { const s = squareAt(x, z); return !!s && held.has(sqId(s.i, s.j)) }
let spot: { x: number; z: number } | null = null
for (const R of [14, 12, 10, 8]) {
  for (let z = -150; z <= 150 && !spot; z++) for (let x = -150; x <= 150 && !spot; x++) {
    let good = KEEP_CLEAR.every(c => Math.hypot(c.x - x, c.z - z) > c.r + R)
    for (let a = 0; a < 16 && good; a++) for (const d of [0, R / 2, R]) { if (!isHeld(x + Math.cos(a * Math.PI / 8) * d, z + Math.sin(a * Math.PI / 8) * d)) good = false }
    if (good) spot = { x, z }
  }
  if (spot) break
}
if (!spot) { console.log('no clear held spot'); process.exit(1) }
const X0 = spot.x - 2, X1 = spot.x + 2, Z0 = spot.z - 1, Z1 = spot.z + 2   // 4 x 3
console.log(`room ${X0}..${X1} x ${Z0}..${Z1}`)
const box = (): Walls => {
  let ws: Walls = {}
  for (const [a, b] of [[{ i: X0, j: Z0 }, { i: X1, j: Z0 }], [{ i: X0, j: Z1 }, { i: X1, j: Z1 }], [{ i: X0, j: Z0 }, { i: X0, j: Z1 }], [{ i: X1, j: Z0 }, { i: X1, j: Z1 }]]) ws = planRun(ws, runKeys(a, b), 'goldwood')
  return Object.fromEntries(Object.entries(ws).map(([k, v]) => [k, { mat: v.mat }]))
}
const rk = findRooms(box())[0].key
const HOUSE = { walls: box(), paid: { [rk]: 12 }, upper: [{ walls: box(), paid: { [rk]: 12 } }], roof: 'gable' }
const CELL = { x: X0 + 2.5, z: Z0 + 1.5 }   // the shaft cell (X0+2, Z0+1), inside the room
const LIFT = { id: 'lwc', item: 'lift', x: CELL.x, z: CELL.z, q: 0, placedAt: 1, lv: 0 }
// plan mode's lens (build-mode.tsx lensFor) → screen pixels
function screenOf(v: { x: number; z: number; h: number; yaw: number }, wx: number, wz: number, wy = GROUND_Y) {
  const back = v.h / Math.tan(PITCH)
  const cam = new THREE.PerspectiveCamera(75, W / H, 0.05, 900)
  cam.position.set(v.x + Math.sin(v.yaw) * back, GROUND_Y + v.h, v.z + Math.cos(v.yaw) * back); cam.rotation.set(-PITCH, v.yaw, 0, 'YXZ'); cam.updateMatrixWorld()
  const p = new THREE.Vector3(wx, wy, wz).project(cam)
  return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H }
}

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((house: unknown, lift: unknown) => { (window as any).__LWC = { house, lift } }, HOUSE, LIFT)
  await p.evaluateOnNewDocument(() => {
    if (sessionStorage.getItem('house')) return; sessionStorage.setItem('house', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'goldwood_plank', n: 120 }; slots[9] = { id: 'stone_brick', n: 60 }; slots[10] = { id: 'stucco', n: 30 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [(window as any).__LWC.lift], ...(window as any).__LWC.house }))
  })
  const count = (id: string) => p.evaluate((i: string) => ((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []) as ({ id: string; n: number } | null)[]).reduce((t, s) => t + (s?.id === i ? s.n : 0), 0), id)
  const bom = () => p.evaluate(() => { const e = document.querySelector('[data-plan-bom]'); if (!e) return null; const b = e.querySelector<HTMLButtonElement>('[data-act="build-plan"] button'); return { ready: e.getAttribute('data-ready') === 'true', disabled: !!b?.disabled, lines: Object.fromEntries([...e.querySelectorAll('[data-bom-line]')].map(l => [l.getAttribute('data-bom-line'), { need: +l.getAttribute('data-need')!, have: +l.getAttribute('data-have')!, short: l.getAttribute('data-short') === 'true' }])) } })
  const draftCount = () => p.evaluate(() => { const w = JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'); return { total: Object.keys(w.walls ?? {}).length, draft: Object.values(w.walls ?? {}).filter((x: any) => x.draft).length, paid: Object.keys(w.paid ?? {}).length } })
  const enterPlan = async () => { await p.mouse.click(550, 340); await sleep(600); await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), TABLE.x + 1.6, TABLE.z + 1.6); await sleep(1500); await p.keyboard.press('e'); await sleep(1000); await tap('[data-act="plan"]'); const r = await poll(() => p.evaluate(() => (window as any).__build?.on() === true)); await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), spot!.x, spot!.z); return r }
  const saved = () => p.evaluate(() => { const w = JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'); return { walls: Object.keys(w.walls ?? {}).length, roof: w.roof } })
  const savedFull = () => p.evaluate(() => { const w = JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'); return { walls: (w.walls ?? {}) as Record<string, { mat: string; kind?: string }>, floors: (w.floors ?? {}) as Record<string, string> } })
  const walls = () => p.evaluate(() => { const w = (window as any).__walls; return w ? { rooms: w.rooms(), down: w.down(), roof: w.roof() } : null })
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const tap = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await p.mouse.click(b.x, b.y); return true }
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }
  const view = () => p.evaluate(() => (window as any).__build.view())
  const settled = () => poll(async () => { const a = await view(); await sleep(500); const b = await view(); return Math.hypot(a.x - spot!.x, a.z - spot!.z) < 0.2 && Math.abs(a.yaw) < 0.01 && Math.abs(a.h - b.h) < 0.05 }, 60000)
  const dragW = async (ax: number, az: number, bx: number, bz: number) => {
    await settled(); const v = await view(), a = screenOf(v, ax, az), b = screenOf(v, bx, bz)
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b.x, b.y, { steps: 12 }); await p.mouse.up(); await sleep(900)
  }

  const count2 = (id: string) => count(id)

  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  ok(await enterPlan(), 'E at the table, Plan: flying')
  await tap('[data-tool="walls"]'); await sleep(300)
  const works = () => p.evaluate(() => JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'))
  const floors = () => p.evaluate(() => { const f = (window as any).__floors; return f ? { shown: f.shown() as number[], editing: f.editing() as number, count: f.count() as number } : null })
  const dc = (sel: string) => p.evaluate((x: string) => { document.querySelector<HTMLElement>(x)?.click() }, sel)
  const STOREY = 5.0   // M50: WALL_H 4.8 + slab 0.2 (was 3.4)
  // a drag on floor `lv`: the pointer's plane is that floor's, so project the points at its height
  const dragL = async (lv: number, ax: number, az: number, bx: number, bz: number) => {
    await settled(); const v = await view(), y = GROUND_Y + lv * STOREY, a = screenOf(v, ax, az, y), b = screenOf(v, bx, bz, y)
    // the plan bars can sit over the house at this zoom: let the pointer through them for the drag (the buttons are DOM-clicked)
    const bars = '[data-build-bar],[data-plan-bom],[data-floor-switch]'
    await p.evaluate((q: string) => document.querySelectorAll<HTMLElement>(q).forEach(e => { e.style.pointerEvents = 'none' }), bars)
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b.x, b.y, { steps: 12 }); await p.mouse.up(); await sleep(900)
    await p.evaluate((q: string) => document.querySelectorAll<HTMLElement>(q).forEach(e => { e.style.pointerEvents = 'auto' }), bars)
  }
  const room = async (lv: number) => { await dragL(lv, X0, Z0, X1, Z0); await dragL(lv, X0, Z1, X1, Z1); await dragL(lv, X0, Z0, X0, Z1); await dragL(lv, X1, Z0, X1, Z1) }
  const cnt = (w: any) => ({ g: Object.keys(w.walls ?? {}).length, u: Object.keys(w.upper?.[0]?.walls ?? {}).length })
  const said = () => p.evaluate((t: string) => document.body.innerText.includes(t), SHAFT_WHY)
  let w0 = await works(); ok(cnt(w0).g === 14 && cnt(w0).u === 14 && (w0.pieces ?? []).some((x: any) => x.item === 'lift'), `seeded: 2-level house + lift (${JSON.stringify(cnt(w0))})`)
  await dc('[data-floor="1"]'); await sleep(500)
  ok((await floors())?.editing === 1, 'editing floor 2')
  // 1. along the shaft cell's near edge (z = Z0+1), x from X0+1 to X0+3: it touches the shaft cell
  await dragL(1, X0 + 1, Z0 + 1, X0 + 3, Z0 + 1)
  let w1 = await works(); ok(cnt(w1).u === 14, `1. floor 2: a run along the shaft is refused, nothing saved (${cnt(w1).u} upper pieces)`)
  ok(await poll(said, 4000), `   the tool says "${SHAFT_WHY}"`)
  await shot('lwc-1-refused')
  // 2. control: the same 2 m run one cell further from the shaft (z = Z0+2 is the shaft's far edge, so take x along X0+1 instead)
  await dragL(1, X0 + 1, Z0 + 1, X0 + 1, Z0 + 3)
  w1 = await works(); ok(cnt(w1).u === 16, `2. control: a run one cell away on floor 2 is laid (${cnt(w1).u} upper pieces, want 16)`)
  // 3. floor 1 also refuses (the lift piece's rect)
  await dc('[data-floor="0"]'); await sleep(500)
  await dragL(0, X0 + 1, Z0 + 2, X0 + 3, Z0 + 2)
  w1 = await works(); ok(cnt(w1).g === 14, `3. floor 1: a run along the shaft is refused too (${cnt(w1).g} ground pieces)`)
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
} finally { await br.close() }
console.log(fails ? `lift-wall-check: ${fails} FAIL` : 'lift-wall-check: PASS')
process.exit(fails ? 1 : 0)
