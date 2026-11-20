// ── M54 COLUMNS check (hub 11-20) ─────────────────────────────────────────────────────────────────────────────────────────
// Real inputs: E at the table, Plan, the Column tool, Stucco, a click on a grid corner (projected through plan mode's own lens),
// Build, Paint a swatch + click the column, leave plan, walk into it, reload.
//   1. a tap plans a draft stucco column (nothing spent)  2. Build stands it for 3 Stucco (2 m of wall at 1.5)
//   3. Paint colours it  4. it is solid: walking at it stops at its face  5. a reload keeps it; 0 page errors
// SETUP (stated): bag = 40 goldwood planks, 10 stucco, no works.   npx tsx scripts/col-check.mts [--url ...] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import * as THREE from 'three'
import { TABLE, KEEP_CLEAR } from '../src/app/shimmer/open/ather/rooms'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/col-check')
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
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(PHONE ? { width: W, height: H, isMobile: true, hasTouch: true } : { width: W, height: H })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => {
    if (sessionStorage.getItem('colc')) return; sessionStorage.setItem('colc', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[8] = { id: 'goldwood_plank', n: 40 }; slots[9] = { id: 'stucco', n: 10 }
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
  // settled = the lens has stopped moving (yaw home). Not 'aimed at the spot': since 57a58263 view() reports the REAL aim, which the
  // Paint lift shifts toward the camera, so an exact-position test never settles with Paint on.
  const settled = () => poll(async () => { const a = await view(); await sleep(500); const b = await view(); return Math.hypot(a.x - b.x, a.z - b.z) < 0.02 && Math.abs(a.yaw) < 0.01 && Math.abs(a.h - b.h) < 0.05 }, 60000)
  const cols = () => p.evaluate(() => (JSON.parse(localStorage.getItem('open.works.v1') ?? '{}').cols ?? {}) as Record<string, { mat: string; tint?: string; draft?: boolean }>)
  const count = (id: string) => p.evaluate((id: string) => ((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{}').slots ?? []) as ({ id: string; n: number } | null)[]).reduce((t, s) => t + (s?.id === id ? s.n : 0), 0), id)
  const press = async (x: number, y: number) => { await p.evaluate((px: number, py: number) => { for (const e of document.elementsFromPoint(px, py)) { if (e.tagName === 'CANVAS') break; (e as HTMLElement).style.pointerEvents = 'none'; (e as HTMLElement).dataset.pe = '1' } }, x, y); await p.mouse.move(x, y); await p.mouse.down(); await sleep(120); await p.mouse.move(x + 1, y + 1); await p.mouse.up(); await p.evaluate(() => document.querySelectorAll<HTMLElement>('[data-pe]').forEach(e => { e.style.pointerEvents = ''; delete e.dataset.pe })) }
  const clickAt = async (wx: number, wz: number) => { await settled(); const v = await view(), s = screenOf(v, wx, wz); await press(s.x, s.y); await sleep(900) }
  const CX = spot.x, CZ = spot.z, K = `${CX},${CZ}`

  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500); await hideCard()
  await p.mouse.click(550, 340); await sleep(600)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, Math.PI / 4), TABLE.x + 1.6, TABLE.z + 1.6); await sleep(1500)
  await p.keyboard.press('e'); await sleep(1000); await tap('[data-act="plan"]')
  ok(await poll(() => p.evaluate(() => (window as any).__build?.on() === true)), 'E at the table, Plan: flying')
  await p.evaluate((x: number, z: number) => (window as any).__build.to(x, z, 0), CX, CZ)
  ok(await tap('[data-tool="column"]'), '1. the plan bar has a Column tool'); await sleep(400)
  ok(await tap('[data-wall-mat="stucco"]'), '   and offers the wall materials'); await sleep(300)
  const s0 = await count('stucco')
  await clickAt(CX + 0.1, CZ - 0.1)
  let c = await cols()
  ok(c[K]?.mat === 'stucco' && c[K]?.draft === true && (await count('stucco')) === s0, `   a tap on a corner plans a stucco column, nothing spent (${JSON.stringify(c)})`)
  ok(await poll(async () => p.evaluate(() => document.querySelector('[data-plan-bom]')?.getAttribute('data-ready') === 'true')), '   the list is met: Build is ready')
  ok(await tap('[data-act="build-plan"] button') && await poll(async () => { const x = await cols(); return !!x[K] && !x[K].draft }), '2. Build stands the column')
  ok(s0 - (await count('stucco')) === 3, `   it cost 2 m of stucco wall = 3 Stucco (${s0 - (await count('stucco'))})`)
  await shot('col-1-built')
  await tap('[data-tool="paint"]'); await sleep(300); await tap('[data-swatch="#4c6b97"]'); await sleep(200)
  // the Paint lift eases the lens for a while at SwiftShader frame rates: a click aimed mid-ease lands beside the column, so try
  // up to three times, re-reading the settled lens each time (the assert itself is unchanged)
  for (let t = 0; t < 3 && (await cols())[K]?.tint !== '#4c6b97'; t++) { await sleep(1500); await clickAt(CX, CZ) }
  c = await cols(); ok(c[K]?.tint === '#4c6b97', `3. a tap with Paint colours the stucco column (${JSON.stringify(c[K])})`)
  await shot('col-2-painted')
  // 4. solid: leave plan mode, walk at it from the south; the keeper stops short of its face
  await p.keyboard.press('Escape'); await sleep(1200)
  await p.mouse.click(550, 340); await sleep(400)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z, 0), CX, CZ + 2.5); await sleep(1500)
  await p.keyboard.down('KeyW'); await sleep(6000); await p.keyboard.up('KeyW'); await sleep(500)
  const st = await p.evaluate(() => { const a = (window as any).__ather.state(); return { x: a.px, z: a.pz } })
  ok(st.z > CZ + 0.3 + 0.2 && st.z < CZ + 2.4, `4. walking into it stops at its face (z ${st.z.toFixed(2)}, column face ${CZ + 0.3})`)
  try { await p.screenshot({ path: `${out}/col-3-walk.png` }) } catch { /* slow frame */ }
  // 5. reload keeps it
  await p.reload({ waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2000)
  c = await cols(); ok(c[K]?.mat === 'stucco' && c[K]?.tint === '#4c6b97' && !c[K]?.draft, '5. a reload keeps the painted column')
  ok(errs.length === 0, `   0 page errors ${errs.slice(0, 3).join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
