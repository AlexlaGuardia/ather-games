// ── M54 COLUMNS on a PHONE + the capped joint (sprites 11-21) ─────────────────────────────────────────────────────────────
// 390 x 844, touch: every input is a real TAP (touchscreen), no mouse. SETUP (stated): an L of BUILT stucco walls meeting at a corner
// (injected works), 10 stucco. Taps: E at the table, Plan, the Column tool, Stucco, the joint corner, a second corner, the second
// corner again, Build.   1. a tap plans a column at the wall joint  2. a tap on another corner plans a second; tapping it again
// takes it off  3. Build stands the joint column (3 Stucco)  4. a reload keeps it; 0 page errors. Shot: the capped joint.
//   npx tsx scripts/col-phone-check.mts [--url ...] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/col-phone-check')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const PHONE = true   // 390x844 touch: the paint framing at phone size (the bar lays out differently)
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
const X0 = spot.x - 2, X1 = spot.x + 3, Z0 = spot.z - 2, Z1 = spot.z + 2   // 5 x 4
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
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H, isMobile: true, hasTouch: true })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  const CX = spot.x, CZ = spot.z, K = `${CX},${CZ}`, K2 = `${CX + 3},${CZ - 3}`
  // an L: 4 m running east from the corner and 4 m running north (toward -z) from it, built stucco
  const walls: Record<string, { mat: string; tint?: string }> = {}
  for (let i = 0; i < 4; i++) { walls[`h,${CX + i},${CZ}`] = { mat: 'stucco', tint: '#e9c9a0' }; walls[`v,${CX},${CZ - 1 - i}`] = { mat: 'stucco', tint: '#e9c9a0' } }
  const works = { v: 1, rooms: [], chests: [], pieces: [], walls, paid: {}, roof: 'gable' }
  await p.evaluateOnNewDocument((works: string) => {
    if (sessionStorage.getItem('colph')) return; sessionStorage.setItem('colph', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'stucco', n: 10 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', works)
  }, JSON.stringify(works))
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play') || d.textContent?.includes('Tap to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const tapEl = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await p.touchscreen.tap(b.x, b.y); return true }
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }
  const view = () => p.evaluate(() => (window as any).__build.view())
  const settled = () => poll(async () => { const a = await view(); await sleep(500); const b = await view(); return Math.hypot(a.x - b.x, a.z - b.z) < 0.02 && Math.abs(a.yaw) < 0.01 && Math.abs(a.h - b.h) < 0.05 }, 60000)
  const cols = () => p.evaluate(() => (JSON.parse(localStorage.getItem('open.works.v1') ?? '{}').cols ?? {}) as Record<string, { mat: string; draft?: boolean }>)
  const count = (id: string) => p.evaluate((id: string) => ((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []) as ({ id: string; n: number } | null)[]).reduce((t, s) => t + (s?.id === id ? s.n : 0), 0), id)
  // a real tap on the ground at a world corner: overlays in the way step aside (as a finger would land on the canvas)
  const tapAt = async (wx: number, wz: number) => {
    await settled(); const v = await view(), s = screenOf(v, wx, wz)
    await p.evaluate((px: number, py: number) => { for (const e of document.elementsFromPoint(px, py)) { if (e.tagName === 'CANVAS') break; (e as HTMLElement).style.pointerEvents = 'none'; (e as HTMLElement).dataset.pe = '1' } }, s.x, s.y)
    await p.touchscreen.tap(s.x, s.y); await sleep(900)
    await p.evaluate(() => document.querySelectorAll<HTMLElement>('[data-pe]').forEach(e => { e.style.pointerEvents = ''; delete e.dataset.pe }))
  }

  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  await p.touchscreen.tap(W / 2, H / 2); await sleep(600)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), TABLE.x + 1.6, TABLE.z + 1.6); await sleep(1500)
  await p.keyboard.press('e'); await sleep(1000); await tapEl('[data-act="plan"]')
  ok(await poll(() => p.evaluate(() => (window as any).__build?.on() === true)), 'E at the table, a tap on Plan: flying (phone)')
  await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), CX + 1.5, CZ - 1.5)
  ok(await tapEl('[data-tool="column"]'), '   a tap on the Column tool'); await sleep(400)
  ok(await tapEl('[data-wall-mat="stucco"]'), '   a tap on Stucco'); await sleep(300)
  for (let t = 0; t < 3 && !(await cols())[K]; t++) await tapAt(CX, CZ)
  let c = await cols()
  ok(c[K]?.draft === true && c[K].mat === 'stucco', `1. a tap at the wall joint plans a column there (${JSON.stringify(c)})`)
  for (let t = 0; t < 3 && !(await cols())[K2]; t++) await tapAt(CX + 3, CZ - 3)
  ok(!!(await cols())[K2], '2. a tap on another corner plans a second column')
  await tapAt(CX + 3, CZ - 3)
  c = await cols(); ok(!c[K2] && !!c[K], `   tapping it again takes it off the plan (the joint one stays: ${Object.keys(c).join(' ')})`)
  const s0 = await count('stucco')
  ok(await poll(async () => p.evaluate(() => document.querySelector('[data-plan-bom]')?.getAttribute('data-ready') === 'true')), '   the list is met: Build is ready')
  ok(await tapEl('[data-act="build-plan"] button') && await poll(async () => { const x = await cols(); return !!x[K] && !x[K].draft }), '3. a tap on Build stands the joint column')
  ok(s0 - (await count('stucco')) === 3, `   for 3 Stucco (${s0 - (await count('stucco'))})`)
  await shot('colph-1-plan')
  // the capped joint from outside, walls up: leave plan, stand south-east of the corner, looking at it
  await p.keyboard.press('Escape'); await sleep(1500)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, -Math.PI / 4), CX - 3.2, CZ + 3.2)   // facing north-east, at the corner; await sleep(3000)
  await shot('colph-2-joint')
  await p.reload({ waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2000)
  c = await cols(); ok(!!c[K] && !c[K].draft && !c[K2], '4. a reload keeps the joint column (and not the erased one)')
  ok(errs.length === 0, `   0 page errors ${errs.slice(0, 3).join(' | ')}`)
  console.log(`shots in ${out}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
