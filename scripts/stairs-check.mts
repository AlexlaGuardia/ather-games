// ── M56 STAIRS check (hub 11-20) ──────────────────────────────────────────────────────────────────────────────────────────
// SETUP (stated): a BUILT 6 x 8 room on the ground with a south doorway and the same room on floor 2 (injected works), 40
// planks. Real inputs: E at the table, Plan, the Stairs tool, a click on the foot cell (projected through plan mode's own lens,
// view yaw 0 = the stairs climb north), Build, leave plan, hold W from the foot.
//   1. a tap plans stairs climbing away from the view  2. Build stands them for 12 planks  3. the keeper walks up to floor 2
//   4. a reload keeps them; 0 page errors.   npx tsx scripts/stairs-check.mts [--url ...] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
import { findRooms } from '../src/app/shimmer/open/ather/plot-walls'
import { STOREY } from '../src/app/shimmer/open/ather/plot-floors'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/stairs-check')
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
const X0 = spot.x - 3, X1 = spot.x + 3, Z0 = spot.z - 4, Z1 = spot.z + 4   // 6 x 8
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
  // SETUP: a BUILT 6 x 8 room on the ground and the same room on floor 2 (its slab), injected; the stairs are placed for real
  const walls: Record<string, { mat: string }> = {}
  for (let x = X0; x < X1; x++) { walls[`h,${x},${Z0}`] = { mat: 'goldwood' }; walls[`h,${x},${Z1}`] = { mat: 'goldwood' } }
  for (let z = Z0; z < Z1; z++) { walls[`v,${X0},${z}`] = { mat: 'goldwood' }; walls[`v,${X1},${z}`] = { mat: 'goldwood' } }
  // a doorway on the south wall so the keeper walks in (2 m at X0+3..X0+5)
  walls[`h,${X0 + 3},${Z1}`] = { mat: 'goldwood', kind: 'door' } as any; walls[`h,${X0 + 4},${Z1}`] = { mat: 'goldwood', kind: 'door' } as any
  const rk = findRooms(walls as any)[0].key, paid = { [rk]: 48 }
  const works = { v: 1, rooms: [], chests: [], pieces: [], walls, paid, roof: 'flat', upper: [{ walls, paid }] }
  await p.evaluateOnNewDocument((works: string) => {
    if (sessionStorage.getItem('stairc')) return; sessionStorage.setItem('stairc', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'goldwood_plank', n: 40 }
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
  const stairs = () => p.evaluate(() => (JSON.parse(localStorage.getItem('open.works.v1') ?? '{}').stairs ?? {}) as Record<string, { mat: string; dir: number; draft?: boolean }>)
  const press = async (x: number, y: number) => { await p.evaluate((px: number, py: number) => { for (const e of document.elementsFromPoint(px, py)) { if (e.tagName === 'CANVAS') break; (e as HTMLElement).style.pointerEvents = 'none'; (e as HTMLElement).dataset.pe = '1' } }, x, y); await p.mouse.move(x, y); await p.mouse.down(); await sleep(120); await p.mouse.move(x + 1, y + 1); await p.mouse.up(); await p.evaluate(() => document.querySelectorAll<HTMLElement>('[data-pe]').forEach(e => { e.style.pointerEvents = ''; delete e.dataset.pe })) }
  const SI = X0 + 1, SJ = Z1 - 1   // the foot of the stairs: the SW-ish inside cell, climbing north (view yaw 0)

  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  await p.mouse.click(550, 340); await sleep(600)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), TABLE.x + 1.6, TABLE.z + 1.6); await sleep(1500)
  await p.keyboard.press('e'); await sleep(1000); await tap('[data-act="plan"]')
  ok(await poll(() => p.evaluate(() => (window as any).__build?.on() === true)), 'E at the table, Plan: flying')
  await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), spot.x, spot.z)
  ok(await tap('[data-tool="stairs"]'), '1. the plan bar has a Stairs tool'); await sleep(400)
  let placed = false
  for (let t = 0; t < 3 && !placed; t++) { await settled(); const v = await view(), s = screenOf(v, SI + 0.5, SJ + 0.5); await press(s.x, s.y); await sleep(900); placed = !!(await stairs())[`${SI},${SJ}`] }
  const s1 = await stairs()
  ok(s1[`${SI},${SJ}`]?.draft === true && s1[`${SI},${SJ}`]?.dir === 0, `   a tap at the foot plans stairs climbing north, away from the view (${JSON.stringify(s1)})`)
  const p0 = await planks()
  ok(await poll(async () => p.evaluate(() => document.querySelector('[data-plan-bom]')?.getAttribute('data-ready') === 'true')), '   the list is met: Build is ready')
  ok(await tap('[data-act="build-plan"] button') && await poll(async () => { const x = await stairs(); return !!x[`${SI},${SJ}`] && !x[`${SI},${SJ}`].draft }), '2. Build stands the stairs')
  ok(p0 - (await planks()) === 12, `   they cost 12 planks (${p0 - (await planks())})`)
  await shot('stairs-1-built')
  // 3. walk up: leave plan mode, stand at the foot facing north, hold W until a storey up or 30 s
  await p.keyboard.press('Escape'); await sleep(1200); await p.mouse.click(550, 340); await sleep(400)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), SI + 1, SJ + 0.6); await sleep(1500)
  const g0 = await p.evaluate(() => (window as any).__ather.state().py)
  await p.keyboard.down('KeyW')
  await poll(async () => (await p.evaluate(() => (window as any).__ather.state().py)) > g0 + STOREY - 0.3, 30000)
  await p.keyboard.up('KeyW'); await sleep(800)
  const up = await p.evaluate(() => { const a = (window as any).__ather.state(); return { y: a.py, z: a.pz } })
  ok(up.y > g0 + STOREY - 0.3, `3. the keeper walks up the stairs to floor 2 (feet ${up.y.toFixed(2)}, ground ${g0.toFixed(2)}, storey ${STOREY})`)
  try { await p.screenshot({ path: `${out}/stairs-2-upstairs.png` }) } catch { /* slow frame */ }
  // a look from inside on the ground: the south-east corner, facing north-west up the steps (the slab above is open over them)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), X0 + 4.4, Z1 - 0.6); await sleep(2500)
  try { await p.screenshot({ path: `${out}/stairs-3-inside.png` }) } catch { /* slow frame */ }
  // 4. reload keeps them
  await p.reload({ waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2000)
  const s2 = await stairs(); ok(!!s2[`${SI},${SJ}`] && !s2[`${SI},${SJ}`].draft, '4. a reload keeps the stairs')
  ok(errs.length === 0, `   0 page errors ${errs.slice(0, 3).join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
