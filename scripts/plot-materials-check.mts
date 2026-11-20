// M37 slice 5 check (plot-materials-check): brick / stucco walls, paint rules, floor patterns. (header of plot-bom-check kept below)
// M37 slice 4 check (plot-bom-check): a drawn plan is a DRAFT with a bill of materials; Build needs it all.
//   1. draw a 5x4 room with a SHORT bag: 18 draft pieces, list = 38 goldwood planks + 20 stone bricks, have < need, Build disabled,
//      nothing spent, room not built (no floor / roof)
//   2. SETUP (stated): the test guest's own localStorage bag is topped up to the list, then reload: the draft survives, Build lights
//   3. Build: bag spent exactly, walls built (no draft), room built, list gone; reload keeps it
//   4. Erase one built piece: its plank comes back; erase the whole top wall: the room's floor planks + roof bricks come back too
//   5. grandfather: an old-format save (built walls, no draft, no paid) reloads built, no list; 0 page errors.
// The bag is the test guest's own (fresh browser context, localStorage); Alex's real items are never touched.
//   npx tsx scripts/plot-bom-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/plot-bom')
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
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'goldwood_plank', n: 40 }; slots[9] = { id: 'stone_brick', n: 34 }   /* M50: walls cost 1.5x; 34 keeps 10 left after the build (step 4 needs exactly 10) */; slots[10] = { id: 'stucco', n: 30 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.removeItem('open.works.v1')
  })
  const count = (id: string) => p.evaluate((i: string) => ((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []) as ({ id: string; n: number } | null)[]).reduce((t, s) => t + (s?.id === i ? s.n : 0), 0), id)
  const planks = () => count('goldwood_plank')
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

  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  ok(await enterPlan(), 'E at the table, Plan: flying')
  const pickMat = async (m: string) => { if (!(await p.evaluate(() => !!document.querySelector('[data-wall-mat]')))) { await tap('[data-tool="walls"]'); await sleep(300) } await p.evaluate((mm: string) => document.querySelector<HTMLElement>(`[data-wall-mat="${mm}"]`)?.click(), m); await sleep(300) }
  const works = () => p.evaluate(() => JSON.parse(localStorage.getItem('open.works.v1') ?? '{}'))
  // 1. a brick pair (top, bottom) and a stucco pair (sides)
  await pickMat('brick'); await dragW(X0, Z0, X1, Z0); await dragW(X0, Z1, X1, Z1)
  await pickMat('stucco'); await dragW(X0, Z0, X0, Z1); await dragW(X1, Z0, X1, Z1)
  // the plan bar can sit over the house at this zoom: let the pointer through it for this tap (the swatches themselves are DOM-clicked)
  const press = async (x: number, y: number) => { await p.evaluate((px: number, py: number) => { for (const e of document.elementsFromPoint(px, py)) { if (e.tagName === 'CANVAS') break; (e as HTMLElement).style.pointerEvents = 'none'; (e as HTMLElement).dataset.pe = '1' } }, x, y); await p.mouse.move(x, y); await p.mouse.down(); await sleep(120); await p.mouse.move(x + 1, y + 1); await p.mouse.up(); await p.evaluate(() => document.querySelectorAll<HTMLElement>('[data-pe]').forEach(e => { e.style.pointerEvents = ''; delete e.dataset.pe })) }
  const rpress = async (x: number, y: number) => { await p.evaluate((px: number, py: number) => { for (const e of document.elementsFromPoint(px, py)) { if (e.tagName === 'CANVAS') break; (e as HTMLElement).style.pointerEvents = 'none'; (e as HTMLElement).dataset.pe = '1' } }, x, y); await p.mouse.move(x, y); await p.mouse.down({ button: 'right' }); await sleep(120); await p.mouse.up({ button: 'right' }); await p.evaluate(() => document.querySelectorAll<HTMLElement>('[data-pe]').forEach(e => { e.style.pointerEvents = ''; delete e.dataset.pe })) }   // M53: a right-click, no drag
  const dc = (sel: string) => p.evaluate((x: string) => { document.querySelector<HTMLElement>(x)?.click() }, sel)
  const w1 = await walls(), s1 = await works(), b1 = await bom()
  const mats = Object.values(s1.walls ?? {}).map((x: any) => x.mat)
  ok(mats.filter((m: string) => m === 'brick').length === 8 && mats.filter((m: string) => m === 'stucco').length === 6, `1. 8 m of brick + 6 m of stucco drawn (${mats.length} pieces)`)
  ok(!!w1 && w1.rooms.length === 1 && w1.rooms[0].cells === 12, '   they close one 4x3 room')
  ok(!!b1 && b1.lines.stone_brick?.need === 24 && b1.lines.stucco?.need === 9 && b1.lines.goldwood_plank?.need === 12, `   the list asks for bricks + stucco: 24 Stone Brick (8 wall x 1.5 [M50] + 12 roof), 9 Stucco (6 x 1.5), 12 planks (${JSON.stringify(b1?.lines)})`)
  ok(!!b1 && b1.ready && !b1.disabled, '   Build is lit (bag holds it)')
  await shot('mat-1-plan')
  // 2. Build spends them
  ok(await tap('[data-act="build-plan"] button'), '2. tap Build')
  ok(await poll(async () => (await draftCount()).draft === 0 && (await draftCount()).paid === 1), '   walls stand, room paid')
  ok((await count('stone_brick')) === 10 && (await count('stucco')) === 21 && (await planks()) === 28, `   spent exactly: bricks 34->${await count('stone_brick')}, stucco 30->${await count('stucco')}, planks 40->${await planks()}`)
  await shot('mat-2-built')
  // 3. paint: stucco takes it, brick refuses
  await dc('[data-tool="paint"]'); await sleep(300)
  await dc('[data-swatch="#4c6b97"]'); await sleep(200)
  const sk = `v,${X0},${Z0}`, bk = `h,${X0 + 1},${Z0}`
  await settled(); let v = await view(); let sc = screenOf(v, X0, Z0 + 0.5)
  await press(sc.x, sc.y); await sleep(700)
  let s3 = await works(); ok(s3.walls[sk]?.tint === '#4c6b97' && s3.walls[sk]?.mat === 'stucco', `3. painting a stucco wall changes its colour (${JSON.stringify(s3.walls[sk])})`)
  sc = screenOf(v, X0 + 1.5, Z0); await press(sc.x, sc.y); await sleep(700)
  s3 = await works(); ok(!s3.walls[bk]?.tint && s3.walls[bk]?.mat === 'brick' && (await count('stone_brick')) === 10, '   painting the brick wall is refused (no tint, nothing spent)')
  await shot('mat-3-painted')
  // 3b. M53: a RIGHT-CLICK paints every connected stucco piece: the whole left side (3 m), but not the right side (the brick runs between)
  await dc('[data-swatch="#8fae7a"]'); await sleep(200)
  sc = screenOf(v, X0, Z0 + 1.5); await rpress(sc.x, sc.y); await sleep(700)
  { const s = await works(), left = [0, 1, 2].map(d => s.walls[`v,${X0},${Z0 + d}`]?.tint), right = [0, 1, 2].map(d => s.walls[`v,${X1},${Z0 + d}`]?.tint)
    ok(left.every(t => t === '#8fae7a') && right.every(t => t !== '#8fae7a'), `3b. right-click paints the connected stucco side, stops at brick (left ${left}, right ${right})`) }
  await shot('mat-3b-connected')
  // put the left side back to the tapped colour so the reload leg below reads as before
  await dc('[data-swatch="#4c6b97"]'); await sleep(200); await rpress(sc.x, sc.y); await sleep(700)
  // 4. floors: herringbone, painted; tile is refused for want of bricks (needs 12, has 10)
  await dc('[data-floor-pat="herringbone"]'); await sleep(200); await dc('[data-swatch="#e3b94f"]'); await sleep(200)
  sc = screenOf(v, X0 + 2, Z0 + 1.5); await press(sc.x, sc.y); await sleep(700)
  let s4 = await works(), cells = Object.values(s4.floors ?? {}) as any[]
  ok(cells.length === 12 && cells.every(f => f.pat === 'herringbone' && f.col === '#e3b94f'), `4. a herringbone floor, painted gold, over all 12 cells (${cells.length})`)
  ok((await planks()) === 28, '   wood pattern on a wood floor: free swap (planks unchanged)')
  await dc('[data-floor-pat="tile"]'); await sleep(200)
  sc = screenOf(v, X0 + 2, Z0 + 1.5); await press(sc.x, sc.y); await sleep(700)
  s4 = await works(); cells = Object.values(s4.floors ?? {}) as any[]
  ok(cells.every(f => f.pat === 'herringbone') && (await count('stone_brick')) === 10, '   a tile floor needs 12 bricks, has 10: refused, nothing spent')
  await dc('[data-floor-pat="herringbone"]'); await sleep(200); await dc('[data-swatch="#8fae7a"]'); await sleep(200)
  sc = screenOf(v, X0 + 2, Z0 + 1.5); await press(sc.x, sc.y); await sleep(700)
  s4 = await works(); ok((Object.values(s4.floors ?? {}) as any[]).every(f => f.col === '#8fae7a'), '   repainting the floor colour is free and takes any swatch')
  await shot('mat-4-floor')
  // 5. reload keeps all of it
  await p.reload({ waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  const s5 = await works()
  ok(s5.walls[sk]?.tint === '#4c6b97' && s5.walls[bk]?.mat === 'brick' && Object.values(s5.floors ?? {}).length === 12 && (Object.values(s5.floors) as any[])[0].pat === 'herringbone', '5. a reload keeps the brick wall, the painted stucco and the painted herringbone floor')
  ok(await poll(async () => { const w = await walls(); return !!w && w.rooms.length === 1 && w.rooms[0].built }, 30000), '   the room still stands built')
  await shot('mat-5-reload')
  ok(errs.length === 0, `   0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
