// ── M56 (c) RAILING check (sprites 11-21) ─────────────────────────────────────────────────────────────────────────────────
// SETUP (stated): a BUILT 6 x 8 room with a south doorway, the same room on floor 2, and BUILT stairs inside climbing north
// (injected works), 40 planks. Real inputs: E at the table, Plan, the Walls tool, the Railing toggle, a drag along the grid
// north of the house (projected through plan mode's own lens), Build, leave plan, hold W into the railing; then upstairs, hold D
// at the stair hole from its west side.
//   1. the Walls tool has a Railing option and a drag plans railing pieces  2. Build stands them for a third of a wall's planks
//   3. the keeper walks into it and stops; its eye is over it  4. upstairs the stair hole is railed: walking at it from the side
//   does not drop you in  5. a reload keeps the railing; 0 page errors.   npx tsx scripts/railing-check.mts [--url ...] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
import { findRooms } from '../src/app/shimmer/open/ather/plot-walls'
import { STOREY } from '../src/app/shimmer/open/ather/plot-floors'
import { RAIL_H } from '../src/app/shimmer/open/ather/plot-walls'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/railing-check')
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
  const walls: Record<string, { mat: string; kind?: string }> = {}
  for (let x = X0; x < X1; x++) { walls[`h,${x},${Z0}`] = { mat: 'goldwood' }; walls[`h,${x},${Z1}`] = { mat: 'goldwood' } }
  for (let z = Z0; z < Z1; z++) { walls[`v,${X0},${z}`] = { mat: 'goldwood' }; walls[`v,${X1},${z}`] = { mat: 'goldwood' } }
  walls[`h,${X0 + 3},${Z1}`] = { mat: 'goldwood', kind: 'door' }; walls[`h,${X0 + 4},${Z1}`] = { mat: 'goldwood', kind: 'door' }
  const rk = findRooms(walls as any)[0].key, paid = { [rk]: 48 }
  const SI = X0 + 1, SJ = Z1 - 1   // stairs foot, climbing north: hole cells x SI..SI+1, z SJ-5..SJ
  const works = { v: 1, rooms: [], chests: [], pieces: [], walls, paid, roof: 'flat', stairs: { [`${SI},${SJ}`]: { mat: 'brick', dir: 0 } }, upper: [{ walls, paid }] }
  await p.evaluateOnNewDocument((works: string) => {
    if (sessionStorage.getItem('railc')) return; sessionStorage.setItem('railc', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'goldwood_plank', n: 40 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', works)
  }, JSON.stringify(works))
  const planks = () => p.evaluate(() => ((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []) as ({ id: string; n: number } | null)[]).reduce((t, s) => t + (s?.id === 'goldwood_plank' ? s.n : 0), 0))
  const rails = () => p.evaluate(() => Object.entries(JSON.parse(localStorage.getItem('open.works.v1') ?? '{}').walls ?? {}).filter(([, x]: any) => x.kind === 'rail') as [string, { mat: string; draft?: boolean }][])
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const tap = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await p.mouse.click(b.x, b.y); return true }
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }
  const view = () => p.evaluate(() => (window as any).__build.view())
  const settled = () => poll(async () => { const a = await view(); await sleep(500); const b = await view(); return Math.hypot(a.x - b.x, a.z - b.z) < 0.02 && Math.abs(a.yaw) < 0.01 && Math.abs(a.h - b.h) < 0.05 }, 60000)
  const unblock = (x: number, y: number) => p.evaluate((px: number, py: number) => { for (const e of document.elementsFromPoint(px, py)) { if (e.tagName === 'CANVAS') break; (e as HTMLElement).style.pointerEvents = 'none'; (e as HTMLElement).dataset.pe = '1' } }, x, y)
  const reblock = () => p.evaluate(() => document.querySelectorAll<HTMLElement>('[data-pe]').forEach(e => { e.style.pointerEvents = ''; delete e.dataset.pe }))
  const drag = async (a: { x: number; y: number }, b: { x: number; y: number }) => { await unblock(a.x, a.y); await unblock(b.x, b.y); await p.mouse.move(a.x, a.y); await p.mouse.down(); for (let n = 1; n <= 8; n++) { await p.mouse.move(a.x + (b.x - a.x) * n / 8, a.y + (b.y - a.y) * n / 8); await sleep(40) } await p.mouse.up(); await reblock() }
  const RZ = Z0 - 3, RA = X0 + 1, RB = X0 + 5   // a 4 m railing 3 m north of the house

  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  await p.mouse.click(550, 340); await sleep(600)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), TABLE.x + 1.6, TABLE.z + 1.6); await sleep(1500)
  await p.keyboard.press('e'); await sleep(1000); await tap('[data-act="plan"]')
  ok(await poll(() => p.evaluate(() => (window as any).__build?.on() === true)), 'E at the table, Plan: flying')
  await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), spot.x, RZ)
  ok(await tap('[data-tool="walls"]'), '   the Walls tool'); await sleep(300)
  ok(await tap('button[data-wall-kind="rail"]') && await poll(() => p.evaluate(() => document.querySelector('button[data-wall-kind="rail"]')?.getAttribute('aria-pressed') === 'true')), '1. the Walls tool has a Railing option, and it is on')
  let drawn = 0
  for (let t = 0; t < 3 && drawn < 4; t++) { await settled(); const v = await view(); await drag(screenOf(v, RA, RZ), screenOf(v, RB, RZ)); await sleep(900); drawn = (await rails()).length }
  const r1 = await rails()
  ok(r1.length === 4 && r1.every(([, x]) => x.draft), `   a drag plans 4 m of railing (${JSON.stringify(r1)})`)
  await shot('railing-1-plan')
  const p0 = await planks()
  ok(await poll(async () => p.evaluate(() => document.querySelector('[data-plan-bom]')?.getAttribute('data-ready') === 'true')), '   the list is met: Build is ready')
  ok(await tap('[data-act="build-plan"] button') && await poll(async () => { const x = await rails(); return x.length === 4 && x.every(([, y]) => !y.draft) }), '2. Build stands the railing')
  ok(p0 - (await planks()) === 2, `   4 m costs 2 planks, a third of a wall's 6 (${p0 - (await planks())})`)
  // 3. leave plan, stand between the house and the railing, hold W (north) into it
  await p.keyboard.press('Escape'); await sleep(1200); await p.mouse.click(550, 340); await sleep(400)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), X0 + 3, Z0 - 1.4); await sleep(1500)
  const g0 = await p.evaluate(() => (window as any).__ather.state().py)
  await p.keyboard.down('KeyW'); await sleep(3500); await p.keyboard.up('KeyW'); await sleep(600)
  const st = await p.evaluate(() => { const a = (window as any).__ather.state(); return { y: a.py, z: a.pz } })
  ok(st.z > RZ && st.y < g0 + 0.3, `3. walking into the railing stops at it (z ${st.z.toFixed(2)}, railing at ${RZ}, feet ${(st.y - g0).toFixed(2)})`)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI * 0.85), X0 + 1.5, Z0 - 1.2); await sleep(2500)
  await shot('railing-2-ground')
  // 4. upstairs, west of the hole, hold D (east) at it
  const fy = await p.evaluate(() => { const a = (window as any).__ather.state(); return a.py })
  await p.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, 0, y), X0 + 0.5, SJ - 2.5, fy + STOREY + 0.05); await sleep(1500)
  const u0 = await p.evaluate(() => (window as any).__ather.state().py)
  await p.keyboard.down('KeyD'); await sleep(3000); await p.keyboard.up('KeyD'); await sleep(600)
  const u1 = await p.evaluate(() => { const a = (window as any).__ather.state(); return { x: a.px, y: a.py } })
  ok(u0 > g0 + STOREY - 0.3 && u1.y > u0 - 0.2 && u1.x < SI, `4. upstairs the stair hole is railed: walking at it from the side holds (x ${u1.x.toFixed(2)}, hole from ${SI}, feet ${(u1.y - g0).toFixed(2)})`)
  await p.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, -Math.PI * 0.8, y), X0 + 0.6, Z0 + 0.6, fy + STOREY + 0.05); await sleep(2500)
  await shot('railing-3-stairhole')
  // 5. reload keeps it
  await p.reload({ waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2000)
  const r2 = await rails(); ok(r2.length === 4 && r2.every(([, x]) => !x.draft), '5. a reload keeps the railing')
  ok(errs.length === 0, `   0 page errors ${errs.slice(0, 3).join(' | ')}`)
  console.log(`(railing ${RAIL_H} m) shots in ${out}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
