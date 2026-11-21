// ── M56 (a) FREE FLOOR check (sprites 11-21) ──────────────────────────────────────────────────────────────────────────────
// SETUP (stated): a BUILT 6 x 6 room on the ground and the same room on floor 2 (injected works), 40 planks. Real inputs: E at the
// table, Plan, the Floor tool, drags along the grid (projected through plan mode's own lens, at the edited floor's height), the
// floor-2 button, Build, leave plan; then the keeper on the patio and on the balcony.
//   1. the plan bar has a Floor tool; a drag south of the house plans a 4 x 2 PATIO  2. on floor 2 a drag along the north wall plans
//   a 6 x 1 BALCONY  3. a drag 4 m out in mid-air is REFUSED  4. Build lays both for 14 planks  5. the keeper steps up onto the
//   patio and stands on the balcony  6. a reload keeps both; 0 page errors.   npx tsx scripts/free-floor-check.mts [--url ...]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
import { findRooms } from '../src/app/shimmer/open/ather/plot-walls'
import { STOREY } from '../src/app/shimmer/open/ather/plot-floors'
import { DECK_T } from '../src/app/shimmer/open/ather/plot-decks'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/free-floor-check')
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
const X0 = spot.x - 3, X1 = spot.x + 3, Z0 = spot.z - 3, Z1 = spot.z + 3   // 6 x 6
console.log(`room ${X0}..${X1} x ${Z0}..${Z1}`)
// plan mode's lens (build-mode.tsx lensFor) → screen pixels
function screenOf(v: { x: number; z: number; h: number; yaw: number }, wx: number, wz: number, wy = 0) {
  const back = v.h / Math.tan(PITCH)
  const cam = new THREE.PerspectiveCamera(75, W / H, 0.05, 900)
  cam.position.set(v.x + Math.sin(v.yaw) * back, GROUND_Y + v.h, v.z + Math.cos(v.yaw) * back); cam.rotation.set(-PITCH, v.yaw, 0, 'YXZ'); cam.updateMatrixWorld()
  const p = new THREE.Vector3(wx, GROUND_Y + wy, wz).project(cam)
  return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H }
}

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(PHONE ? { width: W, height: H, isMobile: true, hasTouch: true } : { width: W, height: H })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  const walls: Record<string, { mat: string }> = {}
  for (let x = X0; x < X1; x++) { walls[`h,${x},${Z0}`] = { mat: 'goldwood' }; walls[`h,${x},${Z1}`] = { mat: 'goldwood' } }
  for (let z = Z0; z < Z1; z++) { walls[`v,${X0},${z}`] = { mat: 'goldwood' }; walls[`v,${X1},${z}`] = { mat: 'goldwood' } }
  const rk = findRooms(walls as any)[0].key, paid = { [rk]: 36 }
  const works = { v: 1, rooms: [], chests: [], pieces: [], walls, paid, roof: 'flat', upper: [{ walls, paid }] }
  await p.evaluateOnNewDocument((works: string) => {
    if (sessionStorage.getItem('deckc')) return; sessionStorage.setItem('deckc', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'goldwood_plank', n: 40 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', works)
  }, JSON.stringify(works))
  const planks = () => p.evaluate(() => ((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []) as ({ id: string; n: number } | null)[]).reduce((t, s) => t + (s?.id === 'goldwood_plank' ? s.n : 0), 0))
  const decks = (k: number) => p.evaluate((k: number) => { const w = JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'); return Object.entries((k === 0 ? w.decks : w.upper?.[k - 1]?.decks) ?? {}) as [string, { pat: string; draft?: boolean }][] }, k)
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const tap = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await p.mouse.click(b.x, b.y); return true }
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }
  const view = () => p.evaluate(() => (window as any).__build.view())
  const settled = () => poll(async () => { const a = await view(); await sleep(500); const b = await view(); return Math.hypot(a.x - b.x, a.z - b.z) < 0.02 && Math.abs(a.yaw) < 0.01 && Math.abs(a.h - b.h) < 0.05 }, 60000)
  const unblock = (x: number, y: number) => p.evaluate((px: number, py: number) => { for (const e of document.elementsFromPoint(px, py)) { if (e.tagName === 'CANVAS') break; (e as HTMLElement).style.pointerEvents = 'none'; (e as HTMLElement).dataset.pe = '1' } }, x, y)
  const reblock = () => p.evaluate(() => document.querySelectorAll<HTMLElement>('[data-pe]').forEach(e => { e.style.pointerEvents = ''; delete e.dataset.pe }))
  const drag = async (a: { x: number; y: number }, b: { x: number; y: number }) => { await unblock(a.x, a.y); await unblock(b.x, b.y); await p.mouse.move(a.x, a.y); await p.mouse.down(); for (let n = 1; n <= 8; n++) { await p.mouse.move(a.x + (b.x - a.x) * n / 8, a.y + (b.y - a.y) * n / 8); await sleep(40) } await p.mouse.up(); await reblock() }
  // drag from the centre of cell a to the centre of cell b, on floor k
  const dragCells = async (k: number, a: [number, number], b: [number, number]) => { await settled(); const v = await view(), y = k * STOREY; await drag(screenOf(v, a[0] + 0.5, a[1] + 0.5, y), screenOf(v, b[0] + 0.5, b[1] + 0.5, y)); await sleep(900) }

  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  await p.mouse.click(550, 340); await sleep(600)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), TABLE.x + 1.6, TABLE.z + 1.6); await sleep(1500)
  await p.keyboard.press('e'); await sleep(1000); await tap('[data-act="plan"]')
  ok(await poll(() => p.evaluate(() => (window as any).__build?.on() === true)), 'E at the table, Plan: flying')
  await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), spot.x, spot.z)
  ok(await tap('[data-tool="floor"]'), '1. the plan bar has a Floor tool'); await sleep(400)
  // patio: cells X0+1..X0+4 x Z1+1..Z1+2 (south of the house, a metre off its wall)
  for (let t = 0; t < 3 && (await decks(0)).length < 8; t++) await dragCells(0, [X0 + 1, Z1 + 1], [X0 + 4, Z1 + 2])
  const d0 = await decks(0)
  ok(d0.length === 8 && d0.every(([, d]) => d.draft), `   a drag plans a 4 x 2 patio (${d0.length} cells)`)
  // balcony on floor 2: cells X0..X1-1 x Z0-1 (along the north wall)
  ok(await tap('button[data-floor="1"]') && await poll(async () => p.evaluate(() => document.querySelector('button[data-floor="1"]')?.getAttribute('aria-pressed') === 'true')), '   floor 2 picked')
  await sleep(800)
  for (let t = 0; t < 3 && (await decks(1)).length < 6; t++) await dragCells(1, [X0, Z0 - 1], [X1 - 1, Z0 - 1])
  const d1 = await decks(1)
  ok(d1.length === 6 && d1.every(([k, d]) => d.draft && k.endsWith(`,${Z0 - 1}`)), `2. on floor 2 a drag along the north wall plans a 6 x 1 balcony (${d1.length} cells)`)
  await shot('deck-1-plan')
  // unsupported: 4 m out in mid-air, two cells
  await dragCells(1, [X0 + 1, Z0 - 5], [X0 + 2, Z0 - 5])
  const d1b = await decks(1), toast = await p.evaluate(() => document.body.innerText.includes('Nothing holds that up'))
  ok(d1b.length === 6, `3. a floor 4 m out in mid-air is refused (${d1b.length} cells; the reason shown: ${toast})`)
  const p0 = await planks()
  ok(await poll(async () => p.evaluate(() => document.querySelector('[data-plan-bom]')?.getAttribute('data-ready') === 'true')), '   the list is met: Build is ready')
  ok(await tap('[data-act="build-plan"] button') && await poll(async () => { const a = await decks(0), b = await decks(1); return a.length === 8 && b.length === 6 && [...a, ...b].every(([, d]) => !d.draft) }), '4. Build lays the patio and the balcony')
  ok(p0 - (await planks()) === 14, `   14 m² of planks floor costs 14 planks (${p0 - (await planks())})`)
  // 5. leave plan: walk onto the patio from the south, then stand on the balcony
  await p.keyboard.press('Escape'); await sleep(1200); await p.mouse.click(550, 340); await sleep(400)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), X0 + 3, Z1 + 5); await sleep(1500)
  const g0 = await p.evaluate(() => (window as any).__ather.state().py)
  const trace: string[] = []
  await p.keyboard.down('KeyW')
  await poll(async () => { const a = await p.evaluate(() => { const s = (window as any).__ather.state(); return { y: s.py, z: s.pz } }); trace.push(`${a.z.toFixed(2)}/${(a.y - g0).toFixed(2)}`); return a.z < Z1 + 2.5 }, 12000)
  await p.keyboard.up('KeyW'); await sleep(700)
  console.log(`   walk trace z/feet: ${trace.join(' ')}`)
  const pa = await p.evaluate(() => { const a = (window as any).__ather.state(); return { y: a.py, z: a.pz } })
  ok(Math.abs(pa.y - g0 - DECK_T) < 0.05 && pa.z < Z1 + 3 && pa.z > Z1 + 1, `5. the keeper steps up onto the patio (feet +${(pa.y - g0).toFixed(2)}, patio ${DECK_T}, z ${pa.z.toFixed(2)})`)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, -0.35), X0 + 0.5, Z1 + 6); await sleep(2500)   // facing north-east, the patio ahead
  await shot('deck-2-patio')
  await p.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, Math.PI, y), X0 + 2.5, Z0 - 0.5, g0 + STOREY + 0.1); await sleep(2500)
  const ba = await p.evaluate(() => { const a = (window as any).__ather.state(); return { y: a.py, z: a.pz } })
  ok(Math.abs(ba.y - g0 - STOREY) < 0.05, `   and stands on the balcony at floor 2 (feet +${(ba.y - g0).toFixed(2)}, floor ${STOREY})`)
  await p.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, -Math.PI * 0.75, y), X0 + 0.5, Z0 - 0.5, g0 + STOREY + 0.1); await sleep(2500)
  await shot('deck-3-balcony')
  // 6. reload keeps both
  await p.reload({ waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2000)
  ok((await decks(0)).length === 8 && (await decks(1)).length === 6, '6. a reload keeps the patio and the balcony')
  ok(errs.length === 0, `   0 page errors ${errs.slice(0, 3).join(' | ')}`)
  console.log(`shots in ${out}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
