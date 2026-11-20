// ── M37 slice 2: A DRAWN LOOP IS A ROOM WITH A FLOOR AND A ROOF (world d5a9e927, 11-19) ──────────────────────────────
// Real inputs: E at the table, Plan, Walls, four real drags along the sides of a 5 x 4 m rectangle (screen points are the
// rectangle's corners projected through plan mode's own lens: fov 75, pitch 0.98, the live view from __build.view()).
// (slice 4, 11-20: drawn walls are DRAFTS paid by Build from the plan bar's list; the roof/door/paint steps run on the BUILT house)
//   1. the four sides close one rectangular room of 20 m² (__walls.rooms), 18 draft pieces, nothing spent; Build then spends the list (38 planks + 20 bricks)
//   2. the roof buttons switch the house's style (gable -> hip -> flat), saved (Works.roof)
//   3. Walls down drops them in plan mode (__walls.down), Walls up / leaving plan mode puts them back
//   4. a reload keeps the room and the style; 0 page errors.
//   5-8 (slice 3): Door taps a 2 m doorway into the front wall, Window one pane into the side, Paint turns a wall and the
//   whole floor Dawnwood (a plank swap for the wall), and after the reload the keeper walks in through the door. Screenshots: gable, hip, flat, walls down.
// SETUP (stated): bag = 100 goldwood planks, 20 stone bricks, 3 crystal panes, 6 dawnwood planks, no works. Hooks: __ather.tp, __build.to (VIEW only), __build.view / __walls (read).
//   npx tsx scripts/plot-house-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/plot-house')
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
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => {
    if (sessionStorage.getItem('house')) return; sessionStorage.setItem('house', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'goldwood_plank', n: 100 }; slots[9] = { id: 'dawnwood_plank', n: 6 }; slots[10] = { id: 'stone_brick', n: 20 }; slots[11] = { id: 'crystal_pane', n: 3 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.removeItem('open.works.v1')
  })
  const planks = () => p.evaluate(() => ((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []) as ({ id: string; n: number } | null)[]).reduce((t, s) => t + (s?.id === 'goldwood_plank' ? s.n : 0), 0))
  const brickCount = () => p.evaluate(() => ((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []) as ({ id: string; n: number } | null)[]).reduce((t, s) => t + (s?.id === 'stone_brick' ? s.n : 0), 0))
  const draftN = () => p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('open.works.v1') ?? '{}').walls ?? {}).filter((x: any) => x.draft).length)
  const saved = () => p.evaluate(() => { const w = JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'); return { walls: Object.keys(w.walls ?? {}).length, roof: w.roof } })
  const savedFull = () => p.evaluate(() => { const w = JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'); return { walls: (w.walls ?? {}) as Record<string, { mat: string; kind?: string }>, floors: (w.floors ?? {}) as Record<string, string> } })
  const walls = () => p.evaluate(() => { const w = (window as any).__walls; return w ? { rooms: w.rooms(), down: w.down(), roof: w.roof() } : null })
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const tap = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await p.mouse.click(b.x, b.y); return true }
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }
  const view = () => p.evaluate(() => (window as any).__build.view())
  let aimDz = 0
  const settled = () => poll(async () => { const a = await view(); await sleep(500); const b = await view(); return Math.hypot(a.x - spot!.x, a.z - (spot!.z + aimDz)) < 0.2 && Math.abs(a.yaw) < 0.01 && Math.abs(a.h - b.h) < 0.05 }, 60000)
  const dragW = async (ax: number, az: number, bx: number, bz: number) => {
    await settled(); const v = await view(), a = screenOf(v, ax, az), b = screenOf(v, bx, bz)
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b.x, b.y, { steps: 12 }); await p.mouse.up(); await sleep(900)
  }

  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  await p.mouse.click(550, 340); await sleep(600)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), TABLE.x + 1.6, TABLE.z + 1.6); await sleep(1500)
  await p.keyboard.press('e'); await sleep(1000); await tap('[data-act="plan"]')
  ok(await poll(() => p.evaluate(() => (window as any).__build?.on() === true)), 'E at the table, Plan: flying')
  await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), spot.x, spot.z)
  await tap('[data-tool="walls"]'); await sleep(400)
  const p0 = await planks()
  for (const [ax, az, bx, bz] of [[X0, Z0, X1, Z0], [X0, Z1, X1, Z1], [X0, Z0, X0, Z1], [X1, Z0, X1, Z1]]) { await dragW(ax, az, bx, bz); console.log('  side drawn, walls so far', (await saved()).walls) }
  const w1 = await walls(), sv1 = await saved()
  ok(!!w1 && w1.rooms.length === 1 && w1.rooms[0].cells === 20 && w1.rooms[0].rect, `1. four sides close one 5x4 room (${JSON.stringify(w1?.rooms)})`)
  ok(sv1.walls === 18 && (await draftN()) === 18 && p0 === await planks() && w1?.rooms[0].built === false, `   18 m of wall, all DRAFT, nothing spent, room not built (${sv1.walls}, ${await draftN()}, ${p0 - (await planks())})`)
  ok(await poll(async () => p.evaluate(() => document.querySelector('[data-plan-bom]')?.getAttribute('data-ready') === 'true')), '   the list is met from the bag: Build is ready')
  ok(await tap('[data-act="build-plan"] button') && await poll(async () => (await draftN()) === 0 && (await walls())?.rooms[0]?.built === true), '   Build stands the walls and the room (floor + roof)')
  ok(p0 - (await planks()) === 38 && (await brickCount()) === 0, `   the list was spent exactly: 38 planks, 20 bricks (${p0 - (await planks())}, ${20 - (await brickCount())})`)
  await shot('house-1-gable')
  ok(await tap('[data-roof="hip"]') && await poll(async () => (await walls())?.roof === 'hip' && (await saved()).roof === 'hip'), '2. Hip: the roof style switches and saves'); await shot('house-2-hip')
  ok(await tap('[data-roof="flat"]') && await poll(async () => (await walls())?.roof === 'flat'), '   Flat'); await shot('house-3-flat')
  await tap('[data-roof="gable"]'); await sleep(500)
  ok(await tap('[data-act="walls-down"]') && await poll(async () => (await walls())?.down === true), '3. Walls down drops them'); await shot('house-4-down')
  await tap('[data-act="walls-down"]'); ok(await poll(async () => (await walls())?.down === false), '   Walls up puts them back')
  // ── slice 3: a door in the front wall, a window in the side, paint a wall + the floor Dawnwood (all taps)
  const tapW = async (x: number, z: number) => { await settled(); const v = await view(), a = screenOf(v, x, z); await p.mouse.click(a.x, a.y); await sleep(900) }
  await tap('[data-tool="door"]'); await sleep(300); await tapW(X0 + 2.5, Z1)
  const f1 = await savedFull(), doors = Object.entries(f1.walls).filter(([, w]) => w.kind === 'door').map(([k]) => k)
  ok(doors.length === 2 && doors.every(k => k.startsWith('h,') && k.endsWith(`,${Z1}`)), `5. Door: a tap on the front wall cuts a 2 m doorway (${doors.join(' ')})`)
  ok(((await walls())?.rooms.length ?? 0) === 1, '   the room still stands with a door in it')
  await tap('[data-tool="window"]'); await sleep(300); await tapW(X0, Z0 + 1.5)
  const wins = Object.entries((await savedFull()).walls).filter(([, w]) => w.kind === 'window').map(([k]) => k)
  ok(wins.length === 1 && wins[0] === `v,${X0},${Z0 + 1}`, `6. Window: a tap on the side wall makes one window (${wins.join(' ')})`)
  // M37 slice 5 (11-20) changed paint: wood + brick walls keep their set colour, only stucco takes paint (plot-materials-check
  // covers stucco + patterns). Here: a goldwood wall refuses paint and costs nothing; a tapped floor paints the whole room.
  await tap('[data-tool="paint"]'); await sleep(300); await tap('[data-swatch="#4c6b97"]'); await sleep(300)
  // the Paint bar (patterns + swatches) is tall and covers the house at the default framing: pan the view (a player drags) so
  // the room sits clear below it, picking whichever offset puts the room centre lowest on screen inside the canvas.
  { let best = { dz: 0, y: -1 }
    for (const dz of [-4, -2, 0, 2, 4]) { await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), spot.x, spot.z + dz); aimDz = dz; await settled(); const y = screenOf(await view(), (X0 + X1) / 2, Z0).y; if (y < H - 140 && y > best.y) best = { dz, y } }
    await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), spot.x, spot.z + best.dz); aimDz = best.dz; console.log('  paint view pan dz', best.dz, 'room top y', Math.round(best.y)) }
  const bag = () => p.evaluate(() => ((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []) as ({ id: string; n: number } | null)[]).reduce((t, s) => t + (s?.n ?? 0), 0))
  const d0 = await bag()
  await tapW(X1, Z0 + 1.5)
  const f3 = await savedFull(), w7 = f3.walls[`v,${X1},${Z0 + 1}`]
  ok(w7?.mat === 'goldwood' && !w7?.tint && (await bag()) === d0, `7. Paint: a tapped wood wall keeps its set colour, nothing spent (${JSON.stringify(w7)})`)
  await tapW((X0 + X1) / 2, (Z0 + Z1) / 2)
  const fl = Object.values((await savedFull()).floors ?? {}) as any[]
  ok(fl.length === 20 && fl.every(f => f?.col === '#4c6b97'), `   a tapped floor paints the whole room (${fl.length} cells)`)
  await shot('house-5-door-window-paint')
  await tap('[data-act="walls-down"]'); await poll(async () => (await walls())?.down === true); await shot('house-6-down-painted')
  await tap('[data-act="land"]'); ok(await poll(async () => (await walls())?.down === false), '   leaving plan mode puts them back up')
  await p.reload({ waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 })
  ok(await poll(async () => { const w = await walls(); return !!w && w.rooms.length === 1 && w.roof === 'gable' }, 30000), '4. a reload keeps the room and its roof style')
  // 8. walk in through the door: from 1.6 m outside the doorway, facing it (yaw 0 looks -z), hold W
  const dk = Object.entries((await savedFull()).walls).filter(([, w]) => w.kind === 'door').map(([k]) => +k.split(',')[1])
  const doorX = (Math.min(...dk) + Math.max(...dk) + 1) / 2
  await p.mouse.click(550, 340); await sleep(400)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), doorX, Z1 + 1.6); await sleep(1500)
  // hold W until the keeper is inside or 25 s pass (1-2 fps here: a fixed hold measures the frame rate, not the door)
  await p.keyboard.down('KeyW')
  await poll(async () => (await p.evaluate(() => (window as any).__ather.state().pz)) < Z1 - 0.6, 25000)
  await p.keyboard.up('KeyW'); await sleep(500)
  const inside = await p.evaluate(() => { const a = (window as any).__ather.state(); return { x: a.px, z: a.pz } })
  ok(inside.z < Z1 - 0.3 && inside.z > Z0 && Math.abs(inside.x - doorX) < 1.2, `8. the keeper walks in through the door (ended at ${inside.x.toFixed(1)}, ${inside.z.toFixed(1)}; the wall line is z ${Z1})`)
  await shot('house-7-inside')
  ok(errs.length === 0, `   0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
