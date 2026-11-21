// ── M55 FOUNDATION check (hub 11-20) ──────────────────────────────────────────────────────────────────────────────────────
// SETUP (stated): a BUILT 4 x 4 room with a 2 m south door (injected works), 40 Stone Brick. Real inputs: E at the table, Plan,
// the Foundation buttons, leave plan, hold W from outside the door.
//   1. Low = 0.6 m for 16 bricks  2. the keeper walks up the door steps onto the raised floor  3. High pays the difference, None
//   gives it all back  4. a reload keeps it; 0 page errors.   npx tsx scripts/found-check.mts [--url ...] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
import { findRooms } from '../src/app/shimmer/open/ather/plot-walls'
import { STOREY } from '../src/app/shimmer/open/ather/plot-floors'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/found-check')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const PHONE = process.argv.includes('--phone')   // 390x844 touch: the paint framing at phone size (the bar lays out differently)
const W = PHONE ? 390 : 1100, H = PHONE ? 844 : 680, PITCH = 0.98   // = build-mode.tsx BUILD_CAM.PITCH

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
const X0 = spot.x - 2, X1 = spot.x + 2, Z0 = spot.z - 2, Z1 = spot.z + 2   // 4 x 4
console.log(`room ${X0}..${X1} x ${Z0}..${Z1}`)
// plan mode's lens (build-mode.tsx lensFor) → screen pixels
function screenOf(v: { x: number; z: number; h: number; yaw: number }, wx: number, wz: number) {
  const back = v.h / Math.tan(PITCH)
  const cam = new THREE.PerspectiveCamera(75, W / H, 0.05, 900)
  cam.position.set(v.x + Math.sin(v.yaw) * back, GROUND_Y + v.h, v.z + Math.cos(v.yaw) * back); cam.rotation.set(-PITCH, v.yaw, 0, 'YXZ'); cam.updateMatrixWorld()
  const p = new THREE.Vector3(wx, GROUND_Y, wz).project(cam)
  return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H }
}

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(PHONE ? { width: W, height: H, isMobile: true, hasTouch: true } : { width: W, height: H })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  // SETUP: a BUILT 4 x 4 room with a south door, injected; 40 Stone Brick in the bag
  const walls: Record<string, { mat: string }> = {}
  for (let x = X0; x < X1; x++) { walls[`h,${x},${Z0}`] = { mat: 'goldwood' }; walls[`h,${x},${Z1}`] = { mat: 'goldwood' } }
  for (let z = Z0; z < Z1; z++) { walls[`v,${X0},${z}`] = { mat: 'goldwood' }; walls[`v,${X1},${z}`] = { mat: 'goldwood' } }
  // a doorway on the south wall (X0+1..X0+3)
  walls[`h,${X0 + 1},${Z1}`] = { mat: 'goldwood', kind: 'door' } as any; walls[`h,${X0 + 2},${Z1}`] = { mat: 'goldwood', kind: 'door' } as any
  const rk = findRooms(walls as any)[0].key, paid = { [rk]: 16 }
  const works = { v: 1, rooms: [], chests: [], pieces: [], walls, paid, roof: 'gable' }
  await p.evaluateOnNewDocument((works: string) => {
    if (sessionStorage.getItem('foundc')) return; sessionStorage.setItem('foundc', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'stone_brick', n: 40 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', works)
  }, JSON.stringify(works))
  const planks = () => p.evaluate(() => ((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []) as ({ id: string; n: number } | null)[]).reduce((t, s) => t + (s?.id === 'goldwood_plank' ? s.n : 0), 0))
  const brickCount = () => p.evaluate(() => ((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []) as ({ id: string; n: number } | null)[]).reduce((t, s) => t + (s?.id === 'stone_brick' ? s.n : 0), 0))
  const draftN = () => p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('open.works.v1') ?? '{}').walls ?? {}).filter((x: any) => x.draft).length)
  const saved = () => p.evaluate(() => { const w = JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'); return { walls: Object.keys(w.walls ?? {}).length, roof: w.roof } })
  const savedFull = () => p.evaluate(() => { const w = JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'); return { walls: (w.walls ?? {}) as Record<string, { mat: string; kind?: string }>, floors: (w.floors ?? {}) as Record<string, string> } })
  const wallsProbe = () => p.evaluate(() => { const w = (window as any).__walls; return w ? { rooms: w.rooms(), down: w.down(), roof: w.roof() } : null })
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const tap = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await p.mouse.click(b.x, b.y); return true }
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }
  const view = () => p.evaluate(() => (window as any).__build.view())
  // settled = the lens has stopped moving (yaw home). Not 'aimed at the spot': since 57a58263 view() reports the REAL aim, which the
  // Paint lift shifts toward the camera, so an exact-position test never settles with Paint on.
  const settled = () => poll(async () => { const a = await view(); await sleep(500); const b = await view(); return Math.hypot(a.x - b.x, a.z - b.z) < 0.02 && Math.abs(a.yaw) < 0.01 && Math.abs(a.h - b.h) < 0.05 }, 60000)
  // M55 slice 2: the house's own value (per cell), else the old plot-wide one
  const found = () => p.evaluate((c: string) => { const w = JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'); return w.foundCells?.[c] ?? w.found ?? 0 }, `${X0},${Z0}`)
  const bricks = () => p.evaluate(() => ((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []) as ({ id: string; n: number } | null)[]).reduce((t, s) => t + (s?.id === 'stone_brick' ? s.n : 0), 0))
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  await p.mouse.click(550, 340); await sleep(600)
  // ground level outside the door, before
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), X0 + 2, Z1 + 3); await sleep(1500)
  const g0 = await p.evaluate(() => (window as any).__ather.state().py)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), TABLE.x + 1.6, TABLE.z + 1.6); await sleep(1500)
  await p.keyboard.press('e'); await sleep(1000); await tap('[data-act="plan"]')
  ok(await poll(() => p.evaluate(() => (window as any).__build?.on() === true)), 'E at the table, Plan: flying')
  await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), spot.x, spot.z)
  await tap('[data-tool="walls"]'); await sleep(400)
  await poll(() => p.evaluate(() => !(document.querySelector('[data-found="0.6"]') as HTMLButtonElement | null)?.disabled), 15000)   // slice 2: the picker lights once the view is on a house
  ok(await tap('[data-found="0.6"]') && await poll(async () => (await found()) === 0.6), '1. Foundation: Low sets the house on 0.6 m')
  ok((await bricks()) === 40 - 16, `   it cost 16 Stone Brick for the 16 m² (${40 - (await bricks())})`)
  await shot('found-1-plan')
  // 2. walk in: leave plan mode, from the south up the door steps
  await p.keyboard.press('Escape'); await sleep(1200); await p.mouse.click(550, 340); await sleep(400)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), X0 + 6, Z1 + 4); await sleep(2500)
  try { await p.screenshot({ path: `${out}/found-2-outside.png` }) } catch { /* slow frame */ }
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), X0 + 2, Z1 + 2.5); await sleep(1500)
  await p.keyboard.down('KeyW')
  await poll(async () => (await p.evaluate(() => (window as any).__ather.state().pz)) < Z1 - 1, 25000)
  await p.keyboard.up('KeyW'); await sleep(800)
  const st = await p.evaluate(() => { const a = (window as any).__ather.state(); return { y: a.py, z: a.pz } })
  ok(st.z < Z1 - 0.5 && Math.abs(st.y - (g0 + 0.6)) < 0.25, `2. the keeper walks up the steps and in onto the raised floor (z ${st.z.toFixed(2)}, feet ${st.y.toFixed(2)}, ground ${g0.toFixed(2)})`)
  // 3. High costs the difference; None gives it all back
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), TABLE.x + 1.6, TABLE.z + 1.6); await sleep(1500)
  await p.keyboard.press('e'); await sleep(1000); await tap('[data-act="plan"]'); await poll(() => p.evaluate(() => (window as any).__build?.on() === true))
  await tap('[data-tool="walls"]'); await sleep(400)
  await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), spot.x, spot.z)   // slice 2: the picker acts on the house in view
  await poll(() => p.evaluate(() => (document.querySelector('[data-found="0.6"]') as HTMLButtonElement | null)?.getAttribute('aria-pressed') === 'true'), 15000)
  ok(await tap('[data-found="1.2"]') && await poll(async () => (await found()) === 1.2 && (await bricks()) === 40 - 32), `3. High pays 16 more (${40 - (await bricks())} spent)`)
  ok(await tap('[data-found="0"]') && await poll(async () => (await found()) === 0 && (await bricks()) === 40), `   None gives every brick back (${await bricks()})`)
  await tap('[data-found="0.6"]'); await poll(async () => (await found()) === 0.6)
  // 4. reload keeps it
  await p.reload({ waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2000)
  ok((await found()) === 0.6, '4. a reload keeps the foundation')
  ok(errs.length === 0, `   0 page errors ${errs.slice(0, 3).join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
