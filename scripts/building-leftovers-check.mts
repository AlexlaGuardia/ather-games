// ── M55/M56 BUILDING LEFTOVERS check (hub #15815, 11-21) ────────────────────────────────────────────────────────────────────
// SETUP (stated): a BUILT 10 x 8 two-storey house with a south door, a BUILT 3 x 4 patio against its west wall, a RAISED prefab
// Farm east of it (injected works), 300 Stone Brick + 60 planks. Real inputs: E at the table, Plan, the plan view moved onto the
// house / the Farm, the Foundation buttons, the Stairs tool + its Turn right button + a click on the foot cell, Build, leave plan,
// hold W (and a turn in place on the landing).
//   1. house Low: the patio rides it (feet on the patio = the house floor)
//   2. aimed at the Farm, High raises ONLY the Farm (its own value, 48 m² x 2 bricks), the keeper walks up its door steps inside
//   3. a stair placed with Turn right turns at a landing; Build stands it for 16 planks; the keeper climbs to the landing, turns
//      right, climbs to floor 2   4. a reload keeps all of it; 0 page errors.
//   npx tsx scripts/building-leftovers-check.mts [--url ...] [--out dir] [--phone]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR, footprint, doorOf } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
import { findRooms } from '../src/app/shimmer/open/ather/plot-walls'
import { STOREY } from '../src/app/shimmer/open/ather/plot-floors'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/building-leftovers-check')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const PHONE = process.argv.includes('--phone')
const W = PHONE ? 390 : 1100, H = PHONE ? 844 : 680, PITCH = 0.98   // = build-mode.tsx BUILD_CAM.PITCH

const held = new Set(STARTING_SQUARES)
const isHeld = (x: number, z: number) => { const s = squareAt(x, z); return !!s && held.has(sqId(s.i, s.j)) }
let spot: { x: number; z: number } | null = null
for (const R of [16, 15, 14]) {
  for (let z = -150; z <= 150 && !spot; z++) for (let x = -150; x <= 150 && !spot; x++) {
    let good = KEEP_CLEAR.every(c => Math.hypot(c.x - x, c.z - z) > c.r + R)
    for (let a = 0; a < 16 && good; a++) for (const d of [0, R / 2, R]) { if (!isHeld(x + Math.cos(a * Math.PI / 8) * d, z + Math.sin(a * Math.PI / 8) * d)) good = false }
    if (good) spot = { x, z }
  }
  if (spot) break
}
if (!spot) { console.log('no clear held spot'); process.exit(1) }
const X0 = spot.x - 9, X1 = X0 + 10, Z0 = spot.z - 4, Z1 = Z0 + 8   // the house
const PI0 = X0 - 3, PJ0 = Z0 + 2                                       // the patio: x PI0..X0-1, rows PJ0..PJ0+3
const FARM = { id: 'farm-check', kind: 'farm', x: spot.x + 7, z: spot.z, q: 0, placedAt: 0, doneAt: 0 }
const ff = footprint('farm', FARM.x, FARM.z, 0), fd = doorOf(FARM as any)
console.log(`house x ${X0}..${X1} z ${Z0}..${Z1}; patio x ${PI0}..${X0} ; farm x ${ff.x0}..${ff.x1} z ${ff.z0}..${ff.z1}, door ${fd.x},${fd.z}`)
function screenOf(v: { x: number; z: number; h: number; yaw: number }, wx: number, wz: number, wy = GROUND_Y) {
  const back = v.h / Math.tan(PITCH)
  const cam = new THREE.PerspectiveCamera(75, W / H, 0.05, 900)
  cam.position.set(v.x + Math.sin(v.yaw) * back, GROUND_Y + v.h, v.z + Math.cos(v.yaw) * back); cam.rotation.set(-PITCH, v.yaw, 0, 'YXZ'); cam.updateMatrixWorld()
  const p = new THREE.Vector3(wx, wy, wz).project(cam)
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
  walls[`h,${X0 + 7},${Z1}`] = { mat: 'goldwood', kind: 'door' }; walls[`h,${X0 + 8},${Z1}`] = { mat: 'goldwood', kind: 'door' }
  const rk = findRooms(walls as any)[0].key, paid = { [rk]: 80 }
  const upWalls = Object.fromEntries(Object.entries(walls).map(([k, v]) => [k, { mat: v.mat }]))
  const decks: Record<string, { pat: string; col: string }> = {}
  for (let i = PI0; i < X0; i++) for (let j = PJ0; j < PJ0 + 4; j++) decks[`${i},${j}`] = { pat: 'planks', col: '#c9a26b' }
  const works = { v: 1, rooms: [FARM], chests: [], pieces: [], walls, paid, roof: 'flat', decks, upper: [{ walls: upWalls, paid }] }
  await p.evaluateOnNewDocument((works: string) => {
    if (sessionStorage.getItem('bldl')) return; sessionStorage.setItem('bldl', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'stone_brick', n: 99 }; slots[9] = { id: 'stone_brick', n: 99 }; slots[10] = { id: 'stone_brick', n: 99 }; slots[11] = { id: 'goldwood_plank', n: 60 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', works)
  }, JSON.stringify(works))
  const count = (id: string) => p.evaluate((id: string) => ((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []) as ({ id: string; n: number } | null)[]).reduce((t, s) => t + (s?.id === id ? s.n : 0), 0), id)
  const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'))
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const tap = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await p.mouse.click(b.x, b.y); return true }
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }
  const view = () => p.evaluate(() => (window as any).__build.view())
  const settled = () => poll(async () => { const a = await view(); await sleep(500); const b = await view(); return Math.hypot(a.x - b.x, a.z - b.z) < 0.02 && Math.abs(a.yaw) < 0.01 && Math.abs(a.h - b.h) < 0.05 }, 60000)
  const pickerOn = (h: string) => poll(() => p.evaluate((h: string) => !(document.querySelector(`[data-found="${h}"]`) as HTMLButtonElement | null)?.disabled, h), 15000)
  const pressed = (h: string) => p.evaluate((h: string) => document.querySelector(`[data-found="${h}"]`)?.getAttribute('aria-pressed') === 'true', h)
  const press = async (x: number, y: number) => { await p.evaluate((px: number, py: number) => { for (const e of document.elementsFromPoint(px, py)) { if (e.tagName === 'CANVAS') break; (e as HTMLElement).style.pointerEvents = 'none'; (e as HTMLElement).dataset.pe = '1' } }, x, y); await p.mouse.move(x, y); await p.mouse.down(); await sleep(120); await p.mouse.move(x + 1, y + 1); await p.mouse.up(); await p.evaluate(() => document.querySelectorAll<HTMLElement>('[data-pe]').forEach(e => { e.style.pointerEvents = ''; delete e.dataset.pe })) }
  const st = () => p.evaluate(() => { const a = (window as any).__ather.state(); return { x: a.px as number, y: a.py as number, z: a.pz as number } })
  const holdW = async (until: () => Promise<boolean>, ms: number) => { await p.keyboard.down('KeyW'); await poll(until, ms); await p.keyboard.up('KeyW'); await sleep(700) }

  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  await p.mouse.click(550, 340); await sleep(600)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), spot.x, Z1 + 4); await sleep(1500)
  const g0 = (await st()).y
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), TABLE.x + 1.6, TABLE.z + 1.6); await sleep(1500)
  await p.keyboard.press('e'); await sleep(1000); await tap('[data-act="plan"]')
  ok(await poll(() => p.evaluate(() => (window as any).__build?.on() === true)), 'E at the table, Plan: flying')
  await tap('[data-tool="walls"]'); await sleep(400)
  // 1. house Low
  await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), X0 + 5, Z0 + 4); await settled()
  ok(await pickerOn('0.6') && await pressed('0'), '   aimed at the house: the picker shows None')
  const b0 = await count('stone_brick')
  ok(await tap('[data-found="0.6"]') && await poll(async () => (await saved()).foundCells?.[`${X0 + 1},${Z0 + 1}`] === 0.6), '1. Low raises the house to 0.6 m')
  ok(b0 - (await count('stone_brick')) === 80, `   for its 80 m² (${b0 - (await count('stone_brick'))} bricks)`)
  // 2. the Farm, High
  await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), FARM.x, FARM.z); await settled()
  ok(await poll(() => pressed('0'), 8000), '   aimed at the Farm: the picker shows the Farm\'s None (the house\'s Low is not the Farm\'s)')
  const b1 = await count('stone_brick')
  ok(await tap('[data-found="1.2"]') && await poll(async () => (await saved()).rooms?.[0]?.found === 1.2), '2. High raises the prefab Farm to 1.2 m (its own value)')
  const sv = await saved()
  ok(b1 - (await count('stone_brick')) === 96 && sv.foundCells?.[`${X0 + 1},${Z0 + 1}`] === 0.6, `   for its 48 m² (${b1 - (await count('stone_brick'))} bricks); the house stays Low`)
  // 3. a turned stair
  await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), X0 + 3, Z0 + 4)
  ok(await tap('[data-tool="stairs"]'), '3. Stairs tool'); await sleep(500)
  ok(await tap('[data-stair-turn="r"]') && await poll(() => p.evaluate(() => document.querySelector('[data-stair-turn="r"]')?.getAttribute('aria-pressed') === 'true'), 4000), '   the Turn right button is there and lights')
  await shot('leftovers-0-stair-bar')
  const SI = X0 + 1, SJ = Z1 - 1
  let placed = false
  for (let t = 0; t < 3 && !placed; t++) { await settled(); const v = await view(), s = screenOf(v, SI + 0.5, SJ + 0.5, GROUND_Y + 0.6); await press(s.x, s.y); await sleep(900); placed = !!(await saved()).stairs?.[`${SI},${SJ}`] }
  const s1 = (await saved()).stairs ?? {}
  ok(s1[`${SI},${SJ}`]?.turn === 'r' && s1[`${SI},${SJ}`]?.dir === 0 && s1[`${SI},${SJ}`]?.draft === true, `   a tap plans a stair climbing north that turns right (${JSON.stringify(s1)})`)
  const pl0 = await count('goldwood_plank')
  ok(await poll(async () => p.evaluate(() => document.querySelector('[data-plan-bom]')?.getAttribute('data-ready') === 'true')), '   the list is met: Build is ready')
  ok(await tap('[data-act="build-plan"] button') && await poll(async () => { const x = (await saved()).stairs ?? {}; return !!x[`${SI},${SJ}`] && !x[`${SI},${SJ}`].draft }), '   Build stands it')
  ok(pl0 - (await count('goldwood_plank')) === 16, `   for 12 steps + the landing = 16 planks (${pl0 - (await count('goldwood_plank'))})`)
  await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), (X0 + FARM.x) / 2, Z1); await settled(); await sleep(800)
  await shot('leftovers-1-plan')
  await p.keyboard.press('Escape'); await sleep(1200); await p.mouse.click(550, 340); await sleep(400)
  // 1b. the patio: stand on it
  // (a riding patio is a terrace: 0.6 m is over the walker's 0.5 m step from the ground, so the keeper is set down on it and must STAY at the house floor)
  await p.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, -Math.PI / 2, y), PI0 + 1.5, PJ0 + 2, g0 + 0.9); await sleep(2000)
  const pa = await st()
  ok(Math.abs(pa.y - g0 - 0.6) < 0.1, `1b. the patio against the raised house stands flush with its floor (feet on it +${(pa.y - g0).toFixed(2)})`)
  // 2b. walk into the Farm through its door (the front faces north at q 0): from 3 m north, walking south
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI), fd.x, fd.z - 3); await sleep(1500)
  await holdW(async () => (await st()).z > ff.z0 + 1.5, 15000)
  const fa = await st()
  ok(fa.z > ff.z0 + 1 && fa.z < ff.z1 && Math.abs(fa.y - g0 - 1.2) < 0.1, `2b. the keeper walks up the Farm's door steps onto its raised floor (feet +${(fa.y - g0).toFixed(2)}, z ${fa.z.toFixed(2)})`)
  await shot('leftovers-2-farm-inside')
  // 3b. climb: foot of the stair facing north to the landing, turn right in place, climb to floor 2
  await p.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, 0, y), SI + 1, SJ + 0.6, g0 + 0.6); await sleep(1500)
  const base = g0 + 0.6   // the house floor (the keeper was set down on a step)
  await holdW(async () => false, 6000)   // hold W PAST the landing: an overshoot into the far guard rail, then turn

  const la = await st()
  ok(Math.abs(la.y - base - STOREY / 2) < 0.3, `3b. the keeper climbs the first flight to the landing (feet +${(la.y - base).toFixed(2)} over the floor, half a storey ${(STOREY / 2).toFixed(2)}; held against the far rail at z ${la.z.toFixed(2)}, edge ${SJ - 4})`)
  await sleep(600)
  await p.evaluate(() => { const a = (window as any).__ather.state(); (window as any).__ather.tp(a.px, a.pz, -Math.PI / 2, a.py) }); await sleep(500)
  await holdW(async () => (await st()).y > base + STOREY - 0.3, 15000)
  const up = await st()
  ok(up.y > base + STOREY - 0.3 && up.x > SI + 3, `   turns right and climbs to floor 2 (feet +${(up.y - base).toFixed(2)}, storey ${STOREY}, x ${up.x.toFixed(2)})`)
  try { await p.screenshot({ path: `${out}/leftovers-3-upstairs.png` }) } catch { /* slow frame */ }
  await p.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, Math.PI * 0.75, y), X0 + 8.5, Z0 + 1.5, g0 + 0.6); await sleep(2500)
  await shot('leftovers-4-stair-inside')
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI * 0.1), spot.x + 1, Z1 + 12); await sleep(2500)
  await shot('leftovers-5-outside')
  // 4. reload
  await p.reload({ waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2000)
  const s2 = await saved()
  ok(s2.rooms?.[0]?.found === 1.2 && s2.foundCells?.[`${X0 + 1},${Z0 + 1}`] === 0.6 && s2.stairs?.[`${SI},${SJ}`]?.turn === 'r', '4. a reload keeps the Farm High, the house Low, the turned stair')
  ok(errs.length === 0, `   0 page errors ${errs.slice(0, 3).join(' | ')}`)
  console.log(`shots in ${out}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
