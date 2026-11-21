// ── M55 slice 2: FOUNDATION PER HOUSE check (sprites 11-21) ──────────────────────────────────────────────────────────────────
// SETUP (stated): two BUILT 4 x 4 houses 4 m apart, each with a 2 m south door (injected works), 80 Stone Brick. Real inputs: E at
// the table, Plan, the plan view moved onto each house, the Foundation buttons, leave plan, hold W from outside each door.
//   1. aimed at house A, Low raises ONLY A (16 bricks)  2. aimed at house B, High raises ONLY B (32 bricks)  3. the keeper walks
//   up A's step and B's two steps into each  4. a reload keeps both; 0 page errors.   npx tsx scripts/found-houses-check.mts
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
import { findRooms } from '../src/app/shimmer/open/ather/plot-walls'
import { STOREY } from '../src/app/shimmer/open/ather/plot-floors'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/found-houses-check')
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
const X0 = spot.x - 6, Z0 = spot.z - 2, Z1 = spot.z + 2, BX = spot.x + 2   // house A x X0..X0+4, house B x BX..BX+4
console.log(`houses A ${X0}..${X0 + 4}, B ${BX}..${BX + 4}, z ${Z0}..${Z1}`)
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
  for (const x0 of [X0, BX]) {
    for (let x = x0; x < x0 + 4; x++) { walls[`h,${x},${Z0}`] = { mat: 'goldwood' }; walls[`h,${x},${Z1}`] = { mat: 'goldwood' } }
    for (let z = Z0; z < Z1; z++) { walls[`v,${x0},${z}`] = { mat: 'goldwood' }; walls[`v,${x0 + 4},${z}`] = { mat: 'goldwood' } }
    walls[`h,${x0 + 1},${Z1}`] = { mat: 'goldwood', kind: 'door' }; walls[`h,${x0 + 2},${Z1}`] = { mat: 'goldwood', kind: 'door' }
  }
  const paid = Object.fromEntries(findRooms(walls as any).map(r => [r.key, r.cells.length]))
  const works = { v: 1, rooms: [], chests: [], pieces: [], walls, paid, roof: 'gable' }
  await p.evaluateOnNewDocument((works: string) => {
    if (sessionStorage.getItem('foundh')) return; sessionStorage.setItem('foundh', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'stone_brick', n: 80 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', works)
  }, JSON.stringify(works))
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const tap = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await p.mouse.click(b.x, b.y); return true }
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }
  const view = () => p.evaluate(() => (window as any).__build.view())
  const settled = () => poll(async () => { const a = await view(); await sleep(500); const b = await view(); return Math.hypot(a.x - b.x, a.z - b.z) < 0.02 && Math.abs(a.yaw) < 0.01 && Math.abs(a.h - b.h) < 0.05 }, 60000)
  const fAt = (c: string) => p.evaluate((c: string) => { const w = JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'); return w.foundCells?.[c] ?? w.found ?? 0 }, c)
  const A = `${X0 + 1},${Z0 + 1}`, B = `${BX + 1},${Z0 + 1}`
  const bricks = () => p.evaluate(() => ((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []) as ({ id: string; n: number } | null)[]).reduce((t, s) => t + (s?.id === 'stone_brick' ? s.n : 0), 0))
  // the picker lights (enabled) once the 400 ms aim poll finds the house in view; then aria-pressed shows its height
  const pickerOn = (h: string) => poll(() => p.evaluate((h: string) => !(document.querySelector(`[data-found="${h}"]`) as HTMLButtonElement | null)?.disabled, h), 15000)
  const pressed = (h: string) => p.evaluate((h: string) => document.querySelector(`[data-found="${h}"]`)?.getAttribute('aria-pressed') === 'true', h)

  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  await p.mouse.click(550, 340); await sleep(600)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), X0 + 2, Z1 + 3); await sleep(1500)
  const g0 = await p.evaluate(() => (window as any).__ather.state().py)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), TABLE.x + 1.6, TABLE.z + 1.6); await sleep(1500)
  await p.keyboard.press('e'); await sleep(1000); await tap('[data-act="plan"]')
  ok(await poll(() => p.evaluate(() => (window as any).__build?.on() === true)), 'E at the table, Plan: flying')
  await tap('[data-tool="walls"]'); await sleep(400)
  // 1. house A, Low
  await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), X0 + 2, Z0 + 2); await settled()
  ok(await pickerOn('0.6') && await pressed('0'), '   aimed at house A: the picker lights and shows None')
  ok(await tap('[data-found="0.6"]') && await poll(async () => (await fAt(A)) === 0.6), '1. Low raises house A to 0.6 m')
  ok((await fAt(B)) === 0 && (await bricks()) === 80 - 16, `   and ONLY house A (B at ${await fAt(B)}; ${80 - (await bricks())} bricks for its 16 m²)`)
  // 2. house B, High
  await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), BX + 2, Z0 + 2); await settled()
  ok(await poll(() => pressed('0'), 5000), '   aimed at house B: the picker shows B\'s None (A\'s Low is not B\'s)')
  ok(await tap('[data-found="1.2"]') && await poll(async () => (await fAt(B)) === 1.2), '2. High raises house B to 1.2 m')
  ok((await fAt(A)) === 0.6 && (await bricks()) === 80 - 16 - 32, `   A stays Low; B cost ${80 - 16 - (await bricks())} bricks`)
  await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), (X0 + BX + 4) / 2, Z1 + 1); await settled(); await sleep(800)
  await shot('houses-1-plan')
  // 3. walk into each through its door steps
  await p.keyboard.press('Escape'); await sleep(1200); await p.mouse.click(550, 340); await sleep(400)
  const walkIn = async (x: number, want: number) => {
    await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), x, Z1 + 3); await sleep(1500)
    await p.keyboard.down('KeyW'); await poll(async () => (await p.evaluate(() => (window as any).__ather.state().pz)) < Z1 - 1, 15000); await p.keyboard.up('KeyW'); await sleep(700)
    const s = await p.evaluate(() => { const a = (window as any).__ather.state(); return { y: a.py, z: a.pz } })
    return { ok: s.z < Z1 - 0.5 && Math.abs(s.y - g0 - want) < 0.1, s }
  }
  const a = await walkIn(X0 + 2, 0.6), b = await walkIn(BX + 2, 1.2)
  ok(a.ok, `3. the keeper walks up A's step onto its Low floor (feet +${(a.s.y - g0).toFixed(2)}, z ${a.s.z.toFixed(2)})`)
  ok(b.ok, `   and up B's steps onto its High floor (feet +${(b.s.y - g0).toFixed(2)}, z ${b.s.z.toFixed(2)})`)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI * 0.08), (X0 + BX + 4) / 2 + 1, Z1 + 7); await sleep(2500)
  await shot('houses-2-outside')
  // 4. reload
  await p.reload({ waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2000)
  ok((await fAt(A)) === 0.6 && (await fAt(B)) === 1.2, '4. a reload keeps both foundations')
  ok(errs.length === 0, `   0 page errors ${errs.slice(0, 3).join(' | ')}`)
  console.log(`shots in ${out}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
